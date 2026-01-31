# Mobile App Setup Guide

This guide will help you build and install the Running Coach app on your iPhone.

## Prerequisites

1. **macOS** (required for iOS development)
2. **Xcode** (latest version from Mac App Store)
3. **Node.js** (v16 or higher)
4. **CocoaPods** (for iOS dependencies)
5. **Apple Developer Account** (free account works for personal devices)

## Step 1: Install Dependencies

First, install all npm packages:

```bash
npm install
```

This will install Capacitor and all required dependencies.

## Step 2: Build the Web App

Build the React app for production:

```bash
npm run build
```

This creates the `dist` folder with the optimized web app.

## Step 3: Add iOS Platform

Add the iOS platform to your Capacitor project:

```bash
npm run cap:add:ios
```

Or manually:

```bash
npx cap add ios
```

## Step 4: Sync Capacitor

Sync the web build with the native iOS project:

```bash
npm run cap:sync
```

Or manually:

```bash
npx cap sync ios
```

This copies your web app into the iOS project and updates native dependencies.

## Step 5: Install CocoaPods Dependencies

Navigate to the iOS folder and install CocoaPods dependencies:

```bash
cd ios/App
pod install
cd ../..
```

## Step 6: Open in Xcode

Open the project in Xcode:

```bash
npm run cap:open:ios
```

Or manually:

```bash
npx cap open ios
```

This will open Xcode with your project.

## Step 7: Configure Signing in Xcode

1. In Xcode, select the **App** target in the left sidebar
2. Go to the **Signing & Capabilities** tab
3. Check **"Automatically manage signing"**
4. Select your **Team** (your Apple ID)
5. Xcode will automatically create a provisioning profile

## Step 8: Connect Your iPhone

1. Connect your iPhone to your Mac via USB
2. Unlock your iPhone
3. Trust the computer if prompted
4. In Xcode, select your iPhone from the device dropdown (next to the play button)

## Step 9: Build and Run

1. Click the **Play** button in Xcode (or press `Cmd+R`)
2. Xcode will build the app and install it on your iPhone
3. On your iPhone, go to **Settings > General > VPN & Device Management**
4. Trust your developer certificate if needed
5. The app should now appear on your home screen

## Step 10: Enable Supabase Sync

The mobile app automatically enables Supabase sync when running on iOS. This means:

- All your data (workouts, activities, weekly plans) will sync to Supabase
- Changes made on your phone will appear on the web app
- Changes made on the web app will appear on your phone (via real-time sync)

## Troubleshooting

### "No devices found"
- Make sure your iPhone is unlocked
- Trust the computer on your iPhone
- Check that your iPhone is selected in Xcode's device dropdown

### "Signing requires a development team"
- Make sure you're signed in to Xcode with your Apple ID
- Go to Xcode > Settings > Accounts
- Add your Apple ID if not already added
- Select your team in the Signing & Capabilities tab

### "Could not launch app"
- On your iPhone, go to Settings > General > VPN & Device Management
- Trust your developer certificate
- Try building again

### Build Errors
- Make sure CocoaPods dependencies are installed: `cd ios/App && pod install`
- Clean build folder in Xcode: Product > Clean Build Folder (Shift+Cmd+K)
- Delete derived data: Xcode > Settings > Locations > Derived Data (delete folder)

### App crashes on launch
- Check the Xcode console for error messages
- Make sure all environment variables are set correctly
- Verify Supabase credentials are correct

## Updating the App

When you make changes to the web app:

1. Rebuild the web app:
   ```bash
   npm run build
   ```

2. Sync with Capacitor:
   ```bash
   npm run cap:sync
   ```

3. In Xcode, click the Play button to rebuild and install

## Development Workflow

For faster development, you can use:

```bash
npm run cap:build:ios
```

This command will:
1. Build the web app
2. Sync with Capacitor
3. Open Xcode automatically

## Environment Variables

Make sure your `.env` file (or environment variables) includes:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_STRAVA_CLIENT_ID=your_strava_client_id
VITE_STRAVA_CLIENT_SECRET=your_strava_client_secret
VITE_OPENAI_API_KEY=your_openai_key (optional)
```

## Data Sync

The mobile app uses Supabase for data synchronization:

- **Activities**: Synced from Strava and stored in Supabase
- **Workouts**: Generated workouts are saved to Supabase
- **Weekly Plans**: Weekly training plans sync to Supabase
- **Settings**: Coaching prompts and preferences sync

Changes are synced in real-time using Supabase's real-time subscriptions, so updates on one device appear on the other within seconds.

## Notes

- The app uses the same Supabase database as the web version
- All data is user-specific and secure
- The mobile app automatically enables Supabase sync (no manual configuration needed)
- You can still use the web version - both will stay in sync
