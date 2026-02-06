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

// Helper function to analyze activity ratings and determine plan adjustments
const analyzeActivityRatings = async (activities) => {
  const { getActivityRating } = await import('./supabase');
  
  // Get activities from current week (Monday-Sunday)
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7)); // Get Monday of current week
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6); // Get Sunday of current week
  sunday.setHours(23, 59, 59, 999);
  
  const recentActivities = activities.filter(a => {
    const activityDate = new Date(a.start_date);
    return activityDate >= monday && activityDate <= sunday && a.type === 'Run';
  });
  
  // Fetch ratings for these activities
  const ratingsWithData = [];
  for (const activity of recentActivities) {
    const rating = await getActivityRating(activity.id);
    if (rating) {
      ratingsWithData.push({
        activity,
        rating: rating.rating,
        feedback: rating.feedback,
        isInjured: rating.isInjured,
        injuryDetails: rating.injuryDetails,
        date: new Date(activity.start_date)
      });
    }
  }
  
  if (ratingsWithData.length === 0) {
    return {
      avgRating: 3.0,
      hasInjuries: false,
      trend: 'stable',
      adjustment: 0,
      completionRate: 0
    };
  }
  
  // Calculate average rating
  const avgRating = ratingsWithData.reduce((sum, r) => sum + r.rating, 0) / ratingsWithData.length;
  
  // Check for injuries
  const hasInjuries = ratingsWithData.some(r => r.isInjured);
  const injuryCount = ratingsWithData.filter(r => r.isInjured).length;
  
  // Calculate trend (comparing first half vs second half)
  const sortedRatings = [...ratingsWithData].sort((a, b) => a.date - b.date);
  const midPoint = Math.floor(sortedRatings.length / 2);
  const firstHalf = sortedRatings.slice(0, midPoint);
  const secondHalf = sortedRatings.slice(midPoint);
  
  const firstHalfAvg = firstHalf.length > 0 
    ? firstHalf.reduce((sum, r) => sum + r.rating, 0) / firstHalf.length 
    : avgRating;
  const secondHalfAvg = secondHalf.length > 0
    ? secondHalf.reduce((sum, r) => sum + r.rating, 0) / secondHalf.length
    : avgRating;
  
  let trend = 'stable';
  if (secondHalfAvg > firstHalfAvg + 0.3) {
    trend = 'increasing'; // Getting harder
  } else if (secondHalfAvg < firstHalfAvg - 0.3) {
    trend = 'decreasing'; // Getting easier
  }
  
  // Calculate completion rate (activities with ratings vs total activities)
  const completionRate = ratingsWithData.length / Math.max(recentActivities.length, 1);
  
  // Determine intensity adjustment
  let adjustment = 0;
  if (avgRating < 2.5) {
    adjustment = -15; // Reduce intensity 15%
  } else if (avgRating < 3.0) {
    adjustment = -10; // Reduce intensity 10%
  } else if (avgRating > 4.0) {
    adjustment = 10; // Increase challenge 10%
  } else if (avgRating > 4.5) {
    adjustment = 15; // Increase challenge 15%
  }
  
  // If injuries reported, reduce volume
  if (hasInjuries) {
    adjustment -= 20; // Additional 20% reduction
  }
  
  return {
    avgRating,
    hasInjuries,
    injuryCount,
    trend,
    adjustment,
    completionRate,
    totalRatings: ratingsWithData.length,
    recentRatings: ratingsWithData
  };
};

