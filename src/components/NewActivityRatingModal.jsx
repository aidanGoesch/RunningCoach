import { useState, useEffect, useRef } from 'react';
import { getActivityDetails, getActivityStreams } from '../services/api';
import { saveActivityRating } from '../services/supabase';

const formatPace = (speedMs) => {
  const paceMinPerMile = 26.8224 / speedMs;
  const minutes = Math.floor(paceMinPerMile);
  const seconds = Math.round((paceMinPerMile - minutes) * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}/mile`;
};

const ActivityMap = ({ activity, streams }) => {
  const mapId = `modal-map-${activity.id}`;
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  
  useEffect(() => {
    if (!streams?.latlng?.data || streams.latlng.data.length === 0) return;
    if (typeof L === 'undefined') return;

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
      if (mapRef.current && mapRef.current._themeObserver) {
        mapRef.current._themeObserver.disconnect();
      }
      if (mapRef.current) {
        mapRef.current.remove();
      }
      mapRef.current = null;
      tileLayerRef.current = null;
    };
  }, [streams, mapId]);

  if (!streams?.latlng?.data) {
    return (
      <div style={{ 
        height: '200px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: 'var(--grid-color)',
        borderRadius: '8px',
        color: 'var(--text-secondary)'
      }}>
        No GPS data available
      </div>
    );
  }

  return (
    <div id={mapId} style={{ height: '200px', borderRadius: '8px' }}></div>
  );
};

const NewActivityRatingModal = ({ activity, onClose, onComplete }) => {
  const [streams, setStreams] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ratingValue, setRatingValue] = useState(null);
  const [ratingComment, setRatingComment] = useState('');
  const [isInjured, setIsInjured] = useState(false);
  const [injuryDetails, setInjuryDetails] = useState('');
  const [savingRating, setSavingRating] = useState(false);

  useEffect(() => {
    const fetchActivityData = async () => {
      if (!activity) return;
      
      try {
        const { getStravaTokens } = await import('../services/supabase');
        const tokens = await getStravaTokens();
        const token = tokens?.accessToken || localStorage.getItem('strava_access_token');
        
        if (!token) {
          console.error('No Strava token available');
          setLoading(false);
          return;
        }

        const [activityData, streamData] = await Promise.all([
          getActivityDetails(token, activity.id),
          getActivityStreams(token, activity.id).catch(() => null)
        ]);
        
        setStreams(streamData);
      } catch (error) {
        console.error('Error fetching activity data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivityData();
  }, [activity]);

  const handleSubmit = async () => {
    if (!ratingValue) {
      alert('Please select a rating');
      return;
    }

    setSavingRating(true);
    try {
      await saveActivityRating(
        activity.id,
        ratingValue,
        ratingComment,
        isInjured,
        injuryDetails
      );
      onComplete();
    } catch (error) {
      console.error('Error saving rating:', error);
      alert('Failed to save rating. Please try again.');
    } finally {
      setSavingRating(false);
    }
  };

  if (!activity) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9998,
          animation: 'fadeIn 0.3s ease'
        }}
        onClick={onClose}
      />
      
      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '85vh',
          backgroundColor: 'var(--card-bg)',
          borderTopLeftRadius: '20px',
          borderTopRightRadius: '20px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3)',
          animation: 'slideUp 0.3s ease',
          overflow: 'hidden'
        }}
      >
        {/* Handle bar */}
        <div
          style={{
            width: '40px',
            height: '4px',
            backgroundColor: 'var(--border-color)',
            borderRadius: '2px',
            margin: '12px auto',
            cursor: 'pointer'
          }}
          onClick={onClose}
        />

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0 20px 20px',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {/* Activity Title */}
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ 
              fontSize: '20px', 
              fontWeight: '600', 
              marginBottom: '4px',
              color: 'var(--text-color)'
            }}>
              {activity.name}
            </h2>
            <p style={{ 
              fontSize: '14px', 
              color: 'var(--text-secondary)',
              margin: 0
            }}>
              {new Date(activity.start_date).toLocaleDateString()}
            </p>
          </div>

          {/* Map */}
          {loading ? (
            <div style={{ 
              height: '200px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              backgroundColor: 'var(--grid-color)',
              borderRadius: '8px',
              color: 'var(--text-secondary)'
            }}>
              Loading map...
            </div>
          ) : (
            <div style={{ marginBottom: '20px' }}>
              <ActivityMap activity={activity} streams={streams} />
            </div>
          )}

          {/* Stats */}
          <div style={{ 
            marginBottom: '20px',
            padding: '16px',
            backgroundColor: 'var(--grid-color)',
            borderRadius: '8px'
          }}>
            <div style={{ 
              fontSize: '14px', 
              fontWeight: '600', 
              marginBottom: '12px',
              color: 'var(--text-color)'
            }}>
              Activity Stats
            </div>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '12px' 
            }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Distance</div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-color)' }}>
                  {(activity.distance / 1609.34).toFixed(2)} mi
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Duration</div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-color)' }}>
                  {Math.floor(activity.moving_time / 60)}:{(activity.moving_time % 60).toString().padStart(2, '0')}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Avg Pace</div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-color)' }}>
                  {formatPace(activity.average_speed)}
                </div>
              </div>
              {activity.average_heartrate && (
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Avg HR</div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-color)' }}>
                    {Math.round(activity.average_heartrate)} bpm
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Rating */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ 
              fontSize: '14px', 
              fontWeight: '600', 
              marginBottom: '12px',
              color: 'var(--text-color)'
            }}>
              How was this run?
            </div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
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
                    fontSize: '40px',
                    cursor: 'pointer',
                    padding: '12px',
                    transition: 'all 0.2s ease',
                    transform: ratingValue === value ? 'scale(1.15)' : 'scale(1)',
                    boxShadow: ratingValue === value ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    minWidth: '60px'
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
                    <span style={{ fontSize: '10px', color: 'white', fontWeight: '600' }}>
                      {label}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Click an emoji to rate this activity
            </div>
          </div>

          {/* Comment */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ 
              fontSize: '14px', 
              fontWeight: '600', 
              marginBottom: '8px',
              color: 'var(--text-color)'
            }}>
              Comments (optional)
            </div>
            <textarea
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              placeholder="How did this run feel? Any notes..."
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                fontSize: '14px',
                minHeight: '80px',
                backgroundColor: 'var(--card-bg)',
                color: 'var(--text-color)',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Injury Status */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px', 
              cursor: 'pointer',
              fontSize: '14px',
              color: 'var(--text-color)'
            }}>
              <input
                type="checkbox"
                checked={isInjured}
                onChange={(e) => setIsInjured(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span>I'm currently injured or experiencing pain</span>
            </label>
            
            {isInjured && (
              <textarea
                value={injuryDetails}
                onChange={(e) => setInjuryDetails(e.target.value)}
                placeholder="Describe your injury or pain (e.g., 'knee pain', 'shin splints', 'general fatigue')"
                style={{
                  width: '100%',
                  marginTop: '10px',
                  padding: '12px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  minHeight: '60px',
                  backgroundColor: 'var(--card-bg)',
                  color: 'var(--text-color)',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div style={{ 
          padding: '16px 20px',
          borderTop: '1px solid var(--border-color)',
          backgroundColor: 'var(--card-bg)'
        }}>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!ratingValue || savingRating}
            style={{
              width: '100%',
              padding: '16px',
              fontSize: '16px',
              fontWeight: '600',
              opacity: (!ratingValue || savingRating) ? 0.5 : 1,
              cursor: (!ratingValue || savingRating) ? 'not-allowed' : 'pointer'
            }}
          >
            {savingRating ? 'Saving...' : 'Submit Rating'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
};

export default NewActivityRatingModal;
