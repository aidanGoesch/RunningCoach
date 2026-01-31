import { useEffect, useRef } from 'react';

/**
 * Hook to detect left-to-right swipe gestures for back navigation
 * @param {Function} onSwipeBack - Callback function when swipe detected
 * @param {Object} options - Configuration options
 * @param {number} options.minSwipeDistance - Minimum horizontal distance (default: 50px)
 * @param {number} options.maxVerticalDeviation - Maximum vertical deviation (default: 30px)
 * @param {number} options.velocityThreshold - Minimum velocity for immediate trigger (default: 0.3)
 */
export const useSwipeBack = (onSwipeBack, options = {}) => {
  const {
    minSwipeDistance = 50,
    maxVerticalDeviation = 30,
    velocityThreshold = 0.3
  } = options;

  const touchStartRef = useRef(null);
  const touchEndRef = useRef(null);
  const elementRef = useRef(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !onSwipeBack) return;

    const handleTouchStart = (e) => {
      touchEndRef.current = null;
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now()
      };
    };

    const handleTouchMove = (e) => {
      touchEndRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now()
      };
    };

    const handleTouchEnd = () => {
      if (!touchStartRef.current || !touchEndRef.current) return;

      const start = touchStartRef.current;
      const end = touchEndRef.current;

      const deltaX = end.x - start.x;
      const deltaY = Math.abs(end.y - start.y);
      const deltaTime = end.time - start.time;
      const velocity = Math.abs(deltaX) / deltaTime;

      // Check if swipe is left-to-right (positive deltaX)
      // and within vertical deviation limits
      if (
        deltaX > minSwipeDistance &&
        deltaY < maxVerticalDeviation &&
        (deltaX > minSwipeDistance * 1.5 || velocity > velocityThreshold)
      ) {
        onSwipeBack();
      }

      touchStartRef.current = null;
      touchEndRef.current = null;
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onSwipeBack, minSwipeDistance, maxVerticalDeviation, velocityThreshold]);

  return elementRef;
};
