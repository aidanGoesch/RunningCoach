import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { getActivityDetails, getActivityStreams, generateInsights } from '../services/api';
import { getActivityInsights, saveActivityInsights, saveActivityRating, getActivityRating } from '../services/supabase';
import { useSwipeBack } from '../hooks/useSwipeBack';

// Utility function for smoothing data using moving average
const smoothData = (data, windowSize = 4) => {
  if (!data || data.length === 0) return data;
  if (data.length < windowSize) return data;
  
  const smoothed = [];
  const halfWindow = Math.floor(windowSize / 2);
  
  for (let i = 0; i < data.length; i++) {
    let sum = 0;
    let count = 0;
    
    // Use available points within window
    for (let j = Math.max(0, i - halfWindow); j <= Math.min(data.length - 1, i + halfWindow); j++) {
      sum += data[j];
      count++;
    }
    
    smoothed.push(sum / count);
  }
  
  return smoothed;
};

// Utility function to calculate nice axis intervals
const calculateNiceIntervals = (min, max, numIntervals = 4) => {
  const range = max - min;
  if (range === 0) return { min, max, step: 1, intervals: [min] };
  
  // Calculate rough step
  const roughStep = range / numIntervals;
  
  // Find the order of magnitude
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  
  // Normalize the rough step
  const normalizedStep = roughStep / magnitude;
  
  // Round to nearest nice number (1, 2, 5, 10, 20, 50, etc.)
  let niceStep;
  if (normalizedStep <= 1) {
    niceStep = 1;
  } else if (normalizedStep <= 2) {
    niceStep = 2;
  } else if (normalizedStep <= 5) {
    niceStep = 5;
  } else {
    niceStep = 10;
  }
  
  niceStep = niceStep * magnitude;
  
  // Calculate nice min and max
  const niceMin = Math.floor(min / niceStep) * niceStep;
  const niceMax = Math.ceil(max / niceStep) * niceStep;
  
  // Generate intervals
  const intervals = [];
  for (let i = niceMin; i <= niceMax; i += niceStep) {
    intervals.push(i);
  }
  
  return {
    min: niceMin,
    max: niceMax,
    step: niceStep,
    intervals
  };
};

