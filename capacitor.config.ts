import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.runningcoach.app',
  appName: 'Running Coach',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https'
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true
  },
  plugins: {
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#ffffff'
    }
  }
};

export default config;
