import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

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

    const user = await ensureUser()
    
    // Map localStorage keys to Supabase tables
    switch (key) {
      case 'coaching_prompt':
        const { data } = await supabase
          .from('coaching_prompts')
          .select('prompt_text')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single()
        return data?.prompt_text || null

      case 'strava_activities':
        const { data: activities } = await supabase
          .from('strava_activities')
          .select('activity_data')
          .eq('user_id', user.id)
          .order('synced_at', { ascending: false })
        return JSON.stringify(activities?.map(a => a.activity_data) || [])

      default:
        if (key.startsWith('weekly_plan_')) {
          const weekStart = key.replace('weekly_plan_', '')
          const { data: plan } = await supabase
            .from('weekly_plans')
            .select('plan_data')
            .eq('user_id', user.id)
            .eq('week_start_date', weekStart)
            .single()
          return plan ? JSON.stringify(plan.plan_data) : null
        }
        return localStorage.getItem(key)
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
        const { error } = await supabase
          .from('workout_ratings')
          .insert({
            user_id: user.id,
            strava_activity_id: parseInt(activityId),
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
        // Check if we already have a rating for this activity
        const { data: existingRating } = await supabase
          .from('workout_ratings')
          .select('id')
          .eq('strava_activity_id', parseInt(activityId))
          .single()
        
        if (!existingRating) {
          const { error } = await supabase
            .from('workout_ratings')
            .insert({
              user_id: user.id,
              strava_activity_id: parseInt(activityId),
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

// Initialize on load
if (localStorage.getItem('use_supabase') === 'true') {
  dataService.useSupabase = true
}
