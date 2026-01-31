import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Initialize Capacitor for mobile (with error handling)
(async () => {
  try {
    const { Capacitor } = await import('@capacitor/core');
    
    if (Capacitor && Capacitor.isNativePlatform()) {
      import('@capacitor/app').then(({ App: CapacitorApp }) => {
        // Handle app state changes
        CapacitorApp.addListener('appStateChange', ({ isActive }) => {
          console.log('App state changed. Is active?', isActive);
        });
      }).catch(err => console.log('Capacitor App plugin not available:', err));

      import('@capacitor/status-bar').then(({ StatusBar }) => {
        StatusBar.setStyle({ style: 'dark' });
        StatusBar.setBackgroundColor({ color: '#ffffff' });
      }).catch(err => console.log('Capacitor StatusBar plugin not available:', err));
    }
  } catch (err) {
    // Capacitor not available (running in web browser)
    console.log('Capacitor not available, running in web mode');
  }
})();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
