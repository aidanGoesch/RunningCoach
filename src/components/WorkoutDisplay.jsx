import { useState, useEffect, useRef } from 'react';

const WorkoutDisplay = ({ 
  workout, 
  onWorkoutClick, 
  isCompleted = false, 
  weeklyPlan,
  onPostpone,
  onFix,
  isFixingWorkout = false
}) => {
  const [openNoteIndex, setOpenNoteIndex] = useState(null);
  const cardRef = useRef(null);
  // Empty state
  if (!workout) {
    return (
      <div style={{
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: '10px',
        background: 'var(--color-background-primary)',
        overflow: 'hidden',
        padding: '40px 16px',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: '13px',
          color: 'var(--color-text-tertiary)'
        }}>
          No workout planned — generate your weekly plan to get started.
        </div>
      </div>
    );
  }

  // Determine workout type
  let workoutType = 'Easy Run';
  if (workout.type) {
    const type = typeof workout.type === 'string' ? workout.type.toLowerCase() : workout.type;
    if (type === 'recovery') {
      workoutType = 'Recovery / PT';
    } else if (type === 'speed' || type === 'speed work') {
      workoutType = 'Speed Work';
    } else if (type === 'long' || type === 'long run') {
      workoutType = 'Long Run';
    } else if (type === 'easy' || type === 'easy run') {
      workoutType = 'Easy Run';
    }
  }

  // Calculate target summary (pace range, zone, duration)
  const getTargetSummary = () => {
    if (!workout.blocks || workout.blocks.length === 0) return '';
    
    // Try to find pace from first non-warmup block
    const mainBlock = workout.blocks.find(b => 
      !b.title?.toLowerCase().includes('warm') && 
      !b.title?.toLowerCase().includes('cool')
    ) || workout.blocks[0];
    
    const pace = mainBlock.pace || '';
    const zone = mainBlock.heartRateZone || '';
    const duration = workout.blocks.reduce((sum, b) => sum + (b.duration || 0), 0);
    
    const parts = [];
    if (pace) parts.push(pace);
    if (zone) {
      const zoneMatch = zone.match(/Zone\s*(\d+)/i);
      if (zoneMatch) parts.push(`Zone ${zoneMatch[1]}`);
    }
    if (duration) parts.push(`~${Math.round(duration)} min`);
    
    return parts.join(' · ');
  };

  // Check if workout is synced from Strava
  const isSyncedFromStrava = (() => {
    if (!weeklyPlan || !weeklyPlan._activityMatches) return false;
    const today = new Date();
    const dayOfWeek = today.getDay();
    const dayNameMap = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday'
    };
    const dayName = dayNameMap[dayOfWeek];
    const dayMatch = weeklyPlan._activityMatches[dayName];
    return !!dayMatch && dayMatch.activities && dayMatch.activities.length > 0;
  })();

  // Format block pace for dashboard card - truncate to first pace value only
  const formatBlockPace = (pace) => {
    if (!pace) return '';
    // Take only the content before the first comma
    const trimmed = pace.split(',')[0].trim();
    return trimmed;
  };

  // Close popover when clicking outside the card
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (cardRef.current && !cardRef.current.contains(event.target)) {
        setOpenNoteIndex(null);
      }
    };

    if (openNoteIndex !== null) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [openNoteIndex]);

  return (
    <div 
      ref={cardRef}
      style={{
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: '10px',
        background: 'var(--color-background-primary)',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div style={{
        padding: '14px 16px 12px',
        borderBottom: '0.5px solid var(--color-border-tertiary)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '12px'
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Type tag */}
          <div style={{
            fontSize: '10px',
            fontWeight: 500,
            color: 'var(--color-text-tertiary)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '3px'
          }}>
            {workoutType}
          </div>
          
          {/* Title */}
          <div style={{
            fontSize: '17px',
            fontWeight: 500,
            color: 'var(--color-text-primary)',
            marginBottom: '2px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {workout.title}
          </div>
          
          {/* Target summary */}
          <div style={{
            fontSize: '11px',
            color: 'var(--color-text-secondary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {getTargetSummary()}
          </div>
        </div>
        
        {/* Fix button */}
        {onFix && (
          <button
            onClick={onFix}
            disabled={isFixingWorkout}
            style={{
              fontSize: '11px',
              color: isFixingWorkout ? 'var(--color-text-tertiary)' : 'var(--color-text-tertiary)',
              border: '0.5px solid var(--color-border-secondary)',
              borderRadius: '5px',
              padding: '5px 10px',
              whiteSpace: 'nowrap',
              cursor: isFixingWorkout ? 'not-allowed' : 'pointer',
              flexShrink: 0,
              background: 'transparent',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => {
              if (!isFixingWorkout) {
                e.target.style.color = 'var(--color-text-primary)';
                e.target.style.borderColor = 'var(--color-border-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isFixingWorkout) {
                e.target.style.color = 'var(--color-text-tertiary)';
                e.target.style.borderColor = 'var(--color-border-secondary)';
              }
            }}
          >
            {isFixingWorkout ? '...' : '⚡ Fix'}
          </button>
        )}
      </div>

      {/* Workout blocks */}
      {workout.blocks && workout.blocks.length > 0 && (
        <div>
          {workout.blocks.map((block, index) => {
            const isLast = index === workout.blocks.length - 1;
            
            // Format sub text (zone/HR - notes removed, shown in popover)
            const subParts = [];
            if (block.heartRateZone) {
              const zoneMatch = block.heartRateZone.match(/Zone\s*(\d+)(?:\s*[–-]\s*Zone\s*(\d+))?/i);
              if (zoneMatch) {
                if (zoneMatch[2]) {
                  subParts.push(`Z${zoneMatch[1]}–Z${zoneMatch[2]}`);
                } else {
                  subParts.push(`Z${zoneMatch[1]}`);
                }
              }
              
              // Extract HR range
              const hrMatch = block.heartRateZone.match(/(\d+)\s*[–-]\s*(\d+)\s*bpm/i);
              if (hrMatch) {
                subParts.push(`${hrMatch[1]}–${hrMatch[2]} bpm`);
              }
            }
            
            return (
              <>
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 16px',
                    borderBottom: (isLast && openNoteIndex !== index) ? 'none' : '0.5px solid var(--color-border-tertiary)',
                    gap: '12px'
                  }}
                >
                  {/* Left side */}
                  <div style={{ 
                    flex: 1, 
                    minWidth: 0,
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 500,
                      color: 'var(--color-text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {block.title}
                    </div>
                    {subParts.length > 0 && (
                      <div style={{
                        fontSize: '10px',
                        color: 'var(--color-text-tertiary)',
                        marginTop: '2px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {subParts.join(' · ')}
                      </div>
                    )}
                  </div>
                  
                  {/* Right side */}
                  <div style={{
                    flexShrink: 0,
                    maxWidth: '140px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: '3px',
                    paddingLeft: '12px'
                  }}>
                    {block.pace && (
                      <div style={{
                        fontSize: '12px',
                        fontWeight: 500,
                        color: 'var(--color-text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '140px',
                        textAlign: 'right'
                      }}>
                        {formatBlockPace(block.pace)}
                      </div>
                    )}
                    {(block.distance || block.duration) && (
                      <div style={{
                        fontSize: '10px',
                        color: 'var(--color-text-tertiary)',
                        whiteSpace: 'nowrap',
                        textAlign: 'right'
                      }}>
                        {[block.distance, block.duration ? `${block.duration} min` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    )}
                    {block.notes && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenNoteIndex(openNoteIndex === index ? null : index);
                        }}
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          border: '0.5px solid var(--color-border-secondary)',
                          background: 'var(--color-background-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0,
                          marginTop: '2px',
                          flexShrink: 0
                        }}
                      >
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 500,
                          color: 'var(--color-text-tertiary)',
                          lineHeight: 1
                        }}>
                          i
                        </span>
                      </button>
                    )}
                  </div>
                </div>
                {openNoteIndex === index && block.notes && (
                  <div style={{
                    background: 'var(--color-background-secondary)',
                    borderBottom: isLast ? 'none' : '0.5px solid var(--color-border-tertiary)',
                    padding: '10px 16px',
                    fontSize: '12px',
                    color: 'var(--color-text-secondary)',
                    lineHeight: '1.6'
                  }}>
                    {block.notes}
                  </div>
                )}
              </>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div style={{
        borderTop: '0.5px solid var(--color-border-tertiary)',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        {isSyncedFromStrava && (
          <div style={{
            fontSize: '10px',
            color: 'var(--color-text-tertiary)',
            textAlign: 'center'
          }}>
            Synced from Strava
          </div>
        )}
        {onPostpone && (
          <button
            onClick={onPostpone}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '13px',
              fontWeight: 500,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-secondary)',
              transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'var(--color-background-secondary)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'none';
            }}
          >
            Postpone workout
          </button>
        )}
      </div>
    </div>
  );
};

export default WorkoutDisplay;
