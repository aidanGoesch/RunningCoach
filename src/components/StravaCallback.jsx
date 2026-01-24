import { useEffect } from 'react';
import { exchangeStravaCode } from '../services/api';

const StravaCallback = ({ onAuthComplete }) => {
  useEffect(() => {
    const handleCallback = async () => {
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
          console.log('Token exchange successful:', tokenData);
          localStorage.setItem('strava_access_token', tokenData.access_token);
          localStorage.setItem('strava_refresh_token', tokenData.refresh_token);
          onAuthComplete(true);
        } catch (err) {
          console.error('Token exchange failed:', err);
          onAuthComplete(false);
        }
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
