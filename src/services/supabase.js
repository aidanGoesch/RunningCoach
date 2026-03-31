import { createClient } from '@supabase/supabase-js'
import { getWeekKey } from '../utils/weekKey'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dkpxqlbhmyahjizvastq.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrcHhxbGJobXlhaGppenZhc3RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NjczMzcsImV4cCI6MjA4NTA0MzMzN30.IKL72HO1Xxq2fHFcMrNrM9wUJkJwyFX8tO-ofs0ezu8'
const appUserEmail = import.meta.env.VITE_SUPABASE_APP_USER_EMAIL || 'runningcoach@example.com'
const appUserPassword = import.meta.env.VITE_SUPABASE_APP_USER_PASSWORD || 'runningcoach123'

export const supabase = createClient(supabaseUrl, supabaseKey)

const signInOrCreateAppUser = async () => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: appUserEmail,
    password: appUserPassword
  })

  if (error && error.message.includes('Invalid login credentials')) {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: appUserEmail,
      password: appUserPassword
    })
    if (signUpError) throw signUpError
    return signUpData.user
  }

  if (error) throw error
  return data.user
}

// Simple auth for single user
export const ensureUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  
  // Force app to use the configured single app user.
  // This avoids stale sessions for another Supabase user causing token lookups to miss.
  if (user && user.email && user.email !== appUserEmail) {
    await supabase.auth.signOut()
    return signInOrCreateAppUser()
  }
  
  if (!user) {
    return signInOrCreateAppUser()
  }

  return user
}

// Data abstraction layer
export class DataService {
  constructor(useSupabase = false) {
    this.useSupabase = useSupabase
    this.coachStatesMissing = false
  }

  isCoachStateKey(key) {
    return key === 'coach_agent_context' || key === 'coach_chat_history' || key === 'coach_chat_meta'
  }

  isMissingRelationError(error, status) {
    const code = error?.code || ''
    const message = error?.message || ''
    return status === 404 || code === 'PGRST205' || /coach_states/i.test(message)
  }

  async get(key) {
    if (!this.useSupabase) {
      // LocalStorage-only fallback
      if (key.startsWith('recovery_workout_')) {
        return localStorage.getItem(key)
      }
      return localStorage.getItem(key)
    }
    if (this.coachStatesMissing && this.isCoachStateKey(key)) {
      return localStorage.getItem(key)
    }

    try {
      // Add timeout to prevent hanging - wrap ensureUser in timeout too
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Supabase timeout')), 5000)
      );

      // Race ensureUser against timeout to prevent hanging
      const user = await Promise.race([ensureUser(), timeoutPromise]);
      
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
            .maybeSingle()
          break;

        case 'coach_agent_context':
          dataPromise = supabase
            .from('coach_states')
            .select('context_data')
            .eq('user_id', user.id)
            .maybeSingle()
          break;

        case 'coach_chat_history':
          dataPromise = supabase
            .from('coach_states')
            .select('chat_history')
            .eq('user_id', user.id)
            .maybeSingle()
          break;

        case 'coach_chat_meta':
          dataPromise = supabase
            .from('coach_states')
            .select('meta_data')
            .eq('user_id', user.id)
            .maybeSingle()
          break;

        default:
          if (key.startsWith('weekly_plan_')) {
            const weekStart = key.replace('weekly_plan_', '')
            dataPromise = supabase
              .from('weekly_plans')
              .select('plan_data')
              .eq('user_id', user.id)
              .eq('week_start_date', weekStart)
              .maybeSingle()
          } else if (key.startsWith('weekly_analysis_')) {
            const weekStart = key.replace('weekly_analysis_', '')
            dataPromise = supabase
              .from('weekly_plans')
              .select('weekly_analysis')
              .eq('user_id', user.id)
              .eq('week_start_date', weekStart)
              .maybeSingle()
          } else if (key.startsWith('activity_insights_')) {
            const activityId = key.replace('activity_insights_', '')
            dataPromise = supabase
              .from('activity_insights')
              .select('insights_text')
              .eq('strava_activity_id', parseInt(activityId))
              .maybeSingle()
          } else if (key.startsWith('recovery_workout_')) {
            const workoutDate = key.replace('recovery_workout_', '')
            dataPromise = supabase
              .from('recovery_workouts')
              .select('recovery_data, completed')
              .eq('user_id', user.id)
              .eq('workout_date', workoutDate)
              .single()
          } else {
            return localStorage.getItem(key)
          }
      }

