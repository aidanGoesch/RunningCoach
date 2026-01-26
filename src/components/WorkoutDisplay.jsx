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

const WorkoutDisplay = ({ workout, onWorkoutClick }) => {
  if (!workout) return null;

  // Calculate workout summary
  const totalDistance = workout.blocks?.reduce((sum, block) => {
    if (block.distance) {
      const distance = parseFloat(block.distance.replace(/[^\d.]/g, ''));
      return sum + (isNaN(distance) ? 0 : distance);
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

  const workoutType = workout.blocks?.[0]?.title?.includes('Warm') ? 
    (workout.blocks.find(b => b.title?.includes('Interval') || b.title?.includes('Tempo')) ? 'Speed Work' :
     workout.blocks.find(b => b.title?.includes('Long') || b.title?.includes('Steady')) ? 'Long Run' : 'Easy Run') :
    'Easy Run';

  return (
    <div className="workout-display">
      <div className="workout-title">{workout.title}</div>
      
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
          Click to view detailed workout instructions →
        </div>
      </div>
    </div>
  );
};

export default WorkoutDisplay;
