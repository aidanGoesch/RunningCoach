import ActivityMapThumbnail from './ActivityMapThumbnail';

const ActivitiesDisplay = ({ activities, activityRatings = {}, onActivityClick }) => {
  if (!activities || activities.length === 0) return null;

  // Sort by date (most recent first) and filter to runs only
  const sortedActivities = [...activities]
    .filter(a => a.type === 'Run')
    .sort((a, b) => new Date(b.start_date) - new Date(a.start_date))
    .slice(0, 5); // Show only 5 most recent

  if (sortedActivities.length === 0) return null;

  const formatDistance = (meters) => (meters / 1609.34).toFixed(1);
  
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    if (hours > 0) {
      return `${hours}:${remainingMins.toString().padStart(2, '0')}`;
    }
    return `${mins}:${(seconds % 60).toString().padStart(2, '0')}`;
  };
  
  const formatPace = (speedMs) => {
    if (!speedMs || speedMs === 0) return '—';
    const paceMinPerMile = 26.8224 / speedMs;
    const minutes = Math.floor(paceMinPerMile);
    const seconds = Math.round((paceMinPerMile - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')} /mi`;
  };
  
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activityDate = new Date(date);
    activityDate.setHours(0, 0, 0, 0);
    
    const diffTime = today - activityDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  
  const getActivityRating = (activityId) => {
    return activityRatings[activityId]?.rating ?? activityRatings[String(activityId)]?.rating ?? null;
  };

  // Single color per rating value (matches requested behavior).
  const ratingColorByValue = {
    1: '#639922', // very easy
    2: '#1D9E75', // easy
    3: '#BA7517', // moderate
    4: '#D85A30', // hard
    5: '#E24B4A'  // very hard
  };

  return (
    <div className="activity-list" style={{
      border: '0.5px solid var(--color-border-tertiary)',
      borderRadius: '10px',
      overflow: 'hidden',
      background: 'var(--color-background-primary)',
      width: '100%'
    }}>
      {sortedActivities.map((activity, index) => {
        const isLast = index === sortedActivities.length - 1;
        const rating = getActivityRating(activity.id);
        
        return (
          <div
            key={activity.id}
            className="activity-row"
            style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s',
              borderBottom: isLast ? 'none' : '0.5px solid var(--color-border-tertiary)',
              width: '100%',
              minWidth: 0,
              overflow: 'hidden'
            }}
            onClick={() => onActivityClick && onActivityClick(activity.id)}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--color-background-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            {/* Map thumbnail */}
            <div style={{
              width: '68px',
              height: '68px',
              flexShrink: 0,
              overflow: 'hidden',
              background: '#1a1f2e'
            }}>
              <ActivityMapThumbnail 
                activityId={activity.id}
                activity={activity}
                onClick={() => onActivityClick && onActivityClick(activity.id)}
              />
            </div>
            
            {/* Activity info */}
            <div className="act-info" style={{
              flex: 1,
              padding: '10px 14px',
              minWidth: 0
            }}>
              {/* Activity name */}
              <div style={{
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--color-text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {activity.name || 'Run'}
              </div>
              
              {/* Date · duration */}
              <div style={{
                fontSize: '10px',
                color: 'var(--color-text-tertiary)',
                marginTop: '1px',
                marginBottom: '5px'
              }}>
                {formatDate(activity.start_date)} · {formatDuration(activity.moving_time)}
              </div>
              
              {/* Stats row */}
              <div style={{
                display: 'flex',
                gap: '10px',
                flexWrap: 'wrap'
              }}>
                {activity.average_heartrate && (
                  <span style={{
                    fontSize: '11px',
                    color: 'var(--color-text-secondary)'
                  }}>
                    HR <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{Math.round(activity.average_heartrate)}</span>
                  </span>
                )}
                {activity.average_cadence && (
                  <span style={{
                    fontSize: '11px',
                    color: 'var(--color-text-secondary)'
                  }}>
                    Cad <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{Math.round(activity.average_cadence * 2)}</span>
                  </span>
                )}
              </div>
            </div>
            
            {/* Right side */}
            <div className="act-right" style={{
              padding: '10px 16px 10px 0',
              textAlign: 'right',
              flexShrink: 0,
              minWidth: '72px'
            }}>
              {/* Distance */}
              <div style={{
                fontSize: '15px',
                fontWeight: 500,
                color: 'var(--color-text-primary)'
              }}>
                {formatDistance(activity.distance)} mi
              </div>
              
              {/* Pace */}
              <div style={{
                fontSize: '11px',
                color: 'var(--color-text-tertiary)',
                marginTop: '1px'
              }}>
                {formatPace(activity.average_speed)}
              </div>
              
              {/* Star rating - gradient by difficulty: sq1=green (easy) … sq5=red (hard) */}
              {rating != null && (
                <div
                  className="activity-rating-bar"
                  data-rating-value={Number(rating)}
                  style={{ display: 'flex', gap: '2px', marginTop: '5px', justifyContent: 'flex-end' }}
                >
                  {[1, 2, 3, 4, 5].map((star) => {
                    const filled = star <= Number(rating);
                    const filledColor = ratingColorByValue[Number(rating)] || '#639922';
                    return (
                      <div
                        key={star}
                        className={`activity-rating-dot ${filled ? 'activity-rating-dot-filled' : 'activity-rating-dot-empty'}`}
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '1px',
                          backgroundColor: filled ? filledColor : 'var(--color-border-secondary)'
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ActivitiesDisplay;
