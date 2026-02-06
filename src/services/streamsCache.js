// Streams caching service for efficient memory usage
// Caches only latlng data to minimize memory footprint

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const MAX_CACHE_SIZE = 20; // Maximum number of activities to cache

// In-memory cache (LRU-like structure)
const memoryCache = new Map();
const accessOrder = [];

// Get cache key
const getCacheKey = (activityId) => `streams_${activityId}`;

// Get from localStorage
const getFromStorage = (activityId) => {
  try {
    const key = getCacheKey(activityId);
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const { latlng, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;
    
    if (age > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    
    return latlng;
  } catch (err) {
    console.error('Error reading from localStorage cache:', err);
    return null;
  }
};

// Save to localStorage
const saveToStorage = (activityId, latlng) => {
  try {
    const key = getCacheKey(activityId);
    const data = {
      latlng,
      timestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error('Error saving to localStorage cache:', err);
    // If storage is full, try to evict old entries
    try {
      const keys = Object.keys(localStorage);
      const streamKeys = keys.filter(k => k.startsWith('streams_'));
      if (streamKeys.length > MAX_CACHE_SIZE) {
        // Remove oldest entries
        const entries = streamKeys.map(k => ({
          key: k,
          timestamp: JSON.parse(localStorage.getItem(k)).timestamp
        })).sort((a, b) => a.timestamp - b.timestamp);
        
        // Remove oldest 25% of entries
        const toRemove = Math.ceil(entries.length * 0.25);
        entries.slice(0, toRemove).forEach(e => localStorage.removeItem(e.key));
      }
    } catch (evictErr) {
      console.error('Error evicting cache entries:', evictErr);
    }
  }
};

// Update access order for LRU
const updateAccessOrder = (activityId) => {
  const index = accessOrder.indexOf(activityId);
  if (index > -1) {
    accessOrder.splice(index, 1);
  }
  accessOrder.push(activityId);
  
  // Evict oldest if cache is too large
  if (accessOrder.length > MAX_CACHE_SIZE) {
    const oldest = accessOrder.shift();
    memoryCache.delete(oldest);
  }
};

// Get cached streams (latlng only)
export const getCachedStreams = (activityId) => {
  // Check memory cache first
  if (memoryCache.has(activityId)) {
    updateAccessOrder(activityId);
    return memoryCache.get(activityId);
  }
  
  // Check localStorage
  const latlng = getFromStorage(activityId);
  if (latlng) {
    // Restore to memory cache
    memoryCache.set(activityId, latlng);
    updateAccessOrder(activityId);
    return latlng;
  }
  
  return null;
};

// Cache streams (extract and cache only latlng)
export const cacheStreams = (activityId, streams) => {
  if (!streams?.latlng?.data || streams.latlng.data.length === 0) {
    return;
  }
  
  const latlng = streams.latlng.data;
  
  // Store in memory cache
  memoryCache.set(activityId, latlng);
  updateAccessOrder(activityId);
  
  // Store in localStorage
  saveToStorage(activityId, latlng);
};

// Clear cache for a specific activity
export const clearCachedStreams = (activityId) => {
  memoryCache.delete(activityId);
  const index = accessOrder.indexOf(activityId);
  if (index > -1) {
    accessOrder.splice(index, 1);
  }
  
  const key = getCacheKey(activityId);
  localStorage.removeItem(key);
};

// Clear all cached streams
export const clearAllCachedStreams = () => {
  memoryCache.clear();
  accessOrder.length = 0;
  
  // Clear from localStorage
  const keys = Object.keys(localStorage);
  keys.forEach(k => {
    if (k.startsWith('streams_')) {
      localStorage.removeItem(k);
    }
  });
};

// Get cache stats (for debugging)
export const getCacheStats = () => {
  return {
    memorySize: memoryCache.size,
    storageSize: Object.keys(localStorage).filter(k => k.startsWith('streams_')).length
  };
};
