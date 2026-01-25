import { useState, useEffect } from 'react';

const WeeklyProgress = ({ activities }) => {
  const [weeklyData, setWeeklyData] = useState(null);

  useEffect(() => {
    if (!activities || activities.length === 0) return;

    // Find the most recent week with running activities
    const runningActivities = activities.filter(activity => activity.type === 'Run');
    if (runningActivities.length === 0) return;

    // Get the most recent activity date and find that week's Sunday
    const mostRecentActivity = new Date(runningActivities[0].start_date);
    const startOfWeek = new Date(mostRecentActivity);
    startOfWeek.setDate(mostRecentActivity.getDate() - mostRecentActivity.getDay()); // Go to Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    // Get that week's running activities
    const weekActivities = runningActivities.filter(activity => {
      const activityDate = new Date(activity.start_date);
      return activityDate >= startOfWeek && activityDate < endOfWeek;
    });

    // Calculate weekly stats
    const totalMiles = weekActivities.reduce((sum, activity) => 
      sum + (activity.distance / 1609.34), 0
    );

    const totalTime = weekActivities.reduce((sum, activity) => 
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

    weekActivities.forEach(activity => {
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
      runCount: weekActivities.length,
      runsByDay,
      weekStart: startOfWeek
    });
  }, [activities]);

  if (!weeklyData) {
    // Show empty state with schedule
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const runningDays = [0, 2, 4]; // Sunday, Tuesday, Thursday
    const today = new Date().getDay();

    return (
      <div className="workout-display" style={{ marginBottom: '20px' }}>
        <div className="workout-title">
          {weeklyData.weekStart ? 
            `Week of ${weeklyData.weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 
            'This Week\'s Progress'
          }
        </div>
        
        <div className="workout-block">
          <div className="block-details">
            <div className="detail-item">
              <span className="detail-label">Total Miles</span>
              <span className="detail-value">0.0 mi</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Total Time</span>
              <span className="detail-value">0 min</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Runs</span>
              <span className="detail-value">0/3</span>
            </div>
          </div>
        </div>

        <div className="workout-block">
          <div className="block-title">Weekly Schedule</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginTop: '10px' }}>
            {days.map((day, index) => {
              const isRunningDay = runningDays.includes(index);
              const isToday = index === today;
              
              return (
                <div
                  key={day}
                  style={{
                    padding: '8px 4px',
                    borderRadius: '6px',
                    textAlign: 'center',
                    fontSize: '12px',
                    border: isToday ? '2px solid var(--accent)' : '1px solid var(--border-color)',
                    backgroundColor: isRunningDay ? 'var(--card-bg)' : 'var(--grid-color)',
                    color: 'var(--text-color)'
                  }}
                >
                  <div style={{ fontWeight: '600' }}>{day}</div>
                  <div style={{ fontSize: '10px', marginTop: '2px', color: 'var(--text-secondary)' }}>
                    {isRunningDay ? (
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
  }

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const runningDays = [0, 2, 4]; // Sunday, Tuesday, Thursday
  const today = new Date().getDay();

  return (
    <div className="workout-display" style={{ marginBottom: '20px' }}>
      <div className="workout-title">This Week's Progress</div>
      
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
                  border: isToday ? '2px solid var(--accent)' : '1px solid var(--border-color)',
                  backgroundColor: hasRun 
                    ? 'var(--accent)' 
                    : isRunningDay 
                      ? 'var(--card-bg)' 
                      : 'var(--grid-color)',
                  color: hasRun ? 'white' : 'var(--text-color)'
                }}
              >
                <div style={{ fontWeight: '600' }}>{day}</div>
                <div style={{ fontSize: '10px', marginTop: '2px', color: hasRun ? 'white' : 'var(--text-secondary)' }}>
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
