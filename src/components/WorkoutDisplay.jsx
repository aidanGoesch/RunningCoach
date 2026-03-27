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
      <div className="workout-display dashboard-workout-card dashboard-workout-empty">
        <div className="dashboard-workout-empty-text">
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

  // Check if today's workout is completed by checking activity matches
  const isWorkoutCompleted = (() => {
    // First check the isCompleted prop (checks if any run happened today)
    if (isCompleted) return true;
    
    // Then check if today's workout is matched to an activity
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

  // Check if workout is synced from Strava (for display purposes)
  const isSyncedFromStrava = isWorkoutCompleted;

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
      className="workout-display dashboard-workout-card"
    >
      {/* Header */}
      <div className="dashboard-workout-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="dashboard-workout-meta-row">
            {/* Type tag */}
            <div className="dashboard-workout-type">
              {workoutType}
            </div>
            {/* Completion indicator */}
            {isWorkoutCompleted && (
              <div className="dashboard-workout-completed">
                <span style={{ fontSize: '12px' }}>✓</span>
                Completed
              </div>
            )}
          </div>
          
          {/* Title */}
          <div className="dashboard-workout-title">
            {workout.title}
          </div>
          
          {/* Target summary */}
          <div className="dashboard-workout-summary">
            {getTargetSummary()}
          </div>
        </div>
        
        {/* Fix button */}
        {onFix && (
          <button
            onClick={onFix}
            disabled={isFixingWorkout}
            className="fix-workout-btn"
          >
            {isFixingWorkout ? 'Fixing…' : 'Fix Workout'}
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
      <div className="dashboard-workout-footer">
        {isSyncedFromStrava && !isWorkoutCompleted && (
          <div className="dashboard-workout-synced">
            Synced from Strava
          </div>
        )}
        {onPostpone && !isWorkoutCompleted && (
          <button
            onClick={onPostpone}
            className="btn btn-secondary dashboard-workout-postpone-btn"
          >
            Postpone workout
          </button>
        )}
      </div>
    </div>
  );
};

export default WorkoutDisplay;
