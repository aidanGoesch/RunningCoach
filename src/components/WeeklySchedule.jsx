/**
 * WeeklySchedule Component
 * 
 * Displays 7-day workout schedule with planned workouts and completion status.
 * 
 * @param {Object} props
 * @param {Object} props.weeklyPlan - Weekly plan object with day workouts
 * @param {Array} props.activities - Array of activity objects
 * @param {Object} props.currentWeek - Week object with start date
 * @param {Function} props.onWorkoutClick - Click handler for planned workouts
 */

import { useMemo, memo } from 'react';

const WeeklySchedule = memo(({ weeklyPlan, activities, currentWeek, onWorkoutClick }) => {
  // Calculate day info for each day of the week
  const dayInfo = useMemo(() => {
    try {
      if (!currentWeek || !activities || !Array.isArray(activities)) return {};

      const cache = {};
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Pre-filter activities by date for efficiency
      const activitiesByDate = new Map();
      activities.forEach(activity => {
        if (!activity || !activity.start_date) return;
        try {
          if (activity.type === 'Run') {
            const activityDate = new Date(activity.start_date);
            if (isNaN(activityDate.getTime())) return;
            activityDate.setHours(0, 0, 0, 0);
            const dateKey = activityDate.getTime();
            if (!activitiesByDate.has(dateKey)) {
              activitiesByDate.set(dateKey, []);
            }
            activitiesByDate.get(dateKey).push(activity);
          }
        } catch (error) {
          // Skip invalid activity
        }
      });

      const startDate = new Date(currentWeek.start);
      if (isNaN(startDate.getTime())) return {};

      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + dayOffset);
        date.setHours(0, 0, 0, 0);

        const dateKey = date.getTime();
        const dayActivities = activitiesByDate.get(dateKey) || [];

        cache[dayOffset] = {
          date,
          isToday: date.getTime() === today.getTime(),
          isPast: date < today,
          hasRun: dayActivities.length > 0,
          dayName: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][dayOffset],
          fullDayName: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][dayOffset]
        };
      }

      return cache;
    } catch (error) {
      console.error('Error calculating day info:', error);
      return {};
    }
  }, [currentWeek, activities]);

  const getPlannedWorkout = (dayOffset) => {
    if (!weeklyPlan) return null;
    const dayName = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][dayOffset];
    return weeklyPlan[dayName];
  };

  const isRunningDay = (dayOffset) => {
    return [1, 3, 6].includes(dayOffset); // Tuesday, Thursday, Sunday
  };

  const handleDayClick = (dayOffset, plannedWorkout, dayInfo) => {
    if (isRunningDay(dayOffset) && plannedWorkout && !dayInfo.hasRun && onWorkoutClick) {
      onWorkoutClick(plannedWorkout, dayInfo.fullDayName);
    }
  };

  return (
    <div className="workout-block" style={{ 
      backgroundColor: '#1f1f1f',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '16px',
      border: '1px solid var(--border-color)'
    }}>
      <div className="block-title">Weekly Schedule</div>
      <div style={{ 
        overflowX: 'auto', 
        paddingBottom: '10px',
        marginTop: '10px'
      }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(7, minmax(80px, 1fr))', 
          gap: '8px',
          minWidth: '560px'
        }}>
          {[0, 1, 2, 3, 4, 5, 6].map(dayOffset => {
            const info = dayInfo[dayOffset];
            const plannedWorkout = getPlannedWorkout(dayOffset);
            const isRunDay = isRunningDay(dayOffset);
            
            if (!info) return null;
            
            const cardStyle = {
              padding: '12px 8px',
              borderRadius: '8px',
              textAlign: 'center',
              fontSize: '12px',
              cursor: (isRunDay && plannedWorkout && !info.hasRun) ? 'pointer' : 'default',
              border: info.isToday ? '2px solid var(--accent)' : '1px solid var(--border-color)',
              backgroundColor: info.hasRun 
                ? 'var(--accent)' 
                : isRunDay && plannedWorkout
                  ? 'var(--card-bg)'
                  : 'var(--grid-color)',
              color: info.hasRun ? 'white' : 'var(--text-color)',
              opacity: info.isPast && !info.hasRun && isRunDay ? 0.6 : 1
            };
            
            return (
              <div 
                key={dayOffset} 
                style={cardStyle} 
                onClick={() => handleDayClick(dayOffset, plannedWorkout, info)}
              >
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                  {info.dayName}
                </div>
                <div style={{ fontSize: '10px', marginBottom: '4px' }}>
                  {info.date.getDate()}
                </div>
                <div style={{ fontSize: '10px', color: info.hasRun ? 'white' : 'var(--text-secondary)' }}>
                  {info.hasRun ? (
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
      </div>
    </div>
  );
});

WeeklySchedule.displayName = 'WeeklySchedule';

export default WeeklySchedule;
