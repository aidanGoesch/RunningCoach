import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dkpxqlbhmyahjizvastq.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrcHhxbGJobXlhaGppenZhc3RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NjczMzcsImV4cCI6MjA4NTA0MzMzN30.IKL72HO1Xxq2fHFcMrNrM9wUJkJwyFX8tO-ofs0ezu8'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Simple auth for single user
export const ensureUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    // Sign in with a real email format for single user setup
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'runningcoach@example.com',
      password: 'runningcoach123'
    })
    
    if (error && error.message.includes('Invalid login credentials')) {
      // User doesn't exist, create them
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: 'runningcoach@example.com',
        password: 'runningcoach123'
      })
      if (signUpError) throw signUpError
      return signUpData.user
    }
    
    if (error) throw error
    return data.user
  }
  
  return user
}

// Data abstraction layer
export class DataService {
  constructor(useSupabase = false) {
    this.useSupabase = useSupabase
  }

  async get(key) {
    if (!this.useSupabase) {
      return localStorage.getItem(key)
    }

    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Supabase timeout')), 5000)
      );

      const user = await ensureUser()
      
      // Map localStorage keys to Supabase tables
      let dataPromise;
      switch (key) {
        case 'coaching_prompt':
          dataPromise = supabase
            .from('coaching_prompts')
            .select('prompt_text')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .single()
          break;

        case 'strava_activities':
          dataPromise = supabase
            .from('strava_activities')
            .select('activity_data')
            .eq('user_id', user.id)
            .order('synced_at', { ascending: false })
          break;

        case 'activity_ratings':
          dataPromise = supabase
            .from('workout_ratings')
            .select('strava_activity_id, rating, feedback, is_injured, injury_details')
            .eq('user_id', user.id)
          break;

        case 'current_workout':
          dataPromise = supabase
            .from('current_workouts')
            .select('workout_data')
            .eq('user_id', user.id)
            .eq('workout_date', new Date().toISOString().split('T')[0])
            .single()
          break;

        default:
          if (key.startsWith('weekly_plan_')) {
            const weekStart = key.replace('weekly_plan_', '')
            dataPromise = supabase
              .from('weekly_plans')
              .select('plan_data')
              .eq('user_id', user.id)
              .eq('week_start_date', weekStart)
              .single()
          } else if (key.startsWith('activity_insights_')) {
            const activityId = key.replace('activity_insights_', '')
            dataPromise = supabase
              .from('activity_insights')
              .select('insights_text')
              .eq('strava_activity_id', parseInt(activityId))
              .single()
          } else {
            return localStorage.getItem(key)
          }
      }

      const { data } = await Promise.race([dataPromise, timeoutPromise]);

