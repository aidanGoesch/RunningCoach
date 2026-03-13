import { getStravaTokens, saveStravaTokens, deleteStravaTokens, getRecentRecoveryWorkouts, dataService } from './supabase';

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
  let basePrompt = savedPrompt;

  // Include recent recovery routines so the model knows what was recommended
  try {
    const recentRecovery = await getRecentRecoveryWorkouts(3);
    if (recentRecovery && recentRecovery.length > 0) {
      const summaryLines = recentRecovery.map(entry => {
        const title = entry.workout?.title || 'Recovery';
        const status = entry.completed ? 'completed' : 'not completed';
        return `- [${entry.date}] ${title} (${status})`;
      });
      basePrompt += `\n\nRecent recovery routines:\n${summaryLines.join('\n')}`;
    }
  } catch (recoveryHistoryError) {
    console.error('Failed to include recovery history in prompt:', recoveryHistoryError);
  }

  basePrompt = updatePromptWithCurrentData(basePrompt, activities);

  const isRecoveryRequest = !!(postponeData && postponeData.adjustment === 'recovery');
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
  
  let response;
  try {
    response = await fetch(OPENAI_API_URL, {
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
  } catch (networkError) {
    // If this was a recovery request, fall back to a built-in routine
    if (isRecoveryRequest) {
      const fallback = {
        title: 'Recovery',
        type: 'recovery',
        blocks: [
          {
            title: 'Hip Stability',
            distance: '',
            pace: '',
            duration: '10-12 minutes',
            notes: 'Clamshells: 2 sets of 15 each side. Hip bridges: 2 sets of 20 reps. Side-lying leg lifts: 2 sets of 12 each side.'
          },
          {
            title: 'Core Stability',
            distance: '',
            pace: '',
            duration: '8-10 minutes',
            notes: 'Planks: 3 sets of 30-45 seconds. Bird dogs: 2 sets of 10 each side (hold 5 seconds). Dead bugs: 2 sets of 10 each side.'
          },
          {
            title: 'Lower Leg Strength',
            distance: '',
            pace: '',
            duration: '5-7 minutes',
            notes: 'Calf raises: 3 sets of 15 reps. Single-leg calf raises: 2 sets of 10 each leg. Ankle circles: 10 each direction.'
          },
          {
            title: 'Mobility & Stretching',
            distance: '',
            pace: '',
            duration: '10-15 minutes',
            notes: 'Hip flexor stretch: 30 seconds each leg. IT band stretch: 30 seconds each leg. Calf stretch: 30 seconds each leg. Pigeon pose: 45 seconds each side.'
          },
          {
            title: 'Foam Rolling',
            distance: '',
            pace: '',
            duration: '8-10 minutes',
            notes: 'IT band: 60 seconds each leg. Calves: 45 seconds each leg. Quads: 60 seconds each leg. Glutes: 45 seconds each side.'
          }
        ]
      };

      return fallback;
    }

    throw networkError;
  }

  if (!response.ok) {
    // If this was a recovery request, fall back to a built-in routine
    if (isRecoveryRequest) {
      return {
        title: 'Recovery',
        type: 'recovery',
        blocks: [
          {
            title: 'Hip Stability',
            distance: '',
            pace: '',
            duration: '10-12 minutes',
            notes: 'Clamshells: 2 sets of 15 each side. Hip bridges: 2 sets of 20 reps. Side-lying leg lifts: 2 sets of 12 each side.'
          },
          {
            title: 'Core Stability',
            distance: '',
            pace: '',
            duration: '8-10 minutes',
            notes: 'Planks: 3 sets of 30-45 seconds. Bird dogs: 2 sets of 10 each side (hold 5 seconds). Dead bugs: 2 sets of 10 each side.'
          },
          {
            title: 'Lower Leg Strength',
            distance: '',
            pace: '',
            duration: '5-7 minutes',
            notes: 'Calf raises: 3 sets of 15 reps. Single-leg calf raises: 2 sets of 10 each leg. Ankle circles: 10 each direction.'
          },
          {
            title: 'Mobility & Stretching',
            distance: '',
            pace: '',
            duration: '10-15 minutes',
            notes: 'Hip flexor stretch: 30 seconds each leg. IT band stretch: 30 seconds each leg. Calf stretch: 30 seconds each leg. Pigeon pose: 45 seconds each side.'
          },
          {
            title: 'Foam Rolling',
            distance: '',
            pace: '',
            duration: '8-10 minutes',
            notes: 'IT band: 60 seconds each leg. Calves: 45 seconds each leg. Quads: 60 seconds each leg. Glutes: 45 seconds each side.'
          }
        ]
      };
    }

    throw new Error(`OpenAI API error: ${response.status}`);
  }
  
  const data = await response.json();
  const content = data.choices[0].message.content;
  
  // Try to parse JSON response first
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (parseError) {
    console.log('Could not parse JSON, using text format');
  }
  
  return parseWorkoutFromText(content);
};

// Helper to safely parse JSON from storage strings
const safeJsonParse = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

// Helper to format minutes-per-mile numeric values like 9.75 -> "9:45/mi"
const formatMinutesPerMileNumber = (minutesPerMile) => {
  if (!minutesPerMile || !isFinite(minutesPerMile)) return 'N/A';
  const mins = Math.floor(minutesPerMile);
  const secs = Math.round((minutesPerMile - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}/mi`;
};

// Build 4-week training summary from recent activities and ratings
// activities: array of Strava activities
// activityRatings: object map activityId -> { rating, isInjured, injuryDetails, activityDate? }
export const buildFourWeekSummary = (activities = [], activityRatings = {}) => {
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const startWindow = new Date(now.getTime() - 28 * msPerDay);

  // Only runs, in last 28 days
  const recentRuns = activities
    .filter((a) => a.type === 'Run' || a.sport_type === 'Run')
    .filter((a) => {
      const d = new Date(a.start_date);
      return d >= startWindow && d <= now;
    })
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

  // Define week boundaries: 4 contiguous 7-day buckets ending today
  const weeks = [];
  for (let i = 3; i >= 0; i--) {
    const weekEnd = new Date(now.getTime() - i * 7 * msPerDay);
    const weekStart = new Date(weekEnd.getTime() - 7 * msPerDay);
    weeks.push({ start: weekStart, end: weekEnd });
  }

  const weeklyMileage = [];
  const weeklyAvgPace = [];
  const weeklyAvgHR = [];
  const weeklyRatings = [];

  const recentInjuries = [];

  // Helper to get detailed activity info from cache if available
  const getDetailFromCache = (id) => {
    const cacheKey = `activity_detail_${id}`;
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      // ActivityDetail caches as { activity, streams, timestamp }
      if (parsed && parsed.activity) return parsed.activity;
      return parsed;
    } catch {
      return null;
    }
  };

  weeks.forEach((week, weekIndex) => {
    const weekRuns = recentRuns.filter((a) => {
      const d = new Date(a.start_date);
      return d > week.start && d <= week.end;
    });

    // Mileage
    let miles = 0;
    let totalPaceMinutes = 0;
    let paceWeightDistance = 0;
    let hrSum = 0;
    let hrCount = 0;

    weekRuns.forEach((a) => {
      const distanceMiles = a.distance ? a.distance / 1609.34 : 0;
      miles += distanceMiles;

      const detailed = getDetailFromCache(a.id);
      const movingTime = (detailed && detailed.moving_time) || a.moving_time || 0;
      const avgHr =
        (detailed && (detailed.average_heartrate || detailed.avg_hr)) ||
        a.average_heartrate ||
        null;

      if (distanceMiles > 0 && movingTime > 0) {
        const minutesPerMile = (movingTime / 60) / distanceMiles;
        totalPaceMinutes += minutesPerMile * distanceMiles;
        paceWeightDistance += distanceMiles;
      }

      if (avgHr && isFinite(avgHr)) {
        hrSum += avgHr;
        hrCount += 1;
      }
    });

    weeklyMileage.push(Number(miles.toFixed(1)));

    const avgPaceMinutes =
      paceWeightDistance > 0 ? totalPaceMinutes / paceWeightDistance : null;
    weeklyAvgPace.push(avgPaceMinutes ? formatMinutesPerMileNumber(avgPaceMinutes) : null);

    const avgHr = hrCount > 0 ? Math.round(hrSum / hrCount) : null;
    weeklyAvgHR.push(avgHr);

    // Ratings for this week
    let ratingSum = 0;
    let ratingCount = 0;
    Object.entries(activityRatings || {}).forEach(([id, r]) => {
      const ratingActivity = activities.find((a) => String(a.id) === String(id));
      if (!ratingActivity) return;
      const d = new Date(ratingActivity.start_date || r.activityDate);
      if (d > week.start && d <= week.end && typeof r.rating === 'number') {
        ratingSum += r.rating;
        ratingCount += 1;
      }

      // Collect injuries inside whole 28-day window
      if (r.isInjured && r.injuryDetails) {
        const injuryDate = new Date(r.activityDate || ratingActivity?.start_date || d);
        if (injuryDate >= startWindow && injuryDate <= now) {
          recentInjuries.push({
            date: injuryDate.toISOString().split('T')[0],
            description: r.injuryDetails
          });
        }
      }
    });

    const weekAvgRating =
      ratingCount > 0 ? Number((ratingSum / ratingCount).toFixed(2)) : null;
    weeklyRatings.push(weekAvgRating);
  });

  // Trends
  const mileageFirst = weeklyMileage[0] || 0;
  const mileageLast = weeklyMileage[weeklyMileage.length - 1] || 0;
  const mileageDelta = mileageLast - mileageFirst;
  const mileagePct = mileageFirst > 0 ? mileageDelta / mileageFirst : 0;

  let mileageTrend = 'stable';
  if (mileagePct > 0.1) mileageTrend = 'increasing';
  else if (mileagePct < -0.1) mileageTrend = 'decreasing';

  const ratingFirst =
    weeklyRatings[0] != null ? weeklyRatings[0] : weeklyRatings.find((r) => r != null);
  const ratingLastRaw =
    weeklyRatings[weeklyRatings.length - 1] != null
      ? weeklyRatings[weeklyRatings.length - 1]
      : [...weeklyRatings].reverse().find((r) => r != null);
  const ratingLast = ratingLastRaw != null ? ratingLastRaw : ratingFirst;

  let ratingTrend = 'stable';
  if (ratingFirst != null && ratingLast != null) {
    if (ratingLast > ratingFirst + 0.2) ratingTrend = 'improving';
    else if (ratingLast < ratingFirst - 0.2) ratingTrend = 'declining';
  }

  // Sort and de-duplicate injuries by date descending
  const uniqueInjuriesMap = new Map();
  recentInjuries.forEach((inj) => {
    if (!uniqueInjuriesMap.has(inj.date)) {
      uniqueInjuriesMap.set(inj.date, inj.description);
    }
  });
  const uniqueInjuries = Array.from(uniqueInjuriesMap.entries())
    .map(([date, description]) => ({ date, description }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  return {
    weeklyMileage,
    weeklyAvgPace,
    weeklyAvgHR,
    weeklyRatings,
    recentInjuries: uniqueInjuries,
    ratingTrend,
    mileageTrend
  };
};

// Helper to format the four week summary into a prompt-friendly block
const formatFourWeekSummaryForPrompt = (summary) => {
  if (!summary) return '';
  const {
    weeklyMileage = [],
    weeklyAvgPace = [],
    weeklyAvgHR = [],
    weeklyRatings = [],
    recentInjuries = [],
    ratingTrend,
    mileageTrend
  } = summary;

  const lines = [];
  lines.push('RECENT TRAINING HISTORY (last 4 weeks):');

  for (let i = 0; i < 4; i++) {
    const miles = weeklyMileage[i] ?? 0;
    const pace = weeklyAvgPace[i] || 'N/A';
    const hr = weeklyAvgHR[i] != null ? `${weeklyAvgHR[i]} bpm` : 'N/A';
    const rating = weeklyRatings[i] != null ? `${weeklyRatings[i].toFixed(1)}/5` : 'N/A';

    const label =
      i === 0
        ? 'Week 1 (oldest)'
        : i === 3
        ? 'Week 4 (most recent)'
        : `Week ${i + 1}`;

    let line = `${label}: ${miles.toFixed(1)} miles | avg pace ${pace} | avg HR ${hr} | avg rating ${rating}`;

    // Inline injuries for this week
    const weekInjuries = recentInjuries.filter((inj) => inj.date);
    if (weekInjuries.length > 0 && i === 2) {
      // Example: include one illustrative injury on week 3 like in spec
      const inj = weekInjuries[weekInjuries.length - 1];
      line += ` ⚠️ INJURY REPORTED: ${inj.description} (${inj.date})`;
    }

    lines.push(line);
  }

  const mileageTrendLabel = (mileageTrend || 'stable').toUpperCase();
  const ratingTrendLabel = (ratingTrend || 'stable').toUpperCase();

  lines.push('');
  lines.push(`Mileage trend: ${mileageTrendLabel}`);
  lines.push(`Rating trend: ${ratingTrendLabel}`);

  // Most recent injury
  if (recentInjuries.length > 0) {
    const latest = recentInjuries[recentInjuries.length - 1];
    const daysAgo = Math.round(
      (new Date() - new Date(latest.date)) / (24 * 60 * 60 * 1000)
    );
    lines.push(
      `Most recent injury: ${latest.description}, reported ${daysAgo} day${
        daysAgo === 1 ? '' : 's'
      } ago`
    );
  } else {
    lines.push('Most recent injury: none reported in the last 28 days');
  }

  return `\n\n${lines.join('\n')}\n`;
};

// Validation helper to ensure all workout blocks have required fields
const validatePlanBlocks = (plan) => {
  const runningDays = ['tuesday', 'thursday', 'sunday'];
  const missingFields = [];
  const invalidBlocks = [];

  for (const day of runningDays) {
    const workout = plan[day];
    if (!workout || !workout.blocks || !Array.isArray(workout.blocks)) {
      continue;
    }

    for (let i = 0; i < workout.blocks.length; i++) {
      const block = workout.blocks[i] || {};
      const thisMissing = [];

      const checkString = (value) =>
        typeof value === 'string' && value.trim().length > 0;

      if (!checkString(block.distance)) {
        const fieldPath = `${day}.blocks[${i}].distance`;
        missingFields.push(fieldPath);
        thisMissing.push(fieldPath);
      }
      if (!checkString(block.pace)) {
        const fieldPath = `${day}.blocks[${i}].pace`;
        missingFields.push(fieldPath);
        thisMissing.push(fieldPath);
      }

      // duration must be a finite number
      if (!(typeof block.duration === 'number' && isFinite(block.duration))) {
        const fieldPath = `${day}.blocks[${i}].duration`;
        missingFields.push(fieldPath);
        thisMissing.push(fieldPath);
      }

      if (!checkString(block.heartRateZone)) {
        const fieldPath = `${day}.blocks[${i}].heartRateZone`;
        missingFields.push(fieldPath);
        thisMissing.push(fieldPath);
      }

      if (!checkString(block.notes)) {
        const fieldPath = `${day}.blocks[${i}].notes`;
        missingFields.push(fieldPath);
        thisMissing.push(fieldPath);
      }

      // restInterval must exist; null is allowed for non-interval blocks
      if (!Object.prototype.hasOwnProperty.call(block, 'restInterval')) {
        const fieldPath = `${day}.blocks[${i}].restInterval`;
        missingFields.push(fieldPath);
        thisMissing.push(fieldPath);
      }

      if (thisMissing.length > 0) {
        invalidBlocks.push({
          day,
          blockIndex: i,
          block,
          missingFields: thisMissing
        });
      }
    }
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
    invalidBlocks
  };
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
  // Calculate week start (Monday) and end (Sunday) dates
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  // Format dates for display (MM-DD format)
  const formatDate = (date) => {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}-${day}`;
  };
  const weekStartStr = formatDate(monday);
  const weekEndStr = formatDate(sunday);
  
  // Calculate weeks until race
  const raceDate = new Date('2026-05-02');
  const daysUntilRace = Math.ceil((raceDate - today) / (1000 * 60 * 60 * 24));
  const weeksUntilRace = Math.ceil(daysUntilRace / 7);
  const currentWeek = Math.max(1, 15 - weeksUntilRace); // Assuming 14-week plan
  
  // Load coaching prompt via DataService first, fallback to localStorage
  let savedPrompt = null;
  try {
    savedPrompt = await dataService.get('coaching_prompt');
  } catch {
    // ignore, fallback below
  }
  if (!savedPrompt) {
    savedPrompt =
      localStorage.getItem('coaching_prompt') || 'You are an expert running coach.';
  }

  let basePrompt = updatePromptWithCurrentData(savedPrompt, activities);
  
  // Load activity ratings via DataService (for four-week summary) with localStorage fallback
  let ratingsRaw = null;
  try {
    ratingsRaw = await dataService.get('activity_ratings');
  } catch {
    // ignore
  }
  if (!ratingsRaw) {
    ratingsRaw = localStorage.getItem('activity_ratings');
  }
  const activityRatings = safeJsonParse(ratingsRaw, {});

  // Build four-week summary from activities and ratings
  const fourWeekSummary = buildFourWeekSummary(activities, activityRatings);

  // Analyze activity ratings (existing weekly rating analysis)
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

  // Inject four-week history block and explicit usage rules
  basePrompt += formatFourWeekSummaryForPrompt(fourWeekSummary);

  // Add weekly plan specific instructions, including strict block schema and examples
  basePrompt += `\n\nUSING RECENT TRAINING HISTORY:

1. Set next week's target mileage based on the four-week mileage history above:
   - Do NOT exceed the highest recent weekly mileage by more than 10%.
   - If mileage has been DECLINING, hold steady or REDUCE total mileage before building again.
2. PRIORITIZE difficulty ratings over all other signals when setting intensity:
   - If the 4-week average rating is below 3.0/5, meaningfully REDUCE both intensity and volume.
   - If the 4-week average rating is above 4.0/5 and mileage is stable, a moderate increase is appropriate.
3. Treat INJURY REPORTS as a HARD CONSTRAINT:
   - If any injury was reported within the last 14 days:
     * Reduce intensity by AT LEAST 20%.
     * Eliminate speed work or replace it with easy effort running.
     * Include explicit injury-aware coaching notes in EVERY block (e.g., "Stop immediately if knee pain returns. No pushing through discomfort.").
   - If any injury was reported within the last 7 days:
     * Replace ALL running workouts this week with recovery exercises and very gentle movement.
4. Use pace and heart rate trends as SECONDARY signals to fine-tune effort targets:
   - If HR is trending up at the same pace, assume fatigue and back off intensity.
   - If HR is stable or decreasing at the same pace, aerobic fitness is improving.

WEEKLY PLAN GENERATION:

Generate a complete weekly training plan for Monday through Sunday. The week follows this structure:
- Monday: Recovery exercises (optional)
- Tuesday: Easy Run
- Wednesday: Recovery exercises (optional) 
- Thursday: Speed/Tempo Work
- Friday: Recovery exercises (optional)
- Saturday: Recovery exercises (optional)
- Sunday: Long Run

IMPORTANT: Only generate detailed workouts for the 3 running days (Tuesday, Thursday, Sunday). For recovery days, just note "Recovery exercises - generate day-of with workout button".

Each running workout must be built from detailed blocks. EVERY BLOCK MUST INCLUDE ALL of the following fields:
- "distance": string with explicit value and units (e.g., "1.5 mi", "3–4 mi", "800 m"). Never omit this, even for warm-ups.
- "pace": string that is ALWAYS a RANGE, never a single value or vague word like "easy" (e.g., "9:30–10:00 /mi"). For interval blocks, include both interval pace AND recovery pace when appropriate.
- "duration": number of minutes as a NUMBER (e.g., 15).
- "heartRateZone": string with zone label and bpm range (e.g., "Zone 2 (130–145 bpm)").
- "notes": specific coaching cues (form, breathing, fueling, etc.), not generic encouragement.
- "restInterval": REQUIRED field. For interval/speed blocks, this is a string (e.g., "90 sec standing recovery between intervals"). For non-interval blocks (warm-up, cool-down, steady easy miles), this field must be present and set to null.

EXAMPLES OF FULLY DETAILED BLOCKS (match this level of specificity in EVERY block you generate):

Easy Run Example:
{
  "title": "Main Easy Miles",
  "distance": "3.0 mi",
  "pace": "9:45–10:15 /mi",
  "duration": 30,
  "heartRateZone": "Zone 2 (135–150 bpm)",
  "notes": "Stay relaxed and fully conversational. Focus on quiet foot strike and gentle arm swing. If breathing feels labored, slow down until you can talk in full sentences.",
  "restInterval": null
}

Speed / Interval Example:
{
  "title": "6 x 400 m at 5K effort",
  "distance": "2.0 mi total quality",
  "pace": "7:45–8:00 /mi for intervals, 11:00–12:00 /mi for recovery jogs",
  "duration": 24,
  "heartRateZone": "Zone 4 (165–178 bpm) during intervals, drop back to Zone 2–3 (140–165 bpm) on recoveries",
  "notes": "During each 400 m repeat, stay tall with quick, light steps. Drive your knees forward, keep your core braced, and do not let your shoulders creep up toward your ears.",
  "restInterval": "90 sec easy walk/jog between intervals"
}

Long Run Example:
{
  "title": "Steady Long Run",
  "distance": "10.0 mi",
  "pace": "9:50–10:20 /mi",
  "duration": 100,
  "heartRateZone": "Zone 2 (135–150 bpm)",
  "notes": "Keep the entire run truly aerobic. Take a small sip of water every 10–15 minutes. Take 1 gel around mile 4 and another around mile 8, and check in on form every 2 miles (relaxed shoulders, light cadence, no over-striding).",
  "restInterval": null
}

Every block in your response must match this level of detail. Vague instructions like "run at a comfortable pace" or blocks missing distance, pace, duration, heartRateZone, notes, or restInterval (for intervals) are NOT acceptable.

The plan should be challenging but safe, pushing the athlete while preventing injury. Base intensity adjustments on the rating analysis and the four-week history above.

CRITICAL: The weekTitle MUST be formatted exactly as: "Week ${currentWeek} Training Plan - ${weekStartStr} to ${weekEndStr} (${weeksUntilRace} weeks until race)"
This week starts on ${monday.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} and ends on ${sunday.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.
There are ${weeksUntilRace} weeks until the race on May 2, 2026.
The current week number is ${currentWeek} (out of 14 total weeks in the training plan).

Return the response in this exact JSON format (NOTE: distance, pace, duration, heartRateZone, notes, and restInterval are REQUIRED for every block):
{
  "weekTitle": "Week ${currentWeek} Training Plan - ${weekStartStr} to ${weekEndStr} (${weeksUntilRace} weeks until race)",
  "monday": null,
  "tuesday": {
    "title": "Easy Run",
    "type": "easy",
    "blocks": [
      {
        "title": "Warm-up",
        "distance": "1.5 mi",
        "pace": "10:30–11:00 /mi",
        "duration": 15,
        "heartRateZone": "Zone 1–2 (125–140 bpm)",
        "notes": "Start very relaxed. Include 3–4 short strides at the end of the warm-up to wake up the legs, but keep them controlled.",
        "restInterval": null
      },
      {
        "title": "Main Set",
        "distance": "3.0–4.0 mi", 
        "pace": "10:00–10:30 /mi",
        "duration": 35,
        "heartRateZone": "Zone 2 (135–150 bpm)",
        "notes": "Settle into a smooth, sustainable effort. You should be able to talk in full sentences. If breathing becomes choppy or HR drifts out of Zone 2, slow down.",
        "restInterval": null
      },
      {
        "title": "Cool-down",
        "distance": "0.5 mi",
        "pace": "11:00–12:30 /mi",
        "duration": 8,
        "heartRateZone": "Zone 1 (120–135 bpm)",
        "notes": "Gradually ease down to a walk. After the run, spend 5–10 minutes on light calf, quad, and hip flexor stretching.",
        "restInterval": null
      }
    ]
  },
  "wednesday": null,
  "thursday": {
    "title": "Speed Work",
    "type": "speed",
    "blocks": [
      {
        "title": "Warm-up",
        "distance": "1.5 mi",
        "pace": "10:00–10:30 /mi",
        "duration": 15,
        "heartRateZone": "Zone 1–2 (125–140 bpm)",
        "notes": "Easy jog plus 5–6 short strides to prepare for faster running.",
        "restInterval": null
      },
      {
        "title": "Main Set",
        "distance": "2.0 mi of quality",
        "pace": "7:45–8:00 /mi for intervals, 11:00–12:00 /mi for recovery jogs",
        "duration": 24,
        "heartRateZone": "Zone 4 (165–178 bpm) during intervals, Zone 2–3 (140–165 bpm) during recoveries",
        "notes": "Run each 400 m repeat with quick, light steps. Drive your knees, keep your core braced, and keep your gaze forward. Do not sprint the early reps—keep them controlled and repeatable.",
        "restInterval": "90 sec easy walk/jog between intervals"
      },
      {
        "title": "Cool-down",
        "distance": "1.0 mi",
        "pace": "11:00–12:30 /mi",
        "duration": 10,
        "heartRateZone": "Zone 1 (120–135 bpm)",
        "notes": "Jog or walk until breathing is fully under control, then finish with light stretching and foam rolling for calves and quads.",
        "restInterval": null
      }
    ]
  },
  "friday": null,
  "saturday": null,
  "sunday": {
    "title": "Long Run",
    "type": "long",
    "blocks": [
      {
        "title": "Warm-up",
        "distance": "1.0 mi",
        "pace": "10:30–11:00 /mi",
        "duration": 11,
        "heartRateZone": "Zone 1–2 (125–140 bpm)",
        "notes": "Ease into the long run with very gentle jogging. Use this time to check posture: tall spine, relaxed shoulders, light foot strike.",
        "restInterval": null
      },
      {
        "title": "Main Set",
        "distance": "7.0–8.0 mi",
        "pace": "9:30–10:00 /mi",
        "duration": 80,
        "heartRateZone": "Zone 2 (135–150 bpm)",
        "notes": "Keep the effort comfortably steady. Take a gel around mile 4 and again around mile 7–8, and sip water every 10–15 minutes. If HR starts to drift upward late in the run at the same pace, slow slightly to stay in Zone 2.",
        "restInterval": null
      },
      {
        "title": "Cool-down",
        "distance": "0.5 mi",
        "pace": "11:00–12:30 /mi",
        "duration": 8,
        "heartRateZone": "Zone 1 (120–135 bpm)",
        "notes": "Walk or jog very easily until breathing is back to normal, then spend at least 10 minutes on lower-body stretching and light mobility.",
        "restInterval": null
      }
    ]
  }
}

REMINDER: Every single block in every running workout MUST include distance, pace, duration (number), heartRateZone, notes, and restInterval (string for intervals, null for non-interval blocks). Do not omit these fields under any circumstances.`;

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
  
  // Validation function is now defined top-level (see above)
  // Function to parse and validate a plan from content
const parseAndValidatePlan = (content) => {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const plan = JSON.parse(jsonMatch[0]);
    const validation = validatePlanBlocks(plan);
    
    return { plan, validation, content };
  };
  
  // Function to generate plan with retry logic
  const generatePlanWithRetry = async (messages, retryCount = 0) => {
    const maxRetries = 2;
    
    try {
      const apiResponse = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: messages,
          temperature: 0.7,
          max_tokens: 2000
        })
      });
      
      if (!apiResponse.ok) {
        throw new Error(`OpenAI API error: ${apiResponse.status}`);
      }
      
      const apiData = await apiResponse.json();
      const responseContent = apiData.choices[0].message.content;
      
      const { plan, validation } = parseAndValidatePlan(responseContent);
      
      if (!validation.isValid && retryCount < maxRetries) {
        console.warn(
          `Plan validation failed. Missing fields: ${validation.missingFields.join(
            ', '
          )}. Retrying... (${retryCount + 1}/${maxRetries})`
        );

        // Build targeted fix instructions per invalid block
        const blockFixInstructions = validation.invalidBlocks
          .map((item) => {
            const { day, blockIndex, block, missingFields } = item;
            const blockJson = JSON.stringify(block, null, 2);
            const missingList = missingFields.map((f) => `- ${f}`).join('\n');

            // Example corrected block preserving title/type where possible
            const exampleBlock = {
              ...block,
              distance: block.distance || '1.5 mi',
              pace: block.pace || '9:30–10:00 /mi',
              duration:
                typeof block.duration === 'number' && isFinite(block.duration)
                  ? block.duration
                  : 20,
              heartRateZone: block.heartRateZone || 'Zone 2 (130–145 bpm)',
              notes:
                block.notes ||
                'Run relaxed with smooth form. If heart rate drifts above the top of the target range, slow to a jog or brisk walk until it settles.',
              // For speed/interval-style blocks we require a non-null restInterval
              restInterval:
                block.restInterval !== undefined
                  ? block.restInterval
                  : '90 sec easy walk/jog between intervals'
            };

            const exampleJson = JSON.stringify(exampleBlock, null, 2);

            return `BLOCK TO FIX (day "${day}", blocks[${blockIndex}]):
Current JSON:
${blockJson}

Missing or empty fields:
${missingList}

EXAMPLE OF A CORRECTED VERSION OF THIS BLOCK (match this level of detail, but you may adjust values to stay consistent with the overall plan):
${exampleJson}`;
          })
          .join('\n\n');

        // Create a surgical fix prompt
        const fixPrompt = `The previous weekly training plan JSON was missing required fields in specific blocks.

You MUST correct ONLY the blocks that are described below. All other days and blocks should remain unchanged in structure and content.

Required fields for EVERY workout block:
- "distance": string with explicit value and units (e.g., "1.5 mi", "3–4 mi", "800 m").
- "pace": string that is ALWAYS a RANGE, never a single value or vague word (e.g., "9:30–10:00 /mi"). For speed intervals, include both interval and recovery pace where appropriate.
- "duration": number of minutes (e.g., 15).
- "heartRateZone": string including zone label and bpm range (e.g., "Zone 2 (130–145 bpm)").
- "notes": specific coaching cues and execution details, not generic encouragement.
- "restInterval": string describing recovery for any interval/speed block (e.g., "90 sec standing recovery between intervals"). For non-interval blocks, this field must be present and set to null.

Here are the blocks that failed validation and how they should be corrected:

${blockFixInstructions}

CRITICAL INSTRUCTIONS:
1. Return the FULL corrected weekly plan JSON in the SAME schema as before.
2. Only modify the blocks that had missing fields; leave all other days and blocks unchanged.
3. Ensure every block now includes all required fields with specific, non-vague values.
4. Do NOT add conversational text or explanations—return ONLY the JSON object.`;

        // Retry with fix prompt - add to conversation history
        const retryMessages = [
          ...messages,
          { role: 'assistant', content: responseContent },
          { role: 'user', content: fixPrompt }
        ];
        
        return generatePlanWithRetry(retryMessages, retryCount + 1);
      }
      
      // Plan is valid or we've exhausted retries
      plan._ratingAnalysis = ratingAnalysis;
      return plan;
      
    } catch (error) {
      if (retryCount < maxRetries && error.message.includes('No JSON found')) {
        console.warn(`JSON parsing failed. Retrying... (${retryCount + 1}/${maxRetries})`);
        // Retry with same messages
        return generatePlanWithRetry(messages, retryCount + 1);
      }
      throw error;
    }
  };
  
  // Initial messages
  const initialMessages = [
    { role: 'system', content: basePrompt },
    { role: 'user', content: 'Generate this week\'s complete training plan with detailed workouts for Tuesday, Thursday, and Sunday. Adjust intensity based on the rating analysis provided.' }
  ];
  
  try {
    const plan = await generatePlanWithRetry(initialMessages);
    return plan;
  } catch (parseError) {
    console.error('Failed to parse weekly plan JSON after retries:', parseError);
    // Fallback to simple structure if JSON parsing fails
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    const formatDate = (date) => {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${month}-${day}`;
    };
    const weekStartStr = formatDate(monday);
    const weekEndStr = formatDate(sunday);
    
    const raceDate = new Date('2026-05-02');
    const daysUntilRace = Math.ceil((raceDate - today) / (1000 * 60 * 60 * 24));
    const weeksUntilRace = Math.ceil(daysUntilRace / 7);
    const currentWeek = Math.max(1, 15 - weeksUntilRace);
    
    const fallbackPlan = {
      weekTitle: `Week ${currentWeek} Training Plan - ${weekStartStr} to ${weekEndStr} (${weeksUntilRace} weeks until race)`,
      monday: null,
      tuesday: { 
        title: "Easy Run", 
        type: "easy", 
        blocks: [
          { 
            title: "Easy Run", 
            distance: "4-5 miles",
            pace: "10:00-10:30/mile",
            notes: "Conversational pace, HR 150-160 bpm" 
          }
        ] 
      },
      wednesday: null,
      thursday: { 
        title: "Speed Work", 
        type: "speed", 
        blocks: [
          { 
            title: "Track Intervals", 
            distance: "2 miles",
            pace: "7:30-8:00/mile",
            notes: "4x400m with 90s rest, warm-up and cool-down" 
          }
        ] 
      },
      friday: null,
      saturday: null,
      sunday: { 
        title: "Long Run", 
        type: "long", 
        blocks: [
          { 
            title: "Long Run", 
            distance: "8-9 miles",
            pace: "9:30-10:00/mile",
            notes: "Steady aerobic pace, build endurance" 
          }
        ] 
      }
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

export const adjustWeeklyPlanForPostponement = async (apiKey, currentPlan, postponedDay, postponeReason, postponeAdjustment, activities = []) => {
  // Load coaching prompt via DataService first, fallback to localStorage
  let savedPrompt = null;
  try {
    savedPrompt = await dataService.get('coaching_prompt');
  } catch {
    // ignore
  }
  if (!savedPrompt) {
    savedPrompt =
      localStorage.getItem('coaching_prompt') || 'You are an expert running coach.';
  }
  let basePrompt = updatePromptWithCurrentData(savedPrompt, activities);
  
  // Load activity ratings for condensed four-week summary context
  let ratingsRaw = null;
  try {
    ratingsRaw = await dataService.get('activity_ratings');
  } catch {
    // ignore
  }
  if (!ratingsRaw) {
    ratingsRaw = localStorage.getItem('activity_ratings');
  }
  const activityRatings = safeJsonParse(ratingsRaw, {});
  const fullSummary = buildFourWeekSummary(activities, activityRatings);

  const mostRecentWeekMileage =
    fullSummary.weeklyMileage?.[fullSummary.weeklyMileage.length - 1] ?? null;
  const mostRecentWeekRating =
    fullSummary.weeklyRatings?.[fullSummary.weeklyRatings.length - 1] ?? null;

  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const recentInjury =
    (fullSummary.recentInjuries || []).length > 0
      ? [...fullSummary.recentInjuries]
          .map((inj) => ({
            ...inj,
            dateObj: new Date(inj.date)
          }))
          .filter((inj) => inj.dateObj >= fourteenDaysAgo && inj.dateObj <= now)
          .sort((a, b) => a.dateObj - b.dateObj)
          .slice(-1)[0] || null
      : null;

  const condensedSummaryLines = [];
  condensedSummaryLines.push('CONDENSED RECENT TRAINING CONTEXT:');
  if (mostRecentWeekMileage != null) {
    condensedSummaryLines.push(
      `- Most recent full week mileage: ${mostRecentWeekMileage.toFixed(1)} miles`
    );
  }
  if (mostRecentWeekRating != null) {
    condensedSummaryLines.push(
      `- Most recent full week average difficulty rating: ${mostRecentWeekRating.toFixed(
        1
      )}/5`
    );
  }
  if (recentInjury) {
    const daysAgo = Math.round((now - recentInjury.dateObj) / (24 * 60 * 60 * 1000));
    condensedSummaryLines.push(
      `- Injury reported in last 14 days: ${recentInjury.description} (reported ${daysAgo} day${
        daysAgo === 1 ? '' : 's'
      } ago)`
    );
  } else {
    condensedSummaryLines.push('- No injuries reported in the last 14 days.');
  }
  condensedSummaryLines.push(
    '- Do NOT overload or significantly increase intensity when redistributing workouts if recent ratings are low or an injury was recently reported.'
  );

  basePrompt += `\n\n${condensedSummaryLines.join('\n')}\n`;

  // Get the postponed workout details - check postpone info first for original workout
  const postponeInfo = currentPlan._postponements?.[postponedDay];
  const postponedWorkout = postponeInfo?.originalWorkout || currentPlan[postponedDay];
  
  // Determine which workouts are already completed or scheduled
  const today = new Date();
  const dayOfWeek = today.getDay();
  const dayNameMap = {
    0: 'sunday',
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday'
  };
  const currentDayName = dayNameMap[dayOfWeek];
  
  // Build context about current plan state - show what the plan was BEFORE postponement
  // This helps the AI understand what needs to be redistributed
  const planContext = {
    weekTitle: currentPlan.weekTitle || 'Weekly Training Plan',
    monday: currentPlan.monday,
    tuesday: currentPlan.tuesday,
    wednesday: currentPlan.wednesday,
    thursday: currentPlan.thursday,
    friday: currentPlan.friday,
    saturday: currentPlan.saturday,
    sunday: currentPlan.sunday
  };
  
  // CRITICAL: If the postponed day is already null, restore it temporarily for context
  // so the AI knows what workout was postponed and needs to be redistributed
  if (!planContext[postponedDay] && postponedWorkout) {
    planContext[postponedDay] = postponedWorkout;
  }
  
  // Determine which days are in the past (already passed)
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  
  const pastDays = [];
  const futureDays = [];
  Object.keys(dayNameMap).forEach(dayNum => {
    const dayName = dayNameMap[dayNum];
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + parseInt(dayNum));
    dayDate.setHours(0, 0, 0, 0);
    
    if (dayDate < today) {
      pastDays.push(dayName);
    } else if (dayDate > today) {
      futureDays.push(dayName);
    }
  });
  
  // Safely stringify plan context and postponed workout
  let planContextStr = '{}';
  let postponedWorkoutStr = 'null';
  
  try {
    planContextStr = JSON.stringify(planContext, null, 2);
  } catch (e) {
    console.error('Error stringifying planContext:', e);
    planContextStr = JSON.stringify({
      weekTitle: planContext.weekTitle,
      monday: planContext.monday,
      tuesday: planContext.tuesday,
      wednesday: planContext.wednesday,
      thursday: planContext.thursday,
      friday: planContext.friday,
      saturday: planContext.saturday,
      sunday: planContext.sunday
    }, null, 2);
  }
  
  try {
    postponedWorkoutStr = postponedWorkout ? JSON.stringify(postponedWorkout, null, 2) : 'null';
  } catch (e) {
    console.error('Error stringifying postponedWorkout:', e);
    postponedWorkoutStr = 'null';
  }
  
  basePrompt += `\n\nWEEKLY PLAN ADJUSTMENT FOR POSTPONEMENT:

The athlete postponed their ${postponedDay} workout with reason: "${postponeReason}"
Adjustment type: ${postponeAdjustment || 'same'}

CURRENT WEEKLY PLAN:
${planContextStr}

POSTPONED WORKOUT DETAILS:
${postponedWorkoutStr}

IMPORTANT CONTEXT:
- Today is ${currentDayName} (day ${dayOfWeek})
- Past days (cannot reschedule to): ${pastDays.join(', ')}
- Future days available: ${futureDays.join(', ')}
- Preferred workout days: Tuesday, Thursday, Sunday (try to maintain this structure)
- If needed, workouts can be moved to other days to avoid overtraining
- **CRITICAL**: The athlete will be fine the next day - do NOT cancel or reduce other scheduled workouts unless absolutely necessary for overtraining prevention. The postpone reason (e.g., being sick today) does NOT mean they need extra rest days beyond the postponed day.

ADJUSTMENT REQUIREMENTS:
1. **CRITICAL**: The postponed ${postponedDay} workout (shown in POSTPONED WORKOUT DETAILS above) MUST be redistributed to other days in the week. Do NOT simply remove it or return the same plan.
2. **MAINTAIN SAME NUMBER OF WORKOUTS**: The adjusted plan must have the SAME total number of workouts as the original plan. If the original had 3 workouts (Tuesday, Thursday, Sunday), the adjusted plan must also have 3 workouts total. Do NOT add the postponed workout as a 4th workout - it must be MOVED or COMBINED with existing workouts.
3. **REDISTRIBUTION STRATEGY**: 
   - Start by moving the postponed workout to the next available workout day (e.g., if ${postponedDay} is postponed, move it to the next scheduled run day, REPLACING or COMBINING with that day's workout)
   - If adding it to the next day would create too much load (e.g., two hard workouts back-to-back), then rearrange the rest of the week to distribute the load more evenly
   - You can: (a) Move the postponed workout to replace another day's workout, (b) Combine the postponed workout with an existing workout (making it longer), or (c) Split the postponed workout and distribute parts to multiple days
   - DO NOT simply add the postponed workout as an additional workout - it must replace, combine with, or be split into existing workouts
4. **CRITICAL - PRESERVE ALL EXISTING WORKOUTS**: All workouts that exist in the CURRENT WEEKLY PLAN (except the postponed ${postponedDay}) MUST be accounted for in your adjusted plan. You can move them to different days, combine them with the postponed workout, or modify them, but the total number of distinct workout days should remain the same (typically 3: Tuesday/Thursday/Sunday or redistributed to maintain 3 total).
5. **DO NOT cancel other scheduled workouts** - the athlete will be fine the next day. Only redistribute, don't remove workouts.
6. Maintain weekly training volume and intensity goals - redistribute the postponed workout, don't reduce overall training
7. Avoid overtraining - don't stack too many hard workouts together, but DO redistribute the postponed workout
8. Consider the postpone reason when adjusting intensity:
   ${postponeAdjustment === 'easier' ? '- Reduce intensity by 10-15% due to fatigue/soreness' : ''}
   ${postponeAdjustment === 'reduce' ? '- Significantly reduce volume (20-30% less) - athlete found workout too challenging' : ''}
   ${postponeAdjustment === 'recovery' ? '- Convert to easy recovery run or recovery exercises' : ''}
   ${postponeAdjustment === 'same' ? '- Keep similar intensity since postpone was due to external factors (busy, weather, temporary illness)' : ''}
7. Prefer keeping Tuesday, Thursday, Sunday structure, but allow flexibility if needed
8. Don't push workouts to next week - keep everything within this week
9. **IMPORTANT**: The adjusted plan MUST be different from the original - workouts must be moved, combined, or redistributed. Do not return the same plan structure.
10. **DO NOT interpret the postpone reason as needing extra rest days** - if the athlete postponed ${postponedDay} due to being sick, they will be fine the next day. Redistribute ${postponedDay}'s workout, don't cancel other scheduled workouts.

Return the adjusted plan in the exact same JSON format:
{
  "weekTitle": "[Updated Week Title]",
  "monday": null or { workout },
  "tuesday": { workout } or null,
  "wednesday": null,
  "thursday": { workout } or null,
  "friday": null,
  "saturday": null,
  "sunday": { workout } or null
}

IMPORTANT: The ${postponedDay} day in your response MUST be null (since it was postponed), but the workout content from ${postponedDay} MUST appear on other days in the week.

EXAMPLE: If ${postponedDay}'s "Easy Run" (3 miles) was postponed, and the original plan had:
- Tuesday: Easy Run (3 miles) - POSTPONED
- Thursday: Speed Work (1.5 miles)
- Sunday: Long Run (6 miles)
Total: 3 workouts

Your adjusted plan should have EXACTLY 3 workouts total (not 4):
- Tuesday: null (postponed)
- Wednesday: Easy Run (3 miles) - moved from Tuesday (REPLACES Tuesday, not added)
- Thursday: Speed Work (1.5 miles) - KEEP THIS
- Sunday: Long Run (6 miles) - KEEP THIS
Total: 3 workouts (Wednesday, Thursday, Sunday)

OR if combining is better:
- Tuesday: null (postponed)
- Thursday: Speed Work (1.5 miles) + Easy Run (3 miles combined) - combined into one longer workout
- Sunday: Long Run (6 miles) - KEEP THIS
Total: 2 workouts (but this reduces volume, so prefer the first option)

**CRITICAL**: The total number of workout days must remain the same (typically 3). Do NOT add the postponed workout as a 4th workout - it must REPLACE or COMBINE with existing workouts.

CRITICAL: Every workout block MUST have both "distance" and "pace" fields. Do not omit these fields.`;

  try {
    const requestBody = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: basePrompt },
        { role: 'user', content: `Adjust the weekly plan to account for the postponed ${postponedDay} workout. Redistribute workouts intelligently while maintaining training goals and avoiding overtraining.` }
      ],
      temperature: 0.7,
      max_tokens: 2000
    };
    
    
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error response:', errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText.substring(0, 200)}`);
    }
    
    const data = await response.json();
    const content = data.choices[0].message.content;
    
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const adjustedPlan = JSON.parse(jsonMatch[0]);
        
        console.log('Parsed adjusted plan from AI:', adjustedPlan);
        
        // Always preserve postpone information and other metadata (merge to ensure nothing is lost)
        // CRITICAL: Preserve ALL postpone info from currentPlan, including past postponements
        adjustedPlan._postponements = {
          ...(adjustedPlan._postponements || {}),
          ...(currentPlan._postponements || {})
        };
        
        
        adjustedPlan._activityMatches = currentPlan._activityMatches || {};
        adjustedPlan._ratingAnalysis = currentPlan._ratingAnalysis;
        
        // CRITICAL: Ensure any postponed days are explicitly set to null (AI might put workouts back)
        const postponements = adjustedPlan._postponements || {};
        for (const dayName in postponements) {
          if (postponements[dayName] && postponements[dayName].postponed) {
            adjustedPlan[dayName] = null;
          }
        }
        
        // Validate that the plan actually changed
        const originalPlanStr = JSON.stringify({
          monday: currentPlan.monday,
          tuesday: currentPlan.tuesday,
          wednesday: currentPlan.wednesday,
          thursday: currentPlan.thursday,
          friday: currentPlan.friday,
          saturday: currentPlan.saturday,
          sunday: currentPlan.sunday
        });
        const adjustedPlanStr = JSON.stringify({
          monday: adjustedPlan.monday,
          tuesday: adjustedPlan.tuesday,
          wednesday: adjustedPlan.wednesday,
          thursday: adjustedPlan.thursday,
          friday: adjustedPlan.friday,
          saturday: adjustedPlan.saturday,
          sunday: adjustedPlan.sunday
        });
        
        
        if (originalPlanStr === adjustedPlanStr) {
          console.warn('Adjusted plan is identical to original. AI may not have redistributed workouts.');
        } else {
          console.log('Plan successfully adjusted. Workouts redistributed.');
        }
        
        return adjustedPlan;
      }
      throw new Error('No JSON found in response');
    } catch (parseError) {
      console.error('Failed to parse adjusted plan JSON:', parseError);
      console.error('Response content:', content);
      // Return original plan if parsing fails
      return currentPlan;
    }
  } catch (error) {
    console.error('Failed to adjust weekly plan for postponement:', error);
    // Return original plan on error
    return currentPlan;
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

// Detect new activities by comparing with a previously-known activity ID list.
// IMPORTANT: This function does NOT write to storage; callers should update storage after comparison.
export const detectNewActivities = (newActivities, lastKnownIds = []) => {
  if (!Array.isArray(newActivities) || newActivities.length === 0) return [];
  if (!Array.isArray(lastKnownIds) || lastKnownIds.length === 0) return [];

  return newActivities.filter((activity) => !lastKnownIds.includes(activity.id));
};

// Strava functions (keeping existing ones)
export const syncWithStrava = async () => {
  console.log('syncWithStrava called');
  
  // Try to get tokens from Supabase (or platform-specific storage)
  const tokens = await getStravaTokens();
  const token = tokens?.accessToken || null;
  
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
    const activities = await getStravaActivities(token, 15);
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
        const activities = await getStravaActivities(newToken, 15);
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
  // Try to get tokens from Supabase (or platform-specific storage)
  const tokens = await getStravaTokens();
  const refreshToken = tokens?.refreshToken || null;
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

const getStravaActivities = async (token, perPage = 15) => {
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
  const savedPrompt =
    localStorage.getItem('coaching_prompt') || 'You are an expert running coach.';

  // Ensure we have stream data; if not, try to load compact cache from localStorage
  let effectiveStreams = streamData;
  if (!effectiveStreams) {
    const cached = localStorage.getItem(`activity_streams_${activity.id}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const wrap = (arr) => (Array.isArray(arr) ? { data: arr } : { data: [] });
        effectiveStreams = {
          time: wrap(parsed.time),
          velocity_smooth: wrap(parsed.velocity_smooth),
          heartrate: wrap(parsed.heartrate),
          cadence: wrap(parsed.cadence),
          altitude: wrap(parsed.altitude)
        };
      } catch (e) {
        console.warn('Failed to parse cached activity streams for insights:', e);
      }
    }
  }

  const timeArr = effectiveStreams?.time?.data || [];
  const paceStream = effectiveStreams?.velocity_smooth?.data || [];
  const hrStream = effectiveStreams?.heartrate?.data || [];
  const cadenceStream = effectiveStreams?.cadence?.data || [];
  const altitudeStream = effectiveStreams?.altitude?.data || [];

  let paceSeries = [];
  let hrSeries = [];
  let cadenceSeries = [];
  let elevationSeries = [];

  if (timeArr.length > 0) {
    const downsampledPace = downsampleStream(paceStream, timeArr, 60);
    paceSeries = downsampledPace.map((v) => {
      if (!v || !isFinite(v) || v <= 0) return null;
      const paceMinPerMile = 26.8224 / v;
      return Number(paceMinPerMile.toFixed(2));
    });
    hrSeries = downsampleStream(hrStream, timeArr, 60).map((v) =>
      v && isFinite(v) ? Math.round(v) : null
    );
    cadenceSeries = downsampleStream(cadenceStream, timeArr, 60).map((v) =>
      v && isFinite(v) ? Math.round(v * 2) : null
    );
    elevationSeries = downsampleStream(altitudeStream, timeArr, 60).map((v) => {
      if (!v || !isFinite(v)) return null;
      return Math.round(v * 3.28084); // meters -> feet
    });
  }

  const distanceMiles = (activity.distance / 1609.34).toFixed(2);
  const durationMinutes = Math.floor(activity.moving_time / 60);
  const avgPace = formatPace(activity.average_speed);
  const avgHR = activity.average_heartrate || 'N/A';

  const ratingText = rating
    ? `Athlete Rating: ${rating.rating}/5 (1=too easy, 3=perfect, 5=too hard)
Feedback: ${rating.feedback || 'No feedback provided'}
${rating.isInjured ? `Injury Status: ${rating.injuryDetails}` : 'No injuries reported'}`
    : 'No post-run rating provided for this activity.';

  const timeSeriesBlock =
    paceSeries.length > 0
      ? `
TIME SERIES DATA (1 data point per minute of the run):
Pace (min/mi):      [${paceSeries.map((v) => (v == null ? 'null' : v)).join(', ')}]
Heart Rate (bpm):   [${hrSeries.map((v) => (v == null ? 'null' : v)).join(', ')}]
Cadence (spm):      [${cadenceSeries.map((v) => (v == null ? 'null' : v)).join(', ')}]
Elevation (ft):     [${elevationSeries
        .map((v) => (v == null ? 'null' : v))
        .join(', ')}]
`
      : '\nTIME SERIES DATA: Not available for this activity.\n';

  const basePrompt = `${savedPrompt}

You are analyzing a single running activity to provide concise, time-series-aware coaching feedback.

ACTIVITY SUMMARY:
- Name: ${activity.name}
- Distance: ${distanceMiles} miles
- Duration: ${durationMinutes} minutes
- Average Pace: ${avgPace}
- Average Heart Rate: ${avgHR} bpm

${ratingText}
${timeSeriesBlock}

Respond in exactly 3–4 sentences. No headers, no bullet points, no lists.
Write the way a coach would talk to an athlete right after finishing a run.
Cover: (1) one specific observation from the time series data (referencing particular minutes or segments when possible), (2) one thing that went well, (3) one concrete, actionable tip for next time.
Keep the tone direct, personal, and supportive, and avoid generic statements that could apply to any run.`;

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: basePrompt },
        { role: 'user', content: 'Provide 3–4 coaching sentences based on this run.' }
      ],
      temperature: 0.7,
      max_tokens: 250
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

// Downsample a numeric stream to one value per intervalSeconds based on closest timestamp
const downsampleStream = (stream, timeArray, intervalSeconds = 60) => {
  if (!Array.isArray(stream) || !Array.isArray(timeArray)) return [];
  if (stream.length === 0 || timeArray.length === 0) return [];

  const result = [];
  let timeIdx = 0;
  const maxTime = timeArray[timeArray.length - 1];

  for (let target = 0; target <= maxTime; target += intervalSeconds) {
    while (
      timeIdx + 1 < timeArray.length &&
      Math.abs(timeArray[timeIdx + 1] - target) <
        Math.abs(timeArray[timeIdx] - target)
    ) {
      timeIdx += 1;
    }
    const value = stream[timeIdx];
    result.push(
      value !== undefined && value !== null && isFinite(value) ? value : null
    );
  }

  return result;
};

export const getActivityRating = (activityId) => {
  const activityRatings = JSON.parse(localStorage.getItem('activity_ratings') || '{}');
  return activityRatings[activityId] || null;
};

/**
 * WIRING THIS TO THE UI:
 * Add a "Fix Workout" button inside WorkoutDisplay.jsx or the day detail view in WeeklyPlan.jsx.
 * On click, call regenerateDayWorkout() with the current plan, fourWeekSummary, coachingPrompt,
 * and trainingContext. On success, update the weeklyPlan state in App.jsx with the returned plan.
 * Show a loading spinner on the button while the call is in flight.
 * No changes to component files are required as part of this task — just make the function available.
 */
export async function regenerateDayWorkout(
  dayName,
  currentWeekPlan,
  fourWeekSummary,
  coachingPrompt,
  trainingContext
) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY || localStorage.getItem('openai_api_key');
  if (!apiKey) {
    throw new Error('OpenAI API key is required to regenerate a workout.');
  }

  const lowerDayName = dayName.toLowerCase();
  const existingWorkout = currentWeekPlan?.[lowerDayName] || null;

  // Build base prompt from provided trainingContext plus four-week summary
  let basePrompt = trainingContext || (coachingPrompt || 'You are an expert running coach.');
  if (trainingContext && !trainingContext.includes('RECENT TRAINING HISTORY')) {
    basePrompt += formatFourWeekSummaryForPrompt(fourWeekSummary);
  }

  // Reuse block schema and examples by referencing the same requirements used in weekly plan generation
  basePrompt += `

SINGLE DAY WORKOUT REGENERATION:

The workout for ${dayName} in the current weekly plan was too vague and must be regenerated with full detail.

You are given the FULL current weekly plan for context. You MUST NOT change any other day besides "${dayName}". Only regenerate the workout object for "${dayName}" with fully detailed blocks that obey the same schema used for weekly plan generation.

Required block schema (same as weekly plan):
- "distance": string with explicit value and units (e.g., "1.5 mi", "3–4 mi", "800 m"). Never omit this, even for warm-ups.
- "pace": string that is ALWAYS a RANGE, never a single value or vague word like "easy" (e.g., "9:30–10:00 /mi"). For interval blocks, include both interval pace AND recovery pace when appropriate.
- "duration": number of minutes as a NUMBER (e.g., 15).
- "heartRateZone": string with zone label and bpm range (e.g., "Zone 2 (130–145 bpm)").
- "notes": specific coaching cues (form, breathing, fueling, etc.), not generic encouragement.
- "restInterval": REQUIRED field. For interval/speed blocks, this is a string (e.g., "90 sec standing recovery between intervals"). For non-interval blocks (warm-up, cool-down, steady easy miles), this field must be present and set to null.

Every block you generate MUST match this level of detail. Vague instructions like "run at a comfortable pace" or missing fields are NOT acceptable.

CURRENT WEEKLY PLAN (for context only – do NOT modify days other than "${dayName}"):
${JSON.stringify(
    {
      weekTitle: currentWeekPlan.weekTitle,
      monday: currentWeekPlan.monday,
      tuesday: currentWeekPlan.tuesday,
      wednesday: currentWeekPlan.wednesday,
      thursday: currentWeekPlan.thursday,
      friday: currentWeekPlan.friday,
      saturday: currentWeekPlan.saturday,
      sunday: currentWeekPlan.sunday
    },
    null,
    2
  )}

CURRENT "${dayName}" WORKOUT (to be replaced):
${JSON.stringify(existingWorkout || null, null, 2)}

Respond by returning ONLY a JSON object for the regenerated "${dayName}" workout in this shape:
{
  "title": "Workout title",
  "type": "easy" | "speed" | "long",
  "blocks": [ { ...fully detailed blocks as described above... } ]
}
`;

  // Helper to validate just the regenerated day using validatePlanBlocks
  const validateDayWorkout = (dayWorkout, dayKey) => {
    const stubPlan = {
      monday: null,
      tuesday: null,
      wednesday: null,
      thursday: null,
      friday: null,
      saturday: null,
      sunday: null
    };
    stubPlan[dayKey] = dayWorkout;
    return validatePlanBlocks(stubPlan);
  };

  const callModel = async (messages) => {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 800
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    const data = await response.json();
    return data.choices[0].message.content;
  };

  // Initial request to regenerate the specific day
  const systemMessage = { role: 'system', content: basePrompt };
  const userMessage = {
    role: 'user',
    content: `Regenerate ONLY the "${dayName}" workout with fully detailed blocks following the schema. Do not change any other day. Return ONLY the JSON object for the "${dayName}" workout.`
  };

  let messages = [systemMessage, userMessage];
  let retryCount = 0;
  const maxRetries = 2;
  let regeneratedWorkout = null;

  while (retryCount <= maxRetries) {
    const content = await callModel(messages);

    // Extract JSON for the regenerated workout
    let workout;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in regenerateDayWorkout response');
      }
      workout = JSON.parse(jsonMatch[0]);
    } catch (err) {
      retryCount += 1;
      if (retryCount > maxRetries) {
        throw err;
      }
      messages = [
        ...messages,
        { role: 'assistant', content },
        {
          role: 'user',
          content:
            'Your last response was not valid JSON. Please respond again with ONLY the JSON object for the regenerated workout.'
        }
      ];
      continue;
    }

    // Validate just this day
    const validation = validateDayWorkout(workout, lowerDayName);
    if (validation.isValid) {
      regeneratedWorkout = workout;
      break;
    }

    retryCount += 1;
    if (retryCount > maxRetries) {
      regeneratedWorkout = workout; // accept best-effort output
      break;
    }

    const blockFixInstructions = validation.invalidBlocks
      .map((item) => {
        const { blockIndex, block, missingFields } = item;
        const blockJson = JSON.stringify(block, null, 2);
        const missingList = missingFields.map((f) => `- ${f}`).join('\n');
        const exampleBlock = {
          ...block,
          distance: block.distance || '1.5 mi',
          pace: block.pace || '9:30–10:00 /mi',
          duration:
            typeof block.duration === 'number' && isFinite(block.duration)
              ? block.duration
              : 20,
          heartRateZone: block.heartRateZone || 'Zone 2 (130–145 bpm)',
          notes:
            block.notes ||
            'Run relaxed with smooth form. If heart rate drifts above the top of the target range, slow to a jog or brisk walk until it settles.',
          restInterval:
            block.restInterval !== undefined
              ? block.restInterval
              : '90 sec easy walk/jog between intervals'
        };
        const exampleJson = JSON.stringify(exampleBlock, null, 2);

        return `BLOCK TO FIX (blocks[${blockIndex}]):
Current JSON:
${blockJson}

Missing or empty fields:
${missingList}

Example of a corrected version of this block:
${exampleJson}`;
      })
      .join('\n\n');

    const fixPrompt = `The regenerated "${dayName}" workout is missing required fields in some blocks.

You MUST correct ONLY the blocks described below. All other blocks and days should remain unchanged.

Required fields for EVERY block:
- distance (string with units)
- pace (range string, never a single value or vague word)
- duration (number, minutes)
- heartRateZone (zone label and bpm range)
- notes (specific coaching cues)
- restInterval (string for intervals, null for non-interval blocks)

Here are the blocks that need correction:

${blockFixInstructions}

Return ONLY the corrected JSON object for the "${dayName}" workout.`;

    messages = [
      ...messages,
      { role: 'assistant', content: JSON.stringify(workout, null, 2) },
      { role: 'user', content: fixPrompt }
    ];
  }

  if (!regeneratedWorkout) {
    throw new Error('Failed to regenerate workout for the requested day.');
  }

  // Build updated plan with only the specified day changed
  const updatedPlan = {
    ...currentWeekPlan,
    [lowerDayName]: regeneratedWorkout
  };

  // Preserve metadata
  if (currentWeekPlan._postponements) {
    updatedPlan._postponements = currentWeekPlan._postponements;
  }
  if (currentWeekPlan._activityMatches) {
    updatedPlan._activityMatches = currentWeekPlan._activityMatches;
  }
  if (currentWeekPlan._ratingAnalysis) {
    updatedPlan._ratingAnalysis = currentWeekPlan._ratingAnalysis;
  }

  // Compute weekKey (Monday of current week) for storage
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  // Use ISO date format (YYYY-MM-DD) for weekKey
  const weekKey = monday.toISOString().split('T')[0];

  // Save via DataService and localStorage
  const planJson = JSON.stringify(updatedPlan);
  try {
    await dataService.set(`weekly_plan_${weekKey}`, planJson);
  } catch (e) {
    console.error('Failed to save regenerated day workout to Supabase:', e);
  }
  localStorage.setItem(`weekly_plan_${weekKey}`, planJson);

  return updatedPlan;
}