      // Race the data promise against timeout (ensureUser already raced above)
      const response = await Promise.race([dataPromise, timeoutPromise]);
      const { data, error, status } = response || {};
      if (error) {
        if (this.isCoachStateKey(key) && this.isMissingRelationError(error, status)) {
          this.coachStatesMissing = true;
          return localStorage.getItem(key);
        }
        throw error;
      }

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
        case 'coach_agent_context':
          return data?.context_data ? JSON.stringify(data.context_data) : null;
        case 'coach_chat_history':
          return data?.chat_history ? JSON.stringify(data.chat_history) : null;
        case 'coach_chat_meta':
          return data?.meta_data ? JSON.stringify(data.meta_data) : null;
        default:
          if (key.startsWith('weekly_analysis_')) {
            return data?.weekly_analysis || null;
          } else if (key.startsWith('weekly_plan_')) {
            if (data && data.plan_data) {
              const planData = data.plan_data;
              console.log('[Supabase Get] Loaded plan_data has _updatedAt:', !!planData._updatedAt, planData._updatedAt, 'Has _postponements:', !!planData._postponements);
              return JSON.stringify(planData);
            }
            return null;
          } else if (key.startsWith('activity_insights_')) {
            return data?.insights_text || null;
          } else if (key.startsWith('recovery_workout_')) {
            return data ? JSON.stringify({
              workout: data.recovery_data,
              completed: !!data.completed
            }) : null;
          }
          return null;
      }
    } catch (error) {
      // Only log non-timeout errors to reduce noise
      if (error.message !== 'Supabase timeout') {
        console.error(`Supabase get error for ${key}:`, error);
      }
      // Fallback to localStorage on error
      return localStorage.getItem(key);
    }
  }

  async set(key, value) {
    console.log('[DataService Set] Called with key:', key, 'useSupabase:', this.useSupabase);
    if (!this.useSupabase) {
      console.log('[DataService Set] Supabase disabled, saving to localStorage only');
      localStorage.setItem(key, value)
      return
    }
    if (this.coachStatesMissing && this.isCoachStateKey(key)) {
      localStorage.setItem(key, value)
      return
    }

    try {
      console.log('[DataService Set] Supabase enabled, proceeding with save');
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Supabase timeout')), 5000)
      );
      
      // Race ensureUser against timeout to prevent hanging
      const user = await Promise.race([ensureUser(), timeoutPromise]);

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

        case 'coach_agent_context': {
          const parsedValue = value ? JSON.parse(value) : {}
          const { error, status } = await supabase
            .from('coach_states')
            .upsert({
              user_id: user.id,
              context_data: parsedValue || {},
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'user_id'
            })
          if (error) {
            if (this.isMissingRelationError(error, status)) {
              this.coachStatesMissing = true;
              localStorage.setItem(key, value || JSON.stringify({}))
              break
            }
            throw error
          }
          localStorage.setItem(key, value || JSON.stringify({}))
          break
        }

        case 'coach_chat_history': {
          const parsedValue = value ? JSON.parse(value) : []
          const { error, status } = await supabase
            .from('coach_states')
            .upsert({
              user_id: user.id,
              chat_history: Array.isArray(parsedValue) ? parsedValue : [],
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'user_id'
            })
          if (error) {
            if (this.isMissingRelationError(error, status)) {
              this.coachStatesMissing = true;
              localStorage.setItem(key, value || JSON.stringify([]))
              break
            }
            throw error
          }
          localStorage.setItem(key, value || JSON.stringify([]))
          break
        }

        case 'coach_chat_meta': {
          const parsedValue = value ? JSON.parse(value) : {}
          const { error, status } = await supabase
            .from('coach_states')
            .upsert({
              user_id: user.id,
              meta_data: parsedValue || {},
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'user_id'
            })
          if (error) {
            if (this.isMissingRelationError(error, status)) {
              this.coachStatesMissing = true;
              localStorage.setItem(key, value || JSON.stringify({}))
              break
            }
            throw error
          }
          localStorage.setItem(key, value || JSON.stringify({}))
          break
        }

        case 'strava_activities': {
          const activities = JSON.parse(value || '[]')
          if (activities.length === 0) break
          const activityIds = activities.map(a => a.id).filter(Boolean)
          const { data: existingRows } = await supabase
            .from('strava_activities')
            .select('id, strava_activity_id')
            .eq('user_id', user.id)
            .in('strava_activity_id', activityIds)
          const existingByStravaId = new Map((existingRows || []).map(r => [r.strava_activity_id, r.id]))
          const toInsert = []
          const toUpdate = []
          for (const activity of activities) {
            if (!activity.id) continue
            const row = {
              user_id: user.id,
              strava_activity_id: activity.id,
              activity_data: activity
            }
            if (existingByStravaId.has(activity.id)) {
              toUpdate.push({ id: existingByStravaId.get(activity.id), activity })
            } else {
              toInsert.push(row)
            }
          }
          if (toInsert.length > 0) {
            const { error: insertErr } = await supabase
              .from('strava_activities')
              .insert(toInsert)
            if (insertErr) console.error('Error inserting activities:', insertErr)
          }
          await Promise.all(
            toUpdate.map(({ id, activity }) =>
              supabase
                .from('strava_activities')
                .update({ activity_data: activity })
                .eq('id', id)
            )
          )
          break
        }

      case 'current_workout':
        if (value === null || value === 'null') {
          // Clear current workout
          await supabase
            .from('current_workouts')
            .delete()
            .eq('user_id', user.id)
        } else {
          await supabase
            .from('current_workouts')
            .upsert({
              user_id: user.id,
              workout_date: new Date().toISOString().split('T')[0],
              workout_data: JSON.parse(value)
            })
        }
        break

      default:
        if (key.startsWith('weekly_plan_')) {
          const weekStart = key.replace('weekly_plan_', '')
          const planData = JSON.parse(value)
          console.log('[Supabase Set] Saving weekly plan with weekStart:', weekStart);
          console.log('[Supabase Set] Plan data keys:', Object.keys(planData));
          console.log('[Supabase Set] Plan has _updatedAt:', !!planData._updatedAt, planData._updatedAt);
          console.log('[Supabase Set] Plan has _postponements:', !!planData._postponements, planData._postponements);
          console.log('[Supabase Set] Full plan_data being saved:', JSON.stringify(planData).substring(0, 200));
          
          const { data, error } = await supabase
            .from('weekly_plans')
            .upsert({
              user_id: user.id,
              week_start_date: weekStart,
              plan_data: planData
            }, {
              onConflict: 'user_id,week_start_date'
            })
          
          if (error) {
            console.error('[Supabase Set] Error saving weekly plan:', error);
            throw error;
          } else {
            console.log('[Supabase Set] Successfully saved weekly plan, returned data:', data);
            
            // Verify what was actually saved
            const { data: verifyData, error: verifyError } = await supabase
              .from('weekly_plans')
              .select('plan_data')
              .eq('user_id', user.id)
              .eq('week_start_date', weekStart)
              .single();
            
            if (verifyError) {
              console.error('[Supabase Set] Error verifying save:', verifyError);
            } else if (verifyData && verifyData.plan_data) {
              console.log('[Supabase Set] Verified saved plan_data has _updatedAt:', !!verifyData.plan_data._updatedAt, verifyData.plan_data._updatedAt);
              console.log('[Supabase Set] Verified saved plan_data has _postponements:', !!verifyData.plan_data._postponements);
            }
          }
        } else if (key.startsWith('weekly_analysis_')) {
          const weekStart = key.replace('weekly_analysis_', '')
          // Prefer update to avoid 400s on schemas where plan_data is required.
          const updateResult = await supabase
            .from('weekly_plans')
            .update({
              weekly_analysis: value
            })
            .eq('user_id', user.id)
            .eq('week_start_date', weekStart)
            .select('id')

          if (updateResult.error) {
            throw updateResult.error
          }

          if ((updateResult.data || []).length === 0) {
            // Fallback for missing row.
            const { error } = await supabase
            .from('weekly_plans')
            .upsert({
              user_id: user.id,
              week_start_date: weekStart,
              weekly_analysis: value
            }, {
              onConflict: 'user_id,week_start_date'
            })

            if (error) {
              throw error
            }
          }
        } else if (key.startsWith('activity_insights_')) {
          const activityId = key.replace('activity_insights_', '')
          await supabase
            .from('activity_insights')
            .upsert({
              user_id: user.id,
              strava_activity_id: parseInt(activityId),
              insights_text: value
            })
        } else if (key.startsWith('recovery_workout_')) {
          const workoutDate = key.replace('recovery_workout_', '')
          const parsed = value === null || value === 'null' ? null : JSON.parse(value || 'null')
          if (!parsed) {
            await supabase
              .from('recovery_workouts')
              .delete()
              .eq('user_id', user.id)
              .eq('workout_date', workoutDate)
          } else {
            await supabase
              .from('recovery_workouts')
              .upsert({
                user_id: user.id,
                workout_date: workoutDate,
                recovery_data: parsed.workout,
                completed: !!parsed.completed
              })
          }
        } else {
          localStorage.setItem(key, value)
        }
      }
    } catch (error) {
      // Only log non-timeout errors to reduce noise
      if (error.message !== 'Supabase timeout') {
        console.error(`Supabase set error for ${key}:`, error);
      }
      // Fallback to localStorage on error
      localStorage.setItem(key, value);
    }
  }

  async remove(key) {
    if (!this.useSupabase) {
      localStorage.removeItem(key)
      return
    }
    if (this.coachStatesMissing && this.isCoachStateKey(key)) {
      localStorage.removeItem(key)
      return
    }

    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Supabase timeout')), 5000)
      );
      
      // Race ensureUser against timeout to prevent hanging
      const user = await Promise.race([ensureUser(), timeoutPromise]);

    switch (key) {
      case 'coaching_prompt':
        await supabase
          .from('coaching_prompts')
          .update({ is_active: false })
          .eq('user_id', user.id)
        break

      case 'coach_agent_context':
        {
          const { error, status } = await supabase
          .from('coach_states')
          .upsert({
            user_id: user.id,
            context_data: {},
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          })
          if (error) {
            if (this.isMissingRelationError(error, status)) {
              this.coachStatesMissing = true;
            } else {
              throw error
            }
          }
        }
        localStorage.removeItem(key)
        break

      case 'coach_chat_history':
        {
          const { error, status } = await supabase
          .from('coach_states')
          .upsert({
            user_id: user.id,
            chat_history: [],
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          })
          if (error) {
            if (this.isMissingRelationError(error, status)) {
              this.coachStatesMissing = true;
            } else {
              throw error
            }
          }
        }
        localStorage.removeItem(key)
        break

      case 'coach_chat_meta':
        {
          const { error, status } = await supabase
          .from('coach_states')
          .upsert({
            user_id: user.id,
            meta_data: {},
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          })
          if (error) {
            if (this.isMissingRelationError(error, status)) {
              this.coachStatesMissing = true;
            } else {
              throw error
            }
          }
        }
        localStorage.removeItem(key)
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
    } catch (error) {
      // Only log non-timeout errors to reduce noise
      if (error.message !== 'Supabase timeout') {
        console.error(`Supabase remove error for ${key}:`, error);
      }
      // Fallback to localStorage on error
      localStorage.removeItem(key);
    }
  }
}