export const generateDataDrivenWeeklyPlan = async (apiKey, activities = [], isInjured = false) => {
  const savedPrompt = localStorage.getItem('coaching_prompt') || 'You are an expert running coach.';
  let basePrompt = updatePromptWithCurrentData(savedPrompt, activities);
  
  // Analyze activity ratings
  const ratingAnalysis = await analyzeActivityRatings(activities);
  
  // Add rating-based adjustments to prompt
  let intensityNote = '';
  if (ratingAnalysis.adjustment < 0) {
    intensityNote = `\n\nIMPORTANT ADJUSTMENT: Recent workout ratings indicate the athlete has been finding workouts too challenging (average rating: ${ratingAnalysis.avgRating.toFixed(1)}/5). 
Reduce workout intensity by ${Math.abs(ratingAnalysis.adjustment)}%. Make workouts more manageable while still providing training stimulus.`;
  } else if (ratingAnalysis.adjustment > 0) {
    intensityNote = `\n\nIMPORTANT ADJUSTMENT: Recent workout ratings indicate the athlete has been finding workouts manageable (average rating: ${ratingAnalysis.avgRating.toFixed(1)}/5). 
Increase workout challenge by ${ratingAnalysis.adjustment}% to continue progression. Push the athlete appropriately while preventing injury.`;
  }
  
  if (ratingAnalysis.hasInjuries) {
    intensityNote += `\n\nINJURY ALERT: The athlete has reported ${ratingAnalysis.injuryCount} injury/issue(s) in recent workouts. 
Reduce training volume significantly, add extra recovery days, and focus on injury prevention. Prioritize health over training intensity.`;
  }
  
  if (ratingAnalysis.completionRate < 0.5) {
    intensityNote += `\n\nCOMPLETION RATE: The athlete has only rated ${Math.round(ratingAnalysis.completionRate * 100)}% of recent activities. 
Consider this when generating the plan - they may need more motivation or the plan may need adjustment.`;
  }
  
  basePrompt += intensityNote;
  
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

The plan should be challenging but safe, pushing the athlete while preventing injury. Base intensity adjustments on the rating analysis above.

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
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: basePrompt }, 
        { role: 'user', content: 'Generate this week\'s complete training plan with detailed workouts for Tuesday, Thursday, and Sunday. Adjust intensity based on the rating analysis provided.' }
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
      const plan = JSON.parse(jsonMatch[0]);
      // Attach rating analysis for later use in weekly analysis
      plan._ratingAnalysis = ratingAnalysis;
      return plan;
    }
    throw new Error('No JSON found in response');
  } catch (parseError) {
    console.error('Failed to parse weekly plan JSON:', parseError);
    // Fallback to simple structure if JSON parsing fails
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    
    const fallbackPlan = {
      weekTitle: `Week Training Plan - ${monday.toLocaleDateString()}`,
      monday: null,
      tuesday: { title: "Easy Run", type: "easy", blocks: [{ title: "Easy 4-5 miles", notes: "Conversational pace, HR 150-160 bpm" }] },
      wednesday: null,
      thursday: { title: "Speed Work", type: "speed", blocks: [{ title: "Track Intervals", notes: "4x400m with 90s rest, warm-up and cool-down" }] },
      friday: null,
      saturday: null,
      sunday: { title: "Long Run", type: "long", blocks: [{ title: "Long 8-9 miles", notes: "Steady aerobic pace, build endurance" }] }
    };
    fallbackPlan._ratingAnalysis = ratingAnalysis;
    return fallbackPlan;
  }
};

