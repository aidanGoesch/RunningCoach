import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { getActivityDetails, getActivityStreams, generateInsights } from '../services/api';
import { getActivityInsights, saveActivityInsights, saveActivityRating, getActivityRating } from '../services/supabase';
import { useSwipeBack } from '../hooks/useSwipeBack';

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

  if (loading) return <div className="loading">Loading activity details...</div>;
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
          <div className="workout-block">
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
                  color: 'var(--text-color)'
                }}
              >
                {insights}
              </ReactMarkdown>
            )}
          </div>
        ) : (
          <div className="workout-block" style={{ 
            backgroundColor: '#000', 
            color: '#888', 
            textAlign: 'center', 
            padding: '40px 20px',
            cursor: generatingInsights ? 'default' : 'pointer',
            border: '1px solid #333',
            position: 'relative'
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
  
  useEffect(() => {
    if (!streams?.latlng?.data || streams.latlng.data.length === 0) return;

    // Create map
    const map = L.map(mapId).setView(streams.latlng.data[0], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Add route polyline
    const polyline = L.polyline(streams.latlng.data, { color: 'red', weight: 3 }).addTo(map);
    map.fitBounds(polyline.getBounds());

    return () => map.remove();
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
  if (!streams) return null;

  return (
    <>
      {streams.heartrate && (
        <div style={{ marginBottom: '20px' }}>
          <HeartRateChart data={streams} />
        </div>
      )}
      {streams.velocity_smooth && (
        <div style={{ marginBottom: '20px' }}>
          <PaceChart data={streams} />
        </div>
      )}
      {streams.cadence && (
        <div style={{ marginBottom: '20px' }}>
          <CadenceChart data={streams} />
        </div>
      )}
    </>
  );
};

const HeartRateChart = ({ data }) => {
  const canvasRef = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [cursorX, setCursorX] = useState(null);
  
  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !data.heartrate?.data || !data.time?.data) return;
    
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
      const time = Math.round(data.time.data[dataIndex] / 60); // Convert to minutes
      
      setTooltip({
        x: e.clientX,
        y: e.clientY - 80, // Position higher above thumb/cursor
        text: `${hr} bpm`
      });
      
      // Set cursor X position for vertical line
      setCursorX(x);
    }
  };
  
  const handleMouseLeave = () => {
    setTooltip(null);
    setCursorX(null);
  };
  
  useEffect(() => {
    if (!data.heartrate?.data || !data.time?.data) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * dpr;
    canvas.height = 200 * dpr;
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = 200;
    const padding = 60; // Increased padding for HR labels
    
    ctx.clearRect(0, 0, width, height);
    
    const hrData = data.heartrate.data;
    const timeData = data.time.data;
    const maxHR = Math.max(...hrData);
    const minHR = Math.min(...hrData);
    const maxTime = Math.max(...timeData);
    
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
    const gridLines = 4;
    for (let i = 1; i < gridLines; i++) {
      const y = padding + (i * (height - 2 * padding) / gridLines);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }
    
    // Draw HR line
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    hrData.forEach((hr, i) => {
      const x = padding + ((timeData[i] / maxTime) * (width - 2 * padding));
      const y = padding + ((maxHR - hr) / (maxHR - minHR)) * (height - 2 * padding);
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    
    ctx.stroke();
    
    // Labels
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--label-color').trim();
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Time (min)', width / 2, height - 5);
    
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Heart Rate (bpm)', 0, 0);
    ctx.restore();
    
    // Y-axis labels and ticks
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxHR), padding - 5, padding + 5);
    ctx.fillText(Math.round(minHR), padding - 5, height - padding + 5);
    
    // Add intermediate Y-axis ticks
    const hrRange = maxHR - minHR;
    for (let i = 1; i < 4; i++) {
      const hrValue = minHR + (hrRange * i / 4);
      const y = padding + ((maxHR - hrValue) / hrRange) * (height - 2 * padding);
      ctx.fillText(Math.round(hrValue), padding - 5, y + 5);
      
      // Draw tick marks
      ctx.strokeStyle = '#ddd';
      ctx.beginPath();
      ctx.moveTo(padding - 3, y);
      ctx.lineTo(padding, y);
      ctx.stroke();
    }
    
    // X-axis labels and ticks
    ctx.textAlign = 'center';
    ctx.fillText('0', padding, height - padding + 15);
    ctx.fillText(Math.round(maxTime / 60), width - padding, height - padding + 15);
    
    // Add intermediate X-axis ticks
    for (let i = 1; i < 4; i++) {
      const timeValue = (maxTime * i / 4) / 60; // Convert to minutes
      const x = padding + (i * (width - 2 * padding) / 4);
      ctx.fillText(Math.round(timeValue), x, height - padding + 15);
      
      // Draw tick marks
      ctx.strokeStyle = '#ddd';
      ctx.beginPath();
      ctx.moveTo(x, height - padding);
      ctx.lineTo(x, height - padding + 3);
      ctx.stroke();
    }
    
    // Draw vertical cursor line if cursor is active (HR chart)
    if (cursorX !== null) {
      ctx.strokeStyle = '#ff6b6b';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(cursorX, padding);
      ctx.lineTo(cursorX, height - padding);
      ctx.stroke();
      ctx.setLineDash([]); // Reset line dash
    }
  }, [data, cursorX]);

  if (!data.heartrate?.data) return null;

  return (
    <div className="workout-display">
      <div className="workout-title">Heart Rate</div>
      <div style={{ position: 'relative' }}>
        <canvas 
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onTouchMove={(e) => {
            e.preventDefault();
            const touch = e.touches[0];
            handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
          }}
          onTouchEnd={handleMouseLeave}
          style={{ width: '100%', height: '200px', borderRadius: '8px', cursor: 'crosshair' }}
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

const PaceChart = ({ data }) => {
  const canvasRef = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [cursorX, setCursorX] = useState(null);
  
  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !data.velocity_smooth?.data || !data.time?.data) return;
    
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
    
    const velocityData = data.velocity_smooth.data
      .map(v => v > 0 ? 26.8224 / v : 0)
      .filter(pace => pace > 0 && pace < 20);
    
    const dataIndex = Math.round(progress * (velocityData.length - 1));
    
    if (dataIndex >= 0 && dataIndex < velocityData.length) {
      const pace = velocityData[dataIndex];
      const mins = Math.floor(pace);
      const secs = Math.round((pace - mins) * 60);
      const time = Math.round(data.time.data[dataIndex] / 60); // Convert to minutes
      
      setTooltip({
        x: e.clientX,
        y: e.clientY - 80, // Position higher above thumb/cursor
        text: `${mins}:${secs.toString().padStart(2, '0')}/mile`
      });
      
      // Set cursor X position for vertical line
      setCursorX(x);
    }
  };
  
  const handleMouseLeave = () => {
    setTooltip(null);
    setCursorX(null);
  };
  
  useEffect(() => {
    if (!data.velocity_smooth?.data || !data.time?.data) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * dpr;
    canvas.height = 200 * dpr;
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = 200;
    const padding = 60; // Increased padding for pace labels
    
    ctx.clearRect(0, 0, width, height);
    
    const velocityData = data.velocity_smooth.data
      .map(v => v > 0 ? 26.8224 / v : 0) // Convert to pace, handle zero velocity
      .filter(pace => pace > 0 && pace < 20); // Filter out invalid paces (0-20 min/mile)
    const timeData = data.time.data.slice(0, velocityData.length); // Match filtered data length
    const maxPace = Math.max(...velocityData);
    const minPace = Math.min(...velocityData);
    const maxTime = Math.max(...timeData);
    
    if (velocityData.length === 0) return; // No valid pace data
    
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
    const gridLines = 4;
    for (let i = 1; i < gridLines; i++) {
      const y = padding + (i * (height - 2 * padding) / gridLines);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }
    
    // Draw pace line
    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    velocityData.forEach((pace, i) => {
      const x = padding + ((timeData[i] / maxTime) * (width - 2 * padding));
      const y = padding + ((pace - minPace) / (maxPace - minPace)) * (height - 2 * padding); // Normal Y for pace (faster at top)
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    
    ctx.stroke();
    
    // Labels
    ctx.fillStyle = '#666';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Time (min)', width / 2, height - 5);
    
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Pace (min/mile)', 0, 0);
    ctx.restore();
    
    // Y-axis labels (pace) and ticks - fastest at top, slowest at bottom
    ctx.textAlign = 'right';
    const formatPaceLabel = (pace) => {
      const mins = Math.floor(pace);
      const secs = Math.round((pace - mins) * 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    ctx.fillText(formatPaceLabel(minPace), padding - 5, padding + 5); // Fastest at top
    ctx.fillText(formatPaceLabel(maxPace), padding - 5, height - padding + 5); // Slowest at bottom
    
    // Add intermediate Y-axis ticks for pace
    const paceRange = maxPace - minPace;
    for (let i = 1; i < 4; i++) {
      const paceValue = minPace + (paceRange * i / 4); // Calculate from fastest up
      const y = padding + (i * (height - 2 * padding) / 4);
      ctx.fillText(formatPaceLabel(paceValue), padding - 5, y + 5);
      
      // Draw tick marks
      ctx.strokeStyle = '#ddd';
      ctx.beginPath();
      ctx.moveTo(padding - 3, y);
      ctx.lineTo(padding, y);
      ctx.stroke();
    }
    
    // X-axis labels and ticks
    ctx.textAlign = 'center';
    ctx.fillText('0', padding, height - padding + 15);
    ctx.fillText(Math.round(maxTime / 60), width - padding, height - padding + 15);
    
    // Add intermediate X-axis ticks
    for (let i = 1; i < 4; i++) {
      const timeValue = (maxTime * i / 4) / 60; // Convert to minutes
      const x = padding + (i * (width - 2 * padding) / 4);
      ctx.fillText(Math.round(timeValue), x, height - padding + 15);
      
      // Draw tick marks
      ctx.strokeStyle = '#ddd';
      ctx.beginPath();
      ctx.moveTo(x, height - padding);
      ctx.lineTo(x, height - padding + 3);
      ctx.stroke();
    }
    
    // Draw vertical cursor line if cursor is active (Pace chart)
    if (cursorX !== null) {
      ctx.strokeStyle = '#ff6b6b';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(cursorX, padding);
      ctx.lineTo(cursorX, height - padding);
      ctx.stroke();
      ctx.setLineDash([]); // Reset line dash
    }
  }, [data, cursorX]);

  if (!data.velocity_smooth?.data) return null;

  return (
    <div className="workout-display">
      <div className="workout-title">Pace</div>
      <div style={{ position: 'relative' }}>
        <canvas 
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onTouchMove={(e) => {
            e.preventDefault();
            const touch = e.touches[0];
            handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
          }}
          onTouchEnd={handleMouseLeave}
          style={{ width: '100%', height: '200px', borderRadius: '8px', cursor: 'crosshair' }}
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

const CadenceChart = ({ data }) => {
  const canvasRef = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [cursorX, setCursorX] = useState(null);
  
  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !data.cadence?.data || !data.time?.data) return;
    
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
      
      setTooltip({
        x: e.clientX,
        y: e.clientY - 80,
        text: `${cadence} spm`
      });
      
      setCursorX(x);
    }
  };
  
  const handleMouseLeave = () => {
    setTooltip(null);
    setCursorX(null);
  };
  
  useEffect(() => {
    if (!data.cadence?.data || !data.time?.data) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * dpr;
    canvas.height = 200 * dpr;
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = 200;
    const padding = 60;
    
    ctx.clearRect(0, 0, width, height);
    
    const cadenceData = data.cadence.data.map(c => c * 2); // Convert to steps per minute
    const timeData = data.time.data;
    const maxCadence = Math.max(...cadenceData);
    const minCadence = Math.min(...cadenceData);
    const maxTime = Math.max(...timeData);
    
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
    const gridLines = 4;
    for (let i = 1; i < gridLines; i++) {
      const y = padding + (i * (height - 2 * padding) / gridLines);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }
    
    // Draw 170 spm target line
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
    
    // Draw cadence line
    ctx.strokeStyle = '#9b59b6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    cadenceData.forEach((cadence, i) => {
      const x = padding + ((timeData[i] / maxTime) * (width - 2 * padding));
      const y = padding + ((maxCadence - cadence) / (maxCadence - minCadence)) * (height - 2 * padding);
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    
    ctx.stroke();
    
    // Draw Y-axis labels
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--label-color').trim();
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    
    for (let i = 0; i <= 4; i++) {
      const cadence = Math.round(minCadence + (i * (maxCadence - minCadence) / 4));
      const y = height - padding - (i * (height - 2 * padding) / 4);
      ctx.fillText(`${cadence}`, padding - 10, y + 4);
    }
    
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
  }, [data, cursorX]);
  
  if (!data.cadence?.data) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        No cadence data available
      </div>
    );
  }
  
  return (
    <div style={{ position: 'relative' }}>
      <h3 style={{ marginBottom: '10px', color: 'var(--text-color)' }}>Cadence</h3>
      <div style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          style={{ 
            width: '100%', 
            height: '200px', 
            cursor: 'crosshair',
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px'
          }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
        {tooltip && (
          <div style={{
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
            transform: 'translateX(-50%)'
          }}>
            {tooltip.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityDetail;