// Check if we're on a mobile platform (Capacitor)
const isMobilePlatform = () => {
  try {
    // Check if Capacitor is available (might be loaded asynchronously)
    if (typeof window !== 'undefined') {
      // Check for Capacitor in window
      if (window.Capacitor && window.Capacitor.isNativePlatform) {
        return window.Capacitor.isNativePlatform();
      }
      // Check for Capacitor in global scope (ES modules)
      if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform) {
        return Capacitor.isNativePlatform();
      }
    }
    // Fallback: check user agent for mobile (but this is less reliable)
    // We'll primarily rely on the use_supabase flag for web
    return false;
  } catch {
    return false;
  }
};

// Global instance - enable Supabase by default on mobile, localStorage on web
// On mobile, we always want to sync with Supabase for cross-device sync
const shouldUseSupabase = () => {
  // Check localStorage preference first (user override)
  const preference = localStorage.getItem('use_supabase');
  if (preference === 'true') return true;
  if (preference === 'false') return false;
  
  // Default: use Supabase on mobile, localStorage on web
  // We'll check this at runtime when needed, not at module load
  return true; // Default to true, cloud sync enabled by default
};

export const dataService = new DataService(shouldUseSupabase())

// Enable Supabase on mobile platforms after Capacitor loads
if (typeof window !== 'undefined') {
  // Check for mobile platform after a short delay to allow Capacitor to load
  setTimeout(() => {
    try {
      // Check if Capacitor is available (injected by native app at runtime)
      // No import needed - Capacitor is available globally in native apps
      if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
        console.log('Mobile platform detected, enabling Supabase sync');
        dataService.useSupabase = true;
        localStorage.setItem('use_supabase', 'true');
      } else {
        // Not in native environment, check user preference
        const preference = localStorage.getItem('use_supabase');
        if (preference === 'true') {
          dataService.useSupabase = true;
        }
      }
    } catch (err) {
      // Ignore errors, will use localStorage
      console.log('Could not detect mobile platform, using localStorage');
    }
  }, 100);
}

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
          email: user.email || appUserEmail
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
        
        let parsedPlan;
        try {
          parsedPlan = JSON.parse(value);
        } catch (parseError) {
          console.error('Invalid weekly plan JSON for', weekStart, ':', parseError);
          continue;
        }

        // Use upsert to ensure we only keep one row per user/week.
        try {
          const { error } = await supabase
            .from('weekly_plans')
            .upsert({
              user_id: user.id,
              week_start_date: weekStart,
              plan_data: parsedPlan
            }, {
              onConflict: 'user_id,week_start_date'
            })

          if (error) {
            console.error('Weekly plan upsert error for', weekStart, ':', error);
          }
        } catch (queryError) {
          console.error('Weekly plan upsert failed for', weekStart, ':', queryError);
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

// Helper to fetch recent recovery workouts (Supabase or localStorage)
export const getRecentRecoveryWorkouts = async (days = 3) => {
  const results = []
  const today = new Date()

  if (!dataService.useSupabase) {
    for (let i = 0; i < days; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const dateKey = d.toISOString().split('T')[0]
      const stored = localStorage.getItem(`recovery_workout_${dateKey}`)
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          results.push({
            date: dateKey,
            workout: parsed.workout,
            completed: !!parsed.completed
          })
        } catch {
          // Ignore malformed entries
        }
      }
    }
    return results
  }

  const user = await ensureUser()
  const endDate = today.toISOString().split('T')[0]
  const start = new Date(today)
  start.setDate(today.getDate() - (days - 1))
  const startDate = start.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('recovery_workouts')
    .select('workout_date, recovery_data, completed')
    .eq('user_id', user.id)
    .gte('workout_date', startDate)
    .lte('workout_date', endDate)
    .order('workout_date', { ascending: false })

  if (error) {
    console.error('Error fetching recent recovery workouts:', error)
    return results
  }

  return (data || []).map(row => ({
    date: row.workout_date,
    workout: row.recovery_data,
    completed: !!row.completed
  }))
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
    .maybeSingle()

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

