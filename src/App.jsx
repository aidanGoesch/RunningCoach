import { useState, useEffect } from 'react';
import WorkoutDisplay from './components/WorkoutDisplay';
import ActivitiesDisplay from './components/ActivitiesDisplay';
import InsightsDisplay from './components/InsightsDisplay';
import StravaCallback from './components/StravaCallback';
import ActivityDetail from './components/ActivityDetail';
import CoachingPromptEditor from './components/CoachingPromptEditor';
import WorkoutFeedback from './components/WorkoutFeedback';
import { generateWorkout, syncWithStrava, generateInsights } from './services/api';

function App() {
  const [workout, setWorkout] = useState(null);
  const [activities, setActivities] = useState([]);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isStravaCallback, setIsStravaCallback] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState(null);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [darkMode, setDarkMode] = useState(localStorage.getItem('darkMode') === 'true');
  const [isInjured, setIsInjured] = useState(localStorage.getItem('isInjured') === 'true');
  const [apiKey, setApiKey] = useState(
    import.meta.env.VITE_OPENAI_API_KEY || 
    localStorage.getItem('openai_api_key') || 
    ''
  );

  // Apply dark mode
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  // Save injury status
  useEffect(() => {
    localStorage.setItem('isInjured', isInjured);
  }, [isInjured]);

  useEffect(() => {
    // Check if this is a Strava callback - handle both paths and URL params
    const urlParams = new URLSearchParams(window.location.search);
    const isCallback = window.location.pathname === '/strava-callback' || 
                      window.location.pathname === '/RunningCoach/strava-callback' ||
                      urlParams.has('code');
    
    if (isCallback) {
      setIsStravaCallback(true);
    }
    
    // Handle browser back/forward navigation
    const handlePopState = (event) => {
      if (event.state) {
        if (event.state.view === 'activity') {
          setSelectedActivityId(event.state.activityId);
          setShowPromptEditor(false);
          setShowFeedback(false);
        } else if (event.state.view === 'promptEditor') {
          setShowPromptEditor(true);
          setSelectedActivityId(null);
          setShowFeedback(false);
        } else if (event.state.view === 'feedback') {
          setShowFeedback(true);
          setSelectedActivityId(null);
          setShowPromptEditor(false);
        } else {
          // Main view
          setSelectedActivityId(null);
          setShowPromptEditor(false);
          setShowFeedback(false);
        }
      } else {
        // No state, go to main view
        setSelectedActivityId(null);
        setShowPromptEditor(false);
        setShowFeedback(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    // Load stored activities
    const stored = localStorage.getItem('strava_activities');
    if (stored) {
      setActivities(JSON.parse(stored));
    }
    
    // Load saved workout
    const savedWorkout = localStorage.getItem('current_workout');
    if (savedWorkout) {
      setWorkout(JSON.parse(savedWorkout));
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleGenerateWorkout = async (repeatLast = false) => {
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
      if (repeatLast && workout) {
        // Use the same workout as last time
        newWorkout = { ...workout, title: `${workout.title} (Repeat)` };
      } else {
        // Pass recent activities and injury status to the workout generator
        newWorkout = await generateWorkout(availableApiKey, activities, isInjured);
      }
      
      setWorkout(newWorkout);
      
      // Save workout to localStorage for persistence
      localStorage.setItem('current_workout', JSON.stringify(newWorkout));
      if (apiKey) localStorage.setItem('openai_api_key', apiKey);
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
        {darkMode ? '☀️' : '🌙'}
      </button>
      
      <div className="header">
        <h1>🏃‍♂️ Running Coach</h1>
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

      <div className="buttons">
        <button 
          className="btn btn-secondary" 
          onClick={handleStravaSync}
          disabled={loading}
        >
          {loading ? '⏳ Syncing...' : '🔗 Sync with Strava'}
        </button>
        
        <button 
          className="btn btn-secondary" 
          onClick={() => {
            localStorage.removeItem('strava_access_token');
            localStorage.removeItem('strava_refresh_token');
            localStorage.removeItem('strava_activities');
            setActivities([]);
            setInsights(null);
            handleStravaSync();
          }}
          style={{ fontSize: '14px', padding: '10px 15px' }}
        >
          🔄 Re-authorize Strava
        </button>
        
        <button 
          className="btn btn-primary" 
          onClick={() => handleGenerateWorkout(false)}
          disabled={loading || (!apiKey && !import.meta.env.VITE_OPENAI_API_KEY)}
        >
          {loading ? '⏳ Generating...' : '🎯 Generate Workout'}
        </button>
        
        {workout && (
          <button 
            className="btn btn-secondary" 
            onClick={() => handleGenerateWorkout(true)}
            disabled={loading}
            style={{ fontSize: '14px', padding: '10px 15px' }}
          >
            🔁 Same Run Tomorrow
          </button>
        )}
        
        <button 
          className={`btn ${isInjured ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setIsInjured(!isInjured)}
          style={{ fontSize: '14px', padding: '10px 15px' }}
        >
          {isInjured ? '🩹 I\'m Injured' : '💪 I\'m Healthy'}
        </button>
        
        <button 
          className="btn btn-secondary" 
          onClick={() => {
            setShowPromptEditor(true);
            // Add to browser history
            window.history.pushState({ view: 'promptEditor' }, '', window.location.pathname);
          }}
          style={{ fontSize: '14px', padding: '10px 15px' }}
        >
          ⚙️ Coaching Settings
        </button>
      </div>

      {loading && (
        <div className="loading">
          Generating your personalized workout...
        </div>
      )}

      <WorkoutDisplay workout={workout} />
      
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
            📝 Rate This Workout
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
      <InsightsDisplay insights={insights} />
    </div>
  );
}

export default App;
