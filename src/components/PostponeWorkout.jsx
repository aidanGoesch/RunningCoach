import { useState } from 'react';
import { useSwipeBack } from '../hooks/useSwipeBack';

const PostponeWorkout = ({ workout, onPostpone, onCancel }) => {
  const swipeBackRef = useSwipeBack(onCancel);
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  const predefinedReasons = [
    { value: 'busy', label: 'Too busy/no time today', adjustment: 'same' },
    { value: 'weather', label: 'Bad weather conditions', adjustment: 'same' },
    { value: 'tired', label: 'Feeling tired/fatigued', adjustment: 'easier' },
    { value: 'sore', label: 'Still sore from previous workout', adjustment: 'easier' },
    { value: 'too_much', label: 'Workout feels too challenging', adjustment: 'reduce' },
    { value: 'injury_concern', label: 'Minor injury concern', adjustment: 'recovery' },
    { value: 'custom', label: 'Other reason...', adjustment: 'custom' }
  ];

  const handleSubmit = () => {
    const selectedReason = predefinedReasons.find(r => r.value === reason);
    const finalReason = reason === 'custom' ? customReason : selectedReason?.label || '';
    const adjustment = selectedReason?.adjustment || 'same';
    
    if (!finalReason.trim()) return;
    
    onPostpone({
      reason: finalReason,
      adjustment,
      originalWorkout: workout,
      postponedDate: new Date().toISOString()
    });
  };

  return (
    <div className="app" ref={swipeBackRef}>
      <div className="workout-display">
        <div className="workout-title">Postpone Today's Workout</div>
        
        <div className="workout-block">
          <div className="block-title">Why are you postponing?</div>
          <div style={{ marginBottom: '15px' }}>
            {predefinedReasons.map(reasonOption => (
              <label key={reasonOption.value} style={{ 
                display: 'block', 
                marginBottom: '8px',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '6px',
                backgroundColor: reason === reasonOption.value ? 'var(--accent)' : 'transparent',
                color: reason === reasonOption.value ? 'white' : 'var(--text-color)'
              }}>
                <input
                  type="radio"
                  name="reason"
                  value={reasonOption.value}
                  checked={reason === reasonOption.value}
                  onChange={(e) => setReason(e.target.value)}
                  style={{ marginRight: '8px' }}
                />
                {reasonOption.label}
              </label>
            ))}
          </div>

          {reason === 'custom' && (
            <textarea
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Please describe your reason..."
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '12px',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                fontSize: '14px',
                fontFamily: 'inherit',
                backgroundColor: 'var(--card-bg)',
                color: 'var(--text-color)',
                marginBottom: '15px'
              }}
            />
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!reason || (reason === 'custom' && !customReason.trim())}
            style={{ flex: 1 }}
          >
            Postpone Workout
          </button>
          <button 
            className="btn btn-secondary"
            onClick={onCancel}
            style={{ flex: 1 }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostponeWorkout;
