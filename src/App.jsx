import { useState, useEffect } from 'react';
import WorkoutDisplay from './components/WorkoutDisplay';
import WorkoutDetail from './components/WorkoutDetail';
import WeeklyPlan from './components/WeeklyPlan';
import WeeklyAnalysis from './components/WeeklyAnalysis';
import ActivitiesDisplay from './components/ActivitiesDisplay';
import InsightsDisplay from './components/InsightsDisplay';
import StravaCallback from './components/StravaCallback';
import ActivityDetail from './components/ActivityDetail';
import WorkoutFeedback from './components/WorkoutFeedback';
import PostponeWorkout from './components/PostponeWorkout';
import PullToRefresh from './components/PullToRefresh';
import NewActivityRatingModal from './components/NewActivityRatingModal';
import { generateWorkout, generateWeeklyPlan, generateDataDrivenWeeklyPlan, generateWeeklyAnalysis, matchActivitiesToWorkouts, syncWithStrava, generateInsights, detectNewActivities, adjustWeeklyPlanForPostponement } from './services/api';
import { dataService, setupRealtimeSync, syncAllDataFromSupabase, enableSupabase } from './services/supabase';

function App() {
  const [workout, setWorkout] = useState(null);
  const [activities, setActivities] = useState([]);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isPreloading, setIsPreloading] = useState(true);
  const [error, setError] = useState(null);
  const [isStravaCallback, setIsStravaCallback] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState(null);
  const [showWorkoutDetail, setShowWorkoutDetail] = useState(false);
  const [selectedPlannedWorkout, setSelectedPlannedWorkout] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showPostpone, setShowPostpone] = useState(false);
  const [pendingPostpone, setPendingPostpone] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [darkMode, setDarkMode] = useState(localStorage.getItem('darkMode') === 'true');
  const [isInjured, setIsInjured] = useState(localStorage.getItem('isInjured') === 'true');
  const [supabaseEnabled, setSupabaseEnabled] = useState(dataService.useSupabase || localStorage.getItem('use_supabase') === 'true');
  const [weeklyAnalysis, setWeeklyAnalysis] = useState(null);
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [weeklyPlanRefreshKey, setWeeklyPlanRefreshKey] = useState(0);
  const [newActivityQueue, setNewActivityQueue] = useState([]);
  const [currentActivityForRating, setCurrentActivityForRating] = useState(null);
  const [recoveryWorkout, setRecoveryWorkout] = useState(null);
  const [recoveryCompleted, setRecoveryCompleted] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryBlockStatus, setRecoveryBlockStatus] = useState({});

  const todayDate = new Date().toISOString().split('T')[0];

  // Determine if a run activity was completed today
  const hasRunToday = (() => {
    const today = new Date();
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    return (activities || []).some((a) => {
      if (!a || a.type !== 'Run' || !a.start_date) return false;
      const d = new Date(a.start_date);
      return d >= todayStart && d <= todayEnd;
    });
  })();

  // Track daily button usage
  const [dailyUsage, setDailyUsage] = useState(() => {
    const today = new Date().toDateString();
    const stored = localStorage.getItem('daily_button_usage');
    const usage = stored ? JSON.parse(stored) : {};
    
    // Reset if it's a new day
    if (usage.date !== today) {
      return { date: today, postponed: false, recovery: false };
    }
    return usage;
  });

  const updateDailyUsage = (action) => {
    const newUsage = { ...dailyUsage, [action]: true };
    setDailyUsage(newUsage);
    localStorage.setItem('daily_button_usage', JSON.stringify(newUsage));
  };
  const [isAuthenticated, setIsAuthenticated] = useState(localStorage.getItem('authenticated') === 'true');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState(
    import.meta.env.VITE_OPENAI_API_KEY || 
    localStorage.getItem('openai_api_key') || 
    ''
  );

  const handleLogin = () => {
    // Your secure password
    if (password === 'Kx9#mP2$vL8@nQ4!') {
      setIsAuthenticated(true);
      localStorage.setItem('authenticated', 'true');
    } else {
      setError('Incorrect password');
    }
  };

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="app">
        <div className="header">
          <h1>Access Required</h1>
        </div>
        <div className="workout-display">
          <div className="workout-title">Enter Password</div>
          <div className="workout-block">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                fontSize: '16px',
                marginBottom: '15px',
                background: 'var(--card-bg)',
                color: 'var(--text-color)'
              }}
              placeholder="Enter password"
            />
            <button className="btn btn-primary" onClick={handleLogin} style={{ width: '100%' }}>
              Access App
            </button>
            {error && <div className="error" style={{ marginTop: '15px' }}>{error}</div>}
          </div>
        </div>
      </div>
    );
  }

  // Apply dark mode
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  // Save injury status
  useEffect(() => {
    localStorage.setItem('isInjured', isInjured);
  }, [isInjured]);

  // Listen for storage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'darkMode') {
        setDarkMode(e.newValue === 'true');
      } else if (e.key === 'isInjured') {
        setIsInjured(e.newValue === 'true');
      } else if (e.key === 'strava_activities') {
        const newActivities = e.newValue ? JSON.parse(e.newValue) : [];
        setActivities(newActivities);
      } else if (e.key === 'current_workout') {
        const newWorkout = e.newValue ? JSON.parse(e.newValue) : null;
        setWorkout(newWorkout);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    // Check if this is a Strava callback - handle both paths and URL params
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    const isCallback = window.location.pathname === '/strava-callback' || 
                      window.location.pathname === '/RunningCoach/strava-callback' ||
                      window.location.pathname === '/strava-callback.html' ||
                      (code !== null || error !== null);
    
    // Check if there's an activity ID in the URL (after Strava auth redirect)
    const activityIdFromUrl = urlParams.get('activity');
    if (activityIdFromUrl && !isCallback) {
      setSelectedActivityId(parseInt(activityIdFromUrl));
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }
    
    // Check if we should redirect to an activity after Strava auth
    const redirectToActivity = sessionStorage.getItem('redirect_to_activity');
    if (redirectToActivity && !isCallback) {
      sessionStorage.removeItem('redirect_to_activity');
      setSelectedActivityId(parseInt(redirectToActivity));
      return;
    }
    
    // Check for Strava auth code from Browser callback (mobile) - immediate check
    const stravaAuthCode = localStorage.getItem('strava_auth_code');
    const stravaAuthCodeTimestamp = localStorage.getItem('strava_auth_code_timestamp');
    if (stravaAuthCode && stravaAuthCodeTimestamp && !isCallback) {
      console.log('Found Strava auth code in localStorage, exchanging...');
      localStorage.removeItem('strava_auth_code');
      localStorage.removeItem('strava_auth_code_timestamp');
      localStorage.removeItem('strava_auth_state');
      localStorage.removeItem('strava_auth_scope');
      
      // Import and exchange the code
      import('./services/api').then(({ exchangeStravaCode }) => {
        exchangeStravaCode(stravaAuthCode)
          .then(() => {
            console.log('Token exchange successful');
            // Sync activities after successful auth
            syncWithStrava().then(activities => {
              if (activities) {
                setActivities(activities);
              }
              // Reload to refresh app state
              window.location.reload();
            });
          })
          .catch(err => {
            console.error('Failed to exchange code:', err);
            setError('Failed to complete Strava authentication');
          });
      });
      return; // Don't continue with the rest of the useEffect
    }
    
    if (isCallback) {
      setIsStravaCallback(true);
      return; // Don't auto-sync if we're handling callback
    }
    
    // Handle browser back/forward navigation
    const handlePopState = (event) => {
      if (event.state) {
        if (event.state.view === 'activity') {
          setSelectedActivityId(event.state.activityId);
          setShowFeedback(false);
          setShowPostpone(false);
          setShowWorkoutDetail(false);
        } else if (event.state.view === 'workoutDetail') {
          setShowWorkoutDetail(true);
          setSelectedActivityId(null);
          setShowFeedback(false);
          setShowPostpone(false);
        } else if (event.state.view === 'feedback') {
          setShowFeedback(true);
          setSelectedActivityId(null);
          setShowPostpone(false);
          setShowWorkoutDetail(false);
        } else if (event.state.view === 'postpone') {
          setShowPostpone(true);
          setSelectedActivityId(null);
          setShowFeedback(false);
          setShowWorkoutDetail(false);
        } else {
          // Main view
          setSelectedActivityId(null);
          setShowFeedback(false);
          setShowPostpone(false);
          setShowWorkoutDetail(false);
        }
      } else {
        // No state, go to main view
        setSelectedActivityId(null);
        setShowFeedback(false);
        setShowPostpone(false);
        setShowWorkoutDetail(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    // Preload all data in parallel
    const preloadAllData = async () => {
      try {
        console.log('Starting preload...');
        
        const today = new Date();
        const monday = new Date(today);
        monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
        monday.setHours(0, 0, 0, 0);
        const weekKey = `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`;
        
        // Load all data in parallel
        const [
          supabaseData,
          storedActivities,
          workoutData,
          weeklyPlanData,
          analysisData,
          syncedActivities
        ] = await Promise.all([
          // Supabase sync (if enabled)
          dataService.useSupabase ? syncAllDataFromSupabase().catch(err => {
            console.error('Supabase sync error:', err);
            return null;
          }) : Promise.resolve(null),
          
          // Load stored activities
          dataService.get('strava_activities').catch(() => null),
          
          // Load current workout
          dataService.get('current_workout').catch(() => null),
          
          // Load weekly plan
          dataService.get(`weekly_plan_${weekKey}`).catch(() => null),
          
          // Load weekly analysis
          dataService.get(`weekly_analysis_${weekKey}`).catch(() => null),
          
          // Auto-sync with Strava
          syncWithStrava().catch(err => {
            console.error('Strava sync error:', err);
            return null;
          })
        ]);
        
        // Process Supabase data if available
        if (supabaseData) {
          if (supabaseData.activities && supabaseData.activities.length > 0) {
            setActivities(supabaseData.activities);
          }
          if (supabaseData.workout) {
            setWorkout(supabaseData.workout);
          }
        }
        
        // Process activities (prioritize synced activities, then stored)
        let finalActivities = [];
        if (syncedActivities && syncedActivities.length > 0) {
          finalActivities = syncedActivities;
          setActivities(syncedActivities);
        } else if (storedActivities) {
          const parsed = JSON.parse(storedActivities);
          finalActivities = parsed;
          setActivities(parsed);
        } else {
          const localStored = localStorage.getItem('strava_activities');
          if (localStored) {
            const parsed = JSON.parse(localStored);
            finalActivities = parsed;
            setActivities(parsed);
          }
        }
        
        // Determine day type for today
        const dayOfWeek = today.getDay();
        const isRunDay = dayOfWeek === 0 || dayOfWeek === 2 || dayOfWeek === 4; // Sun/Tue/Thu

        // Compute whether a run was completed today from finalActivities
        const todayStart = new Date(today);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);
        const hasRunTodayFromActivities = (finalActivities || []).some((a) => {
          if (!a || a.type !== 'Run' || !a.start_date) return false;
          const d = new Date(a.start_date);
          return d >= todayStart && d <= todayEnd;
        });

        // Process workout
        const dayNameMap = {
          0: 'sunday',
          1: 'monday',
          2: 'tuesday',
          3: 'wednesday',
          4: 'thursday',
          5: 'friday',
          6: 'saturday'
        };
        
        let todayWorkout = null;
        let isTodayPostponed = false;
        if (weeklyPlanData) {
          const parsedPlan = JSON.parse(weeklyPlanData);
          // Check if today was postponed
          const postponements = parsedPlan._postponements || {};
          const todayPostponeInfo = postponements[dayNameMap[dayOfWeek]];
          isTodayPostponed = !!todayPostponeInfo && todayPostponeInfo.postponed;
          
          // Only set workout if today wasn't postponed
          if (!isTodayPostponed) {
            todayWorkout = parsedPlan[dayNameMap[dayOfWeek]];
          }
        }
        
        if (todayWorkout && !isTodayPostponed) {
          setWorkout(todayWorkout);
          await dataService.set('current_workout', JSON.stringify(todayWorkout));
          localStorage.setItem('current_workout', JSON.stringify(todayWorkout));
        } else if (isTodayPostponed) {
          // Clear workout if today was postponed
          setWorkout(null);
          localStorage.removeItem('current_workout');
          await dataService.set('current_workout', null);
        } else if (workoutData) {
          setWorkout(JSON.parse(workoutData));
        } else {
          const localWorkout = localStorage.getItem('current_workout');
          if (localWorkout) {
            setWorkout(JSON.parse(localWorkout));
          }
        }
        
        // Process weekly analysis
        if (analysisData) {
          setWeeklyAnalysis(JSON.parse(analysisData));
        } else {
          const localAnalysis = localStorage.getItem(`weekly_analysis_${weekKey}`);
          if (localAnalysis) {
            setWeeklyAnalysis(JSON.parse(localAnalysis));
          }
        }
        
        // Store weekly plan in state for checking postpone status
        let parsedPlanForState = null;
        if (weeklyPlanData) {
          parsedPlanForState = JSON.parse(weeklyPlanData);
        } else {
          const localPlan = localStorage.getItem(`weekly_plan_${weekKey}`);
          if (localPlan) {
            parsedPlanForState = JSON.parse(localPlan);
          }
        }
        
        // Migrate old postpone data to new structure if needed
        if (parsedPlanForState) {
          const oldPostponeData = localStorage.getItem('postponed_workout');
          if (oldPostponeData && (!parsedPlanForState._postponements || Object.keys(parsedPlanForState._postponements).length === 0)) {
            try {
              const postponeData = JSON.parse(oldPostponeData);
              const postponeDate = new Date(postponeData.postponedDate);
              const todayStart = new Date(today);
              todayStart.setHours(0, 0, 0, 0);
              const todayEnd = new Date(today);
              todayEnd.setHours(23, 59, 59, 999);
              
              // Check if postpone was today
              if (postponeDate >= todayStart && postponeDate <= todayEnd) {
                if (!parsedPlanForState._postponements) {
                  parsedPlanForState._postponements = {};
                }
                
                const currentDayName = dayNameMap[dayOfWeek];
                if (!parsedPlanForState._postponements[currentDayName]) {
                  parsedPlanForState._postponements[currentDayName] = {
                    postponed: true,
                    reason: postponeData.reason || 'Workout postponed',
                    date: postponeData.postponedDate || new Date().toISOString(),
                    originalDay: currentDayName,
                    originalWorkout: parsedPlanForState[currentDayName] || postponeData.originalWorkout,
                    adjustment: postponeData.adjustment || 'same'
                  };
                  
                  // Clear the workout for the postponed day
                  parsedPlanForState[currentDayName] = null;
                  
                  // Save migrated plan
                  await dataService.set(`weekly_plan_${weekKey}`, JSON.stringify(parsedPlanForState));
                  localStorage.setItem(`weekly_plan_${weekKey}`, JSON.stringify(parsedPlanForState));
                  console.log('Migrated old postpone data to new structure');
                }
              }
            } catch (e) {
              console.error('Error migrating postpone data:', e);
            }
          }
          
          setWeeklyPlan(parsedPlanForState);
        }

        // Check if today was postponed - if so, ensure plan is rescheduled
        // We check if postponed even if workout is already cleared, because the plan
        // might not have been redistributed yet (workout cleared but not rescheduled)
        const availableApiKey = import.meta.env.VITE_OPENAI_API_KEY || apiKey;
        
        if (parsedPlanForState && availableApiKey && finalActivities.length > 0) {
          const postponements = parsedPlanForState._postponements || {};
          const todayPostponeInfo = postponements[dayNameMap[dayOfWeek]];
          const isTodayPostponed = !!todayPostponeInfo && todayPostponeInfo.postponed;
          const todayWorkoutStillExists = !!parsedPlanForState[dayNameMap[dayOfWeek]];
          
          // Check if plan has been redistributed - if postponed day is null but other days still have
          // the same workouts as before postponement, it likely hasn't been redistributed
          // We'll trigger rescheduling if postponed, regardless of whether workout exists
          // because the workout might have been cleared but plan not yet redistributed
          
          // Trigger rescheduling if today is postponed, regardless of whether workout still exists
          // The workout might have been cleared but plan not yet redistributed
          if (isTodayPostponed) {
            console.log('Detected postponed day. Ensuring plan is rescheduled...', {
              currentDayName: dayNameMap[dayOfWeek],
              workoutStillExists: todayWorkoutStillExists,
              postponeReason: todayPostponeInfo.reason
            });
            
            try {
              // Ensure the workout for the postponed day is null
              parsedPlanForState[dayNameMap[dayOfWeek]] = null;
              
              // Trigger plan regeneration
              setLoading(true);
              const adjustedPlan = await adjustWeeklyPlanForPostponement(
                availableApiKey,
                parsedPlanForState,
                dayNameMap[dayOfWeek],
                todayPostponeInfo.reason || 'Workout postponed',
                todayPostponeInfo.adjustment || 'same',
                finalActivities
              );
              
              // Always preserve postpone information (merge, don't replace)
              // CRITICAL: Preserve ALL postpone info, not just today's
              adjustedPlan._postponements = {
                ...(adjustedPlan._postponements || {}),
                ...(parsedPlanForState._postponements || {})
              };
              
              
              // CRITICAL: Ensure ALL postponed days are explicitly set to null (AI might put workouts back)
              const postponements = adjustedPlan._postponements || {};
              for (const dayName in postponements) {
                if (postponements[dayName] && postponements[dayName].postponed) {
                  adjustedPlan[dayName] = null;
                }
              }
              
              // Re-match activities to workouts
              const activityMatches = matchActivitiesToWorkouts(finalActivities, adjustedPlan, monday);
              adjustedPlan._activityMatches = activityMatches;
              
              // Save updated plan
              try {
                await dataService.set(`weekly_plan_${weekKey}`, JSON.stringify(adjustedPlan));
              } catch (supabaseError) {
                console.error('Failed to save plan to Supabase:', supabaseError);
              }
              localStorage.setItem(`weekly_plan_${weekKey}`, JSON.stringify(adjustedPlan));
              
              // Update state
              setWeeklyPlan(adjustedPlan);
              setWeeklyPlanRefreshKey(prev => prev + 1);
              
              setLoading(false);
              console.log('Plan rescheduled successfully on page load');
            } catch (err) {
              console.error('Error rescheduling plan on page load:', err);
              setLoading(false);
              // Still clear the workout even if regeneration fails
              parsedPlanForState[dayNameMap[dayOfWeek]] = null;
              await dataService.set(`weekly_plan_${weekKey}`, JSON.stringify(parsedPlanForState));
              localStorage.setItem(`weekly_plan_${weekKey}`, JSON.stringify(parsedPlanForState));
              setWeeklyPlan(parsedPlanForState);
              setWeeklyPlanRefreshKey(prev => prev + 1);
            }
          }
        }

        // Auto-generate weekly plan if missing
        let planWasGenerated = false;
        if (!weeklyPlanData && availableApiKey && finalActivities.length > 0) {
          try {
            console.log('Auto-generating weekly plan...');
            // Call handleGenerateWeeklyPlan with auto-generation flag
            await handleGenerateWeeklyPlan(true);
            planWasGenerated = true;
            // Reload the plan after generation
            const generatedPlan = await dataService.get(`weekly_plan_${weekKey}`);
            if (generatedPlan) {
              const parsedPlan = JSON.parse(generatedPlan);
              // Update weekly plan state
              setWeeklyPlan(parsedPlan);
              // Update today's workout if needed
              const dayNameMap = {
                0: 'sunday',
                1: 'monday',
                2: 'tuesday',
                3: 'wednesday',
                4: 'thursday',
                5: 'friday',
                6: 'saturday'
              };
              // Check if today was postponed
              const postponements = parsedPlan._postponements || {};
              const todayPostponeInfo = postponements[dayNameMap[dayOfWeek]];
              const isTodayPostponed = !!todayPostponeInfo && todayPostponeInfo.postponed;
              
              if (!isTodayPostponed) {
                const todayWorkout = parsedPlan[dayNameMap[dayOfWeek]];
                if (todayWorkout) {
                  setWorkout(todayWorkout);
                  await dataService.set('current_workout', JSON.stringify(todayWorkout));
                  localStorage.setItem('current_workout', JSON.stringify(todayWorkout));
                }
              }
            }
            // If plan was generated, analysis was also generated, so reload it
            const generatedAnalysis = await dataService.get(`weekly_analysis_${weekKey}`).catch(() => null);
            if (generatedAnalysis) {
              const parsedAnalysis = JSON.parse(generatedAnalysis);
              setWeeklyAnalysis(parsedAnalysis);
            } else {
              const localAnalysis = localStorage.getItem(`weekly_analysis_${weekKey}`);
              if (localAnalysis) {
                setWeeklyAnalysis(JSON.parse(localAnalysis));
              }
            }
          } catch (err) {
            console.error('Auto-generation of weekly plan failed:', err);
          }
        }

        // Auto-generate weekly analysis if missing (only if plan wasn't just generated)
        if (!planWasGenerated && !analysisData && availableApiKey && finalActivities.length > 0) {
          try {
            // Check if we have a plan to generate analysis from
            let planForAnalysis = null;
            const currentPlanData = await dataService.get(`weekly_plan_${weekKey}`).catch(() => null);
            if (currentPlanData) {
              planForAnalysis = JSON.parse(currentPlanData);
            } else {
              const localPlan = localStorage.getItem(`weekly_plan_${weekKey}`);
              if (localPlan) {
                planForAnalysis = JSON.parse(localPlan);
              }
            }

            if (planForAnalysis) {
              console.log('Auto-generating weekly analysis...');
              const analysis = await generateWeeklyAnalysis(availableApiKey, finalActivities, planForAnalysis);
              if (analysis) {
                setWeeklyAnalysis(analysis);
                localStorage.setItem(`weekly_analysis_${weekKey}`, JSON.stringify(analysis));
                await dataService.set(`weekly_analysis_${weekKey}`, JSON.stringify(analysis));
              }
            }
          } catch (err) {
            console.error('Auto-generation of weekly analysis failed:', err);
          }
        }

        // Ensure today's recovery workout exists when appropriate
        try {
          let hasRecovery = false;

          // First, try to load any existing recovery workout (Supabase via dataService or localStorage)
          const storedRecovery = await dataService.get(`recovery_workout_${todayDate}`);
          if (storedRecovery) {
            const parsedRecovery = JSON.parse(storedRecovery);
            setRecoveryWorkout(parsedRecovery.workout || null);
            setRecoveryCompleted(!!parsedRecovery.completed);
            setRecoveryBlockStatus({});
            hasRecovery = !!parsedRecovery.workout;
          } else {
            const localRecovery = localStorage.getItem(`recovery_workout_${todayDate}`);
            if (localRecovery) {
              const parsedRecovery = JSON.parse(localRecovery);
              setRecoveryWorkout(parsedRecovery.workout || null);
              setRecoveryCompleted(!!parsedRecovery.completed);
              setRecoveryBlockStatus({});
              hasRecovery = !!parsedRecovery.workout;
            }
          }

          const shouldHaveRecovery =
            !isRunDay || (isRunDay && hasRunTodayFromActivities);

          // On rest days (and on run days after a run), if we still don't have a recovery workout, generate one now
          if (!hasRecovery && shouldHaveRecovery) {
            const availableApiKey = import.meta.env.VITE_OPENAI_API_KEY || apiKey;
            if (availableApiKey) {
              setRecoveryLoading(true);

              const newWorkout = await generateWorkout(
                availableApiKey,
                finalActivities,
                isInjured,
                { reason: 'Recovery day', adjustment: 'recovery', source: 'auto' }
              );

              setRecoveryWorkout(newWorkout);
              setRecoveryCompleted(false);
              setRecoveryBlockStatus({});

              const payload = JSON.stringify({
                workout: newWorkout,
                completed: false
              });

              await dataService.set(`recovery_workout_${todayDate}`, payload);
              localStorage.setItem(`recovery_workout_${todayDate}`, payload);
            }
          }
        } catch (recoveryError) {
          console.error('Error loading recovery workout:', recoveryError);
          const localRecovery = localStorage.getItem(`recovery_workout_${todayDate}`);
          if (localRecovery) {
            try {
              const parsedRecovery = JSON.parse(localRecovery);
              setRecoveryWorkout(parsedRecovery.workout || null);
              setRecoveryCompleted(!!parsedRecovery.completed);
              setRecoveryBlockStatus({});
            } catch {
              // Ignore malformed local recovery
            }
          }
        }
        
        // Detect new activities after sync (compare against last known IDs BEFORE updating them)
        let newActivities = [];
        if (syncedActivities && syncedActivities.length > 0) {
          const hasBaseline = localStorage.getItem('last_known_activity_ids') !== null;
          const lastKnownIds = hasBaseline
            ? JSON.parse(localStorage.getItem('last_known_activity_ids') || '[]')
            : [];

          newActivities = detectNewActivities(syncedActivities, lastKnownIds);

          // Update baseline to current activities after we compare (and only after sync succeeds)
          const currentIds = syncedActivities.map((a) => a.id);
          localStorage.setItem('last_known_activity_ids', JSON.stringify(currentIds));

          // If this is the very first baseline, do NOT prompt for everything historical
          if (!hasBaseline) {
            newActivities = [];
          }

          if (newActivities.length > 0) {
            console.log('New activities detected:', newActivities.length);
          }
        }
        
        console.log('Preload completed');
        return { newActivities };
      } catch (error) {
        console.error('Error during preload:', error);
        // Fallback to localStorage
        const localStored = localStorage.getItem('strava_activities');
        if (localStored) {
          setActivities(JSON.parse(localStored));
        }
        const localWorkout = localStorage.getItem('current_workout');
        if (localWorkout) {
          setWorkout(JSON.parse(localWorkout));
        }
        return { newActivities: [] };
      } finally {
        setIsPreloading(false);
        setRecoveryLoading(false);
      }
    };

    preloadAllData().then((result) => {
      // If there are new activities, show the first one after preloading completes
      if (result && result.newActivities && result.newActivities.length > 0) {
        // Small delay to ensure UI is ready
        setTimeout(() => {
          setNewActivityQueue(result.newActivities);
          setCurrentActivityForRating(result.newActivities[0]);
        }, 100);
      }
    });

    // Setup real-time sync if using Supabase
    let cleanupSync = null;
    if (dataService.useSupabase) {
      cleanupSync = setupRealtimeSync({
        onActivitiesChange: async (payload) => {
          console.log('Activities changed via realtime:', payload);
          // Reload activities when they change
          const stored = await dataService.get('strava_activities');
          if (stored) {
            setActivities(JSON.parse(stored));
          }
        },
        onWorkoutChange: async (payload) => {
          console.log('Workout changed via realtime:', payload);
          // Reload workout when it changes
          const workoutData = await dataService.get('current_workout');
          if (workoutData) {
            setWorkout(JSON.parse(workoutData));
          }
        },
        onWeeklyPlanChange: async (payload) => {
          console.log('Weekly plan changed via realtime:', payload);
          // Could trigger a reload of weekly plan view if needed
        }
      });
    }

    // Check for postponed workout on page load
    const postponedWorkout = localStorage.getItem('postponed_workout');
    const currentWorkout = localStorage.getItem('current_workout');
    if (postponedWorkout && !currentWorkout) {
      // Clean up old postponed workout data if it exists
      localStorage.removeItem('postponed_workout');
    }

    // Auto-sync with Strava on page load if we have tokens
    const hasTokens = localStorage.getItem('strava_access_token') && localStorage.getItem('strava_refresh_token');
    if (hasTokens) {
      // Always auto-sync on page refresh to get latest activities
      // Small delay to let the page load first
      setTimeout(() => {
        handleStravaSync(false); // Don't show loading for background sync
      }, 1000);
    }

    // Cleanup on unmount
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (cleanupSync) {
        cleanupSync();
      }
    };
  }, [isStravaCallback]);

  // Check for Sunday auto-generation when activities change
  useEffect(() => {
    const checkSundayAutoGeneration = async () => {
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 = Sunday
      
      // Only check on Sundays
      if (dayOfWeek !== 0) return;
      
      // Check if we already generated a plan today
      const lastGenerationDate = localStorage.getItem('last_plan_generation_date');
      const todayStr = today.toISOString().split('T')[0];
      if (lastGenerationDate === todayStr) {
        console.log('Plan already generated today');
        return;
      }
      
      // Check if long run was completed today
      const todayStart = new Date(today);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);
      
      const sundayActivities = activities.filter(a => {
        const activityDate = new Date(a.start_date);
        return activityDate >= todayStart && activityDate <= todayEnd && a.type === 'Run';
      });
      
      const hasLongRun = sundayActivities.length > 0;
      
      if (hasLongRun) {
        console.log('Sunday long run detected, auto-generating weekly plan...');
        // Auto-generate plan
        const availableApiKey = import.meta.env.VITE_OPENAI_API_KEY || apiKey;
        if (availableApiKey) {
          try {
            await handleGenerateWeeklyPlan(true); // Pass true to indicate auto-generation
          } catch (err) {
            console.error('Auto-generation failed:', err);
          }
        }
      } else {
        console.log('Sunday detected but no long run completed yet. Plan will generate after long run.');
      }
    };
    
    // Only check if we have activities loaded
    if (activities.length > 0) {
      checkSundayAutoGeneration();
    }
  }, [activities, apiKey]);
  
  // Separate useEffect for polling for Strava auth code (mobile Browser callback)
  useEffect(() => {
    if (isStravaCallback) return; // Don't poll if we're already handling a callback
    
    let pollCount = 0;
    const maxPolls = 120; // Poll for up to 60 seconds
    
    const checkForAuthCode = async () => {
      // Check localStorage (Browser window and app don't share storage, so this may not work)
      // Workaround: Authenticate on web first, which saves tokens to Supabase
      const stravaAuthCode = localStorage.getItem('strava_auth_code');
      const stravaAuthCodeTimestamp = localStorage.getItem('strava_auth_code_timestamp');
      
      if (stravaAuthCode && stravaAuthCodeTimestamp) {
        console.log('Found Strava auth code via polling, exchanging...');
        
        // Remove from storage
        localStorage.removeItem('strava_auth_code');
        localStorage.removeItem('strava_auth_code_timestamp');
        localStorage.removeItem('strava_auth_state');
        localStorage.removeItem('strava_auth_scope');
        
        // Import and exchange the code
        import('./services/api').then(({ exchangeStravaCode }) => {
          exchangeStravaCode(stravaAuthCode)
            .then(() => {
              console.log('Token exchange successful, reloading...');
              window.location.reload();
            })
            .catch(err => {
              console.error('Failed to exchange code:', err);
              setError('Failed to complete Strava authentication');
            });
        });
        return true; // Code found and processed
      }
      return false; // No code found
    };
    
    // Set up polling
    const pollInterval = setInterval(async () => {
      pollCount++;
      if (pollCount % 10 === 0) {
        console.log(`App polling for auth code (attempt ${pollCount}/${maxPolls})...`);
      }
      
      if (await checkForAuthCode()) {
        clearInterval(pollInterval);
      } else if (pollCount >= maxPolls) {
        console.log('App polling timeout reached');
        clearInterval(pollInterval);
      }
    }, 500);
    
    return () => clearInterval(pollInterval);
  }, [isStravaCallback]);

  const handleGenerateWeeklyPlan = async (isAutoGeneration = false) => {
    const availableApiKey = import.meta.env.VITE_OPENAI_API_KEY || apiKey;
    
    if (!availableApiKey) {
      if (!isAutoGeneration) {
        setError('Please enter your OpenAI API key first');
      }
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Use data-driven plan generation
      const weeklyPlan = await generateDataDrivenWeeklyPlan(availableApiKey, activities, isInjured);
      
      // Generate weekly analysis
      let analysis = null;
      try {
        analysis = await generateWeeklyAnalysis(availableApiKey, activities, weeklyPlan);
        weeklyPlan.weeklyAnalysis = analysis;
      } catch (err) {
        console.error('Failed to generate weekly analysis:', err);
        // Continue without analysis
      }
      
      // Store weekly plan
      const today = new Date();
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      monday.setHours(0, 0, 0, 0);
      const weekKey = `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`;
      
      // Match activities to workouts
      const activityMatches = matchActivitiesToWorkouts(activities, weeklyPlan, monday);
      
      // Remove internal data before saving
      const planToSave = { ...weeklyPlan };
      delete planToSave._ratingAnalysis;
      // Store activity matches with the plan
      planToSave._activityMatches = activityMatches;
      
      localStorage.setItem(`weekly_plan_${weekKey}`, JSON.stringify(planToSave));
      console.log('Saving weekly plan to Supabase:', weekKey, planToSave);
      await dataService.set(`weekly_plan_${weekKey}`, JSON.stringify(planToSave));
      
      // Update weekly plan state
      setWeeklyPlan(planToSave);
      
      // Store analysis separately for easy access
      if (analysis) {
        setWeeklyAnalysis(analysis);
        localStorage.setItem(`weekly_analysis_${weekKey}`, JSON.stringify(analysis));
        await dataService.set(`weekly_analysis_${weekKey}`, JSON.stringify(analysis));
      }
      
      // Mark generation date
      localStorage.setItem('last_plan_generation_date', today.toISOString().split('T')[0]);
      
      // Set current workout based on today's day of the week
      const dayOfWeek = today.getDay(); // 0=Sunday, 1=Monday, 2=Tuesday, 4=Thursday
      const dayNameMap = {
        0: 'sunday',
        1: 'monday',
        2: 'tuesday',
        3: 'wednesday',
        4: 'thursday',
        5: 'friday',
        6: 'saturday'
      };
      
      // Check if today was postponed
      const postponements = weeklyPlan._postponements || {};
      const todayPostponeInfo = postponements[dayNameMap[dayOfWeek]];
      const isTodayPostponed = !!todayPostponeInfo && todayPostponeInfo.postponed;
      
      const todayWorkout = weeklyPlan[dayNameMap[dayOfWeek]];
      
      // Clear current workout first
      setWorkout(null);
      await dataService.set('current_workout', null);
      localStorage.removeItem('current_workout');
      
      // Set today's workout if it exists and wasn't postponed
      if (!isTodayPostponed && todayWorkout) {
        setWorkout(todayWorkout);
        await dataService.set('current_workout', JSON.stringify(todayWorkout));
        localStorage.setItem('current_workout', JSON.stringify(todayWorkout));
      } else if (!isTodayPostponed && weeklyPlan.tuesday) {
        // Fallback to Tuesday if today doesn't have a workout and wasn't postponed
        setWorkout(weeklyPlan.tuesday);
        await dataService.set('current_workout', JSON.stringify(weeklyPlan.tuesday));
        localStorage.setItem('current_workout', JSON.stringify(weeklyPlan.tuesday));
      }
      
      if (!isAutoGeneration) {
        setError('Weekly plan generated successfully!');
        setTimeout(() => setError(null), 3000);
      }
    } catch (err) {
      if (!isAutoGeneration) {
        setError(`Failed to generate weekly plan: ${err.message}`);
      } else {
        console.error('Auto-generation failed:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  // Helper function to check if today is a scheduled run day
  const isScheduledRunDay = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sunday, 1=Monday, 2=Tuesday, 4=Thursday
    // Scheduled run days: Tuesday (2), Thursday (4), Sunday (0)
    return dayOfWeek === 0 || dayOfWeek === 2 || dayOfWeek === 4;
  };

  // Safety net: ensure recovery workout exists on rest days (and after runs on run days)
  useEffect(() => {
    if (isPreloading) return;
    if (recoveryWorkout) return;

    const availableApiKey = import.meta.env.VITE_OPENAI_API_KEY || apiKey;
    if (!availableApiKey) return;

    const today = new Date();
    const dayOfWeek = today.getDay();
    const isRunDay = dayOfWeek === 0 || dayOfWeek === 2 || dayOfWeek === 4; // Sun/Tue/Thu

    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const hasRunTodayFromActivities = (activities || []).some((a) => {
      if (!a || a.type !== 'Run' || !a.start_date) return false;
      const d = new Date(a.start_date);
      return d >= todayStart && d <= todayEnd;
    });

    const shouldHaveRecovery =
      !isRunDay || (isRunDay && hasRunTodayFromActivities);

    if (!shouldHaveRecovery) return;

    // Avoid regenerating if we already have one persisted
    const existingLocal = localStorage.getItem(`recovery_workout_${todayDate}`);
    if (existingLocal) {
      try {
        const parsed = JSON.parse(existingLocal);
        if (parsed && parsed.workout) {
          setRecoveryWorkout(parsed.workout);
          setRecoveryCompleted(!!parsed.completed);
          return;
        }
      } catch {
        // Ignore malformed data and fall through to regenerate
      }
    }

    const generate = async () => {
      try {
        setRecoveryLoading(true);
        const newWorkout = await generateWorkout(
          availableApiKey,
          activities,
          isInjured,
          { reason: 'Recovery day', adjustment: 'recovery', source: 'auto-fallback' }
        );

        setRecoveryWorkout(newWorkout);
        setRecoveryCompleted(false);

        const payload = JSON.stringify({
          workout: newWorkout,
          completed: false
        });

        await dataService.set(`recovery_workout_${todayDate}`, payload);
        localStorage.setItem(`recovery_workout_${todayDate}`, payload);
      } catch (err) {
        console.error('Fallback recovery generation failed:', err);
      } finally {
        setRecoveryLoading(false);
      }
    };

    generate();
  }, [
    isPreloading,
    activities,
    apiKey,
    isInjured,
    recoveryWorkout,
    todayDate
  ]);

  const handlePlannedWorkoutClick = (plannedWorkout, dayName) => {
    console.log('Planned workout clicked:', plannedWorkout, dayName);
    setSelectedPlannedWorkout({ workout: plannedWorkout, dayName });
    setShowWorkoutDetail(true);
    window.history.pushState({ view: 'plannedWorkout', dayName }, '', window.location.pathname);
  };

  const handleGenerateWorkout = async (repeatLast = false, postponeData = null) => {
    // Check for API key in environment variables first, then localStorage
    const availableApiKey = import.meta.env.VITE_OPENAI_API_KEY || apiKey;
    
    if (!availableApiKey) {
      setError('Please enter your OpenAI API key first');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      let newWorkout;
      if (repeatLast && workout && !postponeData) {
        // Use the same workout as last time
        newWorkout = { ...workout, title: `${workout.title} (Repeat)` };
      } else {
        // Pass recent activities, injury status, and postpone data to the workout generator
        newWorkout = await generateWorkout(availableApiKey, activities, isInjured, postponeData);
      }
      
      setWorkout(newWorkout);
      
      // Save workout to Supabase (or localStorage fallback)
      await dataService.set('current_workout', JSON.stringify(newWorkout));
      localStorage.setItem('current_workout', JSON.stringify(newWorkout)); // Keep local copy too
      if (apiKey) localStorage.setItem('openai_api_key', apiKey);
      
      // Clear postpone data after generating workout
      if (postponeData) {
        localStorage.removeItem('postponed_workout');
      }
    } catch (err) {
      setError(`Failed to generate workout: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePostponeWorkout = async (postponeData) => {
    try {
      // Determine current day and week
      const today = new Date();
      const dayOfWeek = today.getDay();
      const dayNameMap = {
        0: 'sunday',
        1: 'monday',
        2: 'tuesday',
        3: 'wednesday',
        4: 'thursday',
        5: 'friday',
        6: 'saturday'
      };
      const currentDayName = dayNameMap[dayOfWeek];
      
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      monday.setHours(0, 0, 0, 0);
      const weekKey = `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`;
      
      // Load current weekly plan
      let weeklyPlan = null;
      const storedPlan = await dataService.get(`weekly_plan_${weekKey}`).catch(() => null);
      if (storedPlan) {
        weeklyPlan = JSON.parse(storedPlan);
      } else {
        const localPlan = localStorage.getItem(`weekly_plan_${weekKey}`);
        if (localPlan) {
          weeklyPlan = JSON.parse(localPlan);
        }
      }
      
      // Initialize _postponements if it doesn't exist
      if (!weeklyPlan) {
        weeklyPlan = {
          weekTitle: `Week Training Plan - ${monday.toLocaleDateString()}`,
          monday: null,
          tuesday: null,
          wednesday: null,
          thursday: null,
          friday: null,
          saturday: null,
          sunday: null
        };
      }
      
      if (!weeklyPlan._postponements) {
        weeklyPlan._postponements = {};
      }
      
      // Store postpone information in weekly plan
      const originalWorkout = weeklyPlan[currentDayName] || workout;
      weeklyPlan._postponements[currentDayName] = {
        postponed: true,
        reason: postponeData.reason,
        date: postponeData.postponedDate || new Date().toISOString(),
        originalDay: currentDayName,
        originalWorkout: originalWorkout,
        adjustment: postponeData.adjustment
      };
      
      
      // Clear the workout for the postponed day (set to null)
      weeklyPlan[currentDayName] = null;
      
      // Store postpone data in localStorage for backward compatibility
      localStorage.setItem('postponed_workout', JSON.stringify(postponeData));
      
      // Regenerate weekly plan to redistribute workouts
      const availableApiKey = import.meta.env.VITE_OPENAI_API_KEY || apiKey;
      if (availableApiKey && weeklyPlan) {
        try {
          setLoading(true);
          console.log('Regenerating weekly plan after postponement...', {
            postponedDay: currentDayName,
            reason: postponeData.reason,
            adjustment: postponeData.adjustment
          });
          
          const adjustedPlan = await adjustWeeklyPlanForPostponement(
            availableApiKey,
            weeklyPlan,
            currentDayName,
            postponeData.reason,
            postponeData.adjustment,
            activities
          );
          
          console.log('Plan regeneration completed. Adjusted plan:', adjustedPlan);
          
          // Always preserve postpone information (merge, don't replace)
          adjustedPlan._postponements = {
            ...(adjustedPlan._postponements || {}),
            ...(weeklyPlan._postponements || {})
          };
          
          
          // CRITICAL: Ensure ALL postponed days are explicitly set to null (AI might put workouts back)
          const postponements = adjustedPlan._postponements || {};
          for (const dayName in postponements) {
            if (postponements[dayName] && postponements[dayName].postponed) {
              adjustedPlan[dayName] = null;
            }
          }
          
          // Re-match activities to workouts
          const activityMatches = matchActivitiesToWorkouts(activities, adjustedPlan, monday);
          adjustedPlan._activityMatches = activityMatches;
          
          // Save updated weekly plan
          console.log('Saving adjusted plan to storage...');
          await dataService.set(`weekly_plan_${weekKey}`, JSON.stringify(adjustedPlan));
          localStorage.setItem(`weekly_plan_${weekKey}`, JSON.stringify(adjustedPlan));
          console.log('Plan saved successfully');
          
          // Update weekly plan state
          setWeeklyPlan(adjustedPlan);
          
          // Force WeeklyPlan component to refresh immediately
          setWeeklyPlanRefreshKey(prev => prev + 1);
          
          setLoading(false);
          
          // Force WeeklyPlan component to reload by triggering a state update
          // This will be handled by the component's useEffect that watches for plan changes
        } catch (err) {
          console.error('Error regenerating plan:', err);
          setLoading(false);
          // Still save the postpone info even if regeneration fails
          await dataService.set(`weekly_plan_${weekKey}`, JSON.stringify(weeklyPlan));
          localStorage.setItem(`weekly_plan_${weekKey}`, JSON.stringify(weeklyPlan));
          
          // Update weekly plan state
          setWeeklyPlan(weeklyPlan);
          
          // Show error to user
          setError('Plan postponed but regeneration failed. Plan saved with postpone status.');
          setTimeout(() => setError(null), 5000);
        }
      } else {
        // Save plan even without regeneration if no API key
        await dataService.set(`weekly_plan_${weekKey}`, JSON.stringify(weeklyPlan));
        localStorage.setItem(`weekly_plan_${weekKey}`, JSON.stringify(weeklyPlan));
        
        // Update weekly plan state
        setWeeklyPlan(weeklyPlan);
      }
      
      // Clear current workout
      setWorkout(null);
      localStorage.removeItem('current_workout');
      
      setShowPostpone(false);
      // Update browser history
      window.history.pushState({ view: 'main' }, '', window.location.pathname);
      
      // Show confirmation
      setError(null);
      setTimeout(() => {
        setError('Workout postponed and weekly plan adjusted!');
        setTimeout(() => setError(null), 3000);
      }, 100);
    } catch (err) {
      console.error('Error handling postpone workout:', err);
      setError('Failed to postpone workout. Please try again.');
    }
  };

  const handleWorkoutFeedback = (feedback) => {
    // Add to rating queue instead of direct feedback storage
    const ratingQueue = JSON.parse(localStorage.getItem('rating_queue') || '[]');
    const queueItem = {
      ...feedback,
      timestamp: new Date().toISOString(),
      matched: false
    };
    ratingQueue.push(queueItem);
    localStorage.setItem('rating_queue', JSON.stringify(ratingQueue));
    
    // Also keep in workout_feedback for AI training purposes
    const existingFeedback = JSON.parse(localStorage.getItem('workout_feedback') || '[]');
    existingFeedback.push(feedback);
    localStorage.setItem('workout_feedback', JSON.stringify(existingFeedback));
    
    setShowFeedback(false);
    // Update browser history
    window.history.pushState({ view: 'main' }, '', window.location.pathname);
    
    // Show confirmation
    setError(null);
    setTimeout(() => {
      setError('Rating saved! It will be matched with your Strava activity when you sync.');
      setTimeout(() => setError(null), 3000);
    }, 100);
  };

  const handleStravaSync = async (showLoadingState = true) => {
    console.log('Strava sync clicked');
    console.log('Current token:', localStorage.getItem('strava_access_token') ? 'exists' : 'none');
    
    if (showLoadingState) {
      setLoading(true);
    }
    setError(null);
    
    try {
      console.log('Calling syncWithStrava...');
      const hasBaseline = localStorage.getItem('last_known_activity_ids') !== null;
      const lastKnownIds = hasBaseline
        ? JSON.parse(localStorage.getItem('last_known_activity_ids') || '[]')
        : [];

      const syncedActivities = await syncWithStrava();
      console.log('Sync result:', syncedActivities);
      
      if (syncedActivities) {
        setActivities(syncedActivities);
        
        // Save activities to Supabase
        await dataService.set('strava_activities', JSON.stringify(syncedActivities));
        localStorage.setItem('strava_activities', JSON.stringify(syncedActivities)); // Keep local copy

        // Detect new activities and prompt for rating (only if baseline exists)
        let newActivities = detectNewActivities(syncedActivities, lastKnownIds);

        // Update baseline AFTER comparison
        const currentIds = syncedActivities.map((a) => a.id);
        localStorage.setItem('last_known_activity_ids', JSON.stringify(currentIds));

        // If this is the first time we establish baseline, don't prompt historical activities
        if (!hasBaseline) {
          newActivities = [];
        }

        if (newActivities.length > 0) {
          setNewActivityQueue(newActivities);
          setCurrentActivityForRating(newActivities[0]);
        }
        
        // Re-match activities to workouts after sync
        const today = new Date();
        const monday = new Date(today);
        monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
        monday.setHours(0, 0, 0, 0);
        const weekKey = `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`;
        
        const storedPlan = await dataService.get(`weekly_plan_${weekKey}`);
        if (storedPlan) {
          const parsedPlan = JSON.parse(storedPlan);
          const activityMatches = matchActivitiesToWorkouts(syncedActivities, parsedPlan, monday);
          parsedPlan._activityMatches = activityMatches;
          
          // Save updated plan with matches
          await dataService.set(`weekly_plan_${weekKey}`, JSON.stringify(parsedPlan));
          localStorage.setItem(`weekly_plan_${weekKey}`, JSON.stringify(parsedPlan));
        }
        
        // Generate insights for most recent activity
        if (syncedActivities.length > 0 && apiKey) {
          try {
            const newInsights = await generateInsights(apiKey, syncedActivities);
            setInsights(newInsights);
          } catch (err) {
            console.error('Failed to generate insights:', err);
          }
        }
      } else {
        console.log('No activities returned, probably redirecting to auth');
      }
    } catch (err) {
      console.error('Strava sync error:', err);
      setError(`Strava sync failed: ${err.message}`);
    } finally {
      if (showLoadingState) {
        setLoading(false);
      }
    }
  };

  const handleStravaAuthComplete = (success) => {
    setIsStravaCallback(false);
    if (success) {
      // Clear the callback URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      urlParams.delete('code');
      urlParams.delete('state');
      urlParams.delete('scope');
      const cleanUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
      window.history.replaceState({}, '', cleanUrl);
      
      // Check if we should redirect to an activity
      const redirectToActivity = sessionStorage.getItem('redirect_to_activity');
      if (redirectToActivity) {
        sessionStorage.removeItem('redirect_to_activity');
        setSelectedActivityId(parseInt(redirectToActivity));
      } else {
        // Sync with Strava to get activities
        handleStravaSync();
      }
    } else {
      setError('Strava authentication failed');
      // Clean up URL even on error
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  const handleApiKeyChange = (e) => {
    setApiKey(e.target.value);
    if (e.target.value) {
      localStorage.setItem('openai_api_key', e.target.value);
    }
  };

  if (showWorkoutDetail) {
    const workoutToShow = selectedPlannedWorkout ? selectedPlannedWorkout.workout : workout;
    const title = selectedPlannedWorkout ? `${selectedPlannedWorkout.dayName} - ${workoutToShow.title}` : workoutToShow.title;
    
    console.log('Showing workout detail:', { workoutToShow, title, selectedPlannedWorkout });
    
    // Check if this workout can be postponed
    // For planned workouts, check if today matches the workout's scheduled day
    // For current workout, check if today is a scheduled run day
    let canPostpone = false;
    let isTodayPostponed = false;
    
    // Check if today was postponed in the weekly plan
    const today = new Date();
    const dayOfWeek = today.getDay();
    const dayNameMap = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday'
    };
    const currentDayName = dayNameMap[dayOfWeek];
    
    if (weeklyPlan && weeklyPlan._postponements) {
      const postponeInfo = weeklyPlan._postponements[currentDayName];
      isTodayPostponed = !!postponeInfo && postponeInfo.postponed;
    }
    
    // Also check old localStorage postpone data for backward compatibility
    const oldPostponeData = localStorage.getItem('postponed_workout');
    if (oldPostponeData && !isTodayPostponed) {
      try {
        const postponeData = JSON.parse(oldPostponeData);
        const postponeDate = new Date(postponeData.postponedDate);
        const todayStart = new Date(today);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);
        // Check if postpone was today
        if (postponeDate >= todayStart && postponeDate <= todayEnd) {
          isTodayPostponed = true;
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    
    if (selectedPlannedWorkout) {
      // For planned workouts, check if today is the scheduled day
      const dayNameMapFull = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 0 };
      const scheduledDay = dayNameMapFull[selectedPlannedWorkout.dayName];
      canPostpone = scheduledDay === dayOfWeek;
    } else {
      // For current workout, check if today is a scheduled run day
      canPostpone = isScheduledRunDay();
    }
    
    const handleBack = () => {
      if (pendingPostpone) {
        // Show postpone menu when trying to exit with pending postpone
        setShowPostpone(true);
        updateDailyUsage('postponed');
        window.history.pushState({ view: 'postpone' }, '', window.location.pathname);
      } else {
        setShowWorkoutDetail(false);
        setSelectedPlannedWorkout(null);
      }
    };

    return (
      <WorkoutDetail 
        workout={{ ...workoutToShow, title }}
        onBack={handleBack}
        onPostpone={() => {
          // Set pending postpone instead of showing menu immediately
          setPendingPostpone(true);
          updateDailyUsage('postponed');
        }}
        postponeDisabled={isTodayPostponed || dailyUsage.postponed || !canPostpone}
        postponeReason={isTodayPostponed || dailyUsage.postponed ? 'already_postponed' : (!canPostpone ? 'not_run_day' : null)}
        pendingPostpone={pendingPostpone}
      />
    );
  }

  if (showPostpone && workout) {
    return (
      <PostponeWorkout 
        workout={workout}
        onPostpone={(postponeData) => {
          handlePostponeWorkout(postponeData);
          setPendingPostpone(false); // Clear pending state after confirmation
        }}
        onCancel={() => {
          setShowPostpone(false);
          setPendingPostpone(false); // Clear pending state on cancel
        }}
      />
    );
  }

  if (showFeedback && workout) {
    return (
      <WorkoutFeedback 
        workout={workout}
        onSubmit={handleWorkoutFeedback}
        onBack={() => {
          setShowFeedback(false);
          window.history.pushState({ view: 'main' }, '', window.location.pathname);
        }}
      />
    );
  }

  if (isStravaCallback) {
    return <StravaCallback onAuthComplete={handleStravaAuthComplete} />;
  }

  if (selectedActivityId) {
    return (
      <ActivityDetail 
        activityId={selectedActivityId} 
        onBack={() => setSelectedActivityId(null)} 
      />
    );
  }

  return (
    <div className="app">
      {/* Hamburger Menu */}
      <div style={{ 
        position: 'fixed', 
        top: '20px', 
        left: '20px', 
        zIndex: 1000,
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'env(safe-area-inset-left)'
      }}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            width: '30px',
            height: '30px',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '5px'
          }}
        >
          <div style={{ width: '24px', height: '3px', backgroundColor: 'var(--text-color)', borderRadius: '2px' }}></div>
          <div style={{ width: '24px', height: '3px', backgroundColor: 'var(--text-color)', borderRadius: '2px' }}></div>
          <div style={{ width: '24px', height: '3px', backgroundColor: 'var(--text-color)', borderRadius: '2px' }}></div>
        </button>

        {/* Menu Slide Panel */}
        <div style={{
          position: 'fixed',
          top: '0',
          left: showMenu ? '0' : '-300px',
          width: '280px',
          height: '100vh',
          background: 'var(--card-bg)',
          borderRight: '1px solid var(--border-color)',
          transition: 'left 0.3s ease-in-out',
          padding: '60px 0 20px 0',
          boxShadow: showMenu ? '2px 0 10px rgba(0,0,0,0.1)' : 'none',
          zIndex: 999
        }}>
          <div style={{ 
            padding: '0 20px 20px 20px', 
            fontSize: '20px', 
            fontWeight: '600', 
            color: 'var(--text-color)',
            borderBottom: '1px solid var(--border-color)',
            marginBottom: '0'
          }}>
            Menu
          </div>
          
          <div style={{ padding: '0' }}>
            <div
              style={{
                width: '100%',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--grid-color)'
              }}
            >
              <span style={{ fontSize: '16px', color: 'var(--text-color)' }}>Theme</span>
              <div
                onClick={() => {
                  setDarkMode(!darkMode);
                }}
                style={{
                  position: 'relative',
                  width: '60px',
                  height: '32px',
                  borderRadius: '16px',
                  backgroundColor: darkMode ? 'var(--accent)' : 'var(--border-color)',
                  cursor: 'pointer',
                  transition: 'background-color 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px'
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                    transition: 'transform 0.3s ease',
                    transform: darkMode ? 'translateX(28px)' : 'translateX(0)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    left: '8px',
                    fontSize: '14px',
                    opacity: darkMode ? 0 : 1,
                    transition: 'opacity 0.3s ease',
                    pointerEvents: 'none'
                  }}
                >
                  ☀️
                </span>
                <span
                  style={{
                    position: 'absolute',
                    right: '8px',
                    fontSize: '14px',
                    opacity: darkMode ? 1 : 0,
                    transition: 'opacity 0.3s ease',
                    pointerEvents: 'none'
                  }}
                >
                  🌙
                </span>
              </div>
            </div>
            
            <button
              onClick={() => {
                handleGenerateWeeklyPlan();
                setShowMenu(false);
              }}
              style={{
                width: '100%',
                padding: '16px 20px',
                background: 'none',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                color: 'var(--text-color)',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                borderBottom: '1px solid var(--grid-color)'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--grid-color)'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            >
              <span style={{ fontSize: '18px' }}>📅</span>
              <span>Generate Weekly Plan</span>
            </button>
            
            <button
              onClick={async () => {
                handleStravaSync();
                setShowMenu(false);
              }}
              style={{
                width: '100%',
                padding: '16px 20px',
                background: 'none',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                color: 'var(--text-color)',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                borderBottom: '1px solid var(--grid-color)',
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#FC4C02';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-color)';
              }}
            >
              <img
                src={`${import.meta.env.BASE_URL}strava-logo.png`}
                alt="Strava"
                style={{
                  width: '20px',
                  height: '20px',
                  flexShrink: 0,
                  objectFit: 'contain',
                  filter: darkMode ? 'brightness(0) saturate(100%) invert(1)' : 'brightness(0) saturate(100%)',
                  transition: 'filter 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.filter = 'brightness(0) saturate(100%) invert(1)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.filter = darkMode ? 'brightness(0) saturate(100%) invert(1)' : 'brightness(0) saturate(100%)';
                }}
                onError={(e) => {
                  console.error('Failed to load Strava logo:', e.target.src);
                }}
              />
              <span>Sync with Strava</span>
            </button>
            
            <button
              onClick={async () => {
                // TODO: Implement Google login
                setShowMenu(false);
              }}
              style={{
                width: '100%',
                padding: '16px 20px',
                background: 'none',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                color: 'var(--text-color)',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                borderBottom: '1px solid var(--grid-color)',
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#4285F4';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-color)';
              }}
            >
              <img
                src={`${import.meta.env.BASE_URL}google-logo.png`}
                alt="Google"
                style={{
                  width: '20px',
                  height: '20px',
                  flexShrink: 0,
                  objectFit: 'contain',
                  filter: darkMode ? 'brightness(0) saturate(100%) invert(1)' : 'brightness(0) saturate(100%)',
                  transition: 'filter 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.filter = 'brightness(0) saturate(100%) invert(1)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.filter = darkMode ? 'brightness(0) saturate(100%) invert(1)' : 'brightness(0) saturate(100%)';
                }}
                onError={(e) => {
                  console.error('Failed to load Google logo:', e.target.src);
                }}
              />
              <span>Login with Google</span>
            </button>
            
            <button
              onClick={async () => {
                // TODO: Implement Garmin Connect login
                setShowMenu(false);
              }}
              style={{
                width: '100%',
                padding: '16px 20px',
                background: 'none',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                color: 'var(--text-color)',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                borderBottom: '1px solid var(--grid-color)',
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#007CC3';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-color)';
              }}
            >
              <img
                src={`${import.meta.env.BASE_URL}garminconnect.svg`}
                alt="Garmin Connect"
                style={{
                  width: '20px',
                  height: '20px',
                  flexShrink: 0,
                  objectFit: 'contain',
                  filter: darkMode ? 'brightness(0) saturate(100%) invert(1)' : 'brightness(0) saturate(100%)',
                  transition: 'filter 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.filter = 'brightness(0) saturate(100%) invert(1)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.filter = darkMode ? 'brightness(0) saturate(100%) invert(1)' : 'brightness(0) saturate(100%)';
                }}
                onError={(e) => {
                  console.error('Failed to load Garmin Connect logo:', e.target.src);
                }}
              />
              <span>Login with Garmin Connect</span>
            </button>
            
            <button
              onClick={async () => {
                if (!supabaseEnabled) {
                  enableSupabase();
                  setSupabaseEnabled(true);
                  setError(null);
                  setTimeout(() => {
                    setError('Supabase sync enabled! Your data will now sync with the mobile app.');
                    setTimeout(() => setError(null), 3000);
                  }, 100);
                  // Reload data from Supabase
                  const syncedData = await syncAllDataFromSupabase();
                  if (syncedData) {
                    if (syncedData.activities && syncedData.activities.length > 0) {
                      setActivities(syncedData.activities);
                    }
                    if (syncedData.workout) {
                      setWorkout(syncedData.workout);
                    }
                  }
                  // Setup real-time sync
                  setupRealtimeSync({
                    onActivitiesChange: async (payload) => {
                      const stored = await dataService.get('strava_activities');
                      if (stored) {
                        setActivities(JSON.parse(stored));
                      }
                    },
                    onWorkoutChange: async (payload) => {
                      const workoutData = await dataService.get('current_workout');
                      if (workoutData) {
                        setWorkout(JSON.parse(workoutData));
                      }
                    }
                  });
                } else {
                  dataService.useSupabase = false;
                  localStorage.setItem('use_supabase', 'false');
                  setSupabaseEnabled(false);
                  setError(null);
                  setTimeout(() => {
                    setError('Supabase sync disabled. Using local storage only.');
                    setTimeout(() => setError(null), 3000);
                  }, 100);
                }
                setShowMenu(false);
              }}
              style={{
                width: '100%',
                padding: '16px 20px',
                background: 'none',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                color: 'var(--text-color)',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                borderBottom: '1px solid var(--grid-color)'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--grid-color)'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            >
              <span style={{ fontSize: '18px' }}>{supabaseEnabled ? '☁️' : '📱'}</span>
              <span>{supabaseEnabled ? 'Disable Cloud Sync' : 'Enable Cloud Sync'}</span>
            </button>
          </div>
        </div>

        {/* Overlay */}
        {showMenu && (
          <div 
            style={{
              position: 'fixed',
              top: '0',
              left: '0',
              width: '100vw',
              height: '100vh',
              backgroundColor: 'rgba(0,0,0,0.3)',
              zIndex: 998
            }}
            onClick={() => setShowMenu(false)}
          />
        )}
      </div>

      {/* Loading Spinner */}
      {isPreloading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-color)',
          zIndex: 9999
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid var(--border-color)',
            borderTop: '4px solid var(--accent)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '16px'
          }}></div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>Loading...</p>
        </div>
      )}

      <PullToRefresh onRefresh={handleStravaSync}>
        {!isPreloading && (
          <>
            <div className="header">
              <h1>Running Coach</h1>
            </div>

        {!import.meta.env.VITE_OPENAI_API_KEY && (
          <div style={{ marginBottom: '20px' }}>
            <input
              type="password"
              placeholder="Enter OpenAI API Key"
              value={apiKey}
              onChange={handleApiKeyChange}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>
        )}

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        <WeeklyAnalysis analysis={weeklyAnalysis} />

        <WeeklyPlan 
          key={weeklyPlanRefreshKey}
          activities={activities}
          onWorkoutClick={handlePlannedWorkoutClick}
          onGenerateWeeklyPlan={handleGenerateWeeklyPlan}
          apiKey={apiKey}
          onActivitiesChange={async () => {
            // When activities change, re-match them to workouts
            const today = new Date();
            const monday = new Date(today);
            monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
            monday.setHours(0, 0, 0, 0);
            const weekKey = `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`;
            
            const storedPlan = await dataService.get(`weekly_plan_${weekKey}`);
            if (storedPlan) {
              const parsedPlan = JSON.parse(storedPlan);
              const activityMatches = matchActivitiesToWorkouts(activities, parsedPlan, monday);
              parsedPlan._activityMatches = activityMatches;
              
              // Save updated plan with matches
              await dataService.set(`weekly_plan_${weekKey}`, JSON.stringify(parsedPlan));
              localStorage.setItem(`weekly_plan_${weekKey}`, JSON.stringify(parsedPlan));
            }
          }}
        />

        {recoveryWorkout && (
          <div
            className="workout-block"
            style={{
              marginTop: '24px',
              border: recoveryCompleted
                ? '1px solid rgba(34, 197, 94, 0.65)'
                : '1px solid var(--border-color)',
              boxShadow: recoveryCompleted
                ? '0 14px 40px rgba(34, 197, 94, 0.30)'
                : '0 8px 24px rgba(15, 23, 42, 0.12)',
              background: recoveryCompleted
                ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(16, 185, 129, 0.06))'
                : 'var(--card-bg)',
              borderRadius: '16px',
              padding: '14px',
              transition: 'box-shadow 0.25s ease, border-color 0.25s ease, background 0.25s ease'
            }}
          >
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div className="workout-title">
                  Recovery Exercises
                </div>
                <div
                  style={{
                    padding: '6px 10px',
                    borderRadius: '999px',
                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.30), rgba(16, 185, 129, 0.18))',
                    border: '1px solid rgba(34, 197, 94, 0.50)',
                    color: 'var(--text-color)',
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '0.02em',
                    whiteSpace: 'nowrap',
                    opacity: recoveryCompleted ? 1 : 0,
                    transform: recoveryCompleted ? 'translateY(0px)' : 'translateY(-4px)',
                    transition: 'opacity 0.25s ease, transform 0.25s ease',
                    pointerEvents: recoveryCompleted ? 'auto' : 'none'
                  }}
                >
                  ✅ Recovery Completed
                </div>
              </div>
            </div>

            <div
              className="block-details"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
                {(recoveryWorkout.blocks || []).map((block, index) => {
                  const isBlockCompleted = !!recoveryBlockStatus[index];
                  return (
                    <div
                      key={index}
                      className="detail-item recovery-detail"
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        width: '100%'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setRecoveryBlockStatus(prev => ({
                            ...prev,
                            [index]: !prev[index]
                          }));
                        }}
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          border: '2px solid var(--accent)',
                          background: isBlockCompleted ? 'var(--accent)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          cursor: 'pointer',
                          transition: 'background 0.15s ease, transform 0.1s ease',
                          transform: isBlockCompleted ? 'scale(0.95)' : 'scale(1)'
                        }}
                        aria-label={isBlockCompleted ? 'Mark segment as not done' : 'Mark segment as done'}
                      >
                        {isBlockCompleted && (
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: 'white'
                            }}
                          />
                        )}
                      </button>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span
                          className="detail-label"
                          style={{
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            fontSize: '12px',
                            opacity: isBlockCompleted ? 0.7 : 1
                          }}
                        >
                          {block.title}
                        </span>
                        {block.duration && (
                          <span
                            className="detail-value"
                            style={{
                              fontSize: '13px',
                              fontWeight: 500,
                              opacity: isBlockCompleted ? 0.7 : 1
                            }}
                          >
                            {block.duration}
                          </span>
                        )}
                        {block.notes && (
                          <span
                            className="detail-value"
                            style={{
                              fontSize: '13px',
                              color: 'var(--text-secondary)',
                              opacity: isBlockCompleted ? 0.6 : 1
                            }}
                          >
                            {block.notes}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  marginTop: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <button
                  className="btn btn-primary"
                  onClick={async () => {
                    if (!recoveryWorkout) return;
                    const newCompleted = !recoveryCompleted;
                    setRecoveryCompleted(newCompleted);
                    const payload = JSON.stringify({
                      workout: recoveryWorkout,
                      completed: newCompleted
                    });
                    try {
                      await dataService.set(`recovery_workout_${todayDate}`, payload);
                      localStorage.setItem(`recovery_workout_${todayDate}`, payload);
                    } catch (err) {
                      console.error('Failed to update recovery completion state:', err);
                    }
                  }}
                  style={{
                    width: '100%',
                    background: recoveryCompleted
                      ? 'transparent'
                      : 'linear-gradient(135deg, rgba(34,197,94,0.95), rgba(16,185,129,0.9))',
                    borderColor: recoveryCompleted
                      ? 'var(--border-color)'
                      : 'rgba(34,197,94,0.9)',
                    color: recoveryCompleted ? 'var(--text-color)' : '#ffffff',
                    boxShadow: recoveryCompleted
                      ? 'none'
                      : '0 12px 30px rgba(34,197,94,0.35)',
                    fontWeight: 700,
                    transition: 'background 0.25s ease, border-color 0.25s ease, color 0.25s ease, box-shadow 0.25s ease, transform 0.1s ease'
                  }}
                >
                  {recoveryCompleted ? 'Undo Recovery' : 'Complete Recovery'}
                </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="loading">
            Generating your personalized workout...
          </div>
        )}

        {isScheduledRunDay() && (
          <WorkoutDisplay 
            workout={workout} 
            isCompleted={hasRunToday}
            onWorkoutClick={() => {
              setShowWorkoutDetail(true);
              // Add to browser history
              window.history.pushState({ view: 'workoutDetail' }, '', window.location.pathname);
            }}
          />
        )}
        
        <div style={{ marginTop: '32px' }}>
          <ActivitiesDisplay 
            activities={activities} 
            onActivityClick={(activityId) => {
              setSelectedActivityId(activityId);
              // Add to browser history
              window.history.pushState({ view: 'activity', activityId }, '', window.location.pathname);
            }}
          />
        </div>
          </>
        )}
      </PullToRefresh>

      {/* New Activity Rating Modal */}
      {currentActivityForRating && (
        <NewActivityRatingModal
          activity={currentActivityForRating}
          onClose={() => {
            // Remove current activity from queue and show next one
            setNewActivityQueue(prev => {
              const updated = prev.filter(a => a.id !== currentActivityForRating.id);
              if (updated.length > 0) {
                setCurrentActivityForRating(updated[0]);
              } else {
                setCurrentActivityForRating(null);
              }
              return updated;
            });
          }}
          onComplete={() => {
            // Remove current activity from queue and show next one
            setNewActivityQueue(prev => {
              const updated = prev.filter(a => a.id !== currentActivityForRating.id);
              if (updated.length > 0) {
                setCurrentActivityForRating(updated[0]);
              } else {
                setCurrentActivityForRating(null);
              }
              return updated;
            });
          }}
        />
      )}
    </div>
  );
}

export default App;