      // Process the response based on key type
      switch (key) {
        case 'coaching_prompt':
          return data?.prompt_text || null;
        case 'strava_activities':
          return JSON.stringify(data?.map(a => a.activity_data) || []);
        case 'activity_ratings':
          const ratingsObj = {}
          data?.forEach(r => {
            ratingsObj[r.strava_activity_id] = {
              rating: r.rating,
              feedback: r.feedback,
              isInjured: r.is_injured,
              injuryDetails: r.injury_details
            }
          })
          return JSON.stringify(ratingsObj);
        case 'current_workout':
          return data ? JSON.stringify(data.workout_data) : null;
        default:
          if (key.startsWith('weekly_plan_')) {
            return data ? JSON.stringify(data.plan_data) : null;
          } else if (key.startsWith('activity_insights_')) {
            return data?.insights_text || null;
          }
          return null;
      }
    } catch (error) {
      console.error(`Supabase get error for ${key}:`, error);
      // Fallback to localStorage on error
      return localStorage.getItem(key);
    }
  }

  async set(key, value) {
    if (!this.useSupabase) {
      localStorage.setItem(key, value)
      return
    }

    const user = await ensureUser()

    switch (key) {
      case 'coaching_prompt':
        await supabase
          .from('coaching_prompts')
          .upsert({
            user_id: user.id,
            prompt_text: value,
            is_active: true
          })
        break

      case 'strava_activities':
        const activities = JSON.parse(value || '[]')
        for (const activity of activities) {
          await supabase
            .from('strava_activities')
            .upsert({
              user_id: user.id,
              strava_activity_id: activity.id,
              activity_data: activity
            })
        }
        break

      case 'current_workout':
        await supabase
          .from('current_workouts')
          .upsert({
            user_id: user.id,
            workout_date: new Date().toISOString().split('T')[0],
            workout_data: JSON.parse(value)
          })
        break

      default:
        if (key.startsWith('weekly_plan_')) {
          const weekStart = key.replace('weekly_plan_', '')
          await supabase
            .from('weekly_plans')
            .upsert({
              user_id: user.id,
              week_start_date: weekStart,
              plan_data: JSON.parse(value)
            })
        } else if (key.startsWith('activity_insights_')) {
          const activityId = key.replace('activity_insights_', '')
          await supabase
            .from('activity_insights')
            .upsert({
              user_id: user.id,
              strava_activity_id: parseInt(activityId),
              insights_text: value
            })
        } else {
          localStorage.setItem(key, value)
        }
    }
  }

  async remove(key) {
    if (!this.useSupabase) {
      localStorage.removeItem(key)
      return
    }

    const user = await ensureUser()

    switch (key) {
      case 'coaching_prompt':
        await supabase
          .from('coaching_prompts')
          .update({ is_active: false })
          .eq('user_id', user.id)
        break

      default:
        if (key.startsWith('weekly_plan_')) {
          const weekStart = key.replace('weekly_plan_', '')
          await supabase
            .from('weekly_plans')
            .delete()
            .eq('user_id', user.id)
            .eq('week_start_date', weekStart)
        } else {
          localStorage.removeItem(key)
        }
    }
  }
}

// Global instance - will switch to Supabase after migration
export const dataService = new DataService(false)

