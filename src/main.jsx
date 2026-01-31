import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Initialize Capacitor for mobile (runtime only, won't break web builds)
// Capacitor will be injected by the native app at runtime
if (typeof window !== 'undefined' && window.Capacitor) {
  // Only run if Capacitor is already available (injected by native app)
  // This avoids any import statements that would break the web build
  setTimeout(() => {
    try {
      if (window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
        // Use global Capacitor object that's injected by the native app
        // No imports needed - Capacitor is available globally in native apps
        console.log('Running in Capacitor native environment');
        
        // Status bar styling is handled by Capacitor config
        // App state listeners can be added here if needed via Capacitor.Plugins
      }
    } catch (err) {
      // Not in native environment, continue as web app
    }
  }, 100);
}

// Wait for DOM to be ready and ensure root element exists
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

// Clear any existing content to avoid hydration issues
rootElement.innerHTML = '';

const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
