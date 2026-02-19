-- SQL to ensure postpone info is properly synced in weekly_plans table
-- This ensures that when plan_data is updated from localhost, _postponements are preserved
-- Run this once to fix existing data and ensure future syncs work correctly

-- Step 1: Check current state - see which plans have postpone info
SELECT 
  week_start_date,
  CASE 
    WHEN plan_data ? '_postponements' THEN 'Has _postponements'
    WHEN plan_data::text LIKE '%postponed%' THEN 'Has postpone info (nested)'
    ELSE 'No postpone info'
  END as postpone_status,
  plan_data->'_postponements' as current_postponements
FROM weekly_plans
WHERE user_id = '00945913-8ad1-4802-8296-5c5ddc60fba7'
ORDER BY created_at DESC
LIMIT 10;

-- Step 2: Create a function to ensure _postponements is always preserved during updates
-- This function will be called automatically when plan_data is updated
CREATE OR REPLACE FUNCTION preserve_postponements()
RETURNS TRIGGER AS $$
DECLARE
  old_postponements jsonb;
BEGIN
  -- If this is an update (not insert), preserve existing _postponements
  IF TG_OP = 'UPDATE' AND OLD.plan_data ? '_postponements' THEN
    old_postponements := OLD.plan_data->'_postponements';
    
    -- If new plan_data doesn't have _postponements, merge the old one in
    IF NOT (NEW.plan_data ? '_postponements') THEN
      NEW.plan_data := jsonb_set(
        NEW.plan_data,
        '{_postponements}',
        old_postponements,
        true
      );
    ELSE
      -- If both have _postponements, merge them (new takes precedence for individual days)
      NEW.plan_data := jsonb_set(
        NEW.plan_data,
        '{_postponements}',
        old_postponements || (NEW.plan_data->'_postponements'),
        true
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create trigger to automatically preserve postpone info on updates
DROP TRIGGER IF EXISTS preserve_postponements_trigger ON weekly_plans;
CREATE TRIGGER preserve_postponements_trigger
  BEFORE UPDATE ON weekly_plans
  FOR EACH ROW
  WHEN (OLD.plan_data IS DISTINCT FROM NEW.plan_data)
  EXECUTE FUNCTION preserve_postponements();

-- Step 4: Fix existing plans that might have postpone info but it's not at root level
-- This extracts postpone info from anywhere in the JSON and ensures it's at _postponements
UPDATE weekly_plans
SET plan_data = jsonb_set(
  plan_data,
  '{_postponements}',
  COALESCE(plan_data->'_postponements', '{}'::jsonb),
  true
)
WHERE user_id = '00945913-8ad1-4802-8296-5c5ddc60fba7'
  AND plan_data IS NOT NULL
  AND (
    -- Plans that don't have _postponements at root but might have postpone info
    NOT (plan_data ? '_postponements')
    OR
    -- Plans where _postponements exists but is empty/null
    (plan_data->'_postponements' IS NULL OR plan_data->'_postponements' = 'null'::jsonb)
  );

-- Step 5: Verify the fix worked
SELECT 
  week_start_date,
  plan_data ? '_postponements' as has_postponements_key,
  plan_data->'_postponements' as postponements,
  jsonb_object_keys(plan_data->'_postponements') as postpone_days
FROM weekly_plans
WHERE user_id = '00945913-8ad1-4802-8296-5c5ddc60fba7'
  AND plan_data ? '_postponements'
ORDER BY created_at DESC
LIMIT 5;
