import { useState, useEffect } from 'react';

const WeeklyProgress = ({ activities }) => {
  const [weeklyData, setWeeklyData] = useState(null);

  useEffect(() => {
    if (!activities || activities.length === 0) return;

    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Start of current week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);

    // Get this week's running activities
    const thisWeekActivities = activities.filter(activity => {
      const activityDate = new Date(activity.start_date);
      return activityDate >= startOfWeek && activity.type === 'Run';
    });

    // Calculate weekly stats
    const totalMiles = thisWeekActivities.reduce((sum, activity) => 
      sum + (activity.distance / 1609.34), 0
    );

    const totalTime = thisWeekActivities.reduce((sum, activity) => 
      sum + activity.moving_time, 0
    );

    // Track runs by day
    const runsByDay = {
      0: null, // Sunday
      1: null, // Monday  
      2: null, // Tuesday
      3: null, // Wednesday
      4: null, // Thursday
      5: null, // Friday
      6: null  // Saturday
    };

    thisWeekActivities.forEach(activity => {
      const day = new Date(activity.start_date).getDay();
      if (!runsByDay[day]) {
        runsByDay[day] = {
          distance: activity.distance / 1609.34,
          name: activity.name
        };
      }
    });

    setWeeklyData({
      totalMiles: totalMiles.toFixed(1),
      totalTime: Math.floor(totalTime / 60),
      runCount: thisWeekActivities.length,
      runsByDay
    });
  }, [activities]);

  if (!weeklyData) return null;

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const runningDays = [0, 2, 4]; // Sunday, Tuesday, Thursday
  const today = new Date().getDay();

  return (
    <div className="workout-display" style={{ marginBottom: '20px' }}>
      <div className="workout-title">📊 This Week's Progress</div>
      
      <div className="workout-block">
        <div className="block-details">
          <div className="detail-item">
            <span className="detail-label">Total Miles</span>
            <span className="detail-value">{weeklyData.totalMiles} mi</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Total Time</span>
            <span className="detail-value">{weeklyData.totalTime} min</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Runs</span>
            <span className="detail-value">{weeklyData.runCount}/3</span>
          </div>
        </div>
      </div>

      <div className="workout-block">
        <div className="block-title">Weekly Schedule</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginTop: '10px' }}>
          {days.map((day, index) => {
            const isRunningDay = runningDays.includes(index);
            const hasRun = weeklyData.runsByDay[index];
            const isToday = index === today;
            
            return (
              <div
                key={day}
                style={{
                  padding: '8px 4px',
                  borderRadius: '6px',
                  textAlign: 'center',
                  fontSize: '12px',
                  border: isToday ? '2px solid #3498db' : '1px solid var(--border-color)',
                  backgroundColor: hasRun 
                    ? '#2ecc71' 
                    : isRunningDay 
                      ? 'var(--card-bg)' 
                      : '#95a5a6',
                  color: hasRun || !isRunningDay ? 'white' : 'var(--text-color)'
                }}
              >
                <div style={{ fontWeight: '600' }}>{day}</div>
                <div style={{ fontSize: '10px', marginTop: '2px' }}>
                  {hasRun ? (
                    `${hasRun.distance.toFixed(1)}mi`
                  ) : isRunningDay ? (
                    index === 0 ? 'Long' : index === 2 ? 'Easy' : 'Speed'
                  ) : (
                    'Rest'
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WeeklyProgress;
