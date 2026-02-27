import { useState } from 'react';

const PostponeWorkout = ({ workout, onPostpone, onCancel }) => {
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
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9998,
          animation: 'fadeIn 0.3s ease'
        }}
        onClick={onCancel}
      />

      {/* Bottom Sheet */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: '80vh',
          backgroundColor: 'var(--card-bg)',
          borderTopLeftRadius: '20px',
          borderTopRightRadius: '20px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3)',
          animation: 'slideUp 0.3s ease',
          overflow: 'hidden'
        }}
      >
        {/* Handle bar */}
        <div
          style={{
            width: '40px',
            height: '4px',
            backgroundColor: 'var(--border-color)',
            borderRadius: '2px',
            margin: '12px auto',
            cursor: 'pointer'
          }}
          onClick={onCancel}
        />

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0 20px 20px',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <div className="workout-title" style={{ marginBottom: '16px' }}>
            Postpone Today's Workout
          </div>
          
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
        </div>

        {/* Footer buttons */}
        <div
          style={{
            padding: '12px 20px 20px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--card-bg)'
          }}
        >
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

      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
};

export default PostponeWorkout;
