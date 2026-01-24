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
  const [apiKey, setApiKey] = useState(
    import.meta.env.VITE_OPENAI_API_KEY || 
    localStorage.getItem('openai_api_key') || 
    ''
  );

  useEffect(() => {
    // Check if this is a Strava callback - handle both paths
    const isCallback = window.location.pathname === '/strava-callback' || 
                      window.location.pathname === '/RunningCoach/strava-callback' ||
                      window.location.search.includes('code=');
    
    if (isCallback) {
      setIsStravaCallback(true);
    }
    
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
  }, []);

  const handleGenerateWorkout = async () => {
    // Check for API key in environment variables first, then localStorage
    const availableApiKey = import.meta.env.VITE_OPENAI_API_KEY || apiKey;
    
    if (!availableApiKey) {
      setError('Please enter your OpenAI API key first');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Pass recent activities to the workout generator
      const newWorkout = await generateWorkout(availableApiKey, activities);
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
  };

  const handleWorkoutFeedback = (feedback) => {
    // Save feedback to localStorage
    const existingFeedback = JSON.parse(localStorage.getItem('workout_feedback') || '[]');
    existingFeedback.push(feedback);
    localStorage.setItem('workout_feedback', JSON.stringify(existingFeedback));
    
    setShowFeedback(false);
    
    // Show confirmation
    setError(null);
    setTimeout(() => {
      setError('Feedback saved! Future workouts will be adjusted based on your input.');
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
          onClick={handleGenerateWorkout}
          disabled={loading || (!apiKey && !import.meta.env.VITE_OPENAI_API_KEY)}
        >
          {loading ? '⏳ Generating...' : '🎯 Generate Workout'}
        </button>
        
        <button 
          className="btn btn-secondary" 
          onClick={() => setShowPromptEditor(true)}
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
            onClick={() => setShowFeedback(true)}
            style={{ width: '100%' }}
          >
            📝 Rate This Workout
          </button>
        </div>
      )}
      
      <ActivitiesDisplay 
        activities={activities} 
        onActivityClick={setSelectedActivityId}
      />
      <InsightsDisplay insights={insights} />
    </div>
  );
}

export default App;