export const getActivityRating = async (activityId) => {
  // First check localStorage
  const localRatings = JSON.parse(localStorage.getItem('activity_ratings') || '{}');
  if (localRatings[activityId]) {
    return localRatings[activityId];
  }
  
  // If using Supabase, check there too
  if (dataService.useSupabase) {
    try {
      const user = await ensureUser();
      const { data, error } = await supabase
        .from('workout_ratings')
        .select('rating, feedback, is_injured, injury_details')
        .eq('user_id', user.id)
        .eq('strava_activity_id', parseInt(activityId))
        .maybeSingle();

      if (error) {
        console.error('Error fetching rating:', error);
        return null;
      }
      
      if (data) {
        return {
          rating: data.rating,
          feedback: data.feedback,
          isInjured: data.is_injured,
          injuryDetails: data.injury_details
        };
      }
    } catch (err) {
      console.error('Error getting activity rating:', err);
    }
  }
  
  return null;
};

export const getActivityRatings = async () => {
  // If not using Supabase, return empty array
  if (!dataService.useSupabase) {
    return [];
  }

  try {
    // Add timeout to prevent hanging - fail fast if Supabase is unavailable
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Supabase timeout')), 8000)
    );

    const fetchRatings = async () => {
      const user = await ensureUser();
      const { data, error } = await supabase
        .from('workout_ratings')
        .select('strava_activity_id, rating, feedback, is_injured, injury_details')
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Error fetching activity ratings from Supabase:', error);
        return [];
      }

      let rows = data || [];

      // If no rows for current user, attempt a broad fallback read.
      // This helps recover ratings when auth identity drifted across devices.
      if (rows.length === 0) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('workout_ratings')
          .select('strava_activity_id, rating, feedback, is_injured, injury_details')
          .limit(1000);

        if (!fallbackError && Array.isArray(fallbackData) && fallbackData.length > 0) {
          rows = fallbackData;
        }
      }

      // Return array with activity_id field (mapped from strava_activity_id)
      return rows.map(row => ({
        activity_id: row.strava_activity_id,
        rating: row.rating,
        notes: row.feedback, // Map feedback to notes for consistency
        feedback: row.feedback,
        is_injured: row.is_injured,
        injury_details: row.injury_details
      }));
    };

    return await Promise.race([fetchRatings(), timeoutPromise]);
  } catch (err) {
    // Silently fail - don't log as error since this is expected when Supabase is unavailable
    if (err.message !== 'Supabase timeout') {
      console.warn('Could not fetch existing ratings from Supabase, using localStorage fallback:', err);
    }
    return [];
  }
};

