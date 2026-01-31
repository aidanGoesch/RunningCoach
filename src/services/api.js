import { getStravaTokens, saveStravaTokens, deleteStravaTokens } from './supabase';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID;

// Determine redirect URI based on platform
// Note: Strava doesn't support custom URL schemes, so we use web URLs
// For mobile apps, we'll use the web URL and intercept it
const getStravaRedirectUri = () => {
  // For development
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:5173/strava-callback';
  }
  
  // For production (web or mobile app)
  // Use GitHub Pages URL - the app will intercept this
  return 'https://aidangoesch.github.io/RunningCoach/strava-callback.html';
};

const STRAVA_REDIRECT_URI = getStravaRedirectUri();

console.log('Environment check:', {
  STRAVA_CLIENT_ID: STRAVA_CLIENT_ID ? 'set' : 'missing',
  OPENAI_KEY: import.meta.env.VITE_OPENAI_API_KEY ? 'set' : 'missing',
  STRAVA_SECRET: import.meta.env.VITE_STRAVA_CLIENT_SECRET ? 'set' : 'missing'
});

export const updatePromptWithCurrentData = (basePrompt, activities = []) => {
  // Race date and calculations
  const raceDate = new Date('2026-05-02');
  const today = new Date();
  const daysUntilRace = Math.ceil((raceDate - today) / (1000 * 60 * 60 * 24));
  const weeksUntilRace = Math.ceil(daysUntilRace / 7);
  const currentWeek = Math.max(1, 15 - weeksUntilRace); // Assuming 14-week plan
  
  // Determine workout type based on day of week - STRICT 3-day schedule
  const dayOfWeek = today.getDay(); // 0=Sunday, 1=Monday, etc.
  
  // Check if user has already run today
  const todayActivities = activities.filter(activity => {
    const activityDate = new Date(activity.start_date);
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);
    return activityDate >= todayStart && activityDate <= todayEnd && activity.type === 'Run';
  });
  
  const hasRunToday = todayActivities.length > 0;
  
  let recommendedWorkoutType;
  if (dayOfWeek === 2) { // Tuesday
    if (hasRunToday) {
      recommendedWorkoutType = "Recovery Exercises (post-run PT routine: hip bridges, clamshells, calf stretches, foam rolling)";
    } else {
      recommendedWorkoutType = "Easy Run (recovery pace, conversational effort, HR 150-160 bpm)";
    }
  } else if (dayOfWeek === 4) { // Thursday  
    if (hasRunToday) {
      recommendedWorkoutType = "Recovery Exercises (post-speed work routine: dynamic stretching, hip flexor stretches, IT band work)";
    } else {
      recommendedWorkoutType = "Speed Work (intervals, tempo, or track workout as specified in training plan)";
    }
  } else if (dayOfWeek === 0) { // Sunday - Long Run
    if (hasRunToday) {
      recommendedWorkoutType = "Recovery Exercises (post-long run routine: gentle stretching, elevation, hydration focus)";
    } else {
      recommendedWorkoutType = "Long Run (steady aerobic pace, build endurance as specified in training plan)";
    }
  } else {
    // Monday, Wednesday, Friday (gym days), Saturday (rest/recovery)
    recommendedWorkoutType = "Recovery Exercises (optional PT routine: clamshells, hip bridges, bird dogs, planks, calf raises, ankle mobility, foam rolling for joint health and injury prevention)";
  }
  
  // Calculate training phase based on your periodization
  let phase, targetMileageRange;
  if (currentWeek <= 4) {
    phase = "Base Building Phase (focus on easy mileage, simple speed work)";
    targetMileageRange = "12-16 miles";
  } else if (currentWeek <= 8) {
    phase = "Build Phase (increase long run distance, introduce harder tempo work)";
    targetMileageRange = "16-19 miles";
  } else if (currentWeek <= 12) {
    phase = "Peak Phase (hit 20 mile weeks, race-specific pace work)";
    targetMileageRange = "19-22 miles";
  } else if (currentWeek === 13) {
    phase = "Taper (reduce volume 40-50%, maintain intensity)";
    targetMileageRange = "12-15 miles";
  } else {
    phase = "Taper (reduce volume 40-50%, maintain intensity)";
    targetMileageRange = "8-10 miles race week";
  }
  
  // Calculate weekly mileage from recent activities
  const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
  
  const thisWeekActivities = activities.filter(a => 
    new Date(a.start_date) >= oneWeekAgo && a.type === 'Run'
  );
  const lastWeekActivities = activities.filter(a => 
    new Date(a.start_date) >= twoWeeksAgo && 
    new Date(a.start_date) < oneWeekAgo && 
    a.type === 'Run'
  );
  
  const thisWeekMiles = thisWeekActivities.reduce((sum, a) => sum + (a.distance / 1609.34), 0);
  const lastWeekMiles = lastWeekActivities.reduce((sum, a) => sum + (a.distance / 1609.34), 0);
  
  // Update the prompt with current data
  let updatedPrompt = basePrompt;
  
  // Add workout type recommendation with strict schedule enforcement
  updatedPrompt += `\n\nTODAY'S WORKOUT TYPE: ${recommendedWorkoutType}
  
STRICT WEEKLY SCHEDULE (3 runs per week):
- Sunday: Long Run ONLY (or recovery exercises if already completed)
- Tuesday: Easy Run ONLY (or recovery exercises if already completed)
- Thursday: Speed Work ONLY (or recovery exercises if already completed)
- Monday/Wednesday/Friday: Recovery Exercises (optional PT routine for joint health)
- Saturday: Recovery Exercises (optional mobility and injury prevention work)

RECOVERY EXERCISE RECOMMENDATIONS:
- Clamshells (hip stability)
- Hip bridges (glute activation)
- Bird dogs (core stability)
- Planks (core strength)
- Calf raises (lower leg strength)
- Ankle mobility circles
- IT band stretches
- Hip flexor stretches
- Foam rolling routine
- Dynamic warm-up movements

IMPORTANT: If today is NOT a running day OR if the athlete has already run today, provide a structured recovery exercise routine. Focus on injury prevention, joint mobility, and muscle activation exercises that support running performance.

Today is ${today.toLocaleDateString()} (${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]}).
${hasRunToday ? 'The athlete has already completed a run today.' : 'No run completed today yet.'}`;
  
  // Replace placeholders
  updatedPrompt = updatedPrompt.replace(/\[Week X of 14\]/g, `Week ${currentWeek} of 14`);
  updatedPrompt = updatedPrompt.replace(/\[X days\]/g, `${daysUntilRace} days`);
  updatedPrompt = updatedPrompt.replace(/\[Base Building \/ Build \/ Peak \/ Taper\]/g, phase);
  updatedPrompt = updatedPrompt.replace(/Previous week's total mileage: \[X miles\]/g, 
    `Previous week's total mileage: ${lastWeekMiles.toFixed(1)} miles`);
  updatedPrompt = updatedPrompt.replace(/This week's target mileage: \[X miles\]/g, 
    `This week's target mileage: ${targetMileageRange}`);
  
  return updatedPrompt;
};

