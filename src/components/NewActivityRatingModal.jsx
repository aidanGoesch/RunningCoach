import { useState, useEffect, useRef } from 'react';
import { getActivityDetails, getActivityStreams } from '../services/api';
import { saveActivityRating } from '../services/supabase';

const formatPace = (speedMs) => {
  const paceMinPerMile = 26.8224 / speedMs;
  const minutes = Math.floor(paceMinPerMile);
  const seconds = Math.round((paceMinPerMile - minutes) * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}/mi`;
};

const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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

    // Add route polyline - blue color #378ADD
    const polyline = L.polyline(streams.latlng.data, { color: '#378ADD', weight: 4 }).addTo(map);
    map.fitBounds(polyline.getBounds());

    // Always use dark tiles for modal map
    tileLayerRef.current = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors © CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    return () => {
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
        height: '160px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#1a1f2e',
        color: 'var(--color-text-tertiary)'
      }}>
        No GPS data available
      </div>
    );
  }

  return (
    <div id={mapId} style={{ height: '160px' }}></div>
  );
};

const NewActivityRatingModal = ({ activity, onClose, onComplete }) => {
  const [streams, setStreams] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ratingValue, setRatingValue] = useState(null);
  const [ratingComment, setRatingComment] = useState('');
  const [savingRating, setSavingRating] = useState(false);
  const [hoveredRating, setHoveredRating] = useState(null);

  // Rating colors matching ActivityDetail
  const ratingColors = [
    { muted: '#C0DD97', vivid: '#639922' },
    { muted: '#9FE1CB', vivid: '#1D9E75' },
    { muted: '#FAC775', vivid: '#BA7517' },
    { muted: '#F0997B', vivid: '#D85A30' },
    { muted: '#F7C1C1', vivid: '#E24B4A' }
  ];

  const ratingLabels = ['Very easy', 'Easy', 'Moderate', 'Hard', 'Very hard'];

  useEffect(() => {
    const fetchActivityData = async () => {
      if (!activity) return;
      
      try {
        const { getStravaTokens } = await import('../services/supabase');
        const tokens = await getStravaTokens();
        const token = tokens?.accessToken;
        
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
      return;
    }

    setSavingRating(true);
    try {
      // Save notes as feedback field (for backwards compatibility with plan generation)
      await saveActivityRating(
        activity.id,
        ratingValue,
        ratingComment, // This will be saved as feedback field
        false, // isInjured
        '' // injuryDetails
      );
      onComplete();
    } catch (error) {
      console.error('Error saving rating:', error);
      alert('Failed to save rating. Please try again.');
    } finally {
      setSavingRating(false);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  if (!activity) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: '90vh',
        backgroundColor: 'var(--color-background-primary)',
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
          display: 'flex',
          justifyContent: 'center',
          padding: '10px 0 6px',
          background: 'var(--color-background-primary)'
        }}
      >
        <div
          style={{
            width: '36px',
            height: '4px',
            borderRadius: '2px',
            background: 'var(--color-border-secondary)'
          }}
        />
      </div>

      {/* Map hero */}
      <div style={{ width: '100%', height: '160px', background: '#1a1f2e' }}>
        {loading ? (
          <div style={{ 
            height: '160px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            backgroundColor: '#1a1f2e',
            color: 'var(--color-text-tertiary)'
          }}>
            Loading map...
          </div>
        ) : (
          <ActivityMap activity={activity} streams={streams} />
        )}
      </div>

      {/* Sheet body */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px 0',
          background: 'var(--color-background-primary)',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {/* Activity header */}
        <div style={{
          marginBottom: '16px',
          borderBottom: '0.5px solid var(--color-border-tertiary)',
          paddingBottom: '14px'
        }}>
          <div style={{
            fontSize: '18px',
            fontWeight: '500',
            color: 'var(--color-text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {activity.name}
          </div>
          <div style={{
            fontSize: '12px',
            color: 'var(--color-text-tertiary)',
            marginTop: '3px'
          }}>
            {new Date(activity.start_date).toLocaleDateString()} · {formatDuration(activity.moving_time)}
          </div>
        </div>

        {/* Metrics row */}
        <div style={{
          marginBottom: '16px',
          borderBottom: '0.5px solid var(--color-border-tertiary)',
          paddingBottom: '14px'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1px 1fr 1px 1fr',
            gap: 0
          }}>
            {/* Distance */}
            <div style={{ padding: '0 16px', paddingLeft: 0 }}>
              <div style={{
                fontSize: '16px',
                fontWeight: '500',
                color: 'var(--color-text-primary)',
                lineHeight: 1
              }}>
                {(activity.distance / 1609.34).toFixed(1)} mi
              </div>
              <div style={{
                fontSize: '10px',
                color: 'var(--color-text-tertiary)',
                marginTop: '4px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase'
              }}>
                Distance
              </div>
            </div>
            {/* Divider */}
            <div style={{
              background: 'var(--color-border-tertiary)',
              width: '1px'
            }} />
            {/* Avg Pace */}
            <div style={{ padding: '0 16px' }}>
              <div style={{
                fontSize: '16px',
                fontWeight: '500',
                color: 'var(--color-text-primary)',
                lineHeight: 1
              }}>
                {formatPace(activity.average_speed)}
              </div>
              <div style={{
                fontSize: '10px',
                color: 'var(--color-text-tertiary)',
                marginTop: '4px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase'
              }}>
                Avg pace
              </div>
            </div>
            {/* Divider */}
            <div style={{
              background: 'var(--color-border-tertiary)',
              width: '1px'
            }} />
            {/* Avg HR */}
            <div style={{ padding: '0 16px', paddingRight: 0 }}>
              <div style={{
                fontSize: '16px',
                fontWeight: '500',
                color: 'var(--color-text-primary)',
                lineHeight: 1
              }}>
                {activity.average_heartrate ? `${Math.round(activity.average_heartrate)} bpm` : '—'}
              </div>
              <div style={{
                fontSize: '10px',
                color: 'var(--color-text-tertiary)',
                marginTop: '4px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase'
              }}>
                Avg HR
              </div>
            </div>
          </div>
        </div>

        {/* Effort rating */}
        <div style={{
          marginBottom: '16px',
          borderBottom: '0.5px solid var(--color-border-tertiary)',
          paddingBottom: '16px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px'
          }}>
            <div style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--color-text-tertiary)'
            }}>
              EFFORT
            </div>
            <div style={{
              fontSize: '11px',
              color: 'var(--color-text-tertiary)'
            }}>
              {ratingValue ? ratingLabels[ratingValue - 1] : ''}
            </div>
          </div>
          <div style={{
            display: 'flex',
            gap: '6px',
            marginTop: '8px'
          }}>
            {[1, 2, 3, 4, 5].map((value) => {
              const isSelected = ratingValue === value;
              const isHovered = hoveredRating === value;
              const colors = ratingColors[value - 1];
              const shouldShowVivid = isSelected || isHovered;
              return (
                <div
                  key={value}
                  onClick={() => setRatingValue(value)}
                  onMouseEnter={() => setHoveredRating(value)}
                  onMouseLeave={() => setHoveredRating(null)}
                  style={{
                    width: '40px',
                    height: '16px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    backgroundColor: shouldShowVivid ? colors.vivid : colors.muted,
                    outline: isSelected ? '1.5px solid var(--color-border-primary)' : 'none',
                    outlineOffset: isSelected ? '2px' : '0',
                    transition: 'all 0.15s'
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <div style={{
          marginBottom: '16px',
          borderBottom: '0.5px solid var(--color-border-tertiary)',
          paddingBottom: '16px'
        }}>
          <div style={{
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--color-text-tertiary)',
            marginBottom: '8px'
          }}>
            NOTES
          </div>
          <textarea
            value={ratingComment}
            onChange={(e) => setRatingComment(e.target.value)}
            placeholder="How did it feel? Any issues?"
            rows={3}
            style={{
              width: '100%',
              border: '0.5px solid var(--color-border-secondary)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '13px',
              color: 'var(--color-text-secondary)',
              background: 'var(--color-background-secondary)',
              resize: 'none',
              fontFamily: 'inherit'
            }}
          />
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex',
          gap: '10px',
          paddingBottom: '32px'
        }}>
          <button
            onClick={handleSkip}
            style={{
              flexShrink: 0,
              padding: '11px 18px',
              fontSize: '13px',
              color: 'var(--color-text-secondary)',
              background: 'none',
              border: '0.5px solid var(--color-border-secondary)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={!ratingValue || savingRating}
            style={{
              flex: 1,
              padding: '11px',
              fontSize: '13px',
              fontWeight: '500',
              color: (!ratingValue || savingRating) ? 'var(--color-text-tertiary)' : 'white',
              background: (!ratingValue || savingRating) ? 'var(--color-background-secondary)' : '#185FA5',
              border: 'none',
              borderRadius: '8px',
              cursor: (!ratingValue || savingRating) ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit'
            }}
          >
            {savingRating ? 'Saving...' : 'Save'}
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
      `}</style>
    </div>
  );
};

export default NewActivityRatingModal;
