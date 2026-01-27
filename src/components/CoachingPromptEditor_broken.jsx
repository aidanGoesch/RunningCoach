import { useState } from 'react';

const CoachingPromptEditor = ({ onSave, onCancel, currentPrompt }) => {
  const [prompt, setPrompt] = useState(currentPrompt || `You are an elite running coach specializing in half marathon training and injury prevention. I need a personalized 100-day training plan to run a half marathon in 1:45:00 on May 2nd.
CURRENT TRAINING WEEK: [Week X of 14]

Race Date: May 2, 2026
Days until race: [X days]
Current phase: [Base Building / Build / Peak / Taper]
Previous week's total mileage: [X miles]
This week's target mileage: [X miles]

(Note: Update this section each time you ask for a new workout. This helps me track progression and ensure proper periodization.)
Current Fitness & Background:

Recent half marathon PR: 2:01:00 (need to improve by 16 minutes)
Current longest run: 7.5 miles (starting next long run at 8-8.5 miles)
Max heart rate: ~210 bpm
Previous weekly mileage before injury: 20 miles/week
Target peak weekly mileage: ~20 miles/week near race day
Injury history: Prone to overuse injuries when increasing mileage too quickly (most recently foot tendonitis in November 2025)

Training Structure (3 runs per week):

Easy Run (Recovery/Aerobic Base)

Purpose: Build aerobic base, recover between hard sessions, adapt body to mileage
Heart rate target: 150-160 bpm (I struggle to stay in true Zone 2, so this is my realistic easy pace)
Focus: Time on feet, not pace. Keep it conversational.
Start conservatively and build volume gradually


Speed/Tempo Workout

Types: Track intervals OR tempo runs only (no fartleks or hill repeats)
Reference the attached track workout format I enjoyed (400m repeats structure)
Heart rate: Unrestricted - can push into Zone 4-5 for intervals
Include proper warm-up (1.5mi easy) and cool-down (1mi easy)
Vary between shorter intervals (400m, 800m) and tempo efforts (2-4 miles at threshold)


Long Run

Purpose: Build endurance for half marathon distance
Starting point: 8 miles this weekend, progress gradually to 11-12 miles
Heart rate: Unrestricted, but aim for sustainable pace (likely Zone 3-4)
Increase by no more than 1 mile per week, with cutback weeks every 3-4 weeks



Critical Constraints:

Injury prevention is TOP priority - never increase weekly mileage by more than 10%
Include cutback/recovery weeks every 3-4 weeks (reduce mileage by 20-30%)
Build mileage gradually from current ~12-15 miles/week back up to 20 miles/week
Monitor for early warning signs: unusual soreness, persistent fatigue, elevated resting HR

Periodization Strategy (14-week plan):

Weeks 1-4: Base Building Phase (focus on easy mileage, simple speed work)

Target weekly mileage: 12-16 miles


Weeks 5-8: Build Phase (increase long run distance, introduce harder tempo work)

Target weekly mileage: 16-19 miles


Weeks 9-12: Peak Phase (hit 20 mile weeks, race-specific pace work)

Target weekly mileage: 19-22 miles


Weeks 13-14: Taper (reduce volume 40-50%, maintain intensity)

Target weekly mileage: 12-15 miles, then 8-10 miles race week



Target Race Pace:

Goal: 1:45:00 = 8:01/mile average pace
Tempo pace: 8:00-8:15/mile
Interval pace: 7:15-7:45/mile (depending on distance)
Easy run pace: 10:00-11:00/mile (based on HR 150-160)
Long run pace: 9:00-9:30/mile

Weekly Workout Format:
Generate workouts with specific details including:

Warm-up protocol (distance, pace, HR guidance)
Main set with precise distances, target paces, rest intervals
Cool-down protocol
Estimated total distance and time
Key coaching cues for execution
Progress notes: How this workout fits into the current training phase and prepares for the next phase

Additional Context:

I'm currently training in Irvine, California (flat terrain, good weather)
I respond well to structured track sessions with timed rest intervals
I use HR data to monitor effort and prevent overtraining
Reference my recent activity data to ensure workout recommendations align with current fitness

When I request a workout, please:

Confirm which week we're in and the current phase
Reference what I did in previous sessions (if I provide that data)
Adjust the workout if I report feeling tired, sore, or indicate any warning signs
Provide the specific workout for the day requested (easy/speed/long)
Give context on how this fits into the overall plan

Please provide progressive, injury-conscious workouts that will safely bridge the gap from my current 2:01 half marathon fitness to a 1:45 finish, with special attention to building durability and avoiding the overuse injuries I've experienced in the past.`);

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
        authenticated: localStorage.getItem('authenticated')
      }
    };

    // Add all weekly plans
    const weeklyPlans = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('weekly_plan_')) {
        weeklyPlans[key] = localStorage.getItem(key);
      }
      if (key.startsWith('activity_detail_')) {
        exportData.data[key] = localStorage.getItem(key);
      }
    }
    exportData.data.weekly_plans = weeklyPlans;

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

          <button 
            className="btn btn-secondary"
            onClick={async () => {
              try {
                // Try to sync first
                const { syncWithStrava } = await import('../services/api');
                await syncWithStrava();
                // If successful, close settings and refresh page to show new data
                onCancel();
                window.location.reload();
              } catch (error) {
                // If sync fails, clear tokens and redirect to auth
                localStorage.removeItem('strava_access_token');
                localStorage.removeItem('strava_refresh_token');
                localStorage.removeItem('strava_activities');
                window.location.reload();
              }
            }}
            style={{ fontSize: '14px', padding: '8px 12px' }}
          >
            Sync with Strava
          </button>
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
            Save Prompt
          </button>
          <button 
            className="btn btn-secondary"
            onClick={onCancel}
            style={{ flex: 1 }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default CoachingPromptEditor;
