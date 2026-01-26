const ActivityCard = ({ activity, onClick }) => {
  const formatDistance = (meters) => (meters / 1609.34).toFixed(2);
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  const formatPace = (speedMs) => {
    const paceMinPerMile = 26.8224 / speedMs;
    const minutes = Math.floor(paceMinPerMile);
    const seconds = Math.round((paceMinPerMile - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/mile`;
  };

  return (
    <div 
      className="workout-block clickable" 
      onClick={() => onClick(activity.id)}
    >
      <div className="block-title">{activity.name}</div>
      <div className="block-details">
        <div className="detail-item">
          <span className="detail-label">Distance</span>
          <span className="detail-value">{formatDistance(activity.distance)} mi</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Duration</span>
          <span className="detail-value">{formatDuration(activity.moving_time)}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Avg Pace</span>
          <span className="detail-value">{formatPace(activity.average_speed)}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Date</span>
          <span className="detail-value">{new Date(activity.start_date).toLocaleDateString()}</span>
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
  );
};

const ActivitiesDisplay = ({ activities, onActivityClick }) => {
  if (!activities || activities.length === 0) return null;

  // Sort by date (most recent first)
  const sortedActivities = [...activities].sort((a, b) => 
    new Date(b.start_date) - new Date(a.start_date)
  );

  return (
    <div className="workout-display">
      <div className="workout-title">Recent Activities</div>
      {sortedActivities.slice(0, 5).map((activity) => (
        <ActivityCard 
          key={activity.id} 
          activity={activity} 
          onClick={onActivityClick}
        />
      ))}
    </div>
  );
};

export default ActivitiesDisplay;