// Migration functions
export const migrateToSupabase = async (exportedData) => {
  console.log('Starting migration with data:', exportedData);
  const user = await ensureUser()
  console.log('User:', user);
  
  try {
    // First, ensure user exists in users table
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single()
    
    if (!existingUser) {
      console.log('Creating user record...');
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email || 'runningcoach@example.com'
        })
      if (userError) {
        console.error('User creation error:', userError);
        throw userError;
      }
      console.log('User record created');
    }

    // Migrate coaching prompt
    if (exportedData.data.coaching_prompt) {
      console.log('Migrating coaching prompt...');
      
      // Check if prompt exists
      const { data: existing } = await supabase
        .from('coaching_prompts')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single()
      
      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('coaching_prompts')
          .update({ prompt_text: exportedData.data.coaching_prompt })
          .eq('id', existing.id)
        if (error) throw error
      } else {
        // Insert new
        const { error } = await supabase
          .from('coaching_prompts')
          .insert({
            user_id: user.id,
            prompt_text: exportedData.data.coaching_prompt,
            is_active: true
          })
        if (error) throw error
      }
      console.log('Coaching prompt migrated');
    }

    // Migrate Strava activities
    if (exportedData.data.strava_activities) {
      console.log('Migrating Strava activities...');
      const activities = JSON.parse(exportedData.data.strava_activities);
      console.log('Found', activities.length, 'activities');
      
      for (const activity of activities) {
        // Check if activity exists
        const { data: existing } = await supabase
          .from('strava_activities')
          .select('id')
          .eq('strava_activity_id', activity.id)
          .single()
        
        if (!existing) {
          // Only insert if doesn't exist
          const { error } = await supabase
            .from('strava_activities')
            .insert({
              user_id: user.id,
              strava_activity_id: activity.id,
              activity_data: activity
            })
          if (error) {
            console.error('Activity error for', activity.id, ':', error);
          } else {
            console.log('Migrated activity:', activity.id);
          }
        } else {
          console.log('Activity already exists:', activity.id);
        }
      }
    }

    // Migrate weekly plans
    if (exportedData.data.weekly_plans) {
      console.log('Migrating weekly plans...');
      for (const [key, value] of Object.entries(exportedData.data.weekly_plans)) {
        let weekStart = key.replace('weekly_plan_', '');
        
        // Fix malformed dates (e.g., "2026-0-26" -> "2026-01-26")
        const dateParts = weekStart.split('-');
        if (dateParts.length === 3) {
          const year = dateParts[0];
          let month = parseInt(dateParts[1]);
          let day = parseInt(dateParts[2]);
          
          // Fix month 0 to month 1 (January)
          if (month === 0) month = 1;
          
          // Ensure valid ranges
          if (month < 1) month = 1;
          if (month > 12) month = 12;
          if (day < 1) day = 1;
          if (day > 31) day = 31;
          
          weekStart = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        }
        
        console.log('Processing weekly plan for:', weekStart);
        
        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
          console.error('Invalid date format:', weekStart, 'skipping...');
          continue;
        }
        
        // Check if plan exists (ignore errors, just try to insert)
        try {
          const { data: existing } = await supabase
            .from('weekly_plans')
            .select('id')
            .eq('user_id', user.id)
            .eq('week_start_date', weekStart)
            .single()
          
          if (existing) {
            // Update existing
            const { error } = await supabase
              .from('weekly_plans')
              .update({ plan_data: JSON.parse(value) })
              .eq('id', existing.id)
            if (error) {
              console.error('Weekly plan update error for', weekStart, ':', error);
            }
          } else {
            // Insert new
            const { error } = await supabase
              .from('weekly_plans')
              .insert({
                user_id: user.id,
                week_start_date: weekStart,
                plan_data: JSON.parse(value)
              })
            if (error) {
              console.error('Weekly plan insert error for', weekStart, ':', error);
            }
          }
        } catch (queryError) {
          // If query fails, just try to insert
          console.log('Query failed, attempting direct insert for', weekStart);
          const { error } = await supabase
            .from('weekly_plans')
            .insert({
              user_id: user.id,
              week_start_date: weekStart,
              plan_data: JSON.parse(value)
            })
          if (error) {
            console.error('Weekly plan insert error for', weekStart, ':', error);
          }
        }
        console.log('Migrated weekly plan:', weekStart);
      }
    }

    // Migrate workout ratings
    if (exportedData.data.activity_ratings) {
      console.log('Migrating workout ratings...');
      const ratings = JSON.parse(exportedData.data.activity_ratings);
      console.log('Found', Object.keys(ratings).length, 'ratings');
      
      for (const [activityId, rating] of Object.entries(ratings)) {
        const numericActivityId = parseInt(activityId);
        
        // Skip activity ID 0 or invalid IDs (these are unmatched workouts)
        if (numericActivityId <= 0) {
          console.log('Skipping invalid activity ID:', activityId);
          continue;
        }
        
        const { error } = await supabase
          .from('workout_ratings')
          .insert({
            user_id: user.id,
            strava_activity_id: numericActivityId,
            rating: rating.rating,
            feedback: rating.feedback || null,
            is_injured: rating.isInjured || false,
            injury_details: rating.injuryDetails || null
          })
        if (error) {
          console.error('Rating insert error for', activityId, ':', error);
        } else {
          console.log('Migrated rating for activity:', activityId);
        }
      }
    }

    // Migrate workout feedback
    if (exportedData.data.workout_feedback) {
      console.log('Migrating workout feedback...');
      const feedback = JSON.parse(exportedData.data.workout_feedback);
      console.log('Found', Object.keys(feedback).length, 'feedback entries');
      
      for (const [activityId, feedbackData] of Object.entries(feedback)) {
        const numericActivityId = parseInt(activityId);
        
        // Skip activity ID 0 or invalid IDs
        if (numericActivityId <= 0) {
          console.log('Skipping invalid activity ID:', activityId);
          continue;
        }
        
        // Check if we already have a rating for this activity
        try {
          const { data: existingRating } = await supabase
            .from('workout_ratings')
            .select('id')
            .eq('strava_activity_id', numericActivityId)
            .single()
          
          if (!existingRating) {
            const { error } = await supabase
              .from('workout_ratings')
              .insert({
                user_id: user.id,
                strava_activity_id: numericActivityId,
                rating: feedbackData.rating || 3,
                feedback: feedbackData.feedback || null,
                is_injured: feedbackData.isInjured || false,
                injury_details: feedbackData.injuryDetails || null
              })
            if (error) {
              console.error('Feedback insert error for', activityId, ':', error);
            } else {
              console.log('Migrated feedback for activity:', activityId);
            }
          }
        } catch (queryError) {
          console.log('Query failed for activity', activityId, ', skipping...');
        }
      }
    }

    // Migrate activity insights
    if (exportedData.data.activity_insights) {
      console.log('Migrating activity insights...');
      for (const [key, value] of Object.entries(exportedData.data.activity_insights)) {
        const activityId = key.replace('activity_insights_', '');
        const numericActivityId = parseInt(activityId);
        
        // Skip invalid activity IDs
        if (numericActivityId <= 0) {
          console.log('Skipping invalid insights for activity ID:', activityId);
          continue;
        }
        
        // Check if insights already exist
        const { data: existing } = await supabase
          .from('activity_insights')
          .select('id')
          .eq('strava_activity_id', numericActivityId)
          .single()
        
        if (!existing) {
          const { error } = await supabase
            .from('activity_insights')
            .insert({
              user_id: user.id,
              strava_activity_id: numericActivityId,
              insights_text: value
            })
          if (error) {
            console.error('Insights insert error for', activityId, ':', error);
          } else {
            console.log('Migrated insights for activity:', activityId);
          }
        } else {
          console.log('Insights already exist for activity:', activityId);
        }
      }
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }

  // Switch to Supabase mode
  dataService.useSupabase = true
  localStorage.setItem('use_supabase', 'true')
}