const ActivityDetail = ({ activityId, onBack }) => {
  const swipeBackRef = useSwipeBack(onBack);
  const [activity, setActivity] = useState(null);
  const [streams, setStreams] = useState(null);
  const [insights, setInsights] = useState(null);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [rating, setRating] = useState(null);
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [ratingValue, setRatingValue] = useState(null);
  const [ratingComment, setRatingComment] = useState('');
  const [isInjured, setIsInjured] = useState(false);
  const [injuryDetails, setInjuryDetails] = useState('');
  const [savingRating, setSavingRating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchActivityData = async () => {
      console.log('=== Starting fetchActivityData for activityId:', activityId, '===');
      
      // Try to get token from Supabase first, then localStorage
      const { getStravaTokens } = await import('../services/supabase');
      const tokens = await getStravaTokens();
      const token = tokens?.accessToken || localStorage.getItem('strava_access_token');
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY || localStorage.getItem('openai_api_key');
      
      console.log('Token exists:', !!token);
      console.log('API key exists:', !!apiKey);
      
      if (!token) {
        console.log('No Strava token found, redirecting to Strava authentication...');
        // Automatically redirect to Strava authentication
        const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID;
        
        // Use web redirect URI (Strava doesn't support custom URL schemes)
        // For mobile, we'll intercept the web redirect
        const STRAVA_REDIRECT_URI = window.location.hostname === 'localhost'
          ? 'http://localhost:5173/strava-callback'
          : 'https://aidangoesch.github.io/RunningCoach/strava-callback.html';
        
        const authUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(STRAVA_REDIRECT_URI)}&approval_prompt=force&scope=read,activity:read`;
        // Store the current activity ID so we can return to it after auth
        sessionStorage.setItem('pending_activity_id', activityId);
        
        // Use Capacitor Browser plugin for mobile apps, fallback to window.location for web
        if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
          try {
            const { Browser } = await import('@capacitor/browser');
            await Browser.open({
              url: authUrl,
              windowName: '_self'
            });
          } catch (err) {
            console.error('Failed to open Browser, falling back to window.location:', err);
            window.location.href = authUrl;
          }
        } else {
          window.location.href = authUrl;
        }
        return;
      }

      // Check cache first
      const cacheKey = `activity_detail_${activityId}`;
      const cachedData = localStorage.getItem(cacheKey);
      
      if (cachedData) {
        try {
          const { activity: activityData, streams: streamData, timestamp } = JSON.parse(cachedData);
          
          // Use cached data if it's less than 1 hour old
          const oneHour = 60 * 60 * 1000;
          if (Date.now() - timestamp < oneHour) {
            console.log('Using cached activity data for', activityId);
            setActivity(activityData);
            setStreams(streamData);
            
            // Get rating for this activity
            const activityRating = await getActivityRating(activityId);
            setRating(activityRating);
            
            // Only check for cached insights, don't generate new ones
            console.log('Checking for cached insights for', activityId);
            const cachedInsights = await getActivityInsights(activityId);
            if (cachedInsights) {
              console.log('Found cached insights for', activityId);
              // Ensure cached insights are strings
              const insightsText = typeof cachedInsights === 'string' 
                ? cachedInsights 
                : cachedInsights?.insights || cachedInsights?.content || JSON.stringify(cachedInsights);
              setInsights(insightsText);
            } else {
              console.log('No cached insights found for', activityId);
            }
            
            setLoading(false);
            return;
          }
        } catch (err) {
          console.error('Error parsing cached data:', err);
        }
      }

      // Fetch fresh data if no cache or cache expired
      try {
        console.log('Fetching fresh activity data for', activityId);
        const [activityData, streamData] = await Promise.all([
          getActivityDetails(token, activityId),
          getActivityStreams(token, activityId)
        ]);
        
        // Cache the data
        const cacheData = {
          activity: activityData,
          streams: streamData,
          timestamp: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        
        setActivity(activityData);
        setStreams(streamData);
        
        // Get rating for this activity
        const activityRating = await getActivityRating(activityId);
        setRating(activityRating);
        
        // Only check for cached insights, don't generate new ones
        console.log('Checking for cached insights for', activityId);
        const cachedInsights = await getActivityInsights(activityId);
        if (cachedInsights) {
          console.log('Found cached insights for', activityId);
          // Ensure cached insights are strings
          const insightsText = typeof cachedInsights === 'string' 
            ? cachedInsights 
            : cachedInsights?.insights || cachedInsights?.content || JSON.stringify(cachedInsights);
          setInsights(insightsText);
        } else {
          console.log('No cached insights found for', activityId);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchActivityData();
  }, [activityId]);

  const handleGenerateInsights = async () => {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY || localStorage.getItem('openai_api_key');
    
    if (!apiKey || !activity) return;
    
    setGeneratingInsights(true);
    try {
      console.log('Manually generating insights for', activityId);
      const activityRating = await getActivityRating(activityId);
      
      const insightsPromise = generateInsights(apiKey, [activity], streams, activityRating);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Insights timeout')), 30000) // Increased to 30 seconds
      );
      
      const activityInsights = await Promise.race([insightsPromise, timeoutPromise]);
      
      // Extract the insights text from the response
      const insightsText = typeof activityInsights === 'string' 
        ? activityInsights 
        : activityInsights?.insights || activityInsights?.content || JSON.stringify(activityInsights);
      
      setInsights(insightsText);
      await saveActivityInsights(activityId, insightsText);
      console.log('Insights generated and saved');
    } catch (err) {
      console.error('Failed to generate insights:', err);
      // Don't show error to user, just log it and reset the button
    } finally {
      setGeneratingInsights(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-color)',
        zIndex: 9999
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid var(--border-color)',
          borderTop: '4px solid var(--accent)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '16px'
        }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>Loading...</p>
      </div>
    );
  }
  if (error) return <div className="error">Error: {error}</div>;
  if (!activity) return <div className="error">Activity not found</div>;

  return (
    <div className="app" ref={swipeBackRef}>
      <div className="header">
        <h1>{activity.name}</h1>
        <p>{new Date(activity.start_date).toLocaleDateString()}</p>
      </div>

      {/* Map */}
      <div style={{ marginBottom: '20px' }}>
        <ActivityMap activity={activity} streams={streams} />
      </div>
      
      {/* Stats */}
      <div className="workout-display" style={{ marginBottom: '20px' }}>
        <div className="workout-title">Activity Stats</div>
        <div className="workout-block">
          <div className="block-details">
            <div className="detail-item">
              <span className="detail-label">Distance</span>
              <span className="detail-value">{(activity.distance / 1609.34).toFixed(2)} mi</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Duration</span>
              <span className="detail-value">{Math.floor(activity.moving_time / 60)}:{(activity.moving_time % 60).toString().padStart(2, '0')}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Avg Pace</span>
              <span className="detail-value">{formatPace(activity.average_speed)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Elevation</span>
              <span className="detail-value">{Math.round(activity.total_elevation_gain * 3.28084)} ft</span>
            </div>
            {activity.average_heartrate && (
              <div className="detail-item">
                <span className="detail-label">Avg HR</span>
                <span className="detail-value">{Math.round(activity.average_heartrate)} bpm</span>
              </div>
            )}
            {activity.average_cadence && (
              <div className="detail-item">
                <span className="detail-label">Avg Cadence</span>
                <span className="detail-value">{Math.round(activity.average_cadence * 2)} spm</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activity Rating */}
      {rating && !showRatingForm ? (
        <div className="workout-display" style={{ marginBottom: '20px' }}>
          <div className="workout-title">📝 Your Rating</div>
          <div className="workout-block">
            <div className="block-details">
              <div className="detail-item">
                <span className="detail-label">Rating</span>
                <span className="detail-value">
                  {rating.rating === 1 ? '😊' : 
                   rating.rating === 2 ? '🙂' : 
                   rating.rating === 3 ? '😐' : 
                   rating.rating === 4 ? '😓' : '😫'} 
                  ({rating.rating === 1 ? 'Too easy' : 
                    rating.rating === 2 ? 'Easy' : 
                    rating.rating === 3 ? 'Perfect' : 
                    rating.rating === 4 ? 'Hard' : 'Too hard'})
                </span>
              </div>
              {rating.feedback && (
                <div className="detail-item">
                  <span className="detail-label">Comment</span>
                  <span className="detail-value">{rating.feedback}</span>
                </div>
              )}
              {rating.isInjured && (
                <div className="detail-item">
                  <span className="detail-label">Injury</span>
                  <span className="detail-value">⚠️ {rating.injuryDetails || 'Reported'}</span>
                </div>
              )}
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setShowRatingForm(true);
                setRatingValue(rating.rating);
                setRatingComment(rating.feedback || '');
                setIsInjured(rating.isInjured || false);
                setInjuryDetails(rating.injuryDetails || '');
              }}
              style={{ marginTop: '10px', width: '100%' }}
            >
              Edit Rating
            </button>
          </div>
        </div>
      ) : showRatingForm ? (
        <div className="workout-display" style={{ marginBottom: '20px' }}>
          <div className="workout-title">📝 Rate This Activity</div>
          <div className="workout-block">
            <div className="block-title">How was this run?</div>
            
            {/* Rating */}
            <div style={{ marginBottom: '20px' }}>
              <div className="detail-label" style={{ marginBottom: '10px' }}>Rate this activity:</div>
              <div style={{ display: 'flex', gap: '10px' }}>
                {[
                  { value: 1, emoji: '😊', label: 'Too easy' },
                  { value: 2, emoji: '🙂', label: 'Easy' },
                  { value: 3, emoji: '😐', label: 'Perfect' },
                  { value: 4, emoji: '😓', label: 'Hard' },
                  { value: 5, emoji: '😫', label: 'Too hard' }
                ].map(({ value, emoji, label }) => (
                  <button
                    key={value}
                    onClick={() => setRatingValue(value)}
                    style={{
                      background: ratingValue === value ? 'var(--accent)' : 'var(--grid-color)',
                      border: ratingValue === value ? '2px solid var(--accent)' : '2px solid transparent',
                      borderRadius: '12px',
                      fontSize: '32px',
                      cursor: 'pointer',
                      padding: '10px',
                      transition: 'all 0.2s ease',
                      transform: ratingValue === value ? 'scale(1.15)' : 'scale(1)',
                      boxShadow: ratingValue === value ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      minWidth: '50px'
                    }}
                    onMouseEnter={(e) => {
                      if (ratingValue !== value) {
                        e.currentTarget.style.transform = 'scale(1.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (ratingValue !== value) {
                        e.currentTarget.style.transform = 'scale(1)';
                      }
                    }}
                    title={label}
                  >
                    <span>{emoji}</span>
                    {ratingValue === value && (
                      <span style={{ fontSize: '9px', color: 'white', fontWeight: '600' }}>
                        {label}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '5px' }}>
                Click an emoji to rate this activity
              </div>
            </div>

            {/* Comment */}
            <div style={{ marginBottom: '20px' }}>
              <div className="detail-label" style={{ marginBottom: '8px' }}>Comments (optional):</div>
              <textarea
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="How did this run feel? Any notes..."
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  fontSize: '14px',
                  minHeight: '60px',
                  backgroundColor: 'var(--card-bg)',
                  color: 'var(--text-color)'
                }}
              />
            </div>

            {/* Injury Status */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isInjured}
                  onChange={(e) => setIsInjured(e.target.checked)}
                />
                <span className="detail-label">I'm currently injured or experiencing pain</span>
              </label>
              
              {isInjured && (
                <textarea
                  value={injuryDetails}
                  onChange={(e) => setInjuryDetails(e.target.value)}
                  placeholder="Describe your injury or pain (e.g., 'knee pain', 'shin splints', 'general fatigue')"
                  style={{
                    width: '100%',
                    marginTop: '10px',
                    padding: '8px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    fontSize: '14px',
                    minHeight: '60px',
                    backgroundColor: 'var(--card-bg)',
                    color: 'var(--text-color)'
                  }}
                />
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  if (!ratingValue) {
                    alert('Please select a rating');
                    return;
                  }
                  setSavingRating(true);
                  try {
                    await saveActivityRating(activity.id, ratingValue, ratingComment, isInjured, injuryDetails);
                    const updatedRating = await getActivityRating(activity.id);
                    setRating(updatedRating);
                    setShowRatingForm(false);
                    setRatingValue(null);
                    setRatingComment('');
                    setIsInjured(false);
                    setInjuryDetails('');
                  } catch (error) {
                    console.error('Error saving rating:', error);
                    alert('Failed to save rating');
                  } finally {
                    setSavingRating(false);
                  }
                }}
                disabled={savingRating}
                style={{ flex: 1 }}
              >
                {savingRating ? 'Saving...' : 'Save Rating'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowRatingForm(false);
                  setRatingValue(null);
                  setRatingComment('');
                  setIsInjured(false);
                  setInjuryDetails('');
                }}
                disabled={savingRating}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="workout-display" style={{ marginBottom: '20px' }}>
          <div className="workout-title">📝 Rate This Activity</div>
          <div className="workout-block">
            <button
              className="btn btn-primary"
              onClick={() => setShowRatingForm(true)}
              style={{ width: '100%' }}
            >
              Rate This Activity
            </button>
          </div>
        </div>
      )}

      {/* AI Insights */}
      <div className="workout-display" style={{ marginBottom: '20px' }}>
        <div className="workout-title">AI Insights</div>
        {insights ? (
          <div
            className="workout-block"
            data-ai-insights-panel="true"
            style={{
              height: 'var(--chart-height)',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              paddingRight: '12px'
            }}
          >
            {insights === '[object Object]' || insights.includes('[object Object]') ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <div style={{ color: 'var(--text-secondary)', marginBottom: '15px' }}>
                  Insights data corrupted. Click to regenerate:
                </div>
                <button 
                  className="btn btn-primary"
                  onClick={handleGenerateInsights}
                  disabled={generatingInsights}
                  style={{ fontSize: '14px', padding: '10px 20px' }}
                >
                  {generatingInsights ? 'Generating Insights...' : 'Regenerate Insights'}
                </button>
              </div>
            ) : (
              <ReactMarkdown 
                style={{ 
                  whiteSpace: 'normal', 
                  lineHeight: '1.6',
                  color: 'var(--text-color)',
                  paddingBottom: '8px'
                }}
              >
                {insights}
              </ReactMarkdown>
            )}
          </div>
        ) : (
          <div
            className="workout-block"
            style={{ 
              backgroundColor: '#000', 
              color: '#888', 
              textAlign: 'center', 
              padding: '40px 20px',
              cursor: generatingInsights ? 'default' : 'pointer',
              border: '1px solid #333',
              position: 'relative',
              height: 'var(--chart-height)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          onClick={generatingInsights ? undefined : handleGenerateInsights}>
            {generatingInsights ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  border: '2px solid #333',
                  borderTop: '2px solid #888',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                Generating insights...
              </div>
            ) : (
              'Click to generate insights'
            )}
          </div>
        )}
      </div>

      {/* Charts */}
      <ActivityCharts streams={streams} />
    </div>
  );
};

const ActivityMap = ({ activity, streams }) => {
  const mapId = `map-${activity.id}`;
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  
  useEffect(() => {
    if (!streams?.latlng?.data || streams.latlng.data.length === 0) return;

    // Create map
    const map = L.map(mapId).setView(streams.latlng.data[0], 13);
    mapRef.current = map;

    // Add route polyline - blue color
    const polyline = L.polyline(streams.latlng.data, { color: '#3b82f6', weight: 4 }).addTo(map);
    map.fitBounds(polyline.getBounds());

    // Function to update tile layer based on theme
    const updateTileLayer = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      
      // Remove existing tile layer
      if (tileLayerRef.current) {
        map.removeLayer(tileLayerRef.current);
      }

      // Add appropriate tile layer based on theme
      if (theme === 'dark') {
        // Dark Matter tiles for dark mode
        tileLayerRef.current = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '© OpenStreetMap contributors © CARTO',
          subdomains: 'abcd',
          maxZoom: 19
        }).addTo(map);
      } else {
        // Light tiles for light mode
        tileLayerRef.current = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          attribution: '© OpenStreetMap contributors © CARTO',
          subdomains: 'abcd',
          maxZoom: 19
        }).addTo(map);
      }
    };

    // Set initial tile layer
    updateTileLayer();

    // Watch for theme changes
    const observer = new MutationObserver(updateTileLayer);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    mapRef.current._themeObserver = observer;

    return () => {
      if (mapRef.current._themeObserver) {
        mapRef.current._themeObserver.disconnect();
      }
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
    };
  }, [streams, mapId]);

  if (!streams?.latlng?.data) {
    return (
      <div className="workout-display">
        <div className="workout-title">Route Map</div>
        <div style={{ padding: '40px', textAlign: 'center', color: '#7f8c8d' }}>
          No GPS data available for this activity
        </div>
      </div>
    );
  }

  return (
    <div className="workout-display">
      <div className="workout-title">Route Map</div>
      <div id={mapId} style={{ height: '300px', borderRadius: '8px' }}></div>
    </div>
  );
};

const ActivityCharts = ({ streams }) => {
  const [xAxisMode, setXAxisMode] = useState('time');
  
  if (!streams) return null;

  return (
    <>
      {/* X-Axis Toggle */}
      <div style={{ 
        marginBottom: '20px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        gap: '20px',
        padding: '12px',
        backgroundColor: 'var(--card-bg)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)'
      }}>
        <span style={{ 
          fontSize: '14px', 
          fontWeight: '500', 
          color: xAxisMode === 'time' ? 'var(--accent)' : 'var(--text-secondary)',
          transition: 'color 0.2s ease',
          cursor: 'pointer',
          userSelect: 'none'
        }}
        onClick={() => setXAxisMode('time')}
        >
          Time
        </span>
        <div
          onClick={() => setXAxisMode(xAxisMode === 'time' ? 'distance' : 'time')}
          style={{
            position: 'relative',
            width: '50px',
            height: '26px',
            backgroundColor: xAxisMode === 'distance' ? 'var(--accent)' : 'var(--grid-color)',
            borderRadius: '13px',
            cursor: 'pointer',
            transition: 'background-color 0.2s ease',
            border: '2px solid var(--border-color)'
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '2px',
              left: xAxisMode === 'distance' ? '24px' : '2px',
              width: '18px',
              height: '18px',
              backgroundColor: 'white',
              borderRadius: '50%',
              transition: 'left 0.2s ease',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
          />
        </div>
        <span style={{ 
          fontSize: '14px', 
          fontWeight: '500', 
          color: xAxisMode === 'distance' ? 'var(--accent)' : 'var(--text-secondary)',
          transition: 'color 0.2s ease',
          cursor: 'pointer',
          userSelect: 'none'
        }}
        onClick={() => setXAxisMode('distance')}
        >
          Distance
        </span>
      </div>

      {streams.heartrate && (
        <div style={{ marginBottom: '20px' }}>
          <HeartRateChart data={streams} xAxisMode={xAxisMode} />
        </div>
      )}
      {streams.velocity_smooth && (
        <div style={{ marginBottom: '20px' }}>
          <PaceChart data={streams} xAxisMode={xAxisMode} />
        </div>
      )}
      {streams.distance && streams.time && (
        <div style={{ marginBottom: '20px' }}>
          <MileSplitPaceBarChart data={streams} />
        </div>
      )}
      {streams.cadence && (
        <div style={{ marginBottom: '20px' }}>
          <CadenceChart data={streams} xAxisMode={xAxisMode} />
        </div>
      )}
    </>
  );
};

const MileSplitPaceBarChart = ({ data }) => {
  const canvasRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  const computeMileSplits = () => {
    const distanceM = data.distance?.data;
    const timeS = data.time?.data;
    if (!distanceM || !timeS || distanceM.length === 0 || timeS.length === 0) return [];

    const miles = distanceM.map((d) => d / 1609.34);
    const maxMiles = miles[miles.length - 1];
    const mileCount = Math.floor(maxMiles);
    if (mileCount <= 0) return [];

    // Linear interpolation helper for time at a target mile.
    const timeAtMile = (targetMile) => {
      // Find first index where miles[i] >= targetMile
      let i = 0;
      while (i < miles.length && miles[i] < targetMile) i++;
      if (i <= 0) return timeS[0];
      if (i >= miles.length) return timeS[timeS.length - 1];

      const m0 = miles[i - 1];
      const m1 = miles[i];
      const t0 = timeS[i - 1];
      const t1 = timeS[i];
      if (m1 === m0) return t1;
      const frac = (targetMile - m0) / (m1 - m0);
      return t0 + frac * (t1 - t0);
    };

    const splits = [];
    for (let mile = 1; mile <= mileCount; mile++) {
      const startMile = mile - 1;
      const endMile = mile;
      const tStart = timeAtMile(startMile);
      const tEnd = timeAtMile(endMile);
      const durationS = Math.max(0, tEnd - tStart);
      const paceMinPerMile = durationS / 60; // exactly 1 mile
      splits.push({
        label: String(mile),
        distanceMi: 1,
        pace: paceMinPerMile
      });
    }

    // Add final partial split (remainder), if any (e.g. last 0.32 mi)
    const remainderMi = maxMiles - mileCount;
    if (remainderMi >= 0.05) {
      const tStart = timeAtMile(mileCount);
      const tEnd = timeAtMile(maxMiles);
      const durationS = Math.max(0, tEnd - tStart);
      const paceMinPerMile = remainderMi > 0 ? (durationS / 60) / remainderMi : 0;
      splits.push({
        label: remainderMi.toFixed(2),
        distanceMi: remainderMi,
        pace: paceMinPerMile
      });
    }
    return splits;
  };

  const formatPaceLabel = (paceMin) => {
    if (!Number.isFinite(paceMin) || paceMin <= 0) return '--:--';
    const mins = Math.floor(paceMin);
    const secs = Math.round((paceMin - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const splits = computeMileSplits();
    if (splits.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const paddingLeft = 80;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;
    const height = rect.height || 250;
    const plotHeight = height - paddingTop - paddingBottom;
    const rowHeight = plotHeight / splits.length;

    // Only show tooltip inside plot area
    if (x < paddingLeft || x > rect.width - paddingRight || y < paddingTop || y > height - paddingBottom) {
      setTooltip(null);
      return;
    }

    const idx = Math.floor((y - paddingTop) / rowHeight);
    if (idx < 0 || idx >= splits.length) {
      setTooltip(null);
      return;
    }

    const s = splits[idx];
    setTooltip({
      x: e.clientX,
      y: e.clientY - 80,
      text: `${idx === splits.length - 1 && s.distanceMi < 1 ? `${s.distanceMi.toFixed(2)} mi` : `Mile ${s.label}`}: ${formatPaceLabel(s.pace)}/mi`
    });
  };

  const handleMouseLeave = () => setTooltip(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const splits = computeMileSplits();
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const cssWidth = rect.width || 0;
    const cssHeight = rect.height || 250;
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const width = cssWidth;
    const height = cssHeight;

    ctx.clearRect(0, 0, width, height);

    if (splits.length === 0) {
      ctx.fillStyle = 'var(--text-secondary)';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Not enough distance data for mile splits', width / 2, height / 2);
      return;
    }

    // First mile should be on top, last mile on bottom (natural order).
    // Bar length: further right = faster -> use speed (1/pace) normalization.
    const speeds = splits.map((s) => (s.pace > 0 ? 1 / s.pace : 0)).filter((v) => v > 0);
    const minSpeed = Math.min(...speeds);
    const maxSpeed = Math.max(...speeds);

    const paddingLeft = 80;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;
    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;
    const rowHeight = plotHeight / splits.length;
    const barGap = Math.min(8, rowHeight * 0.25);
    const barHeight = Math.max(6, rowHeight - barGap);
    const minBarLen = Math.max(8, plotWidth * 0.06); // ensure even slowest mile has a visible bar

    // Axes
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--axis-color').trim();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, paddingTop);
    ctx.lineTo(paddingLeft, height - paddingBottom);
    ctx.lineTo(width - paddingRight, height - paddingBottom);
    ctx.stroke();

    // Y-axis label
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--label-color').trim();
    ctx.font = '12px sans-serif';
    ctx.save();
    ctx.translate(18, paddingTop + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Mile', 0, 0);
    ctx.restore();

    // Bars + labels
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--label-color').trim();

    splits.forEach((s, idx) => {
      const speed = s.pace > 0 ? 1 / s.pace : 0;
      const norm = maxSpeed === minSpeed ? 0.7 : (speed - minSpeed) / (maxSpeed - minSpeed);
      const barLen = minBarLen + norm * (plotWidth - minBarLen);

      const yTop = paddingTop + idx * rowHeight + (rowHeight - barHeight) / 2;
      const yMid = yTop + barHeight / 2;

      // Mile label on left
      ctx.fillText(`${s.label}`, paddingLeft - 10, yMid + 4);

      // Bar
      ctx.fillStyle = '#3498db';
      ctx.fillRect(paddingLeft, yTop, barLen, barHeight);

      // Pace label at end of bar
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim();
      ctx.textAlign = 'left';
      ctx.fillText(`${formatPaceLabel(s.pace)}`, Math.min(width - paddingRight - 50, paddingLeft + barLen + 8), yMid + 4);

      // Reset for next left label
      ctx.textAlign = 'right';
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--label-color').trim();
    });

    // X-axis label
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--label-color').trim();
    ctx.textAlign = 'center';
    ctx.fillText('Faster →', paddingLeft + plotWidth / 2, height - 8);
  }, [data]);

  return (
    <div className="workout-display">
      <div className="workout-title">Mile Splits (Pace)</div>
      <div style={{ position: 'relative' }}>
        <canvas
          className="mobile-wide-chart"
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onTouchMove={(e) => {
            e.preventDefault();
            const touch = e.touches[0];
            handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
          }}
          onTouchEnd={handleMouseLeave}
          style={{ width: '100%', height: 'var(--splits-chart-height, var(--chart-height))', borderRadius: '8px', cursor: 'crosshair' }}
        />
        {tooltip && (
          <div
            style={{
              position: 'fixed',
              left: tooltip.x,
              top: tooltip.y,
              background: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '12px',
              color: 'var(--text-color)',
              pointerEvents: 'none',
              zIndex: 1000,
              boxShadow: '0 2px 8px var(--shadow)'
            }}
          >
            {tooltip.text}
          </div>
        )}
      </div>
    </div>
  );
};

const HeartRateChart = ({ data, xAxisMode = 'time' }) => {
  const canvasRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [cursorX, setCursorX] = useState(null);
  
  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !data.heartrate?.data) return;
    if (xAxisMode === 'time' && !data.time?.data) return;
    if (xAxisMode === 'distance' && !data.distance?.data) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const padding = 60;
    const width = rect.width;
    
    // Only show tooltip and cursor within the graph area
    if (x < padding || x > width - padding) {
      setTooltip(null);
      setCursorX(null);
      return;
    }
    
    // Calculate which data point based on X position
    const dataWidth = width - 2 * padding;
    const adjustedX = x - padding;
    const progress = adjustedX / dataWidth;
    const dataIndex = Math.round(progress * (data.heartrate.data.length - 1));
    
    if (dataIndex >= 0 && dataIndex < data.heartrate.data.length) {
      const hr = Math.round(data.heartrate.data[dataIndex]);
      let xAxisValue = '';
      if (xAxisMode === 'time' && data.time?.data) {
        const time = Math.round(data.time.data[dataIndex] / 60);
        xAxisValue = `${time} min`;
      } else if (xAxisMode === 'distance' && data.distance?.data) {
        const distance = (data.distance.data[dataIndex] / 1609.34).toFixed(2);
        xAxisValue = `${distance} mi`;
      }
      
      setTooltip({
        x: e.clientX,
        y: e.clientY - 80,
        text: `${hr} bpm${xAxisValue ? ` • ${xAxisValue}` : ''}`
      });
      
      setCursorX(x);
    }
  };
  
  const handleMouseLeave = () => {
    setTooltip(null);
    setCursorX(null);
  };
  
  useEffect(() => {
    if (!data.heartrate?.data) return;
    if (xAxisMode === 'time' && !data.time?.data) return;
    if (xAxisMode === 'distance' && !data.distance?.data) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    const cssWidth = rect.width || 0;
    const cssHeight = rect.height || 250;
    
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    
    const width = cssWidth;
    const height = cssHeight;
    const padding = 60;
    
    ctx.clearRect(0, 0, width, height);
    
    // Apply smoothing to heart rate data
    const hrData = smoothData(data.heartrate.data, 4);
    
    // Get x-axis data based on mode
    let xAxisData;
    if (xAxisMode === 'distance' && data.distance?.data) {
      xAxisData = data.distance.data.map(d => d / 1609.34); // Convert meters to miles
    } else {
      xAxisData = data.time.data.map(t => t / 60); // Convert seconds to minutes
    }
    
    // Calculate actual data ranges (for positioning the line)
    const maxHR = Math.max(...hrData);
    const minHR = Math.min(...hrData);
    const maxX = Math.max(...xAxisData);
    const minX = Math.min(...xAxisData);
    
    // Calculate intervals for heart rate (increments of 10, max > maxHR with extra bar)
    const hrStep = 10;
    const hrMin = Math.floor(minHR / hrStep) * hrStep;
    // Round up to next multiple of 10, then add one more step for extra bar
    const hrMax = Math.ceil((maxHR + hrStep) / hrStep) * hrStep;
    const hrIntervals = [];
    for (let i = hrMin; i <= hrMax; i += hrStep) {
      hrIntervals.push(i);
    }
    
    // Calculate nice intervals for X-axis labels, but filter to only show those within data range
    const xIntervals = calculateNiceIntervals(minX, maxX, 4);
    const xIntervalsInRange = xIntervals.intervals.filter(x => x >= minX && x <= maxX);
    
    // Draw axes
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--axis-color').trim();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
    
    // Draw horizontal grid lines for HR chart
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid-color').trim();
    ctx.lineWidth = 1;
    hrIntervals.forEach((hrValue) => {
      if (hrValue < minHR || hrValue > maxHR) return; // Only show grid lines within data range
      const y = padding + ((maxHR - hrValue) / (maxHR - minHR)) * (height - 2 * padding);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    });
    
    // Draw vertical grid lines (only for intervals within data range)
    xIntervalsInRange.forEach((xValue) => {
      const x = padding + ((xValue - minX) / (maxX - minX)) * (width - 2 * padding);
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
    });
    
    // Draw HR line (using actual data min/max for x-axis)
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    hrData.forEach((hr, i) => {
      const x = padding + ((xAxisData[i] - minX) / (maxX - minX)) * (width - 2 * padding);
      const y = padding + ((maxHR - hr) / (maxHR - minHR)) * (height - 2 * padding);
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    
    ctx.stroke();
    
    // Labels
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--label-color').trim();
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(xAxisMode === 'distance' ? 'Distance (mi)' : 'Time (min)', width / 2, height - 5);
    
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Heart Rate (bpm)', 0, 0);
    ctx.restore();
    
    // Y-axis labels and ticks (heart rate) - only show those within data range
    ctx.textAlign = 'right';
    hrIntervals.forEach((hrValue) => {
      if (hrValue < minHR || hrValue > maxHR) return; // Only show labels within data range
      const y = padding + ((maxHR - hrValue) / (maxHR - minHR)) * (height - 2 * padding);
      ctx.fillText(Math.round(hrValue).toString(), padding - 5, y + 5);
      
      // Draw tick marks
      ctx.strokeStyle = '#ddd';
      ctx.beginPath();
      ctx.moveTo(padding - 3, y);
      ctx.lineTo(padding, y);
      ctx.stroke();
    });
    
    // X-axis labels and ticks (only show those within data range)
    ctx.textAlign = 'center';
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--label-color').trim();
    xIntervalsInRange.forEach((xValue) => {
      const x = padding + ((xValue - minX) / (maxX - minX)) * (width - 2 * padding);
      const label = xAxisMode === 'distance' 
        ? xValue.toFixed(1) 
        : Math.round(xValue).toString();
      ctx.fillText(label, x, height - padding + 15);
      
      // Draw tick marks
      ctx.strokeStyle = '#ddd';
      ctx.beginPath();
      ctx.moveTo(x, height - padding);
      ctx.lineTo(x, height - padding + 3);
      ctx.stroke();
    });
    
    // Draw vertical cursor line if cursor is active
    if (cursorX !== null) {
      ctx.strokeStyle = '#ff6b6b';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(cursorX, padding);
      ctx.lineTo(cursorX, height - padding);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [data, cursorX, xAxisMode]);

  if (!data.heartrate?.data) return null;

  return (
    <div className="workout-display">
      <div className="workout-title">Heart Rate</div>
      <div style={{ position: 'relative' }}>
        <canvas
          className="mobile-wide-chart"
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onTouchMove={(e) => {
            e.preventDefault();
            const touch = e.touches[0];
            handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
          }}
          onTouchEnd={handleMouseLeave}
          style={{ width: '100%', height: 'var(--chart-height)', borderRadius: '8px', cursor: 'crosshair' }}
        />
        {tooltip && (
          <div
            style={{
              position: 'fixed',
              left: tooltip.x,
              top: tooltip.y,
              background: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '12px',
              color: 'var(--text-color)',
              pointerEvents: 'none',
              zIndex: 1000,
              boxShadow: '0 2px 8px var(--shadow)'
            }}
          >
            {tooltip.text}
          </div>
        )}
      </div>
    </div>
  );
};

const PaceChart = ({ data, xAxisMode = 'time' }) => {
  const canvasRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [cursorX, setCursorX] = useState(null);
  
  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !data.velocity_smooth?.data) return;
    if (xAxisMode === 'time' && !data.time?.data) return;
    if (xAxisMode === 'distance' && !data.distance?.data) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const padding = 60;
    const width = rect.width;
    
    // Only show tooltip and cursor within the graph area
    if (x < padding || x > width - padding) {
      setTooltip(null);
      setCursorX(null);
      return;
    }
    
    // Calculate which data point based on X position
    const dataWidth = width - 2 * padding;
    const adjustedX = x - padding;
    const progress = adjustedX / dataWidth;
    
    // Convert velocity to pace and filter
    const paceData = data.velocity_smooth.data
      .map(v => v > 0 ? 26.8224 / v : 0)
      .filter(pace => pace > 0 && pace < 20);
    
    const dataIndex = Math.round(progress * (paceData.length - 1));
    
    if (dataIndex >= 0 && dataIndex < paceData.length) {
      const pace = paceData[dataIndex];
      const mins = Math.floor(pace);
      const secs = Math.round((pace - mins) * 60);
      
      let xAxisValue = '';
      if (xAxisMode === 'time' && data.time?.data) {
        const time = Math.round(data.time.data[dataIndex] / 60);
        xAxisValue = ` • ${time} min`;
      } else if (xAxisMode === 'distance' && data.distance?.data) {
        const distance = (data.distance.data[dataIndex] / 1609.34).toFixed(2);
        xAxisValue = ` • ${distance} mi`;
      }
      
      setTooltip({
        x: e.clientX,
        y: e.clientY - 80,
        text: `${mins}:${secs.toString().padStart(2, '0')}/mile${xAxisValue}`
      });
      
      setCursorX(x);
    }
  };
  
  const handleMouseLeave = () => {
    setTooltip(null);
    setCursorX(null);
  };
  
  useEffect(() => {
    if (!data.velocity_smooth?.data) return;
    if (xAxisMode === 'time' && !data.time?.data) return;
    if (xAxisMode === 'distance' && !data.distance?.data) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    const cssWidth = rect.width || 0;
    const cssHeight = rect.height || 250;
    
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    
    const width = cssWidth;
    const height = cssHeight;
    const padding = 60;
    
    ctx.clearRect(0, 0, width, height);
    
    // Convert velocity to pace and filter
    let paceData = data.velocity_smooth.data
      .map(v => v > 0 ? 26.8224 / v : 0)
      .filter(pace => pace > 0 && pace < 20);
    
    if (paceData.length === 0) return; // No valid pace data
    
    // Apply smoothing to pace data
    paceData = smoothData(paceData, 4);
    
    // Get x-axis data based on mode
    let xAxisData;
    if (xAxisMode === 'distance' && data.distance?.data) {
      xAxisData = data.distance.data
        .slice(0, paceData.length)
        .map(d => d / 1609.34); // Convert meters to miles
    } else {
      xAxisData = data.time.data
        .slice(0, paceData.length)
        .map(t => t / 60); // Convert seconds to minutes
    }
    
    // Calculate actual data ranges (for positioning the line)
    const maxPace = Math.max(...paceData);
    const minPace = Math.min(...paceData);
    const maxX = Math.max(...xAxisData);
    const minX = Math.min(...xAxisData);
    
    // Calculate intervals for pace (every other minute, starting at fastest pace)
    const paceStep = 2; // 2 minutes per mile increments
    // Start at fastest pace (minPace), round down to nearest even minute
    const paceStart = Math.floor(minPace / paceStep) * paceStep;
    const paceMax = Math.ceil(maxPace / paceStep) * paceStep;
    const paceIntervals = [];
    for (let i = paceStart; i <= paceMax; i += paceStep) {
      paceIntervals.push(i);
    }
    
    // Calculate nice intervals for X-axis labels, but filter to only show those within data range
    const xIntervals = calculateNiceIntervals(minX, maxX, 4);
    const xIntervalsInRange = xIntervals.intervals.filter(x => x >= minX && x <= maxX);
    
    // Draw axes
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--axis-color').trim();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
    
    // Draw horizontal grid lines for pace chart
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid-color').trim();
    ctx.lineWidth = 1;
    paceIntervals.forEach((paceValue) => {
      if (paceValue < minPace || paceValue > maxPace) return; // Only show grid lines within data range
      const y = padding + ((paceValue - minPace) / (maxPace - minPace)) * (height - 2 * padding);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    });
    
    // Draw vertical grid lines (only for intervals within data range)
    xIntervalsInRange.forEach((xValue) => {
      const x = padding + ((xValue - minX) / (maxX - minX)) * (width - 2 * padding);
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
    });
    
    // Draw pace line (using actual data min/max for x-axis)
    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    paceData.forEach((pace, i) => {
      const x = padding + ((xAxisData[i] - minX) / (maxX - minX)) * (width - 2 * padding);
      const y = padding + ((pace - minPace) / (maxPace - minPace)) * (height - 2 * padding);
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    
    ctx.stroke();
    
    // Labels
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--label-color').trim();
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(xAxisMode === 'distance' ? 'Distance (mi)' : 'Time (min)', width / 2, height - 5);
    
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Pace (min/mile)', 0, 0);
    ctx.restore();
    
    // Y-axis labels (pace) and ticks - only show those within data range
    ctx.textAlign = 'right';
    const formatPaceLabel = (pace) => {
      const mins = Math.floor(pace);
      const secs = Math.round((pace - mins) * 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    
    paceIntervals.forEach((paceValue) => {
      if (paceValue < minPace || paceValue > maxPace) return; // Only show labels within data range
      const y = padding + ((paceValue - minPace) / (maxPace - minPace)) * (height - 2 * padding);
      ctx.fillText(formatPaceLabel(paceValue), padding - 5, y + 5);
      
      // Draw tick marks
      ctx.strokeStyle = '#ddd';
      ctx.beginPath();
      ctx.moveTo(padding - 3, y);
      ctx.lineTo(padding, y);
      ctx.stroke();
    });
    
    // X-axis labels and ticks (only show those within data range)
    ctx.textAlign = 'center';
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--label-color').trim();
    xIntervalsInRange.forEach((xValue) => {
      const x = padding + ((xValue - minX) / (maxX - minX)) * (width - 2 * padding);
      const label = xAxisMode === 'distance' 
        ? xValue.toFixed(1) 
        : Math.round(xValue).toString();
      ctx.fillText(label, x, height - padding + 15);
      
      // Draw tick marks
      ctx.strokeStyle = '#ddd';
      ctx.beginPath();
      ctx.moveTo(x, height - padding);
      ctx.lineTo(x, height - padding + 3);
      ctx.stroke();
    });
    
    // Draw vertical cursor line if cursor is active
    if (cursorX !== null) {
      ctx.strokeStyle = '#ff6b6b';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(cursorX, padding);
      ctx.lineTo(cursorX, height - padding);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [data, cursorX, xAxisMode]);

  if (!data.velocity_smooth?.data) return null;

  return (
    <div className="workout-display">
      <div className="workout-title">Pace</div>
      <div style={{ position: 'relative' }}>
        <canvas
          className="mobile-wide-chart"
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onTouchMove={(e) => {
            e.preventDefault();
            const touch = e.touches[0];
            handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
          }}
          onTouchEnd={handleMouseLeave}
          style={{ width: '100%', height: 'var(--chart-height)', borderRadius: '8px', cursor: 'crosshair' }}
        />
        {tooltip && (
          <div
            style={{
              position: 'fixed',
              left: tooltip.x,
              top: tooltip.y,
              background: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '12px',
              color: 'var(--text-color)',
              pointerEvents: 'none',
              zIndex: 1000,
              boxShadow: '0 2px 8px var(--shadow)'
            }}
          >
            {tooltip.text}
          </div>
        )}
      </div>
    </div>
  );
};

const ActivityInsights = ({ insights }) => {
  if (!insights) {
    return (
      <div className="workout-display">
        <div className="workout-title">🧠 AI Insights</div>
        <div style={{ padding: '20px', textAlign: 'center', color: '#7f8c8d' }}>
          Generating insights for this activity...
        </div>
      </div>
    );
  }

  return (
    <div className="workout-display">
      <div className="workout-title">🧠 AI Insights</div>
      
      {insights.summary && (
        <div className="workout-block">
          <div className="block-title">Performance Summary</div>
          <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
            {insights.summary}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {insights.strengths && (
          <div className="workout-block">
            <div className="block-title">✅ Strengths</div>
            <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
              {insights.strengths}
            </div>
          </div>
        )}

        {insights.improvements && (
          <div className="workout-block">
            <div className="block-title">📈 Areas for Improvement</div>
            <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
              {insights.improvements}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const formatPace = (speedMs) => {
  const paceMinPerMile = 26.8224 / speedMs;
  const minutes = Math.floor(paceMinPerMile);
  const seconds = Math.round((paceMinPerMile - minutes) * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}/mile`;
};

const CadenceChart = ({ data, xAxisMode = 'time' }) => {
  const canvasRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [cursorX, setCursorX] = useState(null);
  
  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !data.cadence?.data) return;
    if (xAxisMode === 'time' && !data.time?.data) return;
    if (xAxisMode === 'distance' && !data.distance?.data) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const padding = 60;
    const width = rect.width;
    
    // Only show tooltip and cursor within the graph area
    if (x < padding || x > width - padding) {
      setTooltip(null);
      setCursorX(null);
      return;
    }
    
    const dataWidth = width - 2 * padding;
    const adjustedX = x - padding;
    const progress = adjustedX / dataWidth;
    const dataIndex = Math.round(progress * (data.cadence.data.length - 1));
    
    if (dataIndex >= 0 && dataIndex < data.cadence.data.length) {
      const cadence = Math.round(data.cadence.data[dataIndex] * 2); // Convert to steps per minute
      
      let xAxisValue = '';
      if (xAxisMode === 'time' && data.time?.data) {
        const time = Math.round(data.time.data[dataIndex] / 60);
        xAxisValue = ` • ${time} min`;
      } else if (xAxisMode === 'distance' && data.distance?.data) {
        const distance = (data.distance.data[dataIndex] / 1609.34).toFixed(2);
        xAxisValue = ` • ${distance} mi`;
      }
      
      setTooltip({
        x: e.clientX,
        y: e.clientY - 80,
        text: `${cadence} spm${xAxisValue}`
      });
      
      setCursorX(x);
    }
  };
  
  const handleMouseLeave = () => {
    setTooltip(null);
    setCursorX(null);
  };
  
  useEffect(() => {
    if (!data.cadence?.data) return;
    if (xAxisMode === 'time' && !data.time?.data) return;
    if (xAxisMode === 'distance' && !data.distance?.data) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    const cssWidth = rect.width || 0;
    const cssHeight = rect.height || 250;
    
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    
    const width = cssWidth;
    const height = cssHeight;
    const padding = 60;
    
    ctx.clearRect(0, 0, width, height);
    
    // Convert cadence to steps per minute and apply smoothing
    let cadenceData = data.cadence.data.map(c => c * 2);
    cadenceData = smoothData(cadenceData, 4);
    
    // Get x-axis data based on mode
    let xAxisData;
    if (xAxisMode === 'distance' && data.distance?.data) {
      xAxisData = data.distance.data.map(d => d / 1609.34); // Convert meters to miles
    } else {
      xAxisData = data.time.data.map(t => t / 60); // Convert seconds to minutes
    }
    
    // Calculate actual data ranges (for positioning the line)
    const maxCadence = Math.max(...cadenceData);
    const minCadence = Math.min(...cadenceData);
    const maxX = Math.max(...xAxisData);
    const minX = Math.min(...xAxisData);
    
    // Calculate intervals for cadence (increments of 20)
    const cadenceStep = 20;
    const cadenceMin = Math.floor(minCadence / cadenceStep) * cadenceStep;
    const cadenceMax = Math.ceil(maxCadence / cadenceStep) * cadenceStep;
    const cadenceIntervals = [];
    for (let i = cadenceMin; i <= cadenceMax; i += cadenceStep) {
      cadenceIntervals.push(i);
    }
    
    // Calculate nice intervals for X-axis labels, but filter to only show those within data range
    const xIntervals = calculateNiceIntervals(minX, maxX, 4);
    const xIntervalsInRange = xIntervals.intervals.filter(x => x >= minX && x <= maxX);
    
    // Draw axes
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--axis-color').trim();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
    
    // Draw horizontal grid lines
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid-color').trim();
    ctx.lineWidth = 1;
    cadenceIntervals.forEach((cadenceValue) => {
      if (cadenceValue < minCadence || cadenceValue > maxCadence) return; // Only show grid lines within data range
      const y = padding + ((maxCadence - cadenceValue) / (maxCadence - minCadence)) * (height - 2 * padding);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    });
    
    // Draw vertical grid lines (only for intervals within data range)
    xIntervalsInRange.forEach((xValue) => {
      const x = padding + ((xValue - minX) / (maxX - minX)) * (width - 2 * padding);
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
    });
    
    // Draw 170 spm target line (using actual data range)
    const targetCadence = 170;
    if (targetCadence >= minCadence && targetCadence <= maxCadence) {
      const targetY = padding + ((maxCadence - targetCadence) / (maxCadence - minCadence)) * (height - 2 * padding);
      ctx.strokeStyle = '#f39c12';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(padding, targetY);
      ctx.lineTo(width - padding, targetY);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Label for target line
      ctx.fillStyle = '#f39c12';
      ctx.font = '12px sans-serif';
      ctx.fillText('170 spm target', width - padding - 80, targetY - 5);
    }
    
    // Draw cadence line (using actual data min/max for x-axis)
    ctx.strokeStyle = '#9b59b6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    cadenceData.forEach((cadence, i) => {
      const x = padding + ((xAxisData[i] - minX) / (maxX - minX)) * (width - 2 * padding);
      const y = padding + ((maxCadence - cadence) / (maxCadence - minCadence)) * (height - 2 * padding);
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    
    ctx.stroke();
    
    // Draw Y-axis labels - only show those within data range
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--label-color').trim();
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    
    cadenceIntervals.forEach((cadenceValue) => {
      if (cadenceValue < minCadence || cadenceValue > maxCadence) return; // Only show labels within data range
      const y = padding + ((maxCadence - cadenceValue) / (maxCadence - minCadence)) * (height - 2 * padding);
      ctx.fillText(Math.round(cadenceValue).toString(), padding - 10, y + 4);
      
      // Draw tick marks
      ctx.strokeStyle = '#ddd';
      ctx.beginPath();
      ctx.moveTo(padding - 3, y);
      ctx.lineTo(padding, y);
      ctx.stroke();
    });
    
    // Draw X-axis labels (only show those within data range)
    ctx.textAlign = 'center';
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--label-color').trim();
    xIntervalsInRange.forEach((xValue) => {
      const x = padding + ((xValue - minX) / (maxX - minX)) * (width - 2 * padding);
      const label = xAxisMode === 'distance' 
        ? xValue.toFixed(1) 
        : Math.round(xValue).toString();
      ctx.fillText(label, x, height - padding + 15);
      
      // Draw tick marks
      ctx.strokeStyle = '#ddd';
      ctx.beginPath();
      ctx.moveTo(x, height - padding);
      ctx.lineTo(x, height - padding + 3);
      ctx.stroke();
    });
    
    // Draw X-axis label
    ctx.textAlign = 'center';
    ctx.fillText(xAxisMode === 'distance' ? 'Distance (mi)' : 'Time (min)', width / 2, height - 5);
    
    // Draw Y-axis label
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Cadence (spm)', 0, 0);
    ctx.restore();
    
    // Draw vertical cursor line
    if (cursorX !== null) {
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim();
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(cursorX, padding);
      ctx.lineTo(cursorX, height - padding);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [data, cursorX, xAxisMode]);
  
  if (!data.cadence?.data) {
    return (
      <div className="workout-display">
        <div className="workout-title">Cadence</div>
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No cadence data available
        </div>
      </div>
    );
  }
  
  return (
    <div className="workout-display">
      <div className="workout-title">Cadence</div>
      <div style={{ position: 'relative' }}>
        <canvas
          className="mobile-wide-chart"
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onTouchMove={(e) => {
            e.preventDefault();
            const touch = e.touches[0];
            handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
          }}
          onTouchEnd={handleMouseLeave}
          style={{ width: '100%', height: 'var(--chart-height)', borderRadius: '8px', cursor: 'crosshair' }}
        />
        {tooltip && (
          <div
            style={{
              position: 'fixed',
              left: tooltip.x,
              top: tooltip.y,
              background: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '12px',
              color: 'var(--text-color)',
              pointerEvents: 'none',
              zIndex: 1000,
              boxShadow: '0 2px 8px var(--shadow)'
            }}
          >
            {tooltip.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityDetail;
