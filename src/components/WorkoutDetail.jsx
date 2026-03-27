import { useMemo, useState } from 'react';
import { useSwipeBack } from '../hooks/useSwipeBack';

const DAY_OPTIONS = [
  { key: 'monday', shortLabel: 'Mon' },
  { key: 'tuesday', shortLabel: 'Tue' },
  { key: 'wednesday', shortLabel: 'Wed' },
  { key: 'thursday', shortLabel: 'Thu' },
  { key: 'friday', shortLabel: 'Fri' },
  { key: 'saturday', shortLabel: 'Sat' },
  { key: 'sunday', shortLabel: 'Sun' }
];

const WorkoutDetail = ({
  workout,
  onBack,
  headerTitle = '',
  onReschedule,
  rescheduleDisabled = false,
  rescheduleDisabledReason = '',
  rescheduleSourceDayName = null,
  onFixWorkout,
  isFixingWorkout = false
}) => {
  const [completedBlocks, setCompletedBlocks] = useState(new Set());
  const [openNoteIndex, setOpenNoteIndex] = useState(null);
  const [showReschedulePicker, setShowReschedulePicker] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const swipeBackRef = useSwipeBack(onBack);
  const todayDayName = useMemo(() => {
    const dayNameMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return dayNameMap[new Date().getDay()];
  }, []);

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

  const toSentenceCase = (value) => {
    if (!value || typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    const lower = trimmed.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  };

  const getWorkoutTypeLabel = () => {
    if (!workout.type) return toSentenceCase(workout.title || 'Workout');
    const type = String(workout.type).toLowerCase();
    if (type === 'easy' || type === 'easy run') return 'Easy run';
    if (type === 'long' || type === 'long run') return 'Long run';
    if (type === 'speed' || type === 'speed work') return 'Speed work';
    if (type === 'recovery') return 'Recovery';
    return toSentenceCase(type);
  };

  const getTargetSummary = () => {
    if (!workout.blocks || workout.blocks.length === 0) return '';
    const mainBlock = workout.blocks.find((block) => {
      const title = block?.title?.toLowerCase() || '';
      return !title.includes('warm') && !title.includes('cool');
    }) || workout.blocks[0];
    const duration = workout.blocks.reduce((sum, block) => sum + (Number(block.duration) || 0), 0);

    const parts = [];
    if (mainBlock?.pace) {
      parts.push(mainBlock.pace.split(',')[0].trim());
    }
    if (mainBlock?.heartRateZone) {
      const zoneMatch = String(mainBlock.heartRateZone).match(/Zone\s*(\d+)/i);
      if (zoneMatch) {
        parts.push(`Zone ${zoneMatch[1]}`);
      }
    }
    if (duration > 0) {
      parts.push(`~${Math.round(duration)} min`);
    }
    return parts.join(' · ');
  };

  const formatBlockSubLabel = (block) => {
    const details = [];
    if (block.heartRateZone) {
      const zoneMatch = String(block.heartRateZone).match(/Zone\s*(\d+)(?:\s*[–-]\s*Zone\s*(\d+))?/i);
      if (zoneMatch) {
        details.push(zoneMatch[2] ? `Z${zoneMatch[1]}–Z${zoneMatch[2]}` : `Z${zoneMatch[1]}`);
      }
      const hrMatch = String(block.heartRateZone).match(/(\d+)\s*[–-]\s*(\d+)\s*bpm/i);
      if (hrMatch) {
        details.push(`${hrMatch[1]}–${hrMatch[2]} bpm`);
      }
    }
    if (block.restInterval || block.rest) {
      details.push(`${block.restInterval || block.rest}`);
    }
    return details.join(' · ');
  };

  const formatBlockName = (block) => {
    const repsPrefix = block.repetitions ? `${block.repetitions}× ` : '';
    return `${repsPrefix}${toSentenceCase(block.title || 'Block')}`;
  };

  const totalBlocks = workout.blocks?.length || 0;
  const completedCount = completedBlocks.size;
  const progressPercent = totalBlocks > 0 ? Math.min(100, Math.round((completedCount / totalBlocks) * 100)) : 0;

  const handleSelectDay = async (targetDayName) => {
    if (!onReschedule || isRescheduling || targetDayName === rescheduleSourceDayName) {
      return;
    }

    setIsRescheduling(true);
    try {
      await onReschedule(targetDayName);
      setShowReschedulePicker(false);
    } finally {
      setIsRescheduling(false);
    }
  };

  return (
    <div className="app" ref={swipeBackRef}>
      <div className="workout-detail-shell">
        <div className="workout-detail-header-bar">
          <button
            className="workout-detail-back-btn"
            onClick={onBack}
          >
            Back
          </button>
          <div className="workout-detail-header-title">
            {headerTitle || `${toSentenceCase(workout.title || 'Workout')}`}
          </div>
        </div>

        <div className="workout-detail-meta">
          <div className="workout-detail-type-tag">
            {String(getWorkoutTypeLabel()).toUpperCase()}
          </div>
          <div className="workout-detail-main-title">
            {toSentenceCase(workout.title || '')}
          </div>
          <div className="workout-detail-target-line">
            {getTargetSummary()}
          </div>
        </div>

        <div className="workout-detail-block-rows">
          {workout.blocks && workout.blocks.map((block, index) => {
            const isCompleted = completedBlocks.has(index);
            const subLabel = formatBlockSubLabel(block);
            return (
              <div key={`${index}-${block.title || 'block'}`}>
                <div
                  className={`workout-detail-block-row ${isCompleted ? 'is-completed' : ''}`}
                  onClick={() => toggleBlockCompletion(index)}
                >
                  <div className="workout-detail-block-left">
                    <div className={`workout-detail-block-name ${isCompleted ? 'is-completed' : ''}`}>
                      {formatBlockName(block)}
                    </div>
                    {subLabel && (
                      <div className={`workout-detail-block-sub ${isCompleted ? 'is-completed' : ''}`}>
                        {subLabel}
                      </div>
                    )}
                  </div>

                  <div className="workout-detail-block-right">
                    {block.pace && (
                      <div className={`workout-detail-block-pace ${isCompleted ? 'is-completed' : ''}`}>
                        {block.pace.split(',')[0].trim()}
                      </div>
                    )}
                    {(block.distance || block.duration) && (
                      <div className="workout-detail-block-distance-duration">
                        {[block.distance, block.duration ? `${block.duration} min` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    )}
                    {isCompleted ? (
                      <span className="workout-detail-complete-icon" aria-hidden="true">
                        <svg viewBox="0 0 16 16" fill="none">
                          <path d="M3.5 8.3L6.5 11.2L12.5 5.1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    ) : block.notes ? (
                      <button
                        type="button"
                        className="workout-detail-info-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpenNoteIndex(openNoteIndex === index ? null : index);
                        }}
                      >
                        i
                      </button>
                    ) : null}
                  </div>
                </div>

                {openNoteIndex === index && block.notes && (
                  <div className="workout-detail-notes-row">
                    {block.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="workout-detail-progress-row">
          <div className="workout-detail-progress-track">
            <div
              className="workout-detail-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="workout-detail-progress-label">
            {completedCount} of {totalBlocks} blocks
          </div>
        </div>

        {(onReschedule || onFixWorkout) && (
          <>
            <div className="workout-detail-footer-actions">
              {onReschedule && (
                <button
                  type="button"
                  className={`workout-detail-footer-btn ${onFixWorkout ? 'with-divider' : ''}`}
                  onClick={() => setShowReschedulePicker(true)}
                  disabled={rescheduleDisabled || isRescheduling}
                >
                  {isRescheduling ? 'Rescheduling…' : 'Reschedule'}
                </button>
              )}
              {onFixWorkout && (
                <button
                  type="button"
                  className="workout-detail-footer-btn"
                  onClick={onFixWorkout}
                  disabled={isFixingWorkout}
                >
                  {isFixingWorkout ? 'Fixing…' : 'Fix workout'}
                </button>
              )}
            </div>
            {rescheduleDisabled && rescheduleDisabledReason && (
              <div className="workout-detail-footer-reason">
                {rescheduleDisabledReason}
              </div>
            )}
          </>
        )}

        {showReschedulePicker && onReschedule && (
          <>
            <div
              className="reschedule-backdrop"
              onClick={() => {
                if (!isRescheduling) {
                  setShowReschedulePicker(false);
                }
              }}
            />
            <div className="reschedule-sheet">
              <div className="reschedule-sheet-handle" />
              <div className="reschedule-sheet-content">
                <div className="workout-title" style={{ marginBottom: '8px' }}>
                  Reschedule Workout
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '14px' }}>
                  Choose the day you want to do this workout.
                </div>
                <div className="reschedule-day-grid">
                  {DAY_OPTIONS.map((day) => {
                    const isToday = day.key === todayDayName;
                    const isCurrent = day.key === rescheduleSourceDayName;
                    return (
                      <button
                        key={day.key}
                        type="button"
                        className="reschedule-day-btn"
                        onClick={() => handleSelectDay(day.key)}
                        disabled={isCurrent || isRescheduling}
                      >
                        <span>{day.shortLabel}</span>
                        <span className="reschedule-day-meta">
                          {isCurrent ? 'Current' : isToday ? 'Today' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowReschedulePicker(false)}
                  disabled={isRescheduling}
                  style={{ marginTop: '14px' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WorkoutDetail;
