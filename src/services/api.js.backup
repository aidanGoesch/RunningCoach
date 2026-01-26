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

export const generateWorkout = async (apiKey, activities = [], isInjured = false, postponeData = null) => {
  console.log('generateWorkout called with apiKey:', apiKey ? 'provided' : 'missing');
  console.log('Environment OPENAI key:', import.meta.env.VITE_OPENAI_API_KEY ? 'set' : 'missing');
  console.log('Injury status:', isInjured ? 'injured' : 'healthy');
  
  // Get saved coaching prompt and update with current data
  const savedPrompt = localStorage.getItem('coaching_prompt');
  let basePrompt = savedPrompt || `You are an expert running coach. Create a personalized running workout based on the provided activity data.`;
  
  // Update prompt with current training data if it contains placeholders
  if (basePrompt.includes('[Week X of 14]') || basePrompt.includes('[X days]')) {
    basePrompt = updatePromptWithCurrentData(basePrompt, activities);
  }
  
  // Add postpone context if provided
  if (postponeData) {
    const { reason, adjustment, originalWorkout } = postponeData;
    
    basePrompt += `\n\nPOSTPONED WORKOUT CONTEXT:
    
The athlete postponed yesterday's workout with reason: "${reason}"

Original workout was: ${originalWorkout.title}

Adjustment needed based on postpone reason:`;

    switch (adjustment) {
      case 'same':
        basePrompt += `
- Give the EXACT same workout as yesterday since the postpone was due to external factors (busy, weather, etc.)
- No modifications needed to intensity or volume`;
        break;
      case 'easier':
        basePrompt += `
- Reduce intensity by 10-15% due to fatigue/soreness
- Consider shorter duration or easier pace
- Focus on recovery and getting back into rhythm`;
        break;
      case 'reduce':
        basePrompt += `
- Significantly reduce volume (20-30% less distance/time)
- Lower intensity to build confidence
- The athlete felt the original workout was too challenging`;
        break;
      case 'recovery':
        basePrompt += `
- Convert to easy recovery run or specific recovery exercises
- Focus on injury prevention and gentle movement
- Avoid any high-intensity work`;
        break;
      case 'custom':
        basePrompt += `
- Consider the specific reason provided and adjust accordingly
- Use coaching judgment based on the athlete's feedback`;
        break;
    }
  }

  // Add specific recovery exercise guidance
  basePrompt += `\n\nSPECIFIC RECOVERY EXERCISE PROTOCOLS:

When recommending recovery exercises, provide structured routines with specific sets/reps/duration:

HIP STABILITY ROUTINE:
- Clamshells: 2 sets of 15 each side
- Hip bridges: 2 sets of 20 reps
- Side-lying leg lifts: 2 sets of 12 each side
- Monster walks (with band): 2 sets of 10 steps each direction

CORE STABILITY ROUTINE:
- Planks: 3 sets of 30-45 seconds
- Bird dogs: 2 sets of 10 each side (hold 5 seconds)
- Dead bugs: 2 sets of 10 each side
- Side planks: 2 sets of 20-30 seconds each side

LOWER LEG STRENGTH:
- Calf raises: 3 sets of 15 reps
- Single-leg calf raises: 2 sets of 10 each leg
- Ankle circles: 10 each direction, both feet
- Toe walks: 30 seconds forward, 30 seconds backward

MOBILITY & STRETCHING:
- Hip flexor stretch: 30 seconds each leg
- IT band stretch: 30 seconds each leg
- Calf stretch: 30 seconds each leg
- Pigeon pose: 45 seconds each side
- Cat-cow stretches: 10 slow repetitions

FOAM ROLLING ROUTINE:
- IT band: 60 seconds each leg
- Calves: 45 seconds each leg
- Quads: 60 seconds each leg
- Glutes: 45 seconds each side
- Hamstrings: 60 seconds each leg

POST-RUN RECOVERY (if already ran today):
- 5-10 minutes easy walking
- Dynamic stretching routine (leg swings, hip circles)
- Targeted foam rolling based on workout type
- Hydration and nutrition guidance
- Elevation for legs (10-15 minutes)

Always provide specific exercise names, sets, reps, and durations rather than generic "cross-training" recommendations.`;

  // Add injury status to prompt
  if (isInjured) {
    basePrompt += `\n\nIMPORTANT INJURY STATUS: The athlete is currently injured or experiencing discomfort. 
    
PRIORITY: Focus on recovery and injury prevention over training progression.

Recommendations:
- Suggest easy recovery runs at very conservative paces (11:00-12:00/mile)
- Reduce volume significantly (50-70% of normal)
- Consider cross-training alternatives (pool running, cycling, walking)
- Include rest days if appropriate
- Avoid speed work and high-intensity efforts
- Emphasize proper warm-up and cool-down protocols
- Suggest when to seek medical attention if pain persists

If the scheduled workout is high-intensity (speed/tempo), modify it to be recovery-focused or suggest alternative activities.`;
  }
  
  // Get workout feedback history
  const feedbackHistory = JSON.parse(localStorage.getItem('workout_feedback') || '[]');
  const recentFeedback = feedbackHistory.slice(-5); // Last 5 feedback entries
  
  // Check for current injury status
  const currentInjury = recentFeedback.find(f => f.isInjured && 
    new Date(f.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Within last 7 days
  );
  
  // Analyze recent ratings
  const recentRatings = recentFeedback.filter(f => f.rating).map(f => f.rating);
  const avgRating = recentRatings.length > 0 ? recentRatings.reduce((a, b) => a + b) / recentRatings.length : 3;
  
  // Add injury/recovery context
  if (currentInjury) {
    basePrompt += `\n\nIMPORTANT: The athlete is currently dealing with: ${currentInjury.injuryDetails}. 
    Focus on recovery-oriented workouts with reduced intensity and volume. Prioritize easy runs, cross-training alternatives, and injury prevention exercises.`;
  }
  
  // Add difficulty adjustment based on ratings
  if (avgRating < 2.5) {
    basePrompt += `\n\nRecent workout feedback indicates the athlete has been finding workouts too challenging (average rating: ${avgRating.toFixed(1)}/5). 
    Consider reducing intensity and volume by 10-15% to build confidence and prevent burnout.`;
  } else if (avgRating > 4) {
    basePrompt += `\n\nRecent workout feedback indicates the athlete has been finding workouts manageable (average rating: ${avgRating.toFixed(1)}/5). 
    The current training load appears appropriate, maintain progression as planned.`;
  }

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: basePrompt
        },
        {
          role: 'user', 
          content: 'Generate today\'s workout based on my training plan and current status.'
        }
      ],
      temperature: 0.7,
      max_tokens: 1500
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  // Try to parse structured workout format
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (parseError) {
    console.log('Could not parse JSON, using text format');
  }
  
  // Fallback to parsing text format
  return parseWorkoutFromText(content);
};

