# Quick Start: Mobile App

## One-Command Setup

**First time only:** You need to add the iOS platform first:

```bash
npm run cap:add:ios
cd ios/App && pod install && cd ../..
```

Then, use this single command to build and open in Xcode:

```bash
npm run cap:build:ios
```

This will:
1. Build your web app
2. Sync with Capacitor
3. Open Xcode automatically

Then in Xcode:
1. Select your iPhone as the target device
2. Click the Play button
3. Trust the developer certificate on your iPhone when prompted

## First Time Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Add iOS platform (first time only):**
   ```bash
   npm run cap:add:ios
   ```

3. **Install CocoaPods:**
   ```bash
   cd ios/App && pod install && cd ../..
   ```

4. **Build and open:**
   ```bash
   npm run cap:build:ios
   ```

## Data Sync

The mobile app automatically syncs with Supabase when running on iOS. 

**To enable sync on the web app (GitHub Pages):**
1. Open the web app
2. Click the menu (☰) 
3. Click "Enable Cloud Sync"

Once enabled on both platforms:

✅ Workouts sync between phone and web  
✅ Activities sync between phone and web  
✅ Weekly plans sync between phone and web  
✅ Settings sync between phone and web  
✅ Real-time updates (changes appear within seconds)

**Note:** Both apps must use the same Supabase instance (same environment variables) for sync to work.

## Troubleshooting

**"No devices found"**
- Unlock your iPhone
- Trust the computer on your iPhone
- Select iPhone in Xcode device dropdown

**"Signing requires a development team"**
- Xcode > Settings > Accounts > Add your Apple ID
- Select your team in Signing & Capabilities

**App crashes**
- Check Xcode console for errors
- Verify environment variables are set
- Make sure Supabase credentials are correct

For detailed instructions, see [MOBILE_SETUP.md](./MOBILE_SETUP.md)
