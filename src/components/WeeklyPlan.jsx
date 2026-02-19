import { useState, useEffect, useRef } from 'react';
import { dataService } from '../services/supabase';

const WeeklyPlan = ({ activities, onWorkoutClick, onGenerateWeeklyPlan, apiKey, onActivitiesChange }) => {
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(null);
  const weeklyPlanRef = useRef(null);

  useEffect(() => {
    // Get current week (Monday-Sunday)
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7)); // Get Monday
    monday.setHours(0, 0, 0, 0);
    
    const weekKey = `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`;
    setCurrentWeek({ start: monday, key: weekKey });
    
    // Load weekly plan
    const loadWeeklyPlan = async () => {
      console.log('Loading weekly plan for key:', weekKey);
      try {
        // Prioritize Supabase (shared across devices), then localStorage as fallback
        let parsedPlan = null;
        const storedPlan = await dataService.get(`weekly_plan_${weekKey}`).catch(() => null);
        
        if (storedPlan) {
          parsedPlan = JSON.parse(storedPlan);
          console.log('Loaded weekly plan from Supabase:', parsedPlan);
          console.log('Supabase plan has postpone info:', !!parsedPlan._postponements, parsedPlan._postponements);
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/6638e027-4723-4b24-b270-caaa7c40bae9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'WeeklyPlan.jsx:28','message':'Loaded plan from Supabase',data:{weekKey,hasPostponements:!!parsedPlan._postponements,postponementsKeys:parsedPlan._postponements?Object.keys(parsedPlan._postponements):[],hasLocalStoragePlan:!!localStorage.getItem(`weekly_plan_${weekKey}`)},timestamp:Date.now(),runId:'supabase-load',hypothesisId:'I'})}).catch(()=>{});
          // #endregion
        } else {
          // Fallback to localStorage
          const localPlan = localStorage.getItem(`weekly_plan_${weekKey}`);
          if (localPlan) {
            parsedPlan = JSON.parse(localPlan);
            console.log('Loaded weekly plan from localStorage (fallback):', parsedPlan);
            console.log('LocalStorage plan has postpone info:', !!parsedPlan._postponements, parsedPlan._postponements);
            // Upload to Supabase so it's available on other devices
            await dataService.set(`weekly_plan_${weekKey}`, JSON.stringify(parsedPlan)).catch(() => {});
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/6638e027-4723-4b24-b270-caaa7c40bae9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'WeeklyPlan.jsx:35','message':'Uploaded localStorage plan to Supabase',data:{weekKey,hasPostponements:!!parsedPlan._postponements,postponementsKeys:parsedPlan._postponements?Object.keys(parsedPlan._postponements):[]},timestamp:Date.now(),runId:'upload-to-supabase',hypothesisId:'I'})}).catch(()=>{});
            // #endregion
          }
        }
        
        if (parsedPlan) {
          // CRITICAL: If Supabase plan doesn't have postpone info, check if localStorage does and merge it
          // This handles the case where postpone was set on one device but Supabase doesn't have it yet
          if (!parsedPlan._postponements || Object.keys(parsedPlan._postponements).length === 0) {
            const localPlanWithPostpone = localStorage.getItem(`weekly_plan_${weekKey}`);
            if (localPlanWithPostpone) {
              try {
                const localParsed = JSON.parse(localPlanWithPostpone);
                if (localParsed._postponements && Object.keys(localParsed._postponements).length > 0) {
                  // localStorage has postpone info but Supabase plan doesn't - merge it
                  parsedPlan._postponements = localParsed._postponements;
                  // Save merged plan to Supabase
                  await dataService.set(`weekly_plan_${weekKey}`, JSON.stringify(parsedPlan)).catch(() => {});
                  console.log('Merged postpone info from localStorage into Supabase plan');
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/6638e027-4723-4b24-b270-caaa7c40bae9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'WeeklyPlan.jsx:52','message':'Merged postpone info from localStorage',data:{weekKey,postponementsKeys:Object.keys(parsedPlan._postponements)},timestamp:Date.now(),runId:'merge-postpone',hypothesisId:'I'})}).catch(()=>{});
                  // #endregion
                }
              } catch (e) {
                console.error('Failed to check localStorage plan:', e);
              }
            }
          }
          
          // Try to recover postpone info from old localStorage entry if still missing
          if (!parsedPlan._postponements || Object.keys(parsedPlan._postponements).length === 0) {
            const oldPostponeData = localStorage.getItem('postponed_workout');
            if (oldPostponeData) {
              try {
                const postponeData = JSON.parse(oldPostponeData);
                const postponeDate = new Date(postponeData.postponedDate);
                const today = new Date();
                const daysDiff = Math.floor((today - postponeDate) / (1000 * 60 * 60 * 24));
                
                // Only recover if it's within the last 7 days
                if (daysDiff >= 0 && daysDiff < 7) {
                  const dayNameMap = {
                    0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
                    4: 'thursday', 5: 'friday', 6: 'saturday'
                  };
                  const postponeDayOfWeek = postponeDate.getDay();
                  const postponeDayName = dayNameMap[postponeDayOfWeek];
                  
                  if (postponeDayName) {
                    if (!parsedPlan._postponements) {
                      parsedPlan._postponements = {};
                    }
                    parsedPlan._postponements[postponeDayName] = {
                      postponed: true,
                      reason: postponeData.reason,
                      date: postponeData.postponedDate,
                      originalDay: postponeDayName,
                      originalWorkout: postponeData.originalWorkout,
                      adjustment: postponeData.adjustment
                    };
                    // Save the recovered plan to both Supabase and localStorage
                    localStorage.setItem(`weekly_plan_${weekKey}`, JSON.stringify(parsedPlan));
                    await dataService.set(`weekly_plan_${weekKey}`, JSON.stringify(parsedPlan)).catch(() => {});
                    console.log('Recovered postpone info from old localStorage entry for', postponeDayName);
                  }
                }
              } catch (e) {
                console.error('Failed to recover postpone info:', e);
              }
            }
          }
          
          setWeeklyPlan(parsedPlan);
          weeklyPlanRef.current = parsedPlan;
          console.log('Weekly plan state set successfully');
        } else {
          console.log('No weekly plan found - NOT auto-generating to avoid API spam');
        }
      } catch (error) {
        console.error('Error loading weekly plan from Supabase:', error);
        // Fallback to localStorage
        console.log('Falling back to localStorage...');
        const localPlan = localStorage.getItem(`weekly_plan_${weekKey}`);
        console.log('localStorage weekly plan:', localPlan);
        if (localPlan) {
          const parsedPlan = JSON.parse(localPlan);
          setWeeklyPlan(parsedPlan);
          weeklyPlanRef.current = parsedPlan;
        } else {
          console.log('No weekly plan found in localStorage either - use Generate Weekly Plan button');
        }
      }
    };

    loadWeeklyPlan();
    
    // Set up interval to check for plan updates (e.g., after postponement)
    const checkInterval = setInterval(async () => {
      try {
        // Prioritize Supabase (shared across devices), then localStorage as fallback
        let planToCheck = null;
        const storedPlan = await dataService.get(`weekly_plan_${weekKey}`).catch(() => null);
        if (storedPlan) {
          planToCheck = storedPlan;
        } else {
          const localPlan = localStorage.getItem(`weekly_plan_${weekKey}`);
          if (localPlan) {
            planToCheck = localPlan;
          }
        }
        
        if (planToCheck) {
          const parsedPlan = typeof planToCheck === 'string' ? JSON.parse(planToCheck) : planToCheck;
          
          // CRITICAL: If the new plan doesn't have postpone info but current plan does, preserve it
          const currentHasPostponements = weeklyPlanRef.current?._postponements && Object.keys(weeklyPlanRef.current._postponements).length > 0;
          const newHasPostponements = parsedPlan._postponements && Object.keys(parsedPlan._postponements).length > 0;
          
          if (currentHasPostponements && !newHasPostponements) {
            parsedPlan._postponements = weeklyPlanRef.current._postponements;
            // Save the corrected plan immediately
            localStorage.setItem(`weekly_plan_${weekKey}`, JSON.stringify(parsedPlan));
            dataService.set(`weekly_plan_${weekKey}`, JSON.stringify(parsedPlan)).catch(() => {});
            console.log('Preserved postpone info in polling - plan was missing postpone data');
            // Update state with preserved postpone info
            weeklyPlanRef.current = parsedPlan;
            setWeeklyPlan(parsedPlan);
            return; // Skip further comparison since we've already updated
          }
          
          // Only update if plan actually changed (compare with ref to avoid dependency issues)
          const currentPlanStr = JSON.stringify(weeklyPlanRef.current);
          const newPlanStr = JSON.stringify(parsedPlan);
          
          if (currentPlanStr !== newPlanStr) {
            console.log('Weekly plan updated detected in polling');
            setWeeklyPlan(parsedPlan);
            weeklyPlanRef.current = parsedPlan;
          }
        }
      } catch (e) {
        console.error('Error checking plan updates in interval:', e);
      }
    }, 1000); // Check every second
    
    return () => clearInterval(checkInterval);
  }, [apiKey]); // Removed onGenerateWeeklyPlan from dependencies to prevent infinite loops

  // Re-match activities when they change and reload plan
  useEffect(() => {
    if (weeklyPlan && activities.length > 0 && currentWeek && onActivitiesChange) {
      // Create a simple hash of activity IDs to detect changes
      const activityIds = activities.map(a => a.id).sort().join(',');
      const lastActivityIds = localStorage.getItem(`last_activity_ids_${currentWeek.key}`);
      
      // Only update if activities actually changed
      if (activityIds !== lastActivityIds) {
        localStorage.setItem(`last_activity_ids_${currentWeek.key}`, activityIds);
        
        // Trigger matching in parent, then reload plan
        const updateMatches = async () => {
          await onActivitiesChange();
          // Small delay to ensure plan is saved, then reload
          setTimeout(async () => {
            try {
              const storedPlan = await dataService.get(`weekly_plan_${currentWeek.key}`);
              if (storedPlan) {
                const parsedPlan = JSON.parse(storedPlan);
                setWeeklyPlan(parsedPlan);
              } else {
                const localPlan = localStorage.getItem(`weekly_plan_${currentWeek.key}`);
                if (localPlan) {
                  setWeeklyPlan(JSON.parse(localPlan));
                }
              }
            } catch (error) {
              console.error('Error reloading weekly plan:', error);
            }
          }, 100);
        };
        updateMatches();
      }
    }
  }, [activities, currentWeek?.key, weeklyPlan, onActivitiesChange]);

  const getDayInfo = (dayOffset) => {
    if (!currentWeek) return null;
    
    const date = new Date(currentWeek.start);
    date.setDate(date.getDate() + dayOffset);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    
    const isToday = date.getTime() === today.getTime();
    const isPast = date < today;
    
    // Check if there's a matched workout for this day
    const dayName = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][dayOffset];
    const activityMatches = weeklyPlan?._activityMatches || {};
    const dayMatch = activityMatches[dayName];
    
    // Check if workout is matched to an activity
    const hasMatchedWorkout = !!dayMatch && dayMatch.activities && dayMatch.activities.length > 0;
    
    // Also check if there's any activity for this day (fallback)
    const dayActivities = activities.filter(activity => {
      const activityDate = new Date(activity.start_date);
      activityDate.setHours(0, 0, 0, 0);
      return activityDate.getTime() === date.getTime() && activity.type === 'Run';
    });
    
    const hasRun = hasMatchedWorkout || dayActivities.length > 0;
    
    // Check for postpone status
    const postponements = weeklyPlan?._postponements || {};
    const postponeInfo = postponements[dayName];
    const isPostponed = !!postponeInfo && postponeInfo.postponed;
    
    return {
      date,
      isToday,
      isPast,
      hasRun,
      hasMatchedWorkout,
      isPostponed,
      postponeInfo,
      dayName: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][dayOffset],
      fullDayName: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][dayOffset]
    };
  };

  const getPlannedWorkout = (dayOffset) => {
    if (!weeklyPlan) return null;
    const dayName = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][dayOffset];
    // If this day is postponed, always return null (don't show workout even if AI put one back)
    const postponements = weeklyPlan._postponements || {};
    const postponeInfo = postponements[dayName];
    if (postponeInfo && postponeInfo.postponed) {
      return null;
    }
    return weeklyPlan[dayName];
  };

  const getWeeklyStats = () => {
    if (!currentWeek || !activities) return { totalMiles: 0, totalTime: 0, runCount: 0 };

    const startOfWeek = new Date(currentWeek.start);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const weekActivities = activities.filter(activity => {
      const activityDate = new Date(activity.start_date);
      return activityDate >= startOfWeek && activityDate < endOfWeek && activity.type === 'Run';
    });

    const totalMiles = weekActivities.reduce((sum, activity) => 
      sum + (activity.distance / 1609.34), 0
    );

    const totalTime = weekActivities.reduce((sum, activity) => 
      sum + activity.moving_time, 0
    );

    return {
      totalMiles: totalMiles.toFixed(1),
      totalTime: Math.floor(totalTime / 60),
      runCount: weekActivities.length
    };
  };

  const isRunningDay = (dayOffset) => {
    return [1, 3, 6].includes(dayOffset); // Tuesday, Thursday, Sunday
  };

  const weeklyStats = getWeeklyStats();

  console.log('WeeklyPlan render - weeklyPlan:', weeklyPlan);
  console.log('WeeklyPlan render - currentWeek:', currentWeek);
  console.log('WeeklyPlan render - _postponements:', weeklyPlan?._postponements);
  
  // Expose function to manually upload plan to Supabase (for debugging)
  useEffect(() => {
    window.uploadWeeklyPlanToSupabase = async () => {
      if (!currentWeek) {
        console.error('No current week available');
        return;
      }
      const weekKey = currentWeek.key;
      const localPlan = localStorage.getItem(`weekly_plan_${weekKey}`);
      if (localPlan) {
        try {
          await dataService.set(`weekly_plan_${weekKey}`, localPlan);
          console.log('Successfully uploaded weekly plan to Supabase!');
          // Reload the plan
          const storedPlan = await dataService.get(`weekly_plan_${weekKey}`);
          if (storedPlan) {
            const parsedPlan = JSON.parse(storedPlan);
            setWeeklyPlan(parsedPlan);
            weeklyPlanRef.current = parsedPlan;
          }
        } catch (e) {
          console.error('Failed to upload plan to Supabase:', e);
        }
      } else {
        console.error('No plan found in localStorage');
      }
    };
    return () => {
      delete window.uploadWeeklyPlanToSupabase;
    };
  }, [currentWeek]);

  return (
    <div className="workout-display" style={{ marginBottom: '20px' }}>
      <div className="workout-title">
        Weekly Training Plan
        {currentWeek && ` - Week of ${currentWeek.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
      </div>
      
      <div className="workout-block">
        <div className="block-details">
          <div className="detail-item">
            <span className="detail-label">Total Miles</span>
            <span className="detail-value">{weeklyStats.totalMiles} mi</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Total Time</span>
            <span className="detail-value">{weeklyStats.totalTime} min</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Runs</span>
            <span className="detail-value">{weeklyStats.runCount}/3</span>
          </div>
        </div>
      </div>

      <div className="workout-block">
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
            minWidth: '560px' // Ensures 7 days * 80px minimum
          }}>
        {[0, 1, 2, 3, 4, 5, 6].map(dayOffset => {
          const dayInfo = getDayInfo(dayOffset);
          const plannedWorkout = getPlannedWorkout(dayOffset);
          const isRunDay = isRunningDay(dayOffset);
          
          if (!dayInfo) return null;
          
          // CRITICAL: Check postpone status first, even if there's a workout
          // This ensures postponed days always show as postponed, even if AI put a workout back
          const dayName = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][dayOffset];
          const postponements = weeklyPlan?._postponements || {};
          const postponeInfo = postponements[dayName];
          const isPostponed = !!postponeInfo && postponeInfo.postponed;
          
          // Determine card styling based on state
          let backgroundColor = 'var(--grid-color)';
          let borderColor = dayInfo.isToday ? '2px solid var(--accent)' : '1px solid var(--border-color)';
          let textColor = 'var(--text-color)';
          
          if (isPostponed) {
            backgroundColor = 'rgba(255, 165, 0, 0.3)'; // Orange tint for postponed
            borderColor = '2px solid rgba(255, 165, 0, 0.8)';
            textColor = 'var(--text-color)';
          } else if (dayInfo.hasMatchedWorkout || dayInfo.hasRun) {
            backgroundColor = 'var(--accent)';
            textColor = 'white';
          } else if (plannedWorkout) {
            // Show workout on any day, not just running days (for redistributed workouts)
            backgroundColor = 'var(--card-bg)';
          }
          
          const cardStyle = {
            padding: '12px 8px',
            borderRadius: '8px',
            textAlign: 'center',
            fontSize: '12px',
            cursor: (plannedWorkout && !dayInfo.hasRun && !isPostponed) ? 'pointer' : 'default',
            border: borderColor,
            backgroundColor: backgroundColor,
            color: textColor,
            opacity: dayInfo.isPast && !dayInfo.hasRun && !dayInfo.hasMatchedWorkout && isRunDay && !isPostponed ? 0.6 : 1,
            position: 'relative'
          };
          
          const handleClick = () => {
            if (plannedWorkout && !dayInfo.hasRun && !isPostponed && onWorkoutClick) {
              console.log('Clicking on planned workout:', plannedWorkout);
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
              <div style={{ fontSize: '10px', color: dayInfo.hasRun ? 'white' : (isPostponed ? 'rgba(255, 140, 0, 1)' : 'var(--text-secondary)') }}>
                {isPostponed ? (
                  'Postponed'
                ) : dayInfo.hasRun ? (
                  'Completed'
                ) : plannedWorkout ? (
                  // Show workout type for any day that has a workout (including redistributed ones)
                  plannedWorkout.type === 'easy' ? 'Easy' : 
                  plannedWorkout.type === 'speed' ? 'Speed' : 
                  plannedWorkout.type === 'long' ? 'Long' : 
                  plannedWorkout.title || 'Run'
                ) : isRunDay ? (
                  'Rest'
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
