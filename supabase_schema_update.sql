-- Add weekly_analysis column to weekly_plans table
-- Run this in your Supabase SQL editor

-- Add weekly_analysis column if it doesn't exist
ALTER TABLE weekly_plans 
ADD COLUMN IF NOT EXISTS weekly_analysis TEXT;

-- Add comment to document the column
COMMENT ON COLUMN weekly_plans.weekly_analysis IS 'Encouraging weekly analysis message generated after plan creation';
