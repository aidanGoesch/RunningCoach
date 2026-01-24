import { useState } from 'react';

const CoachingPromptEditor = ({ onSave, onCancel, currentPrompt }) => {
  const [prompt, setPrompt] = useState(currentPrompt || `You are an expert running coach. Based on my recent activities and current fitness level, create a personalized running workout.

Consider:
- My recent training volume and intensity
- Appropriate progression and recovery
- Variety in workout types (easy runs, intervals, tempo, long runs)
- My current fitness level and goals

Workout preferences:
- I prefer [describe your preferences, e.g., "morning runs", "trail running", "track workouts"]
- My typical weekly mileage is [X miles]
- I'm training for [goal, e.g., "general fitness", "5K", "marathon"]
- I have [X] days per week available for running

Please generate a specific workout with the JSON format requested, taking into account my recent activity patterns.`);

  const handleSaveToFile = () => {
    const blob = new Blob([prompt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'coaching-prompt.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLoadFromFile = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPrompt(e.target.result);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="workout-display">
      <div className="workout-title">🤖 Coaching Prompt Settings</div>
      
      <div className="workout-block">
        <div className="block-title">Custom Coaching Instructions</div>
        <p style={{ fontSize: '14px', color: '#7f8c8d', marginBottom: '15px' }}>
          This prompt will be sent to ChatGPT along with your recent workout data when generating workouts.
          Customize it to match your training goals and preferences.
        </p>
        
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <button 
            className="btn btn-secondary"
            onClick={handleSaveToFile}
            style={{ fontSize: '14px', padding: '8px 12px' }}
          >
            💾 Save to File
          </button>
          
          <label className="btn btn-secondary" style={{ fontSize: '14px', padding: '8px 12px', cursor: 'pointer' }}>
            📁 Load from File
            <input
              type="file"
              accept=".txt"
              onChange={handleLoadFromFile}
              style={{ display: 'none' }}
            />
          </label>
        </div>
        
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          style={{
            width: '100%',
            minHeight: '300px',
            padding: '12px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            fontSize: '14px',
            fontFamily: 'inherit',
            lineHeight: '1.5',
            resize: 'vertical'
          }}
          placeholder="Enter your coaching instructions..."
        />
        
        <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
          <button 
            className="btn btn-primary"
            onClick={() => onSave(prompt)}
            style={{ flex: 1 }}
          >
            💾 Save Prompt
          </button>
          <button 
            className="btn btn-secondary"
            onClick={onCancel}
            style={{ flex: 1 }}
          >
            ❌ Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default CoachingPromptEditor;