// Simple workout parser for basic functionality
const parseWorkoutFromText = (content) => {
  const lines = content.split('\n').filter(line => line.trim());
  const blocks = [];
  let currentBlock = null;
  
  for (const line of lines) {
    if (line.includes('Warm') || line.includes('Main') || line.includes('Cool') || line.includes('Recovery')) {
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = { title: line.trim(), notes: [] };
    } else if (currentBlock) {
      currentBlock.notes.push(line.trim());
    }
  }
  
  if (currentBlock) blocks.push(currentBlock);
  
  return {
    title: lines[0] || 'Today\'s Workout',
    blocks: blocks.map(block => ({
      title: block.title,
      notes: block.notes.join(' ')
    }))
  };
};

export const generateWorkout = async (apiKey, activities = [], isInjured = false, postponeData = null) => {
  const savedPrompt = localStorage.getItem('coaching_prompt') || 'You are an expert running coach.';
  let basePrompt = updatePromptWithCurrentData(savedPrompt, activities);
  
  // If this is a recovery exercise request, override the workout type
  if (postponeData && postponeData.adjustment === 'recovery') {
    basePrompt = `You are an expert running coach. Generate a structured recovery exercise routine.

CRITICAL: Return the response in this exact JSON format:
{
  "title": "Recovery",
  "type": "recovery",
  "blocks": [
    {
      "title": "Hip Stability",
      "distance": "",
      "pace": "",
      "duration": "10-12 minutes",
      "notes": "Clamshells: 2 sets of 15 each side. Hip bridges: 2 sets of 20 reps. Side-lying leg lifts: 2 sets of 12 each side."
    },
    {
      "title": "Core Stability", 
      "distance": "",
      "pace": "",
      "duration": "8-10 minutes",
      "notes": "Planks: 3 sets of 30-45 seconds. Bird dogs: 2 sets of 10 each side (hold 5 seconds). Dead bugs: 2 sets of 10 each side."
    },
    {
      "title": "Lower Leg Strength",
      "distance": "",
      "pace": "",
      "duration": "5-7 minutes", 
      "notes": "Calf raises: 3 sets of 15 reps. Single-leg calf raises: 2 sets of 10 each leg. Ankle circles: 10 each direction."
    },
    {
      "title": "Mobility & Stretching",
      "distance": "",
      "pace": "",
      "duration": "10-15 minutes",
      "notes": "Hip flexor stretch: 30 seconds each leg. IT band stretch: 30 seconds each leg. Calf stretch: 30 seconds each leg. Pigeon pose: 45 seconds each side."
    },
    {
      "title": "Foam Rolling",
      "distance": "",
      "pace": "",
      "duration": "8-10 minutes",
      "notes": "IT band: 60 seconds each leg. Calves: 45 seconds each leg. Quads: 60 seconds each leg. Glutes: 45 seconds each side."
    }
  ]
}

Do NOT include any conversational text. Return ONLY the JSON structure above with specific exercises, sets, reps, and durations.`;
  }
  
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-5-mini',
      messages: [{ role: 'system', content: basePrompt }, { role: 'user', content: 'Generate today\'s workout.' }],
      temperature: 0.7,
      max_tokens: 1500
    })
  });

  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
  
  const data = await response.json();
  const content = data.choices[0].message.content;
  
  // Try to parse JSON response first
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed;
    }
  } catch (parseError) {
    console.log('Could not parse JSON, using text format');
  }
  
  return parseWorkoutFromText(content);
};