export const saveActivityRating = async (activityId, rating, feedback, isInjured, injuryDetails) => {
  // Always save to localStorage first
  const ratings = JSON.parse(localStorage.getItem('activity_ratings') || '{}')
  ratings[activityId] = { rating, feedback, isInjured, injuryDetails }
  localStorage.setItem('activity_ratings', JSON.stringify(ratings))
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('activity-ratings-updated'))
  }
  
  // If using Supabase, also save there
  if (dataService.useSupabase) {
    try {
      const user = await ensureUser()
      const numericActivityId = parseInt(activityId)

      // Ensure referenced activity exists to satisfy workout_ratings FK.
      const localActivities = JSON.parse(localStorage.getItem('strava_activities') || '[]')
      const localActivity = localActivities.find((a) => String(a?.id) === String(activityId))
      const activityPayload = localActivity || {
        id: numericActivityId,
        name: 'Run',
        type: 'Run',
        start_date: new Date().toISOString(),
        distance: 0,
        moving_time: 0,
        average_speed: 0
      }

      // Use select-then-insert to avoid 400 from upsert (schema/constraint differences).
      const { data: existingRow } = await supabase
        .from('strava_activities')
        .select('id')
        .eq('user_id', user.id)
        .eq('strava_activity_id', numericActivityId)
        .maybeSingle()

      if (!existingRow) {
        const { error: insertErr } = await supabase
          .from('strava_activities')
          .insert({
            user_id: user.id,
            strava_activity_id: numericActivityId,
            activity_data: activityPayload
          })
        if (insertErr && insertErr.code !== '23505') {
          console.warn('Could not ensure strava_activity for rating:', insertErr.message)
          return
        }
      }

      const { data: parentExists } = await supabase
        .from('strava_activities')
        .select('id')
        .eq('user_id', user.id)
        .eq('strava_activity_id', numericActivityId)
        .maybeSingle()
      if (!parentExists) {
        console.warn('strava_activities row missing for activity', numericActivityId)
        return
      }

      const payload = {
        user_id: user.id,
        strava_activity_id: numericActivityId,
        rating,
        feedback,
        is_injured: isInjured,
        injury_details: injuryDetails
      }

      const { data: existing } = await supabase
        .from('workout_ratings')
        .select('id')
        .eq('user_id', user.id)
        .eq('strava_activity_id', numericActivityId)
        .maybeSingle()

      let error
      if (existing) {
        const result = await supabase
          .from('workout_ratings')
          .update({
            rating: payload.rating,
            feedback: payload.feedback,
            is_injured: payload.is_injured,
            injury_details: payload.injury_details
          })
          .eq('id', existing.id)
        error = result.error
      } else {
        const result = await supabase
          .from('workout_ratings')
          .insert(payload)
        error = result.error
      }

      if (error) {
        console.error('Error saving rating to Supabase:', error);
        throw error;
      }
    } catch (err) {
      console.error('Failed to save rating to Supabase:', err);
      // Don't throw - we've already saved to localStorage
    }
  }
}