export const generateWeeklyPlan = async (apiKey, activities = [], isInjured = false) => {
  
  // Get saved coaching prompt and update with current data
  const savedPrompt = localStorage.getItem('coaching_prompt');
  let basePrompt = savedPrompt || `You are an expert running coach. Create a personalized weekly training plan.`;
  
  // Update prompt with current training data
  if (basePrompt.includes('[Week X of 14]') || basePrompt.includes('[X days]')) {
    basePrompt = updatePromptWithCurrentData(basePrompt, activities);
  }
  
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

Return the response in this exact JSON format:
{
  "weekTitle": "Week [X] Training Plan - [Date Range]",
  "monday": null,
  "tuesday": {
    "title": "Easy Run",
    "type": "easy",
    "blocks": [...]
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
}

Each running workout should have detailed blocks with warm-up, main set, and cool-down as usual.`;

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: basePrompt
        },
        {
          role: 'user', 
          content: 'Generate this week\'s complete training plan with detailed workouts for Tuesday, Thursday, and Sunday.'
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

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
    throw new Error('Failed to parse weekly plan from AI response');
  }
};

export const adjustWeeklyPlanForPostponement = async (apiKey, currentPlan, postponedDay, postponeReason, activities = []) => {
  console.log('adjustWeeklyPlanForPostponement called');
  
  const savedPrompt = localStorage.getItem('coaching_prompt');
  let basePrompt = savedPrompt || `You are an expert running coach.`;
  
  basePrompt += `\n\nWEEKLY PLAN ADJUSTMENT:

The athlete postponed their ${postponedDay} workout with reason: "${postponeReason}"

Current weekly plan:
${JSON.stringify(currentPlan, null, 2)}

Please adjust the remaining workouts for this week (Monday-Sunday) to account for this postponement. Consider:
1. The reason for postponement (busy vs tired vs injury concern)
2. Maintaining weekly training load when possible
3. Not pushing workouts to next week
4. Keeping the 3-run structure within the week

Return the adjusted plan in the same JSON format, updating only the remaining days in the week.`;

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: basePrompt
        },
        {
          role: 'user',
          content: 'Adjust the weekly plan for the postponement.'
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found in response');
  } catch (parseError) {
    console.error('Failed to parse adjusted plan JSON:', parseError);
    throw new Error('Failed to parse adjusted plan from AI response');
  }
};

export const refreshStravaToken = async () => {
  
  // Update prompt with current training data if it contains placeholders
  if (basePrompt.includes('[Week X of 14]') || basePrompt.includes('[X days]')) {
    basePrompt = updatePromptWithCurrentData(basePrompt, activities);
  }
  
  // Add postpone context if provided
  if (postponeData) {
    const { reason, adjustment, originalWorkout } = postponeData;
    
    basePrompt += `\n\nPOSTPONED WORKOUT CONTEXT:
    
The athlete postponed yesterday's workout with reason: "${reason}"

Original workout was: ${originalWorkout.title}

Adjustment needed based on postpone reason:`;

    switch (adjustment) {
      case 'same':
        basePrompt += `
- Give the EXACT same workout as yesterday since the postpone was due to external factors (busy, weather, etc.)
- No modifications needed to intensity or volume`;
        break;
      case 'easier':
        basePrompt += `
- Reduce intensity by 10-15% due to fatigue/soreness
- Consider shorter duration or easier pace
- Focus on recovery and getting back into rhythm`;
        break;
      case 'reduce':
        basePrompt += `
- Significantly reduce volume (20-30% less distance/time)
- Lower intensity to build confidence
- The athlete felt the original workout was too challenging`;
        break;
      case 'recovery':
        basePrompt += `
- Convert to easy recovery run or specific recovery exercises
- Focus on injury prevention and gentle movement
- Avoid any high-intensity work`;
        break;
      case 'custom':
        basePrompt += `
- Consider the specific reason provided and adjust accordingly
- Use coaching judgment based on the athlete's feedback`;
        break;
    }
  }

  // Add specific recovery exercise guidance
  basePrompt += `\n\nSPECIFIC RECOVERY EXERCISE PROTOCOLS:

When recommending recovery exercises, provide structured routines with specific sets/reps/duration:

HIP STABILITY ROUTINE:
- Clamshells: 2 sets of 15 each side
- Hip bridges: 2 sets of 20 reps
- Side-lying leg lifts: 2 sets of 12 each side
- Monster walks (with band): 2 sets of 10 steps each direction

CORE STABILITY ROUTINE:
- Planks: 3 sets of 30-45 seconds
- Bird dogs: 2 sets of 10 each side (hold 5 seconds)
- Dead bugs: 2 sets of 10 each side
- Side planks: 2 sets of 20-30 seconds each side

LOWER LEG STRENGTH:
- Calf raises: 3 sets of 15 reps
- Single-leg calf raises: 2 sets of 10 each leg
- Ankle circles: 10 each direction, both feet
- Toe walks: 30 seconds forward, 30 seconds backward

MOBILITY & STRETCHING:
- Hip flexor stretch: 30 seconds each leg
- IT band stretch: 30 seconds each leg
- Calf stretch: 30 seconds each leg
- Pigeon pose: 45 seconds each side
- Cat-cow stretches: 10 slow repetitions

FOAM ROLLING ROUTINE:
- IT band: 60 seconds each leg
- Calves: 45 seconds each leg
- Quads: 60 seconds each leg
- Glutes: 45 seconds each side
- Hamstrings: 60 seconds each leg

POST-RUN RECOVERY (if already ran today):
- 5-10 minutes easy walking
- Dynamic stretching routine (leg swings, hip circles)
- Targeted foam rolling based on workout type
- Hydration and nutrition guidance
- Elevation for legs (10-15 minutes)

Always provide specific exercise names, sets, reps, and durations rather than generic "cross-training" recommendations.`;
  
  // Add injury status to prompt
  if (isInjured) {
    basePrompt += `\n\nIMPORTANT INJURY STATUS: The athlete is currently injured or experiencing discomfort. 
    
PRIORITY: Focus on recovery and injury prevention over training progression.

Recommendations:
- Suggest easy recovery runs at very conservative paces (11:00-12:00/mile)
- Reduce volume significantly (50-70% of normal)
- Consider cross-training alternatives (pool running, cycling, walking)
- Include rest days if appropriate
- Avoid speed work and high-intensity efforts
- Emphasize proper warm-up and cool-down protocols
- Suggest when to seek medical attention if pain persists

If the scheduled workout is high-intensity (speed/tempo), modify it to be recovery-focused or suggest alternative activities.`;
  }
  
  // Get workout feedback history
  const feedbackHistory = JSON.parse(localStorage.getItem('workout_feedback') || '[]');
  const recentFeedback = feedbackHistory.slice(-5); // Last 5 feedback entries
  
  // Check for current injury status
  const currentInjury = recentFeedback.find(f => f.isInjured && 
    new Date(f.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Within last 7 days
  );
  
  // Analyze recent ratings
  const recentRatings = recentFeedback.filter(f => f.rating).map(f => f.rating);
  const avgRating = recentRatings.length > 0 ? recentRatings.reduce((a, b) => a + b) / recentRatings.length : 3;
  
  // Add injury/recovery context
  if (currentInjury) {
    basePrompt += `\n\nIMPORTANT: The athlete is currently dealing with: ${currentInjury.injuryDetails}. 
    Focus on recovery-oriented workouts with reduced intensity and volume. Prioritize easy runs, cross-training alternatives, and injury prevention exercises.`;
  }
  
  // Add difficulty adjustment based on ratings
  if (avgRating > 4) {
    basePrompt += `\n\nNote: Recent workouts have been rated as too difficult (avg: ${avgRating.toFixed(1)}/5). Please reduce intensity and volume.`;
  } else if (avgRating < 2) {
    basePrompt += `\n\nNote: Recent workouts have been rated as too easy (avg: ${avgRating.toFixed(1)}/5). The athlete may be ready for increased challenge.`;
  }
  
  // Add feedback context
  if (recentFeedback.length > 0) {
    basePrompt += `\n\nRecent Workout Feedback:\n`;
    recentFeedback.forEach((feedback, i) => {
      basePrompt += `${i + 1}. "${feedback.workoutTitle}" - Rating: ${feedback.rating}/5`;
      if (feedback.notes) basePrompt += ` - Notes: ${feedback.notes}`;
      basePrompt += `\n`;
    });
  }
  
  // Build context from recent activities
  let activityContext = '';
  if (activities && activities.length > 0) {
    activityContext = `\n\nRecent Activities Context:\n`;
    activities.slice(0, 5).forEach((activity, i) => {
      const distance = (activity.distance / 1609.34).toFixed(2);
      const duration = Math.floor(activity.moving_time / 60);
      const pace = formatPace(activity.average_speed);
      const date = new Date(activity.start_date).toLocaleDateString();
      
      activityContext += `${i + 1}. ${activity.name} (${date}): ${distance} miles in ${duration} minutes, avg pace ${pace}\n`;
    });
  }

  const fullPrompt = `${basePrompt}${activityContext}

Generate a running workout plan. Return the response as a JSON object with this exact structure:
{
  "title": "Workout name",
  "blocks": [
    {
      "title": "Block name (e.g., Warm-up, Main Set, Cool-down)",
      "distance": "distance with unit (e.g., 1.5 miles, 800m)",
      "pace": "pace description (e.g., Easy, 5K pace, 7:30/mile)",
      "duration": "time if applicable (e.g., 10 minutes)",
      "notes": "additional instructions"
    }
  ]
}

Create a varied workout with warm-up, main work, and cool-down that's appropriate for my current fitness level and any injury considerations.`;

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: fullPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    })
  });

  console.log('OpenAI API response status:', response.status);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI API error response:', errorText);
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  try {
    return JSON.parse(content);
  } catch (e) {
    // Fallback if JSON parsing fails
    return {
      title: "Generated Workout",
      blocks: [
        {
          title: "Workout Generated",
          distance: "See raw response",
          pace: "Various",
          duration: "45 minutes",
          notes: content
        }
      ]
    };
  }
};

