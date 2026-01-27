import { useState, useEffect } from 'react';
import WorkoutDisplay from './components/WorkoutDisplay';
import WorkoutDetail from './components/WorkoutDetail';
import WeeklyPlan from './components/WeeklyPlan';
import ActivitiesDisplay from './components/ActivitiesDisplay';
import InsightsDisplay from './components/InsightsDisplay';
import StravaCallback from './components/StravaCallback';
import ActivityDetail from './components/ActivityDetail';
import CoachingPromptEditor from './components/CoachingPromptEditor';
import WorkoutFeedback from './components/WorkoutFeedback';
import PostponeWorkout from './components/PostponeWorkout';
import { generateWorkout, generateWeeklyPlan, syncWithStrava, generateInsights } from './services/api';
import { dataService } from './services/supabase';

function App() {
  const [workout, setWorkout] = useState(null);
  const [activities, setActivities] = useState([]);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
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
    const isCallback = window.location.pathname === '/strava-callback' || 
                      window.location.pathname === '/RunningCoach/strava-callback' ||
                      urlParams.has('code');
    
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
    
    // Load data asynchronously
    const loadData = async () => {
      try {
        console.log('Loading data from Supabase...');
        
        // Load stored activities first (most important)
        console.log('Loading activities...');
        const stored = await dataService.get('strava_activities');
        if (stored) {
          console.log('Activities loaded:', JSON.parse(stored).length);
          setActivities(JSON.parse(stored));
        } else {
          console.log('No activities found, checking localStorage fallback...');
          const localStored = localStorage.getItem('strava_activities');
          if (localStored) {
            setActivities(JSON.parse(localStored));
          }
        }
        
        // Load saved workout (skip for now due to 406 error)
        console.log('Skipping current workout load due to Supabase query issues...');
        const localWorkout = localStorage.getItem('current_workout');
        if (localWorkout) {
          setWorkout(JSON.parse(localWorkout));
        }
        
        console.log('Data loading completed');
      } catch (error) {
        console.error('Error loading data from Supabase, falling back to localStorage:', error);
        // Fallback to localStorage if Supabase fails
        const localStored = localStorage.getItem('strava_activities');
        if (localStored) {
          setActivities(JSON.parse(localStored));
        }
        const localWorkout = localStorage.getItem('current_workout');
        if (localWorkout) {
          setWorkout(JSON.parse(localWorkout));
        }
      }
    };

    loadData();
    
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
    if (hasTokens && !currentWorkout) {
      // Only auto-sync if there's no current workout
      // Small delay to let the page load first
      setTimeout(() => {
        handleStravaSync(false); // Don't show loading for background sync
      }, 1000);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleGenerateWeeklyPlan = async () => {
    const availableApiKey = import.meta.env.VITE_OPENAI_API_KEY || apiKey;
    
    if (!availableApiKey) {
      setError('Please enter your OpenAI API key first');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const weeklyPlan = await generateWeeklyPlan(availableApiKey, activities, isInjured);
      
      // Store weekly plan
      const today = new Date();
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      monday.setHours(0, 0, 0, 0);
      const weekKey = `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`;
      
      localStorage.setItem(`weekly_plan_${weekKey}`, JSON.stringify(weeklyPlan));
      await dataService.set(`weekly_plan_${weekKey}`, JSON.stringify(weeklyPlan));
      
      // Set today's workout if it exists
      const today_day = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][today.getDay()];
      const todaysWorkout = weeklyPlan[today_day];
      
      if (todaysWorkout) {
        setWorkout(todaysWorkout);
        localStorage.setItem('current_workout', JSON.stringify(todaysWorkout));
      }
      
      setError('Weekly plan generated successfully!');
      setTimeout(() => setError(null), 3000);
    } catch (err) {
      setError(`Failed to generate weekly plan: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePlannedWorkoutClick = (plannedWorkout, dayName) => {
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
      
      // Save workout to localStorage for persistence
      localStorage.setItem('current_workout', JSON.stringify(newWorkout));
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

  const handleSavePrompt = (prompt) => {
    localStorage.setItem('coaching_prompt', prompt);
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
      // Redirect back to main app and sync
      window.history.replaceState({}, '', '/');
      handleStravaSync();
    } else {
      setError('Strava authentication failed');
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
        postponeDisabled={dailyUsage.postponed}
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
      <div style={{ position: 'fixed', top: '20px', left: '20px', zIndex: 1000 }}>
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

      <WeeklyPlan 
        activities={activities}
        onWorkoutClick={handlePlannedWorkoutClick}
        onGenerateWeeklyPlan={handleGenerateWeeklyPlan}
        apiKey={apiKey}
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
      
      {workout && (
        <div style={{ marginBottom: '20px' }}>
          <button 
            className="btn btn-secondary"
            onClick={() => {
              setShowFeedback(true);
              // Add to browser history
              window.history.pushState({ view: 'feedback' }, '', window.location.pathname);
            }}
            style={{ width: '100%' }}
          >
            Rate This Workout
          </button>
        </div>
      )}
      
      <ActivitiesDisplay 
        activities={activities} 
        onActivityClick={(activityId) => {
          setSelectedActivityId(activityId);
          // Add to browser history
          window.history.pushState({ view: 'activity', activityId }, '', window.location.pathname);
        }}
      />
    </div>
  );
}

export default App;
