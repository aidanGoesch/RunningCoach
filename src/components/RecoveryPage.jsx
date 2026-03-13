import { useSwipeBack } from '../hooks/useSwipeBack';

const RecoveryPage = ({ 
  recoveryWorkout, 
  recoveryCompleted, 
  recoveryBlockStatus,
  onBack,
  onBlockToggle,
  onCompleteToggle,
  isLoading = false
}) => {
  const swipeBackRef = useSwipeBack(onBack);

  // Get today's date and phase label
  const today = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayNames[today.getDay()];
  const dateStr = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const raceDate = new Date('2026-05-02');
  const daysUntilRace = Math.ceil((raceDate - today) / (1000 * 60 * 60 * 24));
  const weeksUntilRace = Math.ceil(daysUntilRace / 7);
  const currentWeek = Math.max(1, 15 - weeksUntilRace);
  const phaseLabel = 'Build phase';

  if (isLoading || !recoveryWorkout) {
    return (
      <div className="app" ref={swipeBackRef}>
        <div style={{
          borderBottom: '0.5px solid var(--color-border-tertiary)',
          padding: '14px 20px'
        }}>
          <button 
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              marginRight: '15px',
              color: 'var(--color-text-primary)'
            }}
          >
            ←
          </button>
          <div style={{
            fontSize: '20px',
            fontWeight: 500,
            color: 'var(--color-text-primary)',
            display: 'inline-block'
          }}>
            Recovery
          </div>
        </div>
        <div style={{
          padding: '40px 20px',
          textAlign: 'center',
          color: 'var(--color-text-secondary)',
          fontSize: '13px'
        }}>
          Generating recovery workout...
        </div>
      </div>
    );
  }

  return (
    <div className="app" ref={swipeBackRef}>
      {/* Header */}
      <div style={{
        borderBottom: '0.5px solid var(--color-border-tertiary)',
        padding: '14px 20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
          <button 
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              marginRight: '15px',
              color: 'var(--color-text-primary)'
            }}
          >
            ←
          </button>
          <div style={{
            fontSize: '20px',
            fontWeight: 500,
            color: 'var(--color-text-primary)'
          }}>
            Recovery
          </div>
        </div>
        <div style={{
          fontSize: '12px',
          color: 'var(--color-text-tertiary)',
          marginLeft: '39px'
        }}>
          {dayName} · {phaseLabel}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '0 20px' }}>
        <div style={{
          border: recoveryCompleted
            ? '1px solid rgba(34, 197, 94, 0.65)'
            : '0.5px solid var(--color-border-tertiary)',
          borderRadius: '10px',
          background: recoveryCompleted
            ? 'rgba(34, 197, 94, 0.08)'
            : 'var(--color-background-primary)',
          padding: '14px',
          marginTop: '20px',
          transition: 'box-shadow 0.25s ease, border-color 0.25s ease, background 0.25s ease'
        }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{
                fontSize: '17px',
                fontWeight: 500,
                color: 'var(--color-text-primary)'
              }}>
                Recovery Exercises
              </div>
              {recoveryCompleted && (
                <div
                  style={{
                    padding: '6px 10px',
                    borderRadius: '999px',
                    background: 'rgba(34, 197, 94, 0.20)',
                    border: '1px solid rgba(34, 197, 94, 0.50)',
                    color: 'var(--color-text-primary)',
                    fontSize: '11px',
                    fontWeight: 500,
                    letterSpacing: '0.02em',
                    whiteSpace: 'nowrap'
                  }}
                >
                  ✅ Recovery Completed
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            {(recoveryWorkout.blocks || []).map((block, index) => {
              const isBlockCompleted = !!recoveryBlockStatus[index];
              return (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    width: '100%'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onBlockToggle(index)}
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: '2px solid var(--accent)',
                      background: isBlockCompleted ? 'var(--accent)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      cursor: 'pointer',
                      transition: 'background 0.15s ease, transform 0.1s ease',
                      transform: isBlockCompleted ? 'scale(0.95)' : 'scale(1)'
                    }}
                    aria-label={isBlockCompleted ? 'Mark segment as not done' : 'Mark segment as done'}
                  >
                    {isBlockCompleted && (
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: 'white'
                        }}
                      />
                    )}
                  </button>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                    <span
                      style={{
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        fontSize: '12px',
                        color: 'var(--color-text-primary)',
                        opacity: isBlockCompleted ? 0.7 : 1,
                        fontWeight: 500
                      }}
                    >
                      {block.title}
                    </span>
                    {block.duration && (
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 500,
                          color: 'var(--color-text-primary)',
                          opacity: isBlockCompleted ? 0.7 : 1
                        }}
                      >
                        {block.duration}
                      </span>
                    )}
                    {block.notes && (
                      <span
                        style={{
                          fontSize: '13px',
                          color: 'var(--color-text-secondary)',
                          opacity: isBlockCompleted ? 0.6 : 1
                        }}
                      >
                        {block.notes}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              marginTop: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <button
              onClick={onCompleteToggle}
              style={{
                width: '100%',
                padding: '12px',
                background: recoveryCompleted
                  ? 'transparent'
                  : 'linear-gradient(135deg, rgba(34,197,94,0.95), rgba(16,185,129,0.9))',
                border: recoveryCompleted
                  ? '0.5px solid var(--color-border-tertiary)'
                  : 'none',
                borderRadius: '8px',
                color: recoveryCompleted ? 'var(--color-text-primary)' : '#ffffff',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.25s ease, border-color 0.25s ease, color 0.25s ease, box-shadow 0.25s ease, transform 0.1s ease'
              }}
            >
              {recoveryCompleted ? 'Undo Recovery' : 'Complete Recovery'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecoveryPage;
