-- Run this in your Supabase SQL editor

-- Add weekly_analysis column if it doesn't exist
ALTER TABLE weekly_plans 
ADD COLUMN IF NOT EXISTS weekly_analysis TEXT;

-- Add comment to document the column
COMMENT ON COLUMN weekly_plans.weekly_analysis IS 'Encouraging weekly analysis message generated after plan creation';

-- Create recovery_workouts table for daily recovery recommendations
CREATE TABLE IF NOT EXISTS recovery_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_date DATE NOT NULL,
  recovery_data JSONB NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT recovery_workouts_user_date_unique UNIQUE (user_id, workout_date)
);

COMMENT ON TABLE recovery_workouts IS 'Per-day recovery exercise recommendations and completion status';
COMMENT ON COLUMN recovery_workouts.recovery_data IS 'JSON payload for the day''s recovery routine';