const formatPace = (speedMs) => {
  const paceMinPerMile = 26.8224 / speedMs;
  const minutes = Math.floor(paceMinPerMile);
  const seconds = Math.round((paceMinPerMile - minutes) * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}/mile`;
};

export const generateInsights = async (apiKey, activities, streamData = null, activityRating = null) => {
  const recentActivity = activities[0];
  if (!recentActivity) return null;

  const activityDate = new Date(recentActivity.start_date);
  const dayOfWeek = activityDate.getDay();
  
  let expectedWorkoutType = null;
  
  // Use the actual workout type from the app if available
  if (activityRating && activityRating.workoutTitle) {
    expectedWorkoutType = `Generated workout: "${activityRating.workoutTitle}"`;
  } else {
    // Fallback to day-based guess only for activities without matched workouts
    if (dayOfWeek === 2) { // Tuesday
      expectedWorkoutType = "Easy Run (recovery pace, HR 150-160 bpm) - estimated based on day";
    } else if (dayOfWeek === 4) { // Thursday  
      expectedWorkoutType = "Speed/Tempo Work (intervals or tempo run) - estimated based on day";
    } else if (dayOfWeek === 0 || dayOfWeek === 6) { // Weekend
      expectedWorkoutType = "Long Run (endurance building) - estimated based on day";
    } else {
      expectedWorkoutType = "Flexible workout (easy run, cross-training, or rest) - estimated based on day";
    }
  }

  const distance = (recentActivity.distance / 1609.34).toFixed(2);
  const duration = Math.floor(recentActivity.moving_time / 60);
  const pace = formatPace(recentActivity.average_speed);
  const avgHR = recentActivity.average_heartrate ? Math.round(recentActivity.average_heartrate) : 'N/A';

  // Add detailed pace and HR analysis if stream data is available
  let detailedAnalysis = '';
  if (streamData) {
    // Analyze pace variations
    if (streamData.velocity_smooth?.data) {
      const paces = streamData.velocity_smooth.data
        .map(v => v > 0 ? 26.8224 / v : 0)
        .filter(pace => pace > 0 && pace < 20);
      
      if (paces.length > 0) {
        const fastestPace = Math.min(...paces);
        const slowestPace = Math.max(...paces);
        const paceRange = slowestPace - fastestPace;
        
        detailedAnalysis += `\nDetailed Pace Analysis:
- Fastest pace: ${formatPaceFromMinutes(fastestPace)}
- Slowest pace: ${formatPaceFromMinutes(slowestPace)}
- Pace range: ${paceRange.toFixed(1)} minutes/mile variation
- This ${paceRange > 2 ? 'indicates interval/tempo work' : 'suggests steady effort'}`;
      }
    }
    
    // Analyze heart rate variations
    if (streamData.heartrate?.data) {
      const hrData = streamData.heartrate.data;
      const maxHR = Math.max(...hrData);
      const minHR = Math.min(...hrData);
      const hrRange = maxHR - minHR;
      
      // Count time in different zones
      const zone1 = hrData.filter(hr => hr < 150).length;
      const zone2 = hrData.filter(hr => hr >= 150 && hr < 170).length;
      const zone3 = hrData.filter(hr => hr >= 170 && hr < 190).length;
      const zone4 = hrData.filter(hr => hr >= 190).length;
      const total = hrData.length;
      
      detailedAnalysis += `\nDetailed Heart Rate Analysis:
- Max HR: ${maxHR} bpm, Min HR: ${minHR} bpm
- HR Range: ${hrRange} bpm variation
- Time in zones: Easy(<150): ${Math.round(zone1/total*100)}%, Moderate(150-170): ${Math.round(zone2/total*100)}%, Hard(170-190): ${Math.round(zone3/total*100)}%, Max(190+): ${Math.round(zone4/total*100)}%
- This ${hrRange > 40 ? 'shows significant intensity variation (likely intervals)' : 'shows steady effort'}`;
    }
  }

  const prompt = `Analyze this running activity for a runner training for a 1:45:00 half marathon on May 2nd, 2026. Current PR is 2:01:00.

Activity Details:
- Name: ${recentActivity.name}
- Distance: ${distance} miles
- Duration: ${duration} minutes
- Average Pace: ${pace}
- Average HR: ${avgHR} bpm
- Date: ${activityDate.toLocaleDateString()}
- Expected workout type for this day: ${expectedWorkoutType}
${detailedAnalysis}

Training Context:
- Goal race pace: 8:01/mile
- Easy run target pace: 10:00-11:00/mile (HR 150-160)
- Tempo pace: 8:00-8:15/mile
- Interval pace: 7:15-7:45/mile
- Injury-prone athlete (focus on conservative progression)

IMPORTANT: ${activityRating ? 'This activity was matched to a generated workout from the app. Use the actual workout type above to analyze performance.' : 'This activity was not generated by the app, so analyze based on the estimated workout type and actual performance data.'}

Use the detailed pace and heart rate analysis above to determine the actual workout type. Don't rely solely on average pace - look at pace range and HR zones to identify if this was intervals, tempo, or easy running.

Provide insights in JSON format:
{
  "summary": "Brief analysis of how this workout aligns with half marathon training goals",
  "strengths": "What went well relative to the expected workout type and training goals",
  "improvements": "Areas for improvement specific to half marathon training and injury prevention", 
  "nextWorkout": "Specific recommendation for next workout based on training schedule and this performance"
}

Focus on: pace appropriateness for workout type, heart rate zones, injury prevention, and progression toward 1:45 goal.`;

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 600
    })
  });

  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
  
  const data = await response.json();
  try {
    return JSON.parse(data.choices[0].message.content);
  } catch (e) {
    return { summary: data.choices[0].message.content };
  }
};

const formatPaceFromMinutes = (paceMinutes) => {
  const mins = Math.floor(paceMinutes);
  const secs = Math.round((paceMinutes - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}/mile`;
};

