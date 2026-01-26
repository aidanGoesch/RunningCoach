import { useState, useEffect } from 'react';

const WeeklyPlan = ({ activities, onWorkoutClick, onGenerateWeeklyPlan }) => {
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(null);

  useEffect(() => {
    // Get current week (Monday-Sunday)
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7)); // Get Monday
    monday.setHours(0, 0, 0, 0);
    
    const weekKey = `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`;
    setCurrentWeek({ start: monday, key: weekKey });
    
    // Load weekly plan
    const storedPlan = localStorage.getItem(`weekly_plan_${weekKey}`);
    if (storedPlan) {
      setWeeklyPlan(JSON.parse(storedPlan));
    } else {
      // Auto-generate plan if none exists
      onGenerateWeeklyPlan();
    }
  }, []);

  const getDayInfo = (dayOffset) => {
    if (!currentWeek) return null;
    
    const date = new Date(currentWeek.start);
    date.setDate(date.getDate() + dayOffset);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    
    const isToday = date.getTime() === today.getTime();
    const isPast = date < today;
    
    // Check if there's an activity for this day
    const dayActivities = activities.filter(activity => {
      const activityDate = new Date(activity.start_date);
      activityDate.setHours(0, 0, 0, 0);
      return activityDate.getTime() === date.getTime() && activity.type === 'Run';
    });
    
    const hasRun = dayActivities.length > 0;
    
    return {
      date,
      isToday,
      isPast,
      hasRun,
      dayName: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][dayOffset],
      fullDayName: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][dayOffset]
    };
  };

  const getPlannedWorkout = (dayOffset) => {
    if (!weeklyPlan) return null;
    const dayName = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][dayOffset];
    return weeklyPlan[dayName];
  };

  const isRunningDay = (dayOffset) => {
    return [1, 3, 6].includes(dayOffset); // Tuesday, Thursday, Sunday
  };

  const shouldShowGenerateButton = () => {
    // Never show the manual generate button since we auto-generate
    return false;
  };

  return (
    <div className="workout-display" style={{ marginBottom: '20px' }}>
      <div className="workout-title">
        Weekly Training Plan
        {currentWeek && ` - Week of ${currentWeek.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
      </div>
      
      {shouldShowGenerateButton() && (
        <div className="workout-block" style={{ textAlign: 'center', marginBottom: '15px' }}>
          <button 
            className="btn btn-primary"
            onClick={onGenerateWeeklyPlan}
            style={{ width: '100%' }}
          >
            Generate This Week's Training Plan
          </button>
        </div>
      )}
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
        {[0, 1, 2, 3, 4, 5, 6].map(dayOffset => {
          const dayInfo = getDayInfo(dayOffset);
          const plannedWorkout = getPlannedWorkout(dayOffset);
          const isRunDay = isRunningDay(dayOffset);
          
          if (!dayInfo) return null;
          
          const cardStyle = {
            padding: '12px 8px',
            borderRadius: '8px',
            textAlign: 'center',
            fontSize: '12px',
            cursor: (isRunDay && plannedWorkout && !dayInfo.hasRun) ? 'pointer' : 'default',
            border: dayInfo.isToday ? '2px solid var(--accent)' : '1px solid var(--border-color)',
            backgroundColor: dayInfo.hasRun 
              ? 'var(--accent)' 
              : isRunDay && plannedWorkout
                ? 'var(--card-bg)'
                : 'var(--grid-color)',
            color: dayInfo.hasRun ? 'white' : 'var(--text-color)',
            opacity: dayInfo.isPast && !dayInfo.hasRun && isRunDay ? 0.6 : 1
          };
          
          const handleClick = () => {
            if (isRunDay && plannedWorkout && !dayInfo.hasRun && onWorkoutClick) {
              onWorkoutClick(plannedWorkout, dayInfo.fullDayName);
            }
          };
          
          return (
            <div key={dayOffset} style={cardStyle} onClick={handleClick}>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                {dayInfo.dayName}
              </div>
              <div style={{ fontSize: '10px', marginBottom: '4px' }}>
                {dayInfo.date.getDate()}
              </div>
              <div style={{ fontSize: '10px', color: dayInfo.hasRun ? 'white' : 'var(--text-secondary)' }}>
                {dayInfo.hasRun ? (
                  'Completed'
                ) : isRunDay ? (
                  plannedWorkout ? (
                    dayOffset === 1 ? 'Easy' : dayOffset === 3 ? 'Speed' : 'Long'
                  ) : (
                    weeklyPlan ? 'Rest' : '?'
                  )
                ) : (
                  'Recovery'
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {weeklyPlan && (
        <div style={{ 
          marginTop: '15px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          textAlign: 'center'
        }}>
          Click on planned run days to view workout details
        </div>
      )}
    </div>
  );
};

export default WeeklyPlan;
