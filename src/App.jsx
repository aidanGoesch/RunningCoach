import { useState, useEffect } from 'react';
import WorkoutDisplay from './components/WorkoutDisplay';
import WorkoutDetail from './components/WorkoutDetail';
import WeeklyPlan from './components/WeeklyPlan';
import WeeklyAnalysis from './components/WeeklyAnalysis';
import ActivitiesDisplay from './components/ActivitiesDisplay';
import InsightsDisplay from './components/InsightsDisplay';
import StravaCallback from './components/StravaCallback';
import ActivityDetail from './components/ActivityDetail';
import CoachingPromptEditor from './components/CoachingPromptEditor';
import WorkoutFeedback from './components/WorkoutFeedback';
import PostponeWorkout from './components/PostponeWorkout';
import PullToRefresh from './components/PullToRefresh';
import NewActivityRatingModal from './components/NewActivityRatingModal';
import { generateWorkout, generateWeeklyPlan, generateDataDrivenWeeklyPlan, generateWeeklyAnalysis, matchActivitiesToWorkouts, syncWithStrava, generateInsights, detectNewActivities } from './services/api';
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
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showPostpone, setShowPostpone] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [darkMode, setDarkMode] = useState(localStorage.getItem('darkMode') === 'true');
  const [isInjured, setIsInjured] = useState(localStorage.getItem('isInjured') === 'true');
  const [supabaseEnabled, setSupabaseEnabled] = useState(dataService.useSupabase || localStorage.getItem('use_supabase') === 'true');
  const [weeklyAnalysis, setWeeklyAnalysis] = useState(null);
  const [newActivityQueue, setNewActivityQueue] = useState([]);
  const [currentActivityForRating, setCurrentActivityForRating] = useState(null);

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
          setShowPromptEditor(false);
          setShowFeedback(false);
          setShowPostpone(false);
          setShowWorkoutDetail(false);
        } else if (event.state.view === 'workoutDetail') {
          setShowWorkoutDetail(true);
          setSelectedActivityId(null);
          setShowPromptEditor(false);
          setShowFeedback(false);
          setShowPostpone(false);
        } else if (event.state.view === 'promptEditor') {
          setShowPromptEditor(true);
          setSelectedActivityId(null);
          setShowFeedback(false);
          setShowPostpone(false);
          setShowWorkoutDetail(false);
        } else if (event.state.view === 'feedback') {
          setShowFeedback(true);
          setSelectedActivityId(null);
          setShowPromptEditor(false);
          setShowPostpone(false);
          setShowWorkoutDetail(false);
        } else if (event.state.view === 'postpone') {
          setShowPostpone(true);
          setSelectedActivityId(null);
          setShowPromptEditor(false);
          setShowFeedback(false);
          setShowWorkoutDetail(false);
        } else {
          // Main view
          setSelectedActivityId(null);
          setShowPromptEditor(false);
          setShowFeedback(false);
          setShowPostpone(false);
          setShowWorkoutDetail(false);
        }
      } else {
        // No state, go to main view
        setSelectedActivityId(null);
        setShowPromptEditor(false);
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
        
        // Process workout
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
        
        let todayWorkout = null;
        if (weeklyPlanData) {
          const parsedPlan = JSON.parse(weeklyPlanData);
          todayWorkout = parsedPlan[dayNameMap[dayOfWeek]];
        }
        
        if (todayWorkout) {
          setWorkout(todayWorkout);
          await dataService.set('current_workout', JSON.stringify(todayWorkout));
          localStorage.setItem('current_workout', JSON.stringify(todayWorkout));
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
        
        // Detect new activities after sync
        let newActivities = [];
        if (syncedActivities && syncedActivities.length > 0) {
          newActivities = detectNewActivities(syncedActivities);
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
      // If there's a postponed workout but no current workout, show option to generate adjusted workout
      const postponeData = JSON.parse(postponedWorkout);
      const postponeDate = new Date(postponeData.postponedDate);
      const now = new Date();
      
      // Only show if postponed within last 2 days
      if (now - postponeDate < 2 * 24 * 60 * 60 * 1000) {
        setTimeout(() => {
          if (confirm(`You postponed a workout: "${postponeData.reason}". Generate an adjusted workout now?`)) {
            handleGenerateWorkout(false, postponeData);
          } else {
            localStorage.removeItem('postponed_workout');
          }
        }, 1000);
      } else {
        localStorage.removeItem('postponed_workout');
      }
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
      
      const todayWorkout = weeklyPlan[dayNameMap[dayOfWeek]];
      
      // Clear current workout first
      setWorkout(null);
      await dataService.set('current_workout', null);
      localStorage.removeItem('current_workout');
      
      // Set today's workout if it exists
      if (todayWorkout) {
        setWorkout(todayWorkout);
        await dataService.set('current_workout', JSON.stringify(todayWorkout));
        localStorage.setItem('current_workout', JSON.stringify(todayWorkout));
      } else if (weeklyPlan.tuesday) {
        // Fallback to Tuesday if today doesn't have a workout
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

  const handleSavePrompt = async (prompt) => {
    localStorage.setItem('coaching_prompt', prompt);
    // Save to Supabase if enabled
    await dataService.set('coaching_prompt', prompt);
    setShowPromptEditor(false);
    // Update browser history
    window.history.pushState({ view: 'main' }, '', window.location.pathname);
  };

  const handlePostponeWorkout = (postponeData) => {
    // Store postpone data
    localStorage.setItem('postponed_workout', JSON.stringify(postponeData));
    
    // Clear current workout
    setWorkout(null);
    localStorage.removeItem('current_workout');
    
    setShowPostpone(false);
    // Update browser history
    window.history.pushState({ view: 'main' }, '', window.location.pathname);
    
    // Show confirmation
    setError(null);
    setTimeout(() => {
      setError('Workout postponed. Generate a new workout when you\'re ready!');
      setTimeout(() => setError(null), 3000);
    }, 100);
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
      const syncedActivities = await syncWithStrava();
      console.log('Sync result:', syncedActivities);
      
      if (syncedActivities) {
        setActivities(syncedActivities);
        
        // Save activities to Supabase
        await dataService.set('strava_activities', JSON.stringify(syncedActivities));
        localStorage.setItem('strava_activities', JSON.stringify(syncedActivities)); // Keep local copy
        
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
    if (selectedPlannedWorkout) {
      // For planned workouts, check if today is the scheduled day
      const today = new Date();
      const dayOfWeek = today.getDay();
      const dayNameMap = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 0 };
      const scheduledDay = dayNameMap[selectedPlannedWorkout.dayName];
      canPostpone = scheduledDay === dayOfWeek;
    } else {
      // For current workout, check if today is a scheduled run day
      canPostpone = isScheduledRunDay();
    }
    
    return (
      <WorkoutDetail 
        workout={{ ...workoutToShow, title }}
        onBack={() => {
          setShowWorkoutDetail(false);
          setSelectedPlannedWorkout(null);
        }}
        onPostpone={() => {
          setShowPostpone(true);
          updateDailyUsage('postponed');
          window.history.pushState({ view: 'postpone' }, '', window.location.pathname);
        }}
        postponeDisabled={dailyUsage.postponed || !canPostpone}
        postponeReason={dailyUsage.postponed ? 'already_postponed' : (!canPostpone ? 'not_run_day' : null)}
      />
    );
  }

  if (showPostpone && workout) {
    return (
      <PostponeWorkout 
        workout={workout}
        onPostpone={handlePostponeWorkout}
        onCancel={() => setShowPostpone(false)}
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

  if (showPromptEditor) {
    return (
      <CoachingPromptEditor 
        currentPrompt={localStorage.getItem('coaching_prompt')}
        onSave={handleSavePrompt}
        onCancel={() => setShowPromptEditor(false)}
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
            <button
              onClick={() => {
                setDarkMode(!darkMode);
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
              <span style={{ fontSize: '18px' }}>{darkMode ? '☀️' : '🌙'}</span>
              <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
            
            <button
              onClick={() => {
                setShowPromptEditor(true);
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
              <span style={{ fontSize: '18px' }}>⚙️</span>
              <span>Coaching Settings</span>
            </button>
            
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
              <p>Your AI-powered running companion</p>
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

        <div className="buttons">
          <button 
            className="btn btn-secondary" 
            onClick={() => {
              handleGenerateWorkout(false, { reason: 'Recovery day', adjustment: 'recovery' });
              updateDailyUsage('recovery');
            }}
            disabled={loading || (!apiKey && !import.meta.env.VITE_OPENAI_API_KEY) || dailyUsage.recovery}
            style={{ 
              fontSize: '14px', 
              padding: '12px 20px',
              opacity: dailyUsage.recovery ? 0.5 : 1,
              cursor: dailyUsage.recovery ? 'not-allowed' : 'pointer'
            }}
          >
            {dailyUsage.recovery ? 'Recovery Used Today' : 'Generate Recovery Exercises'}
          </button>
          
        </div>

        {loading && (
          <div className="loading">
            Generating your personalized workout...
          </div>
        )}

        <WorkoutDisplay 
          workout={workout} 
          onWorkoutClick={() => {
            setShowWorkoutDetail(true);
            // Add to browser history
            window.history.pushState({ view: 'workoutDetail' }, '', window.location.pathname);
          }}
        />
        
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