export const generateWeeklyPlan = async (apiKey, activities = [], isInjured = false) => {
  const savedPrompt = localStorage.getItem('coaching_prompt') || 'You are an expert running coach.';
  let basePrompt = updatePromptWithCurrentData(savedPrompt, activities);
  
  // Add weekly plan specific instructions
  basePrompt += `\n\nWEEKLY PLAN GENERATION:

Generate a complete weekly training plan for Monday through Sunday. The week follows this structure:
- Monday: Recovery exercises (optional)
- Tuesday: Easy Run
- Wednesday: Recovery exercises (optional) 
- Thursday: Speed/Tempo Work
- Friday: Recovery exercises (optional)
- Saturday: Recovery exercises (optional)
- Sunday: Long Run

IMPORTANT: Only generate detailed workouts for the 3 running days (Tuesday, Thursday, Sunday). For recovery days, just note "Recovery exercises - generate day-of with workout button".

Each running workout should have detailed blocks with:
- Warm-up protocol (distance, pace, HR guidance)
- Main set with precise distances, target paces, rest intervals
- Cool-down protocol
- Estimated total distance and time
- Key coaching cues for execution

Return the response in this exact JSON format:
{
  "weekTitle": "Week [X] Training Plan - [Date Range]",
  "monday": null,
  "tuesday": {
    "title": "Easy Run",
    "type": "easy",
    "blocks": [
      {
        "title": "Warm-up",
        "distance": "1.5 miles",
        "pace": "10:30-11:00/mile",
        "duration": "15-17 minutes",
        "notes": "Easy conversational pace, focus on form"
      },
      {
        "title": "Main Set",
        "distance": "3-4 miles", 
        "pace": "10:00-10:30/mile",
        "duration": "30-40 minutes",
        "heartRate": "150-160 bpm",
        "notes": "Maintain conversational effort, HR in Zone 2-3"
      },
      {
        "title": "Cool-down",
        "distance": "0.5 miles",
        "pace": "11:00+/mile",
        "duration": "5-6 minutes",
        "notes": "Easy walking/jogging, light stretching"
      }
    ]
  },
  "wednesday": null,
  "thursday": {
    "title": "Speed Work",
    "type": "speed",
    "blocks": [...]
  },
  "friday": null,
  "saturday": null,
  "sunday": {
    "title": "Long Run",
    "type": "long",
    "blocks": [...]
  }
}`;

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: basePrompt }, 
        { role: 'user', content: 'Generate this week\'s complete training plan with detailed workouts for Tuesday, Thursday, and Sunday.' }
      ],
      temperature: 0.7,
      max_tokens: 2000
    })
  });

  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
  
  const data = await response.json();
  const content = data.choices[0].message.content;
  
  try {
    // Try to parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found in response');
  } catch (parseError) {
    console.error('Failed to parse weekly plan JSON:', parseError);
    // Fallback to simple structure if JSON parsing fails
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    
    return {
      weekTitle: `Week Training Plan - ${monday.toLocaleDateString()}`,
      monday: null,
      tuesday: { title: "Easy Run", type: "easy", blocks: [{ title: "Easy 4-5 miles", notes: "Conversational pace, HR 150-160 bpm" }] },
      wednesday: null,
      thursday: { title: "Speed Work", type: "speed", blocks: [{ title: "Track Intervals", notes: "4x400m with 90s rest, warm-up and cool-down" }] },
      friday: null,
      saturday: null,
      sunday: { title: "Long Run", type: "long", blocks: [{ title: "Long 8-9 miles", notes: "Steady aerobic pace, build endurance" }] }
    };
  }
};

