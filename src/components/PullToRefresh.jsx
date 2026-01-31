import { useState, useEffect, useRef } from 'react';

/**
 * Pull-to-refresh component for iOS-style refresh gesture
 * @param {Function} onRefresh - Callback function when refresh is triggered
 * @param {React.ReactNode} children - Child components to wrap
 * @param {boolean} disabled - Disable pull-to-refresh
 */
const PullToRefresh = ({ onRefresh, children, disabled = false }) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [startY, setStartY] = useState(0);
  const [canPull, setCanPull] = useState(false);
  const containerRef = useRef(null);
  const threshold = 80; // Minimum pull distance to trigger refresh

  useEffect(() => {
    const container = containerRef.current;
    if (!container || disabled) return;

    const handleTouchStart = (e) => {
      const scrollTop = container.scrollTop || window.pageYOffset || document.documentElement.scrollTop;
      // Only allow pull if at the top of the scrollable area
      if (scrollTop <= 5) {
        setCanPull(true);
        setStartY(e.touches[0].clientY);
      } else {
        setCanPull(false);
      }
    };

    const handleTouchMove = (e) => {
      if (!canPull || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;

      if (deltaY > 0) {
        // Prevent default scrolling while pulling
        e.preventDefault();
        const distance = Math.min(deltaY * 0.5, threshold * 1.5); // Dampen the pull
        setPullDistance(distance);
      }
    };

    const handleTouchEnd = () => {
      if (!canPull || isRefreshing) return;

      if (pullDistance >= threshold) {
        setIsRefreshing(true);
        setPullDistance(threshold);
        
        // Call refresh callback
        if (onRefresh) {
          Promise.resolve(onRefresh())
            .then(() => {
              // Reset after a short delay
              setTimeout(() => {
                setPullDistance(0);
                setIsRefreshing(false);
              }, 300);
            })
            .catch((error) => {
              console.error('Refresh error:', error);
              // Reset even on error
              setTimeout(() => {
                setPullDistance(0);
                setIsRefreshing(false);
              }, 300);
            });
        } else {
          // Reset if no callback
          setTimeout(() => {
            setPullDistance(0);
            setIsRefreshing(false);
          }, 300);
        }
      } else {
        // Spring back if not enough pull
        setPullDistance(0);
      }
      
      setCanPull(false);
      setStartY(0);
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [canPull, pullDistance, isRefreshing, onRefresh, disabled, startY]);

  const pullPercentage = Math.min((pullDistance / threshold) * 100, 150);
  const shouldShowIndicator = pullDistance > 10;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        height: '100%',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch'
      }}
    >
      {/* Pull-to-refresh indicator */}
      {shouldShowIndicator && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: `${Math.min(pullDistance, threshold * 1.5)}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `translateY(${pullDistance - threshold}px)`,
            transition: isRefreshing ? 'none' : 'transform 0.2s ease-out',
            zIndex: 1000,
            pointerEvents: 'none'
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              opacity: Math.min(pullPercentage / 100, 1),
              transform: `scale(${Math.min(pullPercentage / 100, 1)})`
            }}
          >
            {isRefreshing ? (
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  border: '2px solid var(--accent)',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}
              />
            ) : (
              <div
                style={{
                  fontSize: '24px',
                  transform: `rotate(${pullDistance >= threshold ? 180 : 0}deg)`,
                  transition: 'transform 0.2s ease'
                }}
              >
                ↓
              </div>
            )}
            <div
              style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                fontWeight: pullDistance >= threshold ? 600 : 400
              }}
            >
              {isRefreshing
                ? 'Syncing with Strava...'
                : pullDistance >= threshold
                ? 'Release to refresh'
                : 'Pull to refresh'}
            </div>
          </div>
        </div>
      )}

      {/* Content with pull offset */}
      <div
        style={{
          transform: `translateY(${Math.max(0, pullDistance)}px)`,
          transition: isRefreshing ? 'none' : 'transform 0.2s ease-out',
          minHeight: '100%'
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
