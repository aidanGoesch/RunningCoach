const WorkoutBlock = ({ block }) => {
  return (
    <div className="workout-block">
      <div className="block-title">{block.title}</div>
      <div className="block-details">
        {block.distance && (
          <div className="detail-item">
            <span className="detail-label">Distance</span>
            <span className="detail-value">{block.distance}</span>
          </div>
        )}
        {block.pace && (
          <div className="detail-item">
            <span className="detail-label">Pace</span>
            <span className="detail-value">{block.pace}</span>
          </div>
        )}
        {block.duration && (
          <div className="detail-item">
            <span className="detail-label">Duration</span>
            <span className="detail-value">{block.duration}</span>
          </div>
        )}
      </div>
      {block.notes && (
        <div style={{ marginTop: '10px', fontSize: '14px', color: '#7f8c8d' }}>
          {block.notes}
        </div>
      )}
    </div>
  );
};

const WorkoutDisplay = ({ workout, onWorkoutClick, isCompleted = false }) => {
  if (!workout) return null;

  // Calculate workout summary
  const totalDistance = workout.blocks?.reduce((sum, block) => {
    if (block.distance) {
      const distanceStr = block.distance.toLowerCase().trim();
      
      // Handle interval formats like "4x800m" or "6x400m"
      if (distanceStr.includes('x') && (distanceStr.includes('m') || distanceStr.includes('meter'))) {
        const intervalMatch = distanceStr.match(/(\d+)\s*x\s*(\d+)\s*m/);
        if (intervalMatch) {
          const reps = parseFloat(intervalMatch[1]);
          const meters = parseFloat(intervalMatch[2]);
          const totalMeters = reps * meters;
          const miles = totalMeters / 1609.34; // Convert meters to miles
          return sum + miles;
        }
      }
      
      // Handle meters (e.g., "800m", "1600 meters")
      if (distanceStr.includes('m') && !distanceStr.includes('mile')) {
        const meterMatch = distanceStr.match(/(\d+\.?\d*)\s*m/);
        if (meterMatch) {
          const meters = parseFloat(meterMatch[1]);
          const miles = meters / 1609.34; // Convert meters to miles
          return sum + miles;
        }
      }
      
      // Handle range in miles (e.g., "3-4 miles")
      if (distanceStr.includes('-') && distanceStr.includes('mile')) {
        const rangeMatch = distanceStr.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)\s*mile/);
        if (rangeMatch) {
          const min = parseFloat(rangeMatch[1]);
          const max = parseFloat(rangeMatch[2]);
          return sum + ((min + max) / 2); // Use average of range
        }
      }
      
      // Handle single value in miles (e.g., "1.5 miles", "0.5 miles", "1 mile")
      if (distanceStr.includes('mile')) {
        const mileMatch = distanceStr.match(/(\d+\.?\d*)\s*mile/);
        if (mileMatch) {
          const miles = parseFloat(mileMatch[1]);
          return sum + (isNaN(miles) ? 0 : miles);
        }
      }
      
      // Fallback: try to extract any number (assume miles if no unit specified)
      const numberMatch = distanceStr.match(/(\d+\.?\d*)/);
      if (numberMatch) {
        const distance = parseFloat(numberMatch[1]);
        // If it's a large number (>20) and no unit, might be meters - but be conservative
        // Only assume miles if it's a reasonable number
        if (distance <= 20) {
          return sum + distance;
        }
      }
    }
    return sum;
  }, 0) || 0;

  const totalDuration = workout.blocks?.reduce((sum, block) => {
    if (block.duration) {
      // Handle ranges like "30-45 mins" by taking the average
      const durationStr = block.duration.toLowerCase();
      if (durationStr.includes('-')) {
        const range = durationStr.match(/(\d+)-(\d+)/);
        if (range) {
          const min = parseFloat(range[1]);
          const max = parseFloat(range[2]);
          return sum + ((min + max) / 2);
        }
      }
      // Handle single numbers
      const duration = parseFloat(durationStr.replace(/[^\d.]/g, ''));
      return sum + (isNaN(duration) ? 0 : duration);
    }
    return sum;
  }, 0) || 0;

  // Determine workout type - check workout.type first, then title, then blocks
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
  } else if (workout.title) {
    // Check title for workout type
    const titleLower = workout.title.toLowerCase();
    if (titleLower.includes('recovery') || titleLower.includes('pt')) {
      workoutType = 'Recovery / PT';
    } else if (titleLower.includes('speed') || titleLower.includes('interval') || titleLower.includes('tempo')) {
      workoutType = 'Speed Work';
    } else if (titleLower.includes('long')) {
      workoutType = 'Long Run';
    } else if (titleLower.includes('easy')) {
      workoutType = 'Easy Run';
    }
  } else if (workout.blocks?.[0]?.title?.includes('Warm')) {
    // Fallback to checking blocks
    if (workout.blocks.find(b => b.title?.includes('Interval') || b.title?.includes('Tempo') || b.title?.includes('Speed'))) {
      workoutType = 'Speed Work';
    } else if (workout.blocks.find(b => b.title?.includes('Long') || b.title?.includes('Steady'))) {
      workoutType = 'Long Run';
    }
  }

  return (
    <div className="workout-display">
      <div style={{ marginBottom: isCompleted ? '14px' : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div className="workout-title">{workout.title}</div>
          {isCompleted && (
            <div style={{
              padding: '8px 12px',
              borderRadius: '999px',
              background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.30), rgba(16, 185, 129, 0.18))',
              border: '1px solid rgba(34, 197, 94, 0.50)',
              color: 'var(--text-color)',
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
              boxShadow: '0 10px 30px rgba(34, 197, 94, 0.18)',
              animation: 'completedPulse 1.8s ease-in-out infinite'
            }}>
              ✅ Completed
            </div>
          )}
        </div>

        {isCompleted && (
          <div style={{
            marginTop: '12px',
            padding: '14px 14px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.18), rgba(59, 130, 246, 0.12))',
            border: '1px solid rgba(34, 197, 94, 0.25)',
            boxShadow: '0 12px 40px rgba(34, 197, 94, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ fontSize: '14px', fontWeight: 900, color: 'var(--text-color)' }}>
                Workout Completed
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                You showed up today. That’s how fitness is built.
              </div>
            </div>
            <div style={{ fontSize: '22px', lineHeight: 1 }}>
              🏁
            </div>
          </div>
        )}
      </div>
      
      <div 
        className="workout-block clickable"
        onClick={() => onWorkoutClick && onWorkoutClick()}
        style={{
          cursor: 'pointer',
          ...(isCompleted
            ? {
                border: '1px solid rgba(34, 197, 94, 0.35)',
                boxShadow: '0 16px 48px rgba(34, 197, 94, 0.10)'
              }
            : {})
        }}
      >
        <div className="block-title">Workout Overview</div>
        <div className="block-details">
          <div className="detail-item">
            <span className="detail-label">Type</span>
            <span className="detail-value">{workoutType}</span>
          </div>
          {totalDistance > 0 && (
            <div className="detail-item">
              <span className="detail-label">Total Distance</span>
              <span className="detail-value">{totalDistance.toFixed(1)} mi</span>
            </div>
          )}
          {totalDuration > 0 && (
            <div className="detail-item">
              <span className="detail-label">Est. Duration</span>
              <span className="detail-value">{Math.round(totalDuration)} min</span>
            </div>
          )}
          <div className="detail-item">
            <span className="detail-label">Blocks</span>
            <span className="detail-value">{workout.blocks?.length || 0}</span>
          </div>
        </div>
        
        <div style={{ 
          marginTop: '15px',
          padding: '12px',
          background: isCompleted
            ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.16), rgba(34, 197, 94, 0.08))'
            : 'var(--grid-color)',
          borderRadius: '8px',
          fontSize: '14px',
          color: 'var(--text-secondary)',
          textAlign: 'center'
        }}>
          {isCompleted ? 'Tap to review the plan + details →' : 'Click to view detailed workout instructions →'}
        </div>
      </div>

      <style>{`
        @keyframes completedPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
      `}</style>
    </div>
  );
};

export default WorkoutDisplay;
