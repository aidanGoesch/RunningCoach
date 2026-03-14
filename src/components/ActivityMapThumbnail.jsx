import React, { useState, useEffect, useRef } from 'react';
import { getActivityStreams } from '../services/api';
import { getCachedStreams, cacheStreams } from '../services/streamsCache';

const ActivityMapThumbnail = ({ activityId, onClick, activity }) => {
  const mapId = `map-thumb-${activityId}`;
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const containerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [latlng, setLatlng] = useState(null);

  // Lazy loading with Intersection Observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px' // Start loading 50px before entering viewport
      }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Load streams data when visible
  useEffect(() => {
    if (!isVisible || latlng !== null) return;

    const loadStreams = async () => {
      try {
        // Check cache first
        const cachedLatlng = getCachedStreams(activityId);
        if (cachedLatlng) {
          setLatlng(cachedLatlng);
          setIsLoading(false);
          return;
        }

        // Fetch from API
        const { getStravaTokens } = await import('../services/supabase');
        const tokens = await getStravaTokens();
        const token = tokens?.accessToken;
        
        if (!token) {
          setHasError(true);
          setIsLoading(false);
          return;
        }

        const streams = await getActivityStreams(token, activityId);
        
        if (streams?.latlng?.data && streams.latlng.data.length > 0) {
          // Cache the streams
          cacheStreams(activityId, streams);
          setLatlng(streams.latlng.data);
        } else {
          setHasError(true);
        }
      } catch (err) {
        console.error('Error loading streams for thumbnail:', err);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadStreams();
  }, [isVisible, activityId, latlng]);

  // Initialize map when latlng is available
  useEffect(() => {
    if (!latlng || latlng.length === 0 || mapRef.current) return;

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      const mapElement = document.getElementById(mapId);
      if (!mapElement || mapRef.current) return;

      try {
        // Create map
        const map = L.map(mapId, {
          zoomControl: false,
          attributionControl: false,
          dragging: false,
          touchZoom: false,
          doubleClickZoom: false,
          scrollWheelZoom: false,
          boxZoom: false,
          keyboard: false
        }).setView(latlng[0], 13);

        // Explicitly disable all click events on the map
        map.off('click');
        map.getContainer().style.pointerEvents = 'none';
        
        // Add route polyline - blue color
        const polyline = L.polyline(latlng, { 
          color: '#378ADD', 
          weight: 4 
        }).addTo(map);
        
        map.fitBounds(polyline.getBounds(), { padding: [10, 10] });
        
        mapRef.current = map;

        // Function to disable pointer events on all Leaflet elements
        const disablePointerEvents = () => {
          const mapContainer = map.getContainer();
          
          // Disable pointer events on all panes
          Object.values(map._panes || {}).forEach((pane) => {
            if (pane && pane.style) {
              pane.style.pointerEvents = 'none';
            }
          });
          
          // Disable pointer events on all canvas elements
          const canvases = mapContainer.querySelectorAll('canvas');
          canvases.forEach((canvas) => {
            canvas.style.pointerEvents = 'none';
          });
          
          // Disable on any SVG elements
          const svgs = mapContainer.querySelectorAll('svg');
          svgs.forEach((svg) => {
            svg.style.pointerEvents = 'none';
          });
          
          // Disable on all divs within the map container (Leaflet creates many divs)
          const divs = mapContainer.querySelectorAll('div');
          divs.forEach((div) => {
            div.style.pointerEvents = 'none';
          });
        };

        // Disable pointer events immediately and after a delay
        disablePointerEvents();
        setTimeout(disablePointerEvents, 200);
        setTimeout(disablePointerEvents, 500);

        // Watch for new elements being added and disable pointer events on them
        const mapContainer = map.getContainer();
        const elementObserver = new MutationObserver(() => {
          disablePointerEvents();
        });
        
        elementObserver.observe(mapContainer, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['style']
        });
        
        // Store observer for cleanup
        mapRef.current._elementObserver = elementObserver;

        // Function to update tile layer based on theme
        const updateTileLayer = () => {
          const theme = document.documentElement.getAttribute('data-theme');
          
          // Remove existing tile layer
          if (tileLayerRef.current) {
            map.removeLayer(tileLayerRef.current);
          }

          // Always use dark tiles for thumbnails
          tileLayerRef.current = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '',
            subdomains: 'abcd',
            maxZoom: 19
          }).addTo(map);
        };

        // Set initial tile layer
        updateTileLayer();

        // Watch for theme changes
        const observer = new MutationObserver(updateTileLayer);
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['data-theme']
        });

        // Store observer for cleanup
        mapRef.current._themeObserver = observer;
      } catch (err) {
        console.error('Error initializing map:', err);
        setHasError(true);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      if (mapRef.current) {
        // Cleanup observers
        if (mapRef.current._themeObserver) {
          mapRef.current._themeObserver.disconnect();
        }
        if (mapRef.current._elementObserver) {
          mapRef.current._elementObserver.disconnect();
        }
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [latlng, mapId]);

  // Cleanup map when component unmounts or becomes invisible
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        if (mapRef.current._themeObserver) {
          mapRef.current._themeObserver.disconnect();
        }
        if (mapRef.current._elementObserver) {
          mapRef.current._elementObserver.disconnect();
        }
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Handle click - but don't handle it here, let it bubble to parent ActivityCard
  // The parent ActivityCard already has onClick handler that will handle the click


  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#1a1f2e'
      }}
    >
      {isLoading && (
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
            fontSize: '14px',
            zIndex: 1
          }}
        >
          Loading map...
        </div>
      )}
      
      {hasError && (
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
      )}

      {!isLoading && !hasError && (
        <div
          id={mapId}
          style={{
            width: '100%',
            height: '100%',
            pointerEvents: 'none' // Prevent map interactions - clicks will pass through to parent
          }}
        />
      )}
    </div>
  );
};

export default React.memo(ActivityMapThumbnail);
