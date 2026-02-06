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
    // Use the type field if available
    if (workout.type === 'speed' || workout.type === 'Speed Work') {
      workoutType = 'Speed Work';
    } else if (workout.type === 'long' || workout.type === 'Long Run') {
      workoutType = 'Long Run';
    } else if (workout.type === 'easy' || workout.type === 'Easy Run') {
      workoutType = 'Easy Run';
    }
  } else if (workout.title) {
    // Check title for workout type
    const titleLower = workout.title.toLowerCase();
    if (titleLower.includes('speed') || titleLower.includes('interval') || titleLower.includes('tempo')) {
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div className="workout-title">{workout.title}</div>
        {isCompleted && (
          <div style={{
            padding: '6px 10px',
            borderRadius: '999px',
            backgroundColor: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid rgba(34, 197, 94, 0.35)',
            color: 'var(--text-color)',
            fontSize: '12px',
            fontWeight: 700,
            whiteSpace: 'nowrap'
          }}>
            Completed
          </div>
        )}
      </div>
      
      <div 
        className="workout-block clickable"
        onClick={() => onWorkoutClick && onWorkoutClick()}
        style={{ cursor: 'pointer' }}
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
          backgroundColor: 'var(--grid-color)',
          borderRadius: '8px',
          fontSize: '14px',
          color: 'var(--text-secondary)',
          textAlign: 'center'
        }}>
          {isCompleted ? 'Nice work — workout completed today.' : 'Click to view detailed workout instructions →'}
        </div>
      </div>
    </div>
  );
};

export default WorkoutDisplay;