export const enableSupabase = () => {
  dataService.useSupabase = true
  localStorage.setItem('use_supabase', 'true')
}

// Helper functions for specific operations
export const getActivityInsights = async (activityId) => {
  if (!dataService.useSupabase) {
    return localStorage.getItem(`activity_insights_${activityId}`)
  }
  
  const { data } = await supabase
    .from('activity_insights')
    .select('insights_text')
    .eq('strava_activity_id', activityId)
    .single()
  
  return data?.insights_text || null
}

export const saveActivityInsights = async (activityId, insights) => {
  if (!dataService.useSupabase) {
    localStorage.setItem(`activity_insights_${activityId}`, insights)
    return
  }
  
  const user = await ensureUser()
  await supabase
    .from('activity_insights')
    .upsert({
      user_id: user.id,
      strava_activity_id: activityId,
      insights_text: insights
    })
}

export const saveActivityRating = async (activityId, rating, feedback, isInjured, injuryDetails) => {
  if (!dataService.useSupabase) {
    const ratings = JSON.parse(localStorage.getItem('activity_ratings') || '{}')
    ratings[activityId] = { rating, feedback, isInjured, injuryDetails }
    localStorage.setItem('activity_ratings', JSON.stringify(ratings))
    return
  }
  
  const user = await ensureUser()
  await supabase
    .from('workout_ratings')
    .upsert({
      user_id: user.id,
      strava_activity_id: activityId,
      rating,
      feedback,
      is_injured: isInjured,
      injury_details: injuryDetails
    })
}

// Initialize on load - check if migration completed
if (localStorage.getItem('use_supabase') === 'true') {
  dataService.useSupabase = true
}
