import { useState, useEffect, useRef } from 'react';
import { dataService } from '../services/supabase';

const WeeklyPlan = ({ activities, onWorkoutClick, onGenerateWeeklyPlan, apiKey, onActivitiesChange, onRecoveryClick }) => {
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
        let storedPlan = null;
        try {
          storedPlan = await dataService.get(`weekly_plan_${weekKey}`);
        } catch (error) {
          console.log('Supabase get failed, falling back to localStorage:', error.message);
        }
        
        if (storedPlan) {
          parsedPlan = JSON.parse(storedPlan);
          console.log('Loaded weekly plan from Supabase:', parsedPlan);
          console.log('Supabase plan has postpone info:', !!parsedPlan._postponements, parsedPlan._postponements);
          console.log('Supabase plan postpone keys:', parsedPlan._postponements ? Object.keys(parsedPlan._postponements) : 'none');
          console.log('Supabase plan tuesday postpone:', parsedPlan._postponements?.tuesday);
          console.log('Supabase plan_data keys:', Object.keys(parsedPlan));
        }
        
        // If Supabase failed or returned null, fallback to localStorage
        if (!parsedPlan) {
          const localPlan = localStorage.getItem(`weekly_plan_${weekKey}`);
          if (localPlan) {
            parsedPlan = JSON.parse(localPlan);
            console.log('Loaded weekly plan from localStorage (fallback):', parsedPlan);
            console.log('LocalStorage plan has postpone info:', !!parsedPlan._postponements, parsedPlan._postponements);
            // Try to upload to Supabase in background (don't wait for it)
            dataService.set(`weekly_plan_${weekKey}`, JSON.stringify(parsedPlan)).catch(() => {});
          }
        }
        
        if (parsedPlan) {
          // CRITICAL: If Supabase plan doesn't have postpone info, check if localStorage does and merge it
          // This handles the case where postpone was set on one device but Supabase doesn't have it yet
          // MUST happen BEFORE setWeeklyPlan so state includes postpone info
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
                  // Also update localStorage to keep them in sync
                  localStorage.setItem(`weekly_plan_${weekKey}`, JSON.stringify(parsedPlan));
                  console.log('Merged postpone info from localStorage into Supabase plan');
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

  const isRunningDay = (dayOffset) => {
    return [1, 3, 6].includes(dayOffset); // Tuesday, Thursday, Sunday
  };
  
  // Helper function to get color set for a workout type and completion state
  const getDayCardColors = (workoutType, isCompleted) => {
    if (!workoutType) {
      return {
        stripe: 'var(--color-border-tertiary)',
        labelColor: 'var(--color-text-tertiary)',
        bg: null,
        border: null,
        textColor: null,
        iconBg: null,
        checkColor: null
      };
    }

    const type = workoutType.toLowerCase();
    
    if (isCompleted) {
      if (type === 'easy' || type === 'recovery') {
        return {
          stripe: '#97C459',
          labelColor: '#3B6D11',
          bg: '#EAF3DE',
          border: '#C0DD97',
          textColor: '#3B6D11',
          iconBg: '#C0DD97',
          checkColor: '#3B6D11'
        };
      } else if (type === 'speed' || type === 'tempo') {
        return {
          stripe: '#BA7517',
          labelColor: '#633806',
          bg: '#FAEEDA',
          border: '#FAC775',
          textColor: '#633806',
          iconBg: '#FAC775',
          checkColor: '#633806'
        };
      } else if (type === 'long') {
        return {
          stripe: '#378ADD',
          labelColor: '#0C447C',
          bg: '#E6F1FB',
          border: '#B5D4F4',
          textColor: '#0C447C',
          iconBg: '#B5D4F4',
          checkColor: '#0C447C'
        };
      } else {
        // PT/recovery fallback
        return {
          stripe: '#C0DD97',
          labelColor: '#3B6D11',
          bg: '#EAF3DE',
          border: '#C0DD97',
          textColor: '#3B6D11',
          iconBg: '#C0DD97',
          checkColor: '#3B6D11'
        };
      }
    } else {
      // Upcoming workouts
      if (type === 'easy') {
        return {
          stripe: '#97C459',
          labelColor: 'var(--color-text-secondary)',
          bg: null,
          border: null,
          textColor: null,
          iconBg: null,
          checkColor: null
        };
      } else if (type === 'speed' || type === 'tempo') {
        return {
          stripe: '#BA7517',
          labelColor: 'var(--color-text-secondary)',
          bg: null,
          border: null,
          textColor: null,
          iconBg: null,
          checkColor: null
        };
      } else if (type === 'long') {
        return {
          stripe: '#378ADD',
          labelColor: 'var(--color-text-secondary)',
          bg: null,
          border: null,
          textColor: null,
          iconBg: null,
          checkColor: null
        };
      } else if (type === 'recovery') {
        return {
          stripe: '#C0DD97',
          labelColor: 'var(--color-text-secondary)',
          bg: null,
          border: null,
          textColor: null,
          iconBg: null,
          checkColor: null
        };
      } else {
        return {
          stripe: 'var(--color-border-tertiary)',
          labelColor: 'var(--color-text-tertiary)',
          bg: null,
          border: null,
          textColor: null,
          iconBg: null,
          checkColor: null
        };
      }
    }
  };
  
  const getWorkoutDistance = (workout) => {
    if (!workout || !workout.blocks) return null;
    
    // Try to extract distance from blocks
    for (const block of workout.blocks) {
      if (block.distance) {
        const distanceStr = block.distance.toLowerCase().trim();
        // Extract number and unit
        const match = distanceStr.match(/(\d+\.?\d*)\s*(mi|mile|m|meter)/);
        if (match) {
          const value = parseFloat(match[1]);
          const unit = match[2];
          if (unit.includes('mi')) {
            return value.toFixed(1);
          } else if (unit.includes('m') && !unit.includes('mi')) {
            // Convert meters to miles
            return (value / 1609.34).toFixed(1);
          }
        }
      }
    }
    return null;
  };

  
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
          const parsedLocal = JSON.parse(localPlan);
          console.log('Uploading plan to Supabase with postpone info:', !!parsedLocal._postponements, parsedLocal._postponements);
          await dataService.set(`weekly_plan_${weekKey}`, localPlan);
          console.log('Successfully uploaded weekly plan to Supabase!');
          // Reload the plan to verify it was saved correctly
          const storedPlan = await dataService.get(`weekly_plan_${weekKey}`);
          if (storedPlan) {
            const parsedPlan = JSON.parse(storedPlan);
            console.log('Verified uploaded plan has postpone info:', !!parsedPlan._postponements, parsedPlan._postponements);
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

  const renderDayCard = (dayOffset) => {
    const dayInfo = getDayInfo(dayOffset);
    const plannedWorkout = getPlannedWorkout(dayOffset);
    const isRunDay = isRunningDay(dayOffset);
    
    if (!dayInfo) return null;
    
    const dayName = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][dayOffset];
    const postponements = weeklyPlan?._postponements || {};
    const postponeInfo = postponements[dayName];
    const isPostponed = !!postponeInfo && postponeInfo.postponed;
    
    const isCompleted = dayInfo.hasMatchedWorkout || dayInfo.hasRun;
    const distance = isCompleted && plannedWorkout ? getWorkoutDistance(plannedWorkout) : (plannedWorkout ? getWorkoutDistance(plannedWorkout) : null);
    
    // Get colors based on workout type and completion state
    const colors = getDayCardColors(plannedWorkout?.type, isCompleted);
    
    // Determine card state and styling
    const isClickable = plannedWorkout && !isPostponed;
    let cardStyle = {
      padding: '8px 8px 0',
      borderRadius: '8px',
      border: '0.5px solid var(--color-border-tertiary)',
      background: 'var(--color-background-primary)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      overflow: 'hidden',
      cursor: isClickable ? 'pointer' : 'default',
      transition: 'border-color 0.15s',
      position: 'relative'
    };
    
    let textColor = 'var(--color-text-primary)';
    let dayNameColor = 'var(--color-text-tertiary)';
    let typeLabelColor = 'var(--color-text-secondary)';
    let distanceColor = 'var(--color-text-tertiary)';
    let intensityStripeColor = colors.stripe;
    let iconContent = null;
    
    if (isPostponed) {
      cardStyle.background = 'var(--color-background-secondary)';
      typeLabelColor = 'var(--color-text-tertiary)';
      intensityStripeColor = 'var(--color-border-tertiary)';
      iconContent = (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="13" stroke="var(--color-text-tertiary)" strokeWidth="1"/>
          <path d="M14 9v10M9 14h10" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      );
    } else if (isCompleted) {
      cardStyle.background = colors.bg;
      cardStyle.border = `0.5px solid ${colors.border}`;
      textColor = colors.textColor;
      dayNameColor = colors.textColor;
      typeLabelColor = colors.labelColor;
      distanceColor = colors.textColor;
      intensityStripeColor = colors.stripe;
      iconContent = (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="13" fill={colors.iconBg}/>
          <path d="M8 14l4 4 8-8" stroke={colors.checkColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    } else if (dayInfo.isToday) {
      cardStyle.border = '1.5px solid #378ADD';
      textColor = '#185FA5';
      dayNameColor = '#185FA5';
      typeLabelColor = '#185FA5';
      distanceColor = '#378ADD';
      intensityStripeColor = '#378ADD';
      iconContent = (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="13" fill="#E6F1FB" stroke="#185FA5" strokeWidth="1"/>
          <circle cx="14" cy="14" r="5" fill="#185FA5"/>
        </svg>
      );
    } else if (!plannedWorkout && !isRunDay) {
      // Rest day
      cardStyle.background = 'var(--color-background-secondary)';
      typeLabelColor = 'var(--color-text-tertiary)';
      intensityStripeColor = 'var(--color-border-tertiary)';
      iconContent = (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="13" fill="var(--color-border-tertiary)" stroke="var(--color-text-tertiary)" strokeWidth="1"/>
          <path d="M14 9v10M9 14h10" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      );
    } else {
      // Upcoming run day - use colors from helper
      typeLabelColor = colors.labelColor;
      intensityStripeColor = colors.stripe;
      iconContent = (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="13" fill="var(--color-background-secondary)" stroke="var(--color-border-tertiary)" strokeWidth="1"/>
        </svg>
      );
    }
    
    // Get workout type label
    let workoutTypeLabel = '—';
    if (plannedWorkout) {
      if (plannedWorkout.type === 'easy') workoutTypeLabel = 'Easy';
      else if (plannedWorkout.type === 'speed' || plannedWorkout.type === 'tempo') workoutTypeLabel = 'Speed';
      else if (plannedWorkout.type === 'long') workoutTypeLabel = 'Long';
      else workoutTypeLabel = 'Run';
    } else if (!isRunDay) {
      workoutTypeLabel = 'Rest';
    }
    
    const handleClick = () => {
      // If today is a rest day, navigate to recovery page
      if (dayInfo.isToday && (!plannedWorkout || plannedWorkout.type === 'rest') && onRecoveryClick) {
        onRecoveryClick();
        return;
      }
      
      // Allow clicking any workout (completed or not) as long as it's not postponed
      if (plannedWorkout && !isPostponed && onWorkoutClick) {
        onWorkoutClick(plannedWorkout, dayInfo.fullDayName);
      }
    };
    
    return (
      <div key={dayOffset} style={cardStyle} onClick={handleClick} onMouseEnter={(e) => {
        if (isClickable) {
          e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
        }
      }} onMouseLeave={(e) => {
        if (dayInfo.isToday) {
          e.currentTarget.style.borderColor = '#378ADD';
        } else if (isCompleted) {
          e.currentTarget.style.borderColor = colors.border;
        } else {
          e.currentTarget.style.borderColor = 'var(--color-border-tertiary)';
        }
      }}>
        {/* Day abbreviation */}
        <div style={{
          fontSize: '9px',
          textTransform: 'uppercase',
          color: dayNameColor,
          fontWeight: 400,
          marginBottom: '4px'
        }}>
          {dayInfo.dayName}
        </div>
        
        {/* Date number */}
        <div style={{
          fontSize: '14px',
          fontWeight: 500,
          color: textColor,
          marginBottom: '6px'
        }}>
          {dayInfo.date.getDate()}
        </div>
        
        {/* Circle icon */}
        <div style={{ marginBottom: '6px' }}>
          {iconContent}
        </div>
        
        {/* Workout type label */}
        <div style={{
          fontSize: '8px',
          fontWeight: 500,
          color: typeLabelColor,
          marginBottom: '4px',
          textAlign: 'center'
        }}>
          {workoutTypeLabel}
        </div>
        
        {/* Distance or dash */}
        <div style={{
          fontSize: '9px',
          color: distanceColor,
          marginBottom: '3px'
        }}>
          {distance ? `${distance} mi` : '—'}
        </div>
        
        {/* Intensity stripe */}
        <div style={{
          width: '100%',
          height: '3px',
          background: intensityStripeColor,
          marginTop: 'auto'
        }} />
      </div>
    );
  };

  return (
    <>
      {/* Desktop week grid */}
      <div className="week-strip-desktop" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '6px',
        padding: '0 24px',
        marginBottom: '0'
      }}>
        {[0, 1, 2, 3, 4, 5, 6].map(dayOffset => renderDayCard(dayOffset))}
      </div>
      
      {/* Mobile week scroll */}
      <div className="week-strip-mobile" style={{
        display: 'none',
        overflowX: 'auto',
        padding: '0 16px 14px 16px',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        boxSizing: 'content-box'
      }}>
        <style>{`
          .week-strip-mobile::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        <div style={{
          display: 'flex',
          gap: '6px',
          minWidth: 'max-content'
        }}>
          {[0, 1, 2, 3, 4, 5, 6].map(dayOffset => {
            const card = renderDayCard(dayOffset);
            if (!card) return null;
            return (
              <div key={dayOffset} style={{ width: '56px', flexShrink: 0 }}>
                {card}
              </div>
            );
          })}
        </div>
      </div>
      
      <style>{`
        @media (max-width: 720px) {
          .week-strip-desktop {
            display: none !important;
          }
          .week-strip-mobile {
            display: block !important;
          }
        }
        @media (min-width: 721px) {
          .week-strip-mobile {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
};

export default WeeklyPlan;