// Strava functions (keeping existing ones)
export const syncWithStrava = async () => {
  console.log('syncWithStrava called');
  
  // Try to get tokens from Supabase first, fallback to localStorage
  const tokens = await getStravaTokens();
  const token = tokens?.accessToken || localStorage.getItem('strava_access_token');
  
  if (!token) {
    await initiateStravaAuth();
    return null;
  }

  try {
    const activities = await getStravaActivities(token, 30);
    localStorage.setItem('strava_activities', JSON.stringify(activities));
    return activities;
  } catch (error) {
    console.error('Sync error:', error);
    if (error.message.includes('401')) {
      try {
        const newToken = await refreshStravaToken();
        const activities = await getStravaActivities(newToken, 30);
        localStorage.setItem('strava_activities', JSON.stringify(activities));
        return activities;
      } catch (refreshError) {
        await deleteStravaTokens();
        await initiateStravaAuth();
        return null;
      }
    }
    throw error;
  }
};

export const refreshStravaToken = async () => {
  // Try to get tokens from Supabase first, fallback to localStorage
  const tokens = await getStravaTokens();
  const refreshToken = tokens?.refreshToken || localStorage.getItem('strava_refresh_token');
  const clientSecret = import.meta.env.VITE_STRAVA_CLIENT_SECRET;
  
  if (!refreshToken || !clientSecret) {
    throw new Error('No refresh token or client secret available');
  }

  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });

  if (!response.ok) throw new Error('Failed to refresh Strava token');
  
  const data = await response.json();
  
  // Calculate expiration time (Strava tokens typically expire in 6 hours)
  const expiresAt = data.expires_at 
    ? new Date(data.expires_at * 1000).toISOString()
    : new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
  
  // Save to Supabase (and localStorage as backup)
  await saveStravaTokens(data.access_token, data.refresh_token, expiresAt);
  
  return data.access_token;
};

