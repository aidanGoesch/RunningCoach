import { useState } from 'react';
import WorkoutDisplay from './components/WorkoutDisplay';
import { generateWorkout, syncWithStrava } from './services/api';

function App() {
  const [workout, setWorkout] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiKey, setApiKey] = useState(localStorage.getItem('openai_api_key') || '');

  const handleGenerateWorkout = async () => {
    if (!apiKey) {
      setError('Please enter your OpenAI API key first');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const newWorkout = await generateWorkout(apiKey);
      setWorkout(newWorkout);
      localStorage.setItem('openai_api_key', apiKey);
    } catch (err) {
      setError(`Failed to generate workout: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStravaSync = async () => {
    setError(null);
    try {
      await syncWithStrava();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleApiKeyChange = (e) => {
    setApiKey(e.target.value);
    if (e.target.value) {
      localStorage.setItem('openai_api_key', e.target.value);
    }
  };

  return (
    <div className="app">
      <div className="header">
        <h1>🏃‍♂️ Running Coach</h1>
        <p>Your AI-powered running companion</p>
      </div>

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

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      <div className="buttons">
        <button 
          className="btn btn-secondary" 
          onClick={handleStravaSync}
        >
          🔗 Sync with Strava
        </button>
        
        <button 
          className="btn btn-primary" 
          onClick={handleGenerateWorkout}
          disabled={loading || !apiKey}
        >
          {loading ? '⏳ Generating...' : '🎯 Generate Workout'}
        </button>
      </div>

      {loading && (
        <div className="loading">
          Generating your personalized workout...
        </div>
      )}

      <WorkoutDisplay workout={workout} />
    </div>
  );
}

export default App;
