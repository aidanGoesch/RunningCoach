import { useState } from 'react';
import { useSwipeBack } from '../hooks/useSwipeBack';

const WorkoutDetail = ({ workout, onBack, onPostpone, postponeDisabled }) => {
  const [completedBlocks, setCompletedBlocks] = useState(new Set());
  const swipeBackRef = useSwipeBack(onBack);

  const toggleBlockCompletion = (blockIndex) => {
    const newCompleted = new Set(completedBlocks);
    if (newCompleted.has(blockIndex)) {
      newCompleted.delete(blockIndex);
    } else {
      newCompleted.add(blockIndex);
    }
    setCompletedBlocks(newCompleted);
  };

  if (!workout) return null;

  return (
    <div className="app" ref={swipeBackRef}>
      <div className="workout-display">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
          <button 
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              marginRight: '15px',
              color: 'var(--text-color)'
            }}
          >
            ←
          </button>
          <div className="workout-title" style={{ margin: 0 }}>
            {workout.title}
          </div>
        </div>

        {workout.blocks && workout.blocks.map((block, index) => (
          <div 
            key={index} 
            className="workout-block"
            style={{
              opacity: completedBlocks.has(index) ? 0.6 : 1,
              border: completedBlocks.has(index) ? '2px solid var(--accent)' : '1px solid var(--border-color)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div className="block-title">{block.title}</div>
              <button
                onClick={() => toggleBlockCompletion(index)}
                style={{
                  background: completedBlocks.has(index) ? 'var(--accent)' : 'transparent',
                  color: completedBlocks.has(index) ? 'white' : 'var(--text-color)',
                  border: '1px solid var(--accent)',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {completedBlocks.has(index) ? '✓' : ''}
              </button>
            </div>

            {block.description && (
              <div style={{ 
                marginBottom: '15px', 
                color: 'var(--text-secondary)',
                fontSize: '14px',
                lineHeight: '1.5'
              }}>
                {block.description}
              </div>
            )}

            <div className="block-details">
              {block.distance && (
                <div className="detail-item">
                  <span className="detail-label">Distance</span>
                  <span className="detail-value">{block.distance}</span>
                </div>
              )}
              {block.pace && (
                <div className="detail-item">
                  <span className="detail-label">Pace</span>
                  <span className="detail-value">{block.pace}</span>
                </div>
              )}
              {block.duration && (
                <div className="detail-item">
                  <span className="detail-label">Duration</span>
                  <span className="detail-value">{block.duration}</span>
                </div>
              )}
              {block.heartRate && (
                <div className="detail-item">
                  <span className="detail-label">Heart Rate</span>
                  <span className="detail-value">{block.heartRate}</span>
                </div>
              )}
              {block.rest && (
                <div className="detail-item">
                  <span className="detail-label">Rest</span>
                  <span className="detail-value">{block.rest}</span>
                </div>
              )}
              {block.repetitions && (
                <div className="detail-item">
                  <span className="detail-label">Repetitions</span>
                  <span className="detail-value">{block.repetitions}</span>
                </div>
              )}
            </div>

            {block.notes && (
              <div style={{ 
                marginTop: '15px',
                padding: '12px',
                backgroundColor: 'var(--grid-color)',
                borderRadius: '8px',
                fontSize: '14px',
                fontStyle: 'italic',
                color: 'var(--text-secondary)'
              }}>
                <strong>Coach Notes:</strong> {block.notes}
              </div>
            )}
          </div>
        ))}

        <div style={{ 
          marginTop: '20px',
          padding: '15px',
          backgroundColor: 'var(--grid-color)',
          borderRadius: '12px'
        }}>
          <div style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--text-color)' }}>
            Workout Summary
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Completed: {completedBlocks.size} of {workout.blocks?.length || 0} blocks
          </div>
        </div>

        {onPostpone && (
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <button 
              className="btn btn-secondary" 
              onClick={onPostpone}
              disabled={postponeDisabled}
              style={{ 
                fontSize: '14px', 
                padding: '12px 20px',
                opacity: postponeDisabled ? 0.5 : 1,
                cursor: postponeDisabled ? 'not-allowed' : 'pointer'
              }}
            >
              {postponeDisabled ? 'Postponed Today' : 'Postpone Workout'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkoutDetail;
