import { useEffect } from 'react';
import { exchangeStravaCode } from '../services/api';

const StravaCallback = ({ onAuthComplete }) => {
  useEffect(() => {
    const handleCallback = async () => {
      // Close Browser if we're in a Capacitor app
      if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
        try {
          const { Browser } = await import('@capacitor/browser');
          // Close the browser window that opened for Strava auth
          await Browser.close();
        } catch (err) {
          // Browser plugin not available or already closed, continue
          console.log('Browser plugin not available or already closed');
        }
      }
      
      // Handle URL params (Strava redirects with ?code=...)
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');

      console.log('Callback params:', { code: code?.substring(0, 10) + '...', error });

      if (error) {
        console.error('Strava auth error:', error);
        onAuthComplete(false);
        return;
      }

      if (code) {
        try {
          console.log('Exchanging code for token...');
          const tokenData = await exchangeStravaCode(code);
          console.log('Token exchange successful, tokens saved to Supabase:', tokenData);
          // Tokens are now saved to Supabase (and localStorage as backup) by exchangeStravaCode
          
          // Check if there's a pending activity ID to redirect to
          const pendingActivityId = sessionStorage.getItem('pending_activity_id');
          if (pendingActivityId) {
            sessionStorage.removeItem('pending_activity_id');
            // Store the activity ID to be picked up by App.jsx
            sessionStorage.setItem('redirect_to_activity', pendingActivityId);
          }
          
          // Clean up the URL immediately
          const urlParams = new URLSearchParams(window.location.search);
          urlParams.delete('code');
          urlParams.delete('state');
          urlParams.delete('scope');
          const cleanPath = window.location.pathname.replace('/strava-callback', '').replace('/strava-callback.html', '') || '/';
          const cleanUrl = cleanPath + (urlParams.toString() ? '?' + urlParams.toString() : '');
          window.history.replaceState({}, '', cleanUrl);
          
          // Call onAuthComplete which will handle the redirect
          onAuthComplete(true);
        } catch (err) {
          console.error('Token exchange failed:', err);
          onAuthComplete(false);
        }
      } else if (!error) {
        // No code and no error - might be stuck, try to redirect
        console.log('No code found in callback, redirecting to main app');
        const cleanPath = window.location.pathname.replace('/strava-callback', '').replace('/strava-callback.html', '') || '/';
        window.location.replace(cleanPath);
      }
    };

    handleCallback();
  }, [onAuthComplete]);

  return (
    <div style={{ textAlign: 'center', padding: '40px' }}>
      <h2>Connecting to Strava...</h2>
      <p>Please wait while we complete the authentication.</p>
    </div>
  );
};

export default StravaCallback;