// Match Strava activities to assigned workouts
export const matchActivitiesToWorkouts = (activities, weeklyPlan, weekStart) => {
  if (!weeklyPlan || !activities || activities.length === 0) {
    return {};
  }

  const matches = {};
  const dayNameMap = {
    'monday': 0,
    'tuesday': 1,
    'wednesday': 2,
    'thursday': 3,
    'friday': 4,
    'saturday': 5,
    'sunday': 6
  };

  // Group activities by date
  const activitiesByDate = new Map();
  activities.forEach(activity => {
    if (activity.type === 'Run') {
      const activityDate = new Date(activity.start_date);
      activityDate.setHours(0, 0, 0, 0);
      const dateKey = activityDate.toISOString().split('T')[0];
      
      if (!activitiesByDate.has(dateKey)) {
        activitiesByDate.set(dateKey, []);
      }
      activitiesByDate.get(dateKey).push(activity);
    }
  });

  // For each day with a planned workout, try to match activities
  Object.keys(dayNameMap).forEach(dayName => {
    const plannedWorkout = weeklyPlan[dayName];
    if (!plannedWorkout) return;

    // Calculate the date for this day of the week
    const dayOffset = dayNameMap[dayName];
    const workoutDate = new Date(weekStart);
    workoutDate.setDate(weekStart.getDate() + dayOffset);
    workoutDate.setHours(0, 0, 0, 0);
    const dateKey = workoutDate.toISOString().split('T')[0];

    const dayActivities = activitiesByDate.get(dateKey) || [];

    if (dayActivities.length === 0) {
      // No activities on this day
      return;
    }

    // If multiple activities on the same day, check if they're within 10 minutes
    if (dayActivities.length > 1) {
      // Sort by start time
      dayActivities.sort((a, b) => 
        new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      );

      // Group activities that are within 10 minutes of each other
      const groupedActivities = [];
      let currentGroup = [dayActivities[0]];

      for (let i = 1; i < dayActivities.length; i++) {
        const prevTime = new Date(dayActivities[i - 1].start_date).getTime();
        const currTime = new Date(dayActivities[i].start_date).getTime();
        const timeDiff = (currTime - prevTime) / (1000 * 60); // minutes

        if (timeDiff <= 10) {
          // Within 10 minutes, add to current group
          currentGroup.push(dayActivities[i]);
        } else {
          // More than 10 minutes apart, start new group
          groupedActivities.push(currentGroup);
          currentGroup = [dayActivities[i]];
        }
      }
      groupedActivities.push(currentGroup);

      // Use the first group (or largest group if multiple)
      const matchedGroup = groupedActivities.reduce((largest, group) => 
        group.length > largest.length ? group : largest
      , groupedActivities[0]);

      // Match the workout to the first activity in the group (or combine them)
      matches[dayName] = {
        workout: plannedWorkout,
        activities: matchedGroup,
        matchedActivityIds: matchedGroup.map(a => a.id)
      };
    } else {
      // Single activity on the workout day - match it
      matches[dayName] = {
        workout: plannedWorkout,
        activities: [dayActivities[0]],
        matchedActivityIds: [dayActivities[0].id]
      };
    }
  });

  return matches;
};