// Initialize on load - check if user has explicitly enabled Supabase
if (localStorage.getItem('use_supabase') === 'true') {
  dataService.useSupabase = true
}
// Mobile platform detection happens asynchronously above

// Real-time sync subscriptions
let subscriptions = [];

export const setupRealtimeSync = (callbacks = {}) => {
  if (!dataService.useSupabase) {
    console.log('Realtime sync disabled - not using Supabase');
    return () => {};
  }

  const cleanup = async () => {
    subscriptions.forEach(sub => {
      supabase.removeChannel(sub);
    });
    subscriptions = [];
  };

  ensureUser().then(async (user) => {
    if (!user) {
      console.error('Cannot setup realtime sync - no user');
      return cleanup;
    }

    // Subscribe to activities changes
    const activitiesChannel = supabase
      .channel('strava_activities_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'strava_activities',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Activities changed:', payload);
          if (callbacks.onActivitiesChange) {
            callbacks.onActivitiesChange(payload);
          }
        }
      )
      .subscribe();

    // Subscribe to current workout changes
    const workoutChannel = supabase
      .channel('current_workout_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'current_workouts',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Workout changed:', payload);
          if (callbacks.onWorkoutChange) {
            callbacks.onWorkoutChange(payload);
          }
        }
      )
      .subscribe();

    // Subscribe to weekly plan changes
    const weeklyPlanChannel = supabase
      .channel('weekly_plan_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'weekly_plans',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Weekly plan changed:', payload);
          if (callbacks.onWeeklyPlanChange) {
            callbacks.onWeeklyPlanChange(payload);
          }
        }
      )
      .subscribe();

    // Subscribe to workout ratings changes
    const ratingsChannel = supabase
      .channel('workout_ratings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workout_ratings',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Workout ratings changed:', payload);
          if (callbacks.onRatingsChange) {
            callbacks.onRatingsChange(payload);
          }
        }
      )
      .subscribe();

    subscriptions = [activitiesChannel, workoutChannel, weeklyPlanChannel, ratingsChannel];
  }).catch(err => {
    console.error('Error setting up realtime sync:', err);
  });

  return cleanup;
};

// Helper to sync all data from Supabase to local state
export const syncAllDataFromSupabase = async () => {
  if (!dataService.useSupabase) {
    console.log('Sync skipped - not using Supabase');
    return null;
  }

  try {
    // Sync activities
    const activities = await dataService.get('strava_activities');
    
    // Sync current workout
    const workout = await dataService.get('current_workout');

    // Sync activity ratings
    const activityRatings = await dataService.get('activity_ratings');
    
    // Sync weekly plans (get current week)
    const weekKey = getWeekKey();
    const weeklyPlan = await dataService.get(`weekly_plan_${weekKey}`);

    return {
      activities: activities ? JSON.parse(activities) : [],
      workout: workout ? JSON.parse(workout) : null,
      activityRatings: activityRatings ? JSON.parse(activityRatings) : {},
      weeklyPlan: weeklyPlan ? JSON.parse(weeklyPlan) : null
    };
  } catch (error) {
    console.error('Error syncing data from Supabase:', error);
    return null;
  }
};
// Strava token storage functions
const STRAVA_OWNER_ID_KEY = 'strava_athlete_id';
const STRAVA_OWNER_USERNAME_KEY = 'strava_athlete_username';
const STRAVA_OWNER_NAME_KEY = 'strava_athlete_name';