// Strava OAuth
export const initiateStravaAuth = () => {
  if (!STRAVA_CLIENT_ID) {
    throw new Error('Strava Client ID not configured. Please check your environment variables.');
  }
  
  // Clear any existing tokens to force fresh auth
  localStorage.removeItem('strava_access_token');
  localStorage.removeItem('strava_refresh_token');
  
  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(STRAVA_REDIRECT_URI)}&approval_prompt=force&scope=read,activity:read_all`;
  console.log('Redirecting to Strava auth:', authUrl);
  window.location.href = authUrl;
};

export const exchangeStravaCode = async (code) => {
  const clientSecret = import.meta.env.VITE_STRAVA_CLIENT_SECRET;
  console.log('Client ID:', STRAVA_CLIENT_ID);
  console.log('Client Secret exists:', !!clientSecret);
  console.log('Code:', code?.substring(0, 10) + '...');
  
  if (!clientSecret) {
    throw new Error('Strava Client Secret not configured');
  }

  const requestBody = {
    client_id: STRAVA_CLIENT_ID,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code'
  };
  
  console.log('Token exchange request:', requestBody);

  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  console.log('Token exchange response status:', response.status);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Token exchange error:', errorText);
    throw new Error(`Failed to exchange Strava code: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  console.log('Token exchange success:', data);
  return data;
};

