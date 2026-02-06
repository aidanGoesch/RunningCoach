import { useState, useEffect } from 'react';
import { getStravaTokens } from '../services/supabase';
import { initiateStravaAuth } from '../services/api';

const StravaIntro = ({ onAuthenticated }) => {
  const [checking, setChecking] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const checkTokens = async () => {
      try {
        const tokens = await getStravaTokens();
        if (tokens && tokens.accessToken) {
          // Tokens found, user is authenticated
          onAuthenticated();
        } else {
          // No tokens found, show intro
          setChecking(false);
        }
      } catch (error) {
        console.error('Error checking Strava tokens:', error);
        setChecking(false);
      }
    };

    checkTokens();
  }, [onAuthenticated]);

  const handleConnectStrava = async () => {
    setConnecting(true);
    try {
      await initiateStravaAuth();
      // The auth flow will redirect, so we don't need to do anything else here
    } catch (error) {
      console.error('Error initiating Strava auth:', error);
      setConnecting(false);
    }
  };

  if (checking) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '20px',
        textAlign: 'center',
        background: 'var(--bg-color)',
        color: 'var(--text-color)'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '4px solid var(--border-color)',
          borderTop: '4px solid var(--primary-color)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '20px'
        }}></div>
        <p>Checking authentication...</p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      textAlign: 'center',
      background: 'var(--bg-color)',
      color: 'var(--text-color)',
      maxWidth: '600px',
      margin: '0 auto'
    }}>
      <div style={{
        fontSize: '64px',
        marginBottom: '20px'
      }}>
        🏃‍♂️
      </div>
      
      <h1 style={{
        fontSize: '32px',
        marginBottom: '16px',
        fontWeight: 'bold'
      }}>
        Welcome to Running Coach
      </h1>
      
      <p style={{
        fontSize: '18px',
        marginBottom: '32px',
        lineHeight: '1.6',
        color: 'var(--text-secondary)'
      }}>
        Connect your Strava account to get personalized running workouts, 
        track your progress, and receive AI-powered coaching insights.
      </p>

      <div style={{
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '32px',
        width: '100%'
      }}>
        <h2 style={{
          fontSize: '20px',
          marginBottom: '16px',
          fontWeight: '600'
        }}>
          What you'll get:
        </h2>
        <ul style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          textAlign: 'left'
        }}>
          <li style={{
            padding: '8px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: '20px' }}>✓</span>
            <span>Personalized daily workouts</span>
          </li>
          <li style={{
            padding: '8px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: '20px' }}>✓</span>
            <span>Weekly training plans</span>
          </li>
          <li style={{
            padding: '8px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: '20px' }}>✓</span>
            <span>Activity analysis and insights</span>
          </li>
          <li style={{
            padding: '8px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: '20px' }}>✓</span>
            <span>Sync across all your devices</span>
          </li>
        </ul>
      </div>

      <button
        onClick={handleConnectStrava}
        disabled={connecting}
        className="btn btn-primary"
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '16px 32px',
          fontSize: '18px',
          fontWeight: '600',
          borderRadius: '8px',
          border: 'none',
          cursor: connecting ? 'wait' : 'pointer',
          opacity: connecting ? 0.7 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px'
        }}
      >
        {connecting ? (
          <>
            <div style={{
              width: '20px',
              height: '20px',
              border: '2px solid white',
              borderTop: '2px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            Connecting to Strava...
          </>
        ) : (
          <>
            <span>Connect with Strava</span>
            <span style={{ fontSize: '20px' }}>→</span>
          </>
        )}
      </button>

      <p style={{
        marginTop: '24px',
        fontSize: '14px',
        color: 'var(--text-secondary)'
      }}>
        Your data is secure and only used to provide personalized coaching.
      </p>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default StravaIntro;
