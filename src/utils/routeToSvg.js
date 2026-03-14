/**
 * Decode Google/Strava encoded polyline to [[lat, lng], ...] array.
 * @param {string} encoded - Encoded polyline string
 * @returns {Array<[number, number]>} Array of [lat, lng] pairs
 */
export function decodePolyline(encoded) {
  if (!encoded || typeof encoded !== 'string') return [];
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

/**
 * Generate static SVG string from lat/lng route points.
 * @param {Array<[number, number]>|string} latlngsOrEncoded - Array of [lat, lng] or encoded polyline string
 * @param {number} width - SVG width (default 68)
 * @param {number} height - SVG height (default 68)
 * @returns {string|null} SVG string or null if insufficient data
 */
export function routeToSvg(latlngsOrEncoded, width = 68, height = 68) {
  let latlngs = latlngsOrEncoded;
  if (typeof latlngs === 'string') {
    latlngs = decodePolyline(latlngs);
  }
  if (!latlngs || latlngs.length < 2) return null;

  const lats = latlngs.map((p) => p[0]);
  const lngs = latlngs.map((p) => p[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const pad = 6;
  const scaleX = (width - pad * 2) / (maxLng - minLng || 1);
  const scaleY = (height - pad * 2) / (maxLat - minLat || 1);
  const scale = Math.min(scaleX, scaleY);
  const points = latlngs
    .map(([lat, lng]) => {
      const x = pad + (lng - minLng) * scale;
      const y = height - pad - (lat - minLat) * scale;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="#1a1f2e"/>
    <polyline points="${points}" fill="none" stroke="#378ADD" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}
