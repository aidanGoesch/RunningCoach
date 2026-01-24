import { useState, useEffect } from 'react';
import { getActivityDetails, getActivityStreams, generateInsights, getActivityRating } from '../services/api';

const ActivityDetail = ({ activityId, onBack }) => {
  const [activity, setActivity] = useState(null);
  const [streams, setStreams] = useState(null);
  const [insights, setInsights] = useState(null);
  const [rating, setRating] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchActivityData = async () => {
      const token = localStorage.getItem('strava_access_token');
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY || localStorage.getItem('openai_api_key');
      
      if (!token) {
        setError('No Strava token found');
        return;
      }

      try {
        const [activityData, streamData] = await Promise.all([
          getActivityDetails(token, activityId),
          getActivityStreams(token, activityId)
        ]);
        
        setActivity(activityData);
        setStreams(streamData);
        
        // Get rating for this activity
        const activityRating = getActivityRating(activityId);
        setRating(activityRating);
        
        // Generate insights for this specific activity with detailed data
        if (apiKey && activityData) {
          try {
            const activityInsights = await generateInsights(apiKey, [activityData], streamData);
            setInsights(activityInsights);
          } catch (err) {
            console.error('Failed to generate insights:', err);
          }
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchActivityData();
  }, [activityId]);

  if (loading) return <div className="loading">Loading activity details...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!activity) return <div className="error">Activity not found</div>;

  return (
    <div className="app">
      <div className="header">
        <button 
          onClick={() => {
            setSelectedActivityId(null);
            // Update browser history
            window.history.pushState({ view: 'main' }, '', window.location.pathname);
          }}
          style={{ 
            background: 'none', 
            border: 'none', 
            fontSize: '24px', 
            cursor: 'pointer',
            marginBottom: '10px'
          }}
        >
          ← Back
        </button>
        <h1>{activity.name}</h1>
        <p>{new Date(activity.start_date).toLocaleDateString()}</p>
      </div>

      {/* Map */}
      <div style={{ marginBottom: '20px' }}>
        <ActivityMap activity={activity} streams={streams} />
      </div>
      
      {/* Stats */}
      <div className="workout-display" style={{ marginBottom: '20px' }}>
        <div className="workout-title">Activity Stats</div>
        <div className="workout-block">
          <div className="block-details">
            <div className="detail-item">
              <span className="detail-label">Distance</span>
              <span className="detail-value">{(activity.distance / 1609.34).toFixed(2)} mi</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Duration</span>
              <span className="detail-value">{Math.floor(activity.moving_time / 60)}:{(activity.moving_time % 60).toString().padStart(2, '0')}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Avg Pace</span>
              <span className="detail-value">{formatPace(activity.average_speed)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Elevation</span>
              <span className="detail-value">{Math.round(activity.total_elevation_gain * 3.28084)} ft</span>
            </div>
            {activity.average_heartrate && (
              <div className="detail-item">
                <span className="detail-label">Avg HR</span>
                <span className="detail-value">{Math.round(activity.average_heartrate)} bpm</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Insights */}
      <div style={{ marginBottom: '20px' }}>
        <ActivityInsights insights={insights} />
      </div>

      {/* Workout Rating */}
      {rating && (
        <div className="workout-display" style={{ marginBottom: '20px' }}>
          <div className="workout-title">📝 Your Rating</div>
          <div className="workout-block">
            <div className="block-details">
              <div className="detail-item">
                <span className="detail-label">Rating</span>
                <span className="detail-value">{'⭐'.repeat(rating.rating)} ({rating.rating}/5)</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Workout</span>
                <span className="detail-value">{rating.workoutTitle}</span>
              </div>
              {rating.isInjured && (
                <div className="detail-item">
                  <span className="detail-label">Injury</span>
                  <span className="detail-value">⚠️ {rating.injuryDetails}</span>
                </div>
              )}
            </div>
            {rating.notes && (
              <div style={{ marginTop: '10px', fontSize: '14px', color: 'var(--label-color)' }}>
                <strong>Notes:</strong> {rating.notes}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Charts */}
      <ActivityCharts streams={streams} />
    </div>
  );
};

const ActivityMap = ({ activity, streams }) => {
  const mapId = `map-${activity.id}`;
  
  useEffect(() => {
    if (!streams?.latlng?.data || streams.latlng.data.length === 0) return;

    // Create map
    const map = L.map(mapId).setView(streams.latlng.data[0], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Add route polyline
    const polyline = L.polyline(streams.latlng.data, { color: 'red', weight: 3 }).addTo(map);
    map.fitBounds(polyline.getBounds());

    return () => map.remove();
  }, [streams, mapId]);

  if (!streams?.latlng?.data) {
    return (
      <div className="workout-display">
        <div className="workout-title">Route Map</div>
        <div style={{ padding: '40px', textAlign: 'center', color: '#7f8c8d' }}>
          No GPS data available for this activity
        </div>
      </div>
    );
  }

  return (
    <div className="workout-display">
      <div className="workout-title">Route Map</div>
      <div id={mapId} style={{ height: '300px', borderRadius: '8px' }}></div>
    </div>
  );
};

const ActivityCharts = ({ streams }) => {
  if (!streams) return null;

  return (
    <>
      {streams.heartrate && (
        <div style={{ marginBottom: '20px' }}>
          <HeartRateChart data={streams} />
        </div>
      )}
      {streams.velocity_smooth && <PaceChart data={streams} />}
    </>
  );
};

const HeartRateChart = ({ data }) => {
  const canvasRef = useState(null);
  
  useEffect(() => {
    if (!data.heartrate?.data || !data.time?.data) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * dpr;
    canvas.height = 200 * dpr;
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = 200;
    const padding = 60; // Increased padding for HR labels
    
    ctx.clearRect(0, 0, width, height);
    
    const hrData = data.heartrate.data;
    const timeData = data.time.data;
    const maxHR = Math.max(...hrData);
    const minHR = Math.min(...hrData);
    const maxTime = Math.max(...timeData);
    
    // Draw axes
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--axis-color').trim();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
    
    // Draw horizontal grid lines for HR chart
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid-color').trim();
    ctx.lineWidth = 1;
    const gridLines = 4;
    for (let i = 1; i < gridLines; i++) {
      const y = padding + (i * (height - 2 * padding) / gridLines);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }
    
    // Draw HR line
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    hrData.forEach((hr, i) => {
      const x = padding + ((timeData[i] / maxTime) * (width - 2 * padding));
      const y = padding + ((maxHR - hr) / (maxHR - minHR)) * (height - 2 * padding);
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    
    ctx.stroke();
    
    // Labels
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--label-color').trim();
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Time (min)', width / 2, height - 5);
    
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Heart Rate (bpm)', 0, 0);
    ctx.restore();
    
    // Y-axis labels and ticks
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxHR), padding - 5, padding + 5);
    ctx.fillText(Math.round(minHR), padding - 5, height - padding + 5);
    
    // Add intermediate Y-axis ticks
    const hrRange = maxHR - minHR;
    for (let i = 1; i < 4; i++) {
      const hrValue = minHR + (hrRange * i / 4);
      const y = padding + ((maxHR - hrValue) / hrRange) * (height - 2 * padding);
      ctx.fillText(Math.round(hrValue), padding - 5, y + 5);
      
      // Draw tick marks
      ctx.strokeStyle = '#ddd';
      ctx.beginPath();
      ctx.moveTo(padding - 3, y);
      ctx.lineTo(padding, y);
      ctx.stroke();
    }
    
    // X-axis labels and ticks
    ctx.textAlign = 'center';
    ctx.fillText('0', padding, height - padding + 15);
    ctx.fillText(Math.round(maxTime / 60), width - padding, height - padding + 15);
    
    // Add intermediate X-axis ticks
    for (let i = 1; i < 4; i++) {
      const timeValue = (maxTime * i / 4) / 60; // Convert to minutes
      const x = padding + (i * (width - 2 * padding) / 4);
      ctx.fillText(Math.round(timeValue), x, height - padding + 15);
      
      // Draw tick marks
      ctx.strokeStyle = '#ddd';
      ctx.beginPath();
      ctx.moveTo(x, height - padding);
      ctx.lineTo(x, height - padding + 3);
      ctx.stroke();
    }
  }, [data]);

  if (!data.heartrate?.data) return null;

  return (
    <div className="workout-display">
      <div className="workout-title">Heart Rate</div>
      <canvas 
        ref={canvasRef}
        style={{ width: '100%', height: '200px', borderRadius: '8px' }}
      />
    </div>
  );
};

const PaceChart = ({ data }) => {
  const canvasRef = useState(null);
  
  useEffect(() => {
    if (!data.velocity_smooth?.data || !data.time?.data) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * dpr;
    canvas.height = 200 * dpr;
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = 200;
    const padding = 60; // Increased padding for pace labels
    
    ctx.clearRect(0, 0, width, height);
    
    const velocityData = data.velocity_smooth.data
      .map(v => v > 0 ? 26.8224 / v : 0) // Convert to pace, handle zero velocity
      .filter(pace => pace > 0 && pace < 20); // Filter out invalid paces (0-20 min/mile)
    const timeData = data.time.data.slice(0, velocityData.length); // Match filtered data length
    const maxPace = Math.max(...velocityData);
    const minPace = Math.min(...velocityData);
    const maxTime = Math.max(...timeData);
    
    if (velocityData.length === 0) return; // No valid pace data
    
    // Draw axes
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--axis-color').trim();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
    
    // Draw horizontal grid lines for pace chart
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid-color').trim();
    ctx.lineWidth = 1;
    const gridLines = 4;
    for (let i = 1; i < gridLines; i++) {
      const y = padding + (i * (height - 2 * padding) / gridLines);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }
    
    // Draw pace line
    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    velocityData.forEach((pace, i) => {
      const x = padding + ((timeData[i] / maxTime) * (width - 2 * padding));
      const y = padding + ((pace - minPace) / (maxPace - minPace)) * (height - 2 * padding);
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    
    ctx.stroke();
    
    // Labels
    ctx.fillStyle = '#666';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Time (min)', width / 2, height - 5);
    
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Pace (min/mile)', 0, 0);
    ctx.restore();
    
    // Y-axis labels (pace) and ticks
    ctx.textAlign = 'right';
    const formatPaceLabel = (pace) => {
      const mins = Math.floor(pace);
      const secs = Math.round((pace - mins) * 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    ctx.fillText(formatPaceLabel(maxPace), padding - 5, padding + 5);
    ctx.fillText(formatPaceLabel(minPace), padding - 5, height - padding + 5);
    
    // Add intermediate Y-axis ticks for pace
    const paceRange = maxPace - minPace;
    for (let i = 1; i < 4; i++) {
      const paceValue = minPace + (paceRange * i / 4);
      const y = padding + ((paceValue - minPace) / paceRange) * (height - 2 * padding);
      ctx.fillText(formatPaceLabel(paceValue), padding - 5, y + 5);
      
      // Draw tick marks
      ctx.strokeStyle = '#ddd';
      ctx.beginPath();
      ctx.moveTo(padding - 3, y);
      ctx.lineTo(padding, y);
      ctx.stroke();
    }
    
    // X-axis labels and ticks
    ctx.textAlign = 'center';
    ctx.fillText('0', padding, height - padding + 15);
    ctx.fillText(Math.round(maxTime / 60), width - padding, height - padding + 15);
    
    // Add intermediate X-axis ticks
    for (let i = 1; i < 4; i++) {
      const timeValue = (maxTime * i / 4) / 60; // Convert to minutes
      const x = padding + (i * (width - 2 * padding) / 4);
      ctx.fillText(Math.round(timeValue), x, height - padding + 15);
      
      // Draw tick marks
      ctx.strokeStyle = '#ddd';
      ctx.beginPath();
      ctx.moveTo(x, height - padding);
      ctx.lineTo(x, height - padding + 3);
      ctx.stroke();
    }
  }, [data]);

  if (!data.velocity_smooth?.data) return null;

  return (
    <div className="workout-display">
      <div className="workout-title">Pace</div>
      <canvas 
        ref={canvasRef}
        style={{ width: '100%', height: '200px', borderRadius: '8px' }}
      />
    </div>
  );
};

const ActivityInsights = ({ insights }) => {
  if (!insights) {
    return (
      <div className="workout-display">
        <div className="workout-title">🧠 AI Insights</div>
        <div style={{ padding: '20px', textAlign: 'center', color: '#7f8c8d' }}>
          Generating insights for this activity...
        </div>
      </div>
    );
  }

  return (
    <div className="workout-display">
      <div className="workout-title">🧠 AI Insights</div>
      
      {insights.summary && (
        <div className="workout-block">
          <div className="block-title">Performance Summary</div>
          <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
            {insights.summary}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {insights.strengths && (
          <div className="workout-block">
            <div className="block-title">✅ Strengths</div>
            <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
              {insights.strengths}
            </div>
          </div>
        )}

        {insights.improvements && (
          <div className="workout-block">
            <div className="block-title">📈 Areas for Improvement</div>
            <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
              {insights.improvements}
            </div>
          </div>
        )}
      </div>

      {insights.nextWorkout && (
        <div className="workout-block">
          <div className="block-title">🎯 Next Workout Recommendation</div>
          <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
            {insights.nextWorkout}
          </div>
        </div>
      )}
    </div>
  );
};

const formatPace = (speedMs) => {
  const paceMinPerMile = 26.8224 / speedMs;
  const minutes = Math.floor(paceMinPerMile);
  const seconds = Math.round((paceMinPerMile - minutes) * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}/mile`;
};

export default ActivityDetail;