const normalizeAthleteMetadata = (athlete = null) => {
  if (!athlete) return null;
  if (athlete.athleteId) {
    return {
      athleteId: String(athlete.athleteId),
      athleteUsername: athlete.athleteUsername || null,
      athleteName: athlete.athleteName || null
    };
  }
  if (!athlete.id) return null;
  return {
    athleteId: String(athlete.id),
    athleteUsername: athlete.username || null,
    athleteName: [athlete.firstname, athlete.lastname].filter(Boolean).join(' ').trim() || null
  };
};

const persistAthleteMetadataLocally = (athleteMetadata) => {
  if (!athleteMetadata || !athleteMetadata.athleteId) return;
  localStorage.setItem(STRAVA_OWNER_ID_KEY, athleteMetadata.athleteId);
  if (athleteMetadata.athleteUsername) {
    localStorage.setItem(STRAVA_OWNER_USERNAME_KEY, athleteMetadata.athleteUsername);
  }
  if (athleteMetadata.athleteName) {
    localStorage.setItem(STRAVA_OWNER_NAME_KEY, athleteMetadata.athleteName);
  }
};

const clearAthleteMetadataLocally = () => {
  localStorage.removeItem(STRAVA_OWNER_ID_KEY);
  localStorage.removeItem(STRAVA_OWNER_USERNAME_KEY);
  localStorage.removeItem(STRAVA_OWNER_NAME_KEY);
};

const getAthleteMetadataFromLocalStorage = () => {
  const athleteId = localStorage.getItem(STRAVA_OWNER_ID_KEY);
  if (!athleteId) return null;
  return {
    athleteId,
    athleteUsername: localStorage.getItem(STRAVA_OWNER_USERNAME_KEY),
    athleteName: localStorage.getItem(STRAVA_OWNER_NAME_KEY)
  };
};

const getAthleteMetadataFromTokenRow = (row) => {
  if (!row) return null;
  const athleteId = row.athlete_id || row.strava_athlete_id || row.athleteId;
  if (!athleteId) return null;
  return {
    athleteId: String(athleteId),
    athleteUsername: row.athlete_username || row.strava_athlete_username || null,
    athleteName: row.athlete_name || row.strava_athlete_name || null
  };
};

