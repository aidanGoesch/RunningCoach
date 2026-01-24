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

const WorkoutDisplay = ({ workout }) => {
  if (!workout) return null;

  return (
    <div className="workout-display">
      <div className="workout-title">{workout.title}</div>
      {workout.blocks?.map((block, index) => (
        <WorkoutBlock key={index} block={block} />
      ))}
    </div>
  );
};

export default WorkoutDisplay;
