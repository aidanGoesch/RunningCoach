# Running Coach

A React-based running coach app that generates AI-powered workout recommendations.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

## Features

- **Generate Workout**: Uses ChatGPT to create personalized running workouts
- **Strava Integration**: Sync activities from Strava
- **Mobile App**: Native iOS app with Capacitor (see [MOBILE_SETUP.md](./MOBILE_SETUP.md))
- **Cloud Sync**: Sync data between web and mobile using Supabase
- **Mobile-Friendly**: Responsive design optimized for mobile devices
- **GitHub Pages**: Hosted on GitHub Pages

## Usage

1. Enter your OpenAI API key in the input field
2. Click "Generate Workout" to get an AI-created running plan
3. Workouts display in structured blocks with pace, distance, and duration info

## Future Enhancements

- Strava OAuth integration
- Workout history tracking
- Personalized recommendations based on past performance
- Advanced workout types and training plans

## Deployment

The app is configured for GitHub Pages deployment. The build output will be in the `dist` folder.

### GitHub Pages Setup

1. Build the app: `npm run build`
2. Commit and push the `dist` folder to your GitHub repository
3. Enable GitHub Pages in your repository settings (pointing to the `dist` folder)

### Cloud Sync (Web ↔ Mobile)

To enable data sync between the web app and mobile app:

1. **On Web App (GitHub Pages):**
   - Open the app
   - Click the menu (☰) in the top-left
   - Click "Enable Cloud Sync"

2. **On Mobile App:**
   - Sync is automatically enabled when running on iOS
   - No manual configuration needed

Both apps must use the same Supabase credentials (via environment variables) for sync to work.

See [MOBILE_SETUP.md](./MOBILE_SETUP.md) for mobile app setup instructions.
