# Testing on Localhost

## Quick Start

1. **Install dependencies** (if not already done):
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   ```

3. **Open your browser** to the URL shown (typically `http://localhost:5173`)

## Environment Variables (Required for Strava auth)

Create a `.env` file in the project root. You can copy from `.env.example`:

```bash
cp .env.example .env
```

Then set at least the Strava values:

```env
# OpenAI API Key (required for workout generation)
VITE_OPENAI_API_KEY=your_openai_api_key_here

# Supabase (optional - defaults are already set)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Strava (required for localhost OAuth)
VITE_STRAVA_CLIENT_ID=your_strava_client_id
VITE_STRAVA_CLIENT_SECRET=your_strava_client_secret

# Optional: use a dedicated local Supabase app user
VITE_SUPABASE_APP_USER_EMAIL=runningcoach@example.com
VITE_SUPABASE_APP_USER_PASSWORD=runningcoach123
```

## Strava app callback setup for localhost

In your Strava developer app settings, make sure localhost callback domain is allowed:

- `localhost`
- `127.0.0.1` (recommended)

This app now uses a localhost callback route at:

- `http://localhost:5173/RunningCoach/strava-callback`

If you use a different port, update your running URL accordingly and allow that host in Strava settings.

## One-time reset when account mismatch happens

If localhost seems stuck on the wrong Strava athlete:

1. Open browser DevTools for localhost and clear:
   - `strava_access_token`
   - `strava_refresh_token`
   - `strava_token_expires_at`
   - `strava_athlete_id`
   - `strava_athlete_username`
   - `strava_athlete_name`
2. In the app, trigger Strava reconnect.
3. Complete OAuth while logged into the intended Strava account.
4. Verify new activities sync from Supabase/Strava.

## Testing the New Features

### 1. Activity Rating System
- **Navigate to**: Click on any activity in the "Recent Activities" section
- **Test**: 
  - Click "Rate This Activity"
  - Rate it 1-5 stars
  - Add optional comments
  - Check "I'm currently injured" if needed
  - Click "Save Rating"
  - Verify the rating appears when you view the activity again

### 2. Data-Driven Plan Generation
- **Navigate to**: Menu → "Generate Weekly Plan"
- **Test**:
  - Generate a weekly plan (it will use your activity ratings if available)
  - Check that the plan adjusts based on your ratings
  - If you rated activities as "too hard" (< 2.5), plan should be easier
  - If you rated activities as "too easy" (> 4.0), plan should be more challenging

### 3. Sunday Auto-Generation
- **Test**:
  - Change your system date to a Sunday (or wait for Sunday)
  - Complete a run on Sunday (or sync Strava activities from a Sunday)
  - The plan should auto-generate after the long run is detected
  - Check console logs for "Sunday long run detected, auto-generating weekly plan..."

### 4. Weekly Analysis
- **Navigate to**: Main screen (should appear automatically after plan generation)
- **Test**:
  - After generating a weekly plan, check for the "💪 Week in Review" section
  - Should show an encouraging message about your previous week
  - Displays metrics: runs completed, mileage, time, average rating

### 5. Current Workout Replacement
- **Test**:
  - Have a current workout displayed
  - Generate a new weekly plan
  - Verify the old workout is replaced with Tuesday's workout from the new plan

## Supabase Setup (if testing with cloud sync)

1. **Run the schema update** in your Supabase SQL editor:
   - Open `supabase_schema_update.sql`
   - Copy and paste into Supabase SQL editor
   - Execute to add the `weekly_analysis` column

2. **Enable Supabase sync**:
   - In the app, click the menu (☰)
   - Click "Enable Cloud Sync"
   - Data will now sync to Supabase

## Testing Checklist

- [ ] Activity rating UI appears on activity detail page
- [ ] Ratings save and persist when viewing activity again
- [ ] Weekly plan generation uses ratings to adjust intensity
- [ ] Sunday auto-generation works (or manual generation works)
- [ ] Weekly analysis message appears on main screen
- [ ] Current workout is replaced when new plan is generated
- [ ] All data persists after page refresh (if using Supabase)

## Troubleshooting

### Plan not auto-generating on Sunday?
- Check browser console for errors
- Verify you have activities synced from Strava
- Check that `last_plan_generation_date` in localStorage isn't blocking it
- Manually generate plan to test the feature

### Ratings not saving?
- Check browser console for errors
- Verify Supabase connection (if using cloud sync)
- Check that `workout_ratings` table exists in Supabase

### Weekly analysis not showing?
- Verify weekly plan was generated successfully
- Check that `weekly_analysis` column exists in `weekly_plans` table
- Check browser console for errors

## Development Tips

- **Hot Reload**: Changes to code will automatically refresh in the browser
- **Console Logs**: Check browser DevTools console for debug messages
- **Network Tab**: Monitor API calls to OpenAI and Supabase
- **Local Storage**: Use DevTools → Application → Local Storage to inspect stored data