const initiateStravaAuth = async () => {
  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(STRAVA_REDIRECT_URI)}&approval_prompt=force&scope=read,activity:read`;
  
  // Use Capacitor Browser plugin for mobile apps, fallback to window.location for web
  if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
    try {
      // Dynamically import Browser plugin
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({
        url: authUrl,
        windowName: '_self'
      });
    } catch (err) {
      console.error('Failed to open Browser, falling back to window.location:', err);
      // Fallback to window.location if Browser plugin fails
      window.location.href = authUrl;
    }
  } else {
    // Web browser - use window.location
    window.location.href = authUrl;
  }
};

export const exchangeStravaCode = async (code) => {
  const clientSecret = import.meta.env.VITE_STRAVA_CLIENT_SECRET;
  
  if (!clientSecret) {
    throw new Error('Strava client secret not configured');
  }

  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: clientSecret,
      code: code,
      grant_type: 'authorization_code'
    })
  });

  if (!response.ok) {
    throw new Error('Failed to exchange Strava code');
  }

  const data = await response.json();
  
  // Calculate expiration time (Strava tokens typically expire in 6 hours)
  const expiresAt = data.expires_at 
    ? new Date(data.expires_at * 1000).toISOString()
    : new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
  
  // Save to Supabase first (and localStorage as backup)
  await saveStravaTokens(data.access_token, data.refresh_token, expiresAt);
  
  return data;
};

const getStravaActivities = async (token, perPage = 30) => {
  const response = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok) throw new Error(`Strava API error: ${response.status}`);
  return response.json();
};

export const getActivityDetails = async (token, activityId) => {
  const response = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok) throw new Error(`Strava API error: ${response.status}`);
  return response.json();
};

export const getActivityStreams = async (token, activityId) => {
  const response = await fetch(`https://www.strava.com/api/v3/activities/${activityId}/streams?keys=time,distance,latlng,altitude,velocity_smooth,heartrate,cadence,watts,temp,moving,grade_smooth&key_by_type=true`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok) throw new Error(`Strava API error: ${response.status}`);
  return response.json();
};

export const generateInsights = async (apiKey, activities, streamData = null, rating = null) => {
  if (!activities || activities.length === 0) return null;
  
  const activity = activities[0]; // Most recent activity
  const savedPrompt = localStorage.getItem('coaching_prompt') || 'You are an expert running coach.';
  
  let basePrompt = `${savedPrompt}

ACTIVITY ANALYSIS REQUEST:

Analyze this running activity and provide coaching insights:

Activity: ${activity.name}
Distance: ${(activity.distance / 1609.34).toFixed(2)} miles
Duration: ${Math.floor(activity.moving_time / 60)} minutes
Average Pace: ${formatPace(activity.average_speed)}
Average Heart Rate: ${activity.average_heartrate || 'N/A'} bpm
Max Heart Rate: ${activity.max_heartrate || 'N/A'} bpm
Average Cadence: ${activity.average_cadence ? Math.round(activity.average_cadence * 2) : 'N/A'} spm

${streamData && streamData.cadence ? `
DETAILED CADENCE ANALYSIS:
Cadence Range: ${Math.round(Math.min(...streamData.cadence.data) * 2)} - ${Math.round(Math.max(...streamData.cadence.data) * 2)} spm
Cadence Variability: ${streamData.cadence.data.length > 1 ? 'Available for analysis' : 'Limited data'}
Target Cadence: 170-180 spm (optimal efficiency range)
` : ''}

${rating ? `Athlete Rating: ${rating.rating}/5 stars
Feedback: ${rating.feedback || 'No feedback provided'}
${rating.isInjured ? `Injury Status: ${rating.injuryDetails}` : 'No injuries reported'}` : ''}

Provide specific coaching insights about:
1. Pace and effort analysis
2. Heart rate zones and efficiency
3. Cadence analysis (target: 170-180 spm for optimal efficiency)
   - Analyze cadence consistency throughout the run
   - Compare average cadence to target range
   - Identify periods of cadence drop-off or spikes
   - Provide specific recommendations for cadence improvement
4. Training adaptations and progress
5. Recovery recommendations
6. Areas for improvement

Keep insights concise and actionable.`;

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: basePrompt },
        { role: 'user', content: 'Analyze this activity and provide coaching insights.' }
      ],
      temperature: 0.7,
      max_tokens: 600
    })
  });

  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
  
  const data = await response.json();
  return { insights: data.choices[0].message.content };
};

const formatPace = (speedMs) => {
  const paceMinPerMile = 26.8224 / speedMs;
  const minutes = Math.floor(paceMinPerMile);
  const seconds = Math.round((paceMinPerMile - minutes) * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}/mile`;
};

export const getActivityRating = (activityId) => {
  const activityRatings = JSON.parse(localStorage.getItem('activity_ratings') || '{}');
  return activityRatings[activityId] || null;
};
