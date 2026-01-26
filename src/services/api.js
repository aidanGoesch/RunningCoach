const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID;
const STRAVA_REDIRECT_URI = window.location.hostname === 'localhost' 
  ? 'http://localhost:5173/strava-callback'
  : `https://aidangoesch.github.io/RunningCoach/strava-callback.html`;

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
    basePrompt += `\n\nSPECIFIC REQUEST: Generate a structured recovery exercise routine only. Do not recommend running. Focus on:

RECOVERY EXERCISE PROTOCOLS:
- Hip stability exercises (clamshells, hip bridges, side-lying leg lifts)
- Core stability work (planks, bird dogs, dead bugs, side planks)
- Lower leg strength (calf raises, ankle mobility)
- Mobility and stretching (hip flexors, IT band, calves, pigeon pose)
- Foam rolling routine (IT band, calves, quads, glutes, hamstrings)

Provide specific sets, reps, and durations for each exercise. Structure as workout blocks for easy following.`;
  }
  
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{ role: 'system', content: basePrompt }, { role: 'user', content: 'Generate today\'s workout.' }],
      temperature: 0.7,
      max_tokens: 1500
    })
  });

  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
  
  const data = await response.json();
  return parseWorkoutFromText(data.choices[0].message.content);
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
      model: 'gpt-4',
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
  const token = localStorage.getItem('strava_access_token');
  
  if (!token) {
    initiateStravaAuth();
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
        await refreshStravaToken();
        const newToken = localStorage.getItem('strava_access_token');
        const activities = await getStravaActivities(newToken, 30);
        localStorage.setItem('strava_activities', JSON.stringify(activities));
        return activities;
      } catch (refreshError) {
        localStorage.removeItem('strava_access_token');
        localStorage.removeItem('strava_refresh_token');
        initiateStravaAuth();
        return null;
      }
    }
    throw error;
  }
};

export const refreshStravaToken = async () => {
  const refreshToken = localStorage.getItem('strava_refresh_token');
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
  localStorage.setItem('strava_access_token', data.access_token);
  localStorage.setItem('strava_refresh_token', data.refresh_token);
  
  return data.access_token;
};

const initiateStravaAuth = () => {
  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(STRAVA_REDIRECT_URI)}&approval_prompt=force&scope=read,activity:read`;
  window.location.href = authUrl;
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
  
  // Store tokens
  localStorage.setItem('strava_access_token', data.access_token);
  localStorage.setItem('strava_refresh_token', data.refresh_token);
  
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
  // Simplified insights generation
  return { insights: "Activity completed successfully!" };
};

export const getActivityRating = (activityId) => {
  const activityRatings = JSON.parse(localStorage.getItem('activity_ratings') || '{}');
  return activityRatings[activityId] || null;
};