export const getStravaActivities = async (accessToken, limit = 5) => {
  console.log('Making Strava API call with token:', accessToken.substring(0, 10) + '...');
  
  // First, let's check what athlete/account we're connected to
  const athleteResponse = await fetch('https://www.strava.com/api/v3/athlete', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  if (athleteResponse.ok) {
    const athlete = await athleteResponse.json();
    console.log('Connected Strava athlete:', athlete.firstname, athlete.lastname, 'ID:', athlete.id);
  }
  
  // Get recent activities without date filter to ensure we get the latest
  console.log('Fetching most recent activities...');
  
  const response = await fetch(`https://www.strava.com/api/v3/activities?per_page=30`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  console.log('Strava API response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Strava API error response:', errorText);
    throw new Error(`Failed to fetch Strava activities: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  console.log('Raw Strava API data (all activities):', data);
  console.log('Total activities found:', data.length);
  
  if (data.length > 0) {
    console.log('Most recent activity date:', data[0]?.start_date);
    console.log('Oldest activity in response:', data[data.length - 1]?.start_date);
  }
  
  // Filter for running activities only
  const runningActivities = data.filter(activity => 
    activity.type === 'Run' || activity.sport_type === 'Run'
  );
  console.log('Running activities found:', runningActivities.length);
  
  if (runningActivities.length === 0) {
    console.log('No running activities found, using mock data for testing');
    return [{
      id: 'mock-1',
      name: 'Morning Run',
      distance: 5000,
      moving_time: 1800,
      average_speed: 2.78,
      start_date: new Date().toISOString(),
      type: 'Run'
    }];
  }
  
  return runningActivities.slice(0, limit);
};

export const matchRatingsWithActivities = (activities) => {
  const ratingQueue = JSON.parse(localStorage.getItem('rating_queue') || '[]');
  const activityRatings = JSON.parse(localStorage.getItem('activity_ratings') || '{}');
  
  let matchedCount = 0;
  const remainingQueue = [];
  
  // Process each unmatched rating in the queue
  ratingQueue.forEach(rating => {
    if (rating.matched) {
      return; // Skip already matched ratings
    }
    
    const ratingDate = new Date(rating.timestamp);
    
    // Find matching activity within 24 hours of the rating
    const matchingActivity = activities.find(activity => {
      const activityDate = new Date(activity.start_date);
      const timeDiff = Math.abs(activityDate - ratingDate);
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      // Match if within 24 hours and not already rated
      return hoursDiff <= 24 && !activityRatings[activity.id];
    });
    
    if (matchingActivity) {
      // Match found - store the rating with the activity
      activityRatings[matchingActivity.id] = {
        rating: rating.rating,
        isInjured: rating.isInjured,
        injuryDetails: rating.injuryDetails,
        notes: rating.notes,
        workoutTitle: rating.workoutTitle,
        ratingTimestamp: rating.timestamp,
        activityDate: matchingActivity.start_date
      };
      
      rating.matched = true;
      matchedCount++;
      console.log(`Matched rating for "${rating.workoutTitle}" with activity "${matchingActivity.name}"`);
    } else {
      // No match found, keep in queue
      remainingQueue.push(rating);
    }
  });
  
  // Update storage
  localStorage.setItem('activity_ratings', JSON.stringify(activityRatings));
  localStorage.setItem('rating_queue', JSON.stringify(remainingQueue));
  
  return matchedCount;
};

export const getActivityRating = (activityId) => {
  const activityRatings = JSON.parse(localStorage.getItem('activity_ratings') || '{}');
  return activityRatings[activityId] || null;
};

export const syncWithStrava = async () => {
  console.log('syncWithStrava called');
  const token = localStorage.getItem('strava_access_token');
  console.log('Stored token:', token ? 'exists' : 'not found');
  
  if (!token) {
    console.log('No token, initiating auth...');
    initiateStravaAuth();
    return null;
  }

  try {
    console.log('Fetching fresh activities from Strava...');
    const activities = await getStravaActivities(token, 30); // Get more activities
    console.log('Fetched activities:', activities);
    
    // Always use fresh data from Strava, don't merge with old stored data
    localStorage.setItem('strava_activities', JSON.stringify(activities));
    
    // Match ratings with activities
    const matchedCount = matchRatingsWithActivities(activities);
    if (matchedCount > 0) {
      console.log(`Matched ${matchedCount} workout ratings with Strava activities`);
    }
    
    return activities;
  } catch (error) {
    console.error('Sync error:', error);
    
    // If it's an auth error, try to refresh token first
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      try {
        console.log('Token expired, attempting refresh...');
        await refreshStravaToken();
        // Retry with new token
        const newToken = localStorage.getItem('strava_access_token');
        const activities = await getStravaActivities(newToken, 30);
        localStorage.setItem('strava_activities', JSON.stringify(activities));
        const matchedCount = matchRatingsWithActivities(activities);
        if (matchedCount > 0) {
          console.log(`Matched ${matchedCount} workout ratings with Strava activities`);
        }
        return activities;
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        // Clear tokens and redirect to auth
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

export const getActivityDetails = async (accessToken, activityId) => {
  try {
    const response = await fetch(`https://www.strava.com/api/v3/activities/${activityId}?include_all_efforts=false`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (response.status === 401) {
      // Token expired, try to refresh
      console.log('Access token expired, attempting refresh...');
      const newToken = await refreshStravaToken();
      
      // Retry with new token
      const retryResponse = await fetch(`https://www.strava.com/api/v3/activities/${activityId}?include_all_efforts=false`, {
        headers: { 'Authorization': `Bearer ${newToken}` }
      });
      
      if (!retryResponse.ok) throw new Error('Failed to fetch activity details after token refresh');
      return retryResponse.json();
    }

    if (!response.ok) throw new Error('Failed to fetch activity details');
    return response.json();
  } catch (error) {
    if (error.message.includes('refresh')) {
      // Refresh failed, need to re-authenticate
      localStorage.removeItem('strava_access_token');
      localStorage.removeItem('strava_refresh_token');
      throw new Error('Strava session expired. Please re-authorize Strava.');
    }
    throw error;
  }
};

export const getActivityStreams = async (accessToken, activityId) => {
  try {
    const streamTypes = 'time,latlng,heartrate,cadence,watts,temp,moving,grade_smooth,velocity_smooth';
    const response = await fetch(`https://www.strava.com/api/v3/activities/${activityId}/streams?keys=${streamTypes}&key_by_type=true`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (response.status === 401) {
      // Token expired, try to refresh
      console.log('Access token expired, attempting refresh...');
      const newToken = await refreshStravaToken();
      
      // Retry with new token
      const retryResponse = await fetch(`https://www.strava.com/api/v3/activities/${activityId}/streams?keys=${streamTypes}&key_by_type=true`, {
        headers: { 'Authorization': `Bearer ${newToken}` }
      });
      
      if (!retryResponse.ok) throw new Error('Failed to fetch activity streams after token refresh');
      return retryResponse.json();
    }

    if (!response.ok) throw new Error('Failed to fetch activity streams');
    return response.json();
  } catch (error) {
    if (error.message.includes('refresh')) {
      // Refresh failed, need to re-authenticate
      localStorage.removeItem('strava_access_token');
      localStorage.removeItem('strava_refresh_token');
      throw new Error('Strava session expired. Please re-authorize Strava.');
    }
    throw error;
  }
};
