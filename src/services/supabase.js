import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// Simple auth for single user
export const ensureUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    // For now, create anonymous session
    const { data, error } = await supabase.auth.signInAnonymously()
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
  const user = await ensureUser()
  
  // Migrate coaching prompt
  if (exportedData.data.coaching_prompt) {
    await supabase
      .from('coaching_prompts')
      .insert({
        user_id: user.id,
        prompt_text: exportedData.data.coaching_prompt,
        is_active: true
      })
  }

  // Migrate Strava activities
  if (exportedData.data.strava_activities) {
    const activities = JSON.parse(exportedData.data.strava_activities)
    for (const activity of activities) {
      await supabase
        .from('strava_activities')
        .upsert({
          user_id: user.id,
          strava_activity_id: activity.id,
          activity_data: activity
        })
    }
  }

  // Migrate weekly plans
  if (exportedData.data.weekly_plans) {
    for (const [key, value] of Object.entries(exportedData.data.weekly_plans)) {
      const weekStart = key.replace('weekly_plan_', '')
      await supabase
        .from('weekly_plans')
        .upsert({
          user_id: user.id,
          week_start_date: weekStart,
          plan_data: JSON.parse(value)
        })
    }
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