export const saveStravaTokens = async (accessToken, refreshToken, expiresAt = null, athleteMetadata = null) => {
  const resolvedAthleteMetadata = normalizeAthleteMetadata(athleteMetadata);
  // Check if we're on mobile - if so, always try Supabase first (even if useSupabase isn't set yet)
  const isMobile = typeof window !== 'undefined' && (
    (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ||
    (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform && Capacitor.isNativePlatform())
  );
  
  const shouldUseSupabase = dataService.useSupabase || isMobile;
  
  console.log('saveStravaTokens called:', { useSupabase: dataService.useSupabase, isMobile, shouldUseSupabase });
  
  if (!shouldUseSupabase) {
    localStorage.setItem('strava_access_token', accessToken);
    localStorage.setItem('strava_refresh_token', refreshToken);
    if (expiresAt) localStorage.setItem('strava_token_expires_at', expiresAt);
    persistAthleteMetadataLocally(resolvedAthleteMetadata);
    return;
  }
  
  try {
    const user = await ensureUser();
    const expiresAtTimestamp = expiresAt ? new Date(expiresAt).toISOString() : null;
    
    console.log('Saving tokens to Supabase for user:', user.id);
    
    const basePayload = {
      user_id: user.id,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAtTimestamp,
      updated_at: new Date().toISOString()
    };
    const enrichedPayload = resolvedAthleteMetadata
      ? {
          ...basePayload,
          athlete_id: resolvedAthleteMetadata.athleteId,
          athlete_username: resolvedAthleteMetadata.athleteUsername,
          athlete_name: resolvedAthleteMetadata.athleteName
        }
      : basePayload;

    let { error } = await supabase.from('strava_tokens').upsert(enrichedPayload, { onConflict: 'user_id' });
    if (error && resolvedAthleteMetadata) {
      const mightBeMissingMetadataColumns =
        /column|schema cache|does not exist/i.test(error.message || '');
      if (mightBeMissingMetadataColumns) {
        // Fallback for older schemas that don't yet include athlete metadata columns.
        const retry = await supabase.from('strava_tokens').upsert(basePayload, { onConflict: 'user_id' });
        error = retry.error;
      }
    }
    
    if (error) {
      console.error('Error saving Strava tokens to Supabase:', error);
      // Still save to localStorage as fallback
      localStorage.setItem('strava_access_token', accessToken);
      localStorage.setItem('strava_refresh_token', refreshToken);
      if (expiresAt) localStorage.setItem('strava_token_expires_at', expiresAt);
      throw error;
    }
    
    console.log('Strava tokens saved to Supabase successfully');
    
    // Also update localStorage as backup
    localStorage.setItem('strava_access_token', accessToken);
    localStorage.setItem('strava_refresh_token', refreshToken);
    if (expiresAt) localStorage.setItem('strava_token_expires_at', expiresAt);
    persistAthleteMetadataLocally(resolvedAthleteMetadata);
  } catch (error) {
    console.error('Failed to save Strava tokens:', error);
    // Fallback to localStorage
    localStorage.setItem('strava_access_token', accessToken);
    localStorage.setItem('strava_refresh_token', refreshToken);
    if (expiresAt) localStorage.setItem('strava_token_expires_at', expiresAt);
    persistAthleteMetadataLocally(resolvedAthleteMetadata);
  }
};

export const getStravaTokens = async ({ allowLocalFallback = false } = {}) => {
  // Always try Supabase first. Local fallback is opt-in only.
  try {
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Supabase timeout')), 3000)
    );

    const fetchFromSupabase = async () => {
      const user = await ensureUser();
      const { data, error } = await supabase
        .from('strava_tokens')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No tokens in Supabase
          return null;
        }
        throw error;
      }
      
      if (data) {
        const existingLocalMetadata = getAthleteMetadataFromLocalStorage();
        const rowMetadata = getAthleteMetadataFromTokenRow(data);
        const resolvedMetadata = rowMetadata || existingLocalMetadata;

        if (
          rowMetadata?.athleteId &&
          existingLocalMetadata?.athleteId &&
          rowMetadata.athleteId !== existingLocalMetadata.athleteId
        ) {
          console.warn(
            'Strava athlete mismatch detected for current Supabase user. Local athlete id:',
            existingLocalMetadata.athleteId,
            'Supabase athlete id:',
            rowMetadata.athleteId
          );
        }

        // Update localStorage with tokens from Supabase for faster access
        localStorage.setItem('strava_access_token', data.access_token);
        localStorage.setItem('strava_refresh_token', data.refresh_token);
        if (data.expires_at) localStorage.setItem('strava_token_expires_at', data.expires_at);
        persistAthleteMetadataLocally(resolvedMetadata);
        return { 
          accessToken: data.access_token, 
          refreshToken: data.refresh_token, 
          expiresAt: data.expires_at,
          ...resolvedMetadata
        };
      }
      
      return null;
    };

    // Try Supabase first with timeout
    const supabaseResult = await Promise.race([fetchFromSupabase(), timeoutPromise]);
    if (supabaseResult) {
      return supabaseResult;
    }
  } catch (error) {
    // Supabase failed or timed out - fall back to localStorage
    if (error.message !== 'Supabase timeout') {
      console.warn('Could not fetch tokens from Supabase, falling back to localStorage:', error);
    }
  }
  
  if (!allowLocalFallback) {
    return null;
  }

  // Optional fallback to localStorage
  const accessToken = localStorage.getItem('strava_access_token');
  const refreshToken = localStorage.getItem('strava_refresh_token');
  if (accessToken && refreshToken) {
    return { accessToken, refreshToken, ...getAthleteMetadataFromLocalStorage() };
  }
  
  return null;
};

export const deleteStravaTokens = async () => {
  if (!dataService.useSupabase) {
    localStorage.removeItem('strava_access_token');
    localStorage.removeItem('strava_refresh_token');
    localStorage.removeItem('strava_token_expires_at');
    clearAthleteMetadataLocally();
    return;
  }
  try {
    const user = await ensureUser();
    const { error } = await supabase.from('strava_tokens').delete().eq('user_id', user.id);
    if (error) console.error('Error deleting Strava tokens from Supabase:', error);
    localStorage.removeItem('strava_access_token');
    localStorage.removeItem('strava_refresh_token');
    localStorage.removeItem('strava_token_expires_at');
    clearAthleteMetadataLocally();
  } catch (error) {
    console.error('Failed to delete Strava tokens:', error);
    localStorage.removeItem('strava_access_token');
    localStorage.removeItem('strava_refresh_token');
    localStorage.removeItem('strava_token_expires_at');
    clearAthleteMetadataLocally();
  }
};
