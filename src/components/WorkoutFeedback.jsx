import { useState } from 'react';

const WorkoutFeedback = ({ workout, onSubmit }) => {
  const [rating, setRating] = useState(null);
  const [isInjured, setIsInjured] = useState(false);
  const [injuryDetails, setInjuryDetails] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    const feedback = {
      workoutId: workout.id || Date.now(),
      workoutTitle: workout.title,
      rating,
      isInjured,
      injuryDetails: isInjured ? injuryDetails : '',
      notes,
      timestamp: new Date().toISOString()
    };
    
    onSubmit(feedback);
  };

  return (
    <div className="workout-display">
      <div className="workout-title">📝 Workout Feedback</div>
      
      <div className="workout-block">
        <div className="block-title">How was "{workout.title}"?</div>
        
        {/* Rating */}
        <div style={{ marginBottom: '20px' }}>
          <div className="detail-label" style={{ marginBottom: '10px' }}>Rate this workout:</div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                onClick={() => setRating(star)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: rating >= star ? '#f39c12' : '#ddd'
                }}
              >
                ⭐
              </button>
            ))}
          </div>
          <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '5px' }}>
            1 = Too easy, 3 = Perfect, 5 = Too hard
          </div>
        </div>

        {/* Injury Status */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isInjured}
              onChange={(e) => setIsInjured(e.target.checked)}
            />
            <span className="detail-label">I'm currently injured or experiencing pain</span>
          </label>
          
          {isInjured && (
            <textarea
              value={injuryDetails}
              onChange={(e) => setInjuryDetails(e.target.value)}
              placeholder="Describe your injury or pain (e.g., 'knee pain', 'shin splints', 'general fatigue')"
              style={{
                width: '100%',
                marginTop: '10px',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                minHeight: '60px'
              }}
            />
          )}
        </div>

        {/* Additional Notes */}
        <div style={{ marginBottom: '20px' }}>
          <div className="detail-label" style={{ marginBottom: '8px' }}>Additional notes (optional):</div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any other feedback about the workout..."
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
              minHeight: '60px'
            }}
          />
        </div>

        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={!rating}
          style={{ width: '100%' }}
        >
          Submit Feedback
        </button>
      </div>
    </div>
  );
};

export default WorkoutFeedback;
