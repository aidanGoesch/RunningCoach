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
import WeeklyProgress from './components/WeeklyProgress';
import { generateWorkout, generateWeeklyPlan, adjustWeeklyPlanForPostponement, syncWithStrava, generateInsights } from './services/api';

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
  const [darkMode, setDarkMode] = useState(localStorage.getItem('darkMode') === 'true');
  const [isInjured, setIsInjured] = useState(localStorage.getItem('isInjured') === 'true');
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
    
    // Load stored activities
    const stored = localStorage.getItem('strava_activities');
    if (stored) {
      setActivities(JSON.parse(stored));
    }
    
  // Load saved workout and check for postponed workout
    const savedWorkout = localStorage.getItem('current_workout');
    if (savedWorkout) {
      setWorkout(JSON.parse(savedWorkout));
    }
    
    // Check for postponed workout on page load
    const postponedWorkout = localStorage.getItem('postponed_workout');
    if (postponedWorkout && !savedWorkout) {
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
      // Small delay to let the page load first
      setTimeout(() => {
        handleStravaSync();
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

  const handleStravaSync = async () => {
    console.log('Strava sync clicked');
    console.log('Current token:', localStorage.getItem('strava_access_token') ? 'exists' : 'none');
    
    setLoading(true);
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
      setLoading(false);
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
      <button 
        className="theme-toggle"
        onClick={() => setDarkMode(!darkMode)}
        title="Toggle dark mode"
      >
        {darkMode ? '☀' : '☾'}
      </button>
      
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
      />

      <WeeklyProgress activities={activities} />

      <div className="buttons">
        <button 
          className="btn btn-primary" 
          onClick={() => handleGenerateWorkout(false)}
          disabled={loading || (!apiKey && !import.meta.env.VITE_OPENAI_API_KEY)}
        >
          {loading ? 'Generating...' : 'Generate Workout'}
        </button>
        
        {workout && (
          <button 
            className="btn btn-secondary" 
            onClick={() => {
              setShowPostpone(true);
              // Add to browser history
              window.history.pushState({ view: 'postpone' }, '', window.location.pathname);
            }}
            disabled={loading}
            style={{ fontSize: '14px', padding: '12px 20px' }}
          >
            Postpone Workout
          </button>
        )}
        
        <button 
          className={`btn ${isInjured ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setIsInjured(!isInjured)}
          style={{ fontSize: '14px', padding: '12px 20px' }}
        >
          {isInjured ? 'I\'m Injured' : 'I\'m Healthy'}
        </button>
        
        <button 
          className="btn btn-secondary" 
          onClick={() => {
            setShowPromptEditor(true);
            // Add to browser history
            window.history.pushState({ view: 'promptEditor' }, '', window.location.pathname);
          }}
          style={{ fontSize: '14px', padding: '12px 20px' }}
        >
          Coaching Settings
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
