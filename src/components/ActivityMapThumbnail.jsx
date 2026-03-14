import React from 'react';
import { routeToSvg } from '../utils/routeToSvg';

const ActivityMapThumbnail = ({ activityId, onClick, activity }) => {
  const encoded = activity?.map?.summary_polyline || activity?.map?.polyline;
  let svg = null;

  if (encoded) {
    const cacheKey = `activity_svg_${activityId}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        svg = cached;
      } else {
        svg = routeToSvg(encoded, 68, 68);
        if (svg) {
          localStorage.setItem(cacheKey, svg);
        }
      }
    } catch (e) {
      svg = routeToSvg(encoded, 68, 68);
    }
  }

  const hasError = !svg;

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#1a1f2e'
      }}
    >
      {hasError ? (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1a1f2e',
            color: '#9ca3af',
            fontSize: '12px',
            textAlign: 'center',
            padding: '20px',
            zIndex: 1
          }}
        >
          No GPS data available
        </div>
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            pointerEvents: 'none'
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
    </div>
  );
};

export default React.memo(ActivityMapThumbnail);
