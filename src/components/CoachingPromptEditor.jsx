import { useState } from 'react';
import { useSwipeBack } from '../hooks/useSwipeBack';

const CoachingPromptEditor = ({ onSave, onCancel, currentPrompt }) => {
  const swipeBackRef = useSwipeBack(onCancel);
  const [prompt, setPrompt] = useState(currentPrompt || `You are an elite running coach specializing in half marathon training and injury prevention. I need a personalized 100-day training plan to run a half marathon in 1:45:00 on May 2nd.`);

  const handleExportData = () => {
    const exportData = {
      exportDate: new Date().toISOString(),
      version: "1.0",
      data: {
        coaching_prompt: localStorage.getItem('coaching_prompt'),
        strava_activities: localStorage.getItem('strava_activities'),
        workout_feedback: localStorage.getItem('workout_feedback'),
        activity_ratings: localStorage.getItem('activity_ratings'),
        rating_queue: localStorage.getItem('rating_queue'),
        current_workout: localStorage.getItem('current_workout'),
        postponed_workout: localStorage.getItem('postponed_workout'),
        openai_api_key: localStorage.getItem('openai_api_key'),
        darkMode: localStorage.getItem('darkMode'),
        isInjured: localStorage.getItem('isInjured'),
        authenticated: localStorage.getItem('authenticated'),
        insights: localStorage.getItem('insights')
      }
    };

    // Add all weekly plans and activity cache
    const weeklyPlans = {};
    const activityInsights = {};
    console.log('Exporting localStorage keys:');
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      console.log('Found key:', key);
      if (key.startsWith('weekly_plan_')) {
        console.log('Adding weekly plan:', key, localStorage.getItem(key));
        weeklyPlans[key] = localStorage.getItem(key);
      }
      if (key.startsWith('activity_detail_')) {
        exportData.data[key] = localStorage.getItem(key);
      }
      if (key.startsWith('activity_insights_')) {
        activityInsights[key] = localStorage.getItem(key);
      }
    }
    console.log('Final weekly plans object:', weeklyPlans);
    exportData.data.weekly_plans = weeklyPlans;
    exportData.data.activity_insights = activityInsights;

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `running-coach-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
    <div className="app" ref={swipeBackRef}>
      <div className="workout-display">
      <div className="workout-title">Coaching Prompt Settings</div>
      
      <div className="workout-block">
        <div className="block-title">Custom Coaching Instructions</div>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '15px' }}>
          This prompt will be sent to ChatGPT along with your recent workout data when generating workouts.
          Customize it to match your training goals and preferences.
        </p>
        
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <button 
            className="btn btn-secondary"
            onClick={handleSaveToFile}
            style={{ fontSize: '14px', padding: '8px 12px' }}
          >
            Save to File
          </button>
          
          <label className="btn btn-secondary" style={{ fontSize: '14px', padding: '8px 12px', cursor: 'pointer' }}>
            Load from File
            <input
              type="file"
              accept=".txt"
              onChange={handleLoadFromFile}
              style={{ display: 'none' }}
            />
          </label>

          <button 
            className="btn btn-primary"
            onClick={handleExportData}
            style={{ fontSize: '14px', padding: '8px 12px' }}
          >
            Export All Data
          </button>

          <label className="btn btn-success" style={{ fontSize: '14px', padding: '8px 12px', cursor: 'pointer' }}>
            Import to Supabase
            <input
              type="file"
              accept=".json"
              onChange={async (event) => {
                const file = event.target.files[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = async (e) => {
                    try {
                      console.log('Starting migration...');
                      const exportedData = JSON.parse(e.target.result);
                      console.log('Parsed data:', exportedData);
                      
                      const { migrateToSupabase } = await import('../services/supabase');
                      console.log('Calling migrateToSupabase...');
                      
                      await migrateToSupabase(exportedData);
                      console.log('Migration completed successfully');
                      
                      alert('Data migrated to Supabase successfully!');
                      window.location.reload();
                    } catch (error) {
                      console.error('Migration error:', error);
                      alert('Migration failed: ' + error.message);
                    }
                  };
                  reader.readAsText(file);
                }
                // Reset the input so the same file can be selected again
                event.target.value = '';
              }}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>
      </div>
    </div>
  );
};

export default CoachingPromptEditor;