export const generateWeeklyAnalysis = async (apiKey, activities = [], weeklyPlan = null) => {
  const today = new Date();
  const lastMonday = new Date(today);
  lastMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7) - 7); // Last week's Monday
  lastMonday.setHours(0, 0, 0, 0); // Start of Monday
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  lastSunday.setHours(23, 59, 59, 999); // End of Sunday
  
  // Get activities from last week (Monday-Sunday only)
  const lastWeekActivities = activities.filter(a => {
    const activityDate = new Date(a.start_date);
    // Only include activities that fall within the Monday-Sunday range
    return activityDate >= lastMonday && activityDate <= lastSunday && a.type === 'Run';
  });
  
  // Calculate metrics
  const totalMiles = lastWeekActivities.reduce((sum, a) => sum + (a.distance / 1609.34), 0);
  const totalTime = lastWeekActivities.reduce((sum, a) => sum + a.moving_time, 0);
  const runCount = lastWeekActivities.length;
  const expectedRuns = 3; // Tuesday, Thursday, Sunday
  
  // Get ratings for last week's activities
  const { getActivityRating } = await import('./supabase');
  const ratings = [];
  for (const activity of lastWeekActivities) {
    const rating = await getActivityRating(activity.id);
    if (rating) {
      ratings.push(rating.rating);
    }
  }
  
  const avgRating = ratings.length > 0 
    ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length 
    : null;
  
  // Build analysis context
  let analysisContext = `Analyze the athlete's training week and provide an encouraging, positive message.

WEEK SUMMARY:
- Total Runs: ${runCount}/${expectedRuns}${runCount === expectedRuns ? ' (Perfect!)' : runCount === 0 ? ' (No runs completed)' : ' (Some runs missed)'}
- Total Mileage: ${totalMiles.toFixed(1)} miles
- Total Time: ${Math.floor(totalTime / 60)} minutes
${avgRating ? `- Average Difficulty Rating: ${avgRating.toFixed(1)}/5 (1=too easy, 3=perfect, 5=too hard)` : '- No difficulty ratings provided'}

GENERATE AN ENCOURAGING MESSAGE:
- Always be positive and supportive
- Acknowledge what they accomplished
- If they missed runs, encourage them gently
- If they completed all runs, celebrate their consistency
- If mileage is increasing, note the progress
- Keep it brief (2-3 sentences max)
- Use encouraging language like "Great job!", "Nice work!", "Keep it up!", "You're building consistency!"

Examples of good messages:
- "Excellent work this week! You completed all 3 runs and hit your mileage target. Keep building that base!"
- "Great consistency! You're showing real dedication to your training. Keep pushing forward!"
- "Nice job getting your runs in! Every week you're building strength and endurance. Keep it up!"
- "You're making progress! Even though you missed a run, you're still building consistency. Keep trying!"

Generate ONLY the encouraging message, nothing else.`;

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an encouraging running coach who always provides positive, supportive feedback.' },
          { role: 'user', content: analysisContext }
        ],
        temperature: 0.8,
        max_tokens: 150
      })
    });

    if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
    
    const data = await response.json();
    const message = data.choices[0].message.content.trim();
    
    return {
      message,
      metrics: {
        runCount,
        expectedRuns,
        totalMiles: totalMiles.toFixed(1),
        totalTime: Math.floor(totalTime / 60),
        avgRating: avgRating ? avgRating.toFixed(1) : null
      }
    };
  } catch (error) {
    console.error('Failed to generate weekly analysis:', error);
    // Fallback to simple message
    let fallbackMessage = '';
    if (runCount === expectedRuns) {
      fallbackMessage = `Excellent work this week! You completed all ${runCount} runs and logged ${totalMiles.toFixed(1)} miles. Keep building that consistency!`;
    } else if (runCount > 0) {
      fallbackMessage = `Nice job getting ${runCount} run${runCount > 1 ? 's' : ''} in this week! You logged ${totalMiles.toFixed(1)} miles. Keep pushing forward!`;
    } else {
      fallbackMessage = `Keep trying! Every week is a new opportunity to build consistency. You've got this!`;
    }
    
    return {
      message: fallbackMessage,
      metrics: {
        runCount,
        expectedRuns,
        totalMiles: totalMiles.toFixed(1),
        totalTime: Math.floor(totalTime / 60),
        avgRating: avgRating ? avgRating.toFixed(1) : null
      }
    };
  }
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
  
  console.log('Token check:', {
    hasTokens: !!tokens,
    hasAccessToken: !!tokens?.accessToken,
    hasLocalStorageToken: !!localStorage.getItem('strava_access_token'),
    useSupabase: typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()
  });
  
  if (!token) {
    console.log('No token found, initiating Strava auth...');
    await initiateStravaAuth();
    return null;
  }

  try {
    console.log('Fetching activities with token...');
    const activities = await getStravaActivities(token, 30);
    console.log('Activities fetched:', activities?.length || 0);
    localStorage.setItem('strava_activities', JSON.stringify(activities));
    return activities;
  } catch (error) {
    console.error('Sync error:', error);
    if (error.message.includes('401') || error.message.includes('403')) {
      console.log('Token expired or invalid, attempting refresh...');
      try {
        const newToken = await refreshStravaToken();
        console.log('Token refreshed, fetching activities...');
        const activities = await getStravaActivities(newToken, 30);
        localStorage.setItem('strava_activities', JSON.stringify(activities));
        return activities;
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
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
      
      // Set up listener for app state changes to detect when Browser closes
      const setupAppListener = async () => {
        try {
          const { App } = await import('@capacitor/app');
          
          // Remove any existing listener
          if (window._stravaAuthListener) {
            await window._stravaAuthListener.remove();
          }
          
          // Listen for app state changes - when Browser closes, app comes to foreground
          let lastCodeTimestamp = null;
          
          // Helper to get code from localStorage
          // Note: Browser window and app don't share localStorage, so this may not work
          // The workaround is to authenticate on web first, which saves to Supabase
          const getAuthCode = async () => {
            return {
              code: localStorage.getItem('strava_auth_code'),
              codeTimestamp: localStorage.getItem('strava_auth_code_timestamp'),
              error: localStorage.getItem('strava_auth_error'),
              source: 'localStorage'
            };
          };
          
          // Helper to remove code from storage
          const removeAuthCode = async (source) => {
            localStorage.removeItem('strava_auth_code');
            localStorage.removeItem('strava_auth_code_timestamp');
            localStorage.removeItem('strava_auth_state');
            localStorage.removeItem('strava_auth_scope');
            localStorage.removeItem('strava_auth_error');
          };
          
          const listener = await App.addListener('appStateChange', async (state) => {
            if (state.isActive) {
              // App is active, check if we have callback data
              const authData = await getAuthCode();
              
              // Only process if this is a new code (timestamp changed)
              if (authData.codeTimestamp && authData.codeTimestamp !== lastCodeTimestamp) {
                lastCodeTimestamp = authData.codeTimestamp;
                
                if (authData.error) {
                  console.error('Strava auth error from callback:', authData.error);
                  await removeAuthCode(authData.source);
                  return;
                }
                
                if (authData.code) {
                  console.log(`Code found in ${authData.source}, exchanging for token...`);
                  await removeAuthCode(authData.source);
                  
                  // Exchange the code for tokens
                  try {
                    await exchangeStravaCode(authData.code);
                    console.log('Token exchange successful, reloading app...');
                    // Trigger a reload to refresh the app state
                    window.location.reload();
                  } catch (err) {
                    console.error('Failed to exchange code:', err);
                  }
                }
              }
            }
          });
          
          // Also set up a polling mechanism as backup
          // Note: Browser window might not share localStorage, so we poll more aggressively
          let pollCount = 0;
          const maxPolls = 120; // Poll for up to 60 seconds (120 * 500ms)
          
          const pollInterval = setInterval(async () => {
            pollCount++;
            
            // Check both Preferences and localStorage
            let code = null;
            let codeTimestamp = null;
            let source = 'localStorage';
            
            // Check localStorage (Browser window and app don't share storage, so this may not work)
            code = localStorage.getItem('strava_auth_code');
            codeTimestamp = localStorage.getItem('strava_auth_code_timestamp');
            
            if (pollCount % 10 === 0) {
              console.log(`Polling for auth code (attempt ${pollCount}/${maxPolls})...`, { hasCode: !!code, hasTimestamp: !!codeTimestamp, source });
            }
            
            if (codeTimestamp && codeTimestamp !== lastCodeTimestamp) {
              lastCodeTimestamp = codeTimestamp;
              clearInterval(pollInterval);
              
              if (code) {
                console.log(`Code found via polling in ${source}, exchanging for token...`);
                
                // Remove from storage
                localStorage.removeItem('strava_auth_code');
                localStorage.removeItem('strava_auth_code_timestamp');
                localStorage.removeItem('strava_auth_state');
                localStorage.removeItem('strava_auth_scope');
                
                exchangeStravaCode(code)
                  .then(() => {
                    console.log('Token exchange successful, reloading app...');
                    window.location.reload();
                  })
                  .catch(err => {
                    console.error('Failed to exchange code:', err);
                  });
              }
            }
            
            if (pollCount >= maxPolls) {
              console.log('Polling timeout reached, stopping...');
              clearInterval(pollInterval);
            }
          }, 500); // Check every 500ms
          
          // Store listener for cleanup
          window._stravaAuthListener = listener;
        } catch (err) {
          console.log('App plugin not available:', err);
        }
      };
      
      await setupAppListener();
      
      console.log('Opening Strava auth in Browser...');
      await Browser.open({
        url: authUrl,
        windowName: '_system',
        presentationStyle: 'popover'
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
