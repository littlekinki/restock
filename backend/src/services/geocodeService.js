const axios = require('axios');

// ============================================================
// NOMINATIM GEOCODING SERVICE
// ============================================================
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'Restock/1.0 (contact: restock@morwave.com)';

// Simple in-memory cache (per server instance)
const cache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Rate limiter — max 1 request per second
let lastRequestAt = 0;
const MIN_INTERVAL_MS = 1100;

async function waitForRateLimit() {
    const now = Date.now();
    const elapsed = now - lastRequestAt;
    if (elapsed < MIN_INTERVAL_MS) {
        await new Promise(r => setTimeout(r, MIN_INTERVAL_MS - elapsed));
    }
    lastRequestAt = Date.now();
}

// ============================================================
// GEOCODE — convert text address to lat/lng
// ============================================================
// Returns { lat, lng, displayName, success: true } on success
// Returns { success: false, error: '...' } on failure
// ============================================================
async function geocodeAddress(street, city, state, country = 'Nigeria') {
    // Build query string
    const parts = [street, city, state, country].filter(Boolean);
    const query = parts.join(', ').trim();

    if (!query || query.length < 3) {
        return { success: false, error: 'Address too short' };
    }

    // Check cache
    const cacheKey = query.toLowerCase();
    const cached = cache.get(cacheKey);
    if (cached && (Date.now() - cached.at) < CACHE_TTL_MS) {
        console.log(`🗺️ Geocode CACHE HIT: "${query}"`);
        return cached.result;
    }

    try {
        await waitForRateLimit();

        const response = await axios.get(NOMINATIM_URL, {
            params: {
                q: query,
                format: 'json',
                limit: 1,
                addressdetails: 1,
            },
            headers: {
                'User-Agent': USER_AGENT,
                'Accept-Language': 'en',
            },
            timeout: 8000,
        });

        const results = response.data;
        if (!Array.isArray(results) || results.length === 0) {
            console.log(`🗺️ Geocode NO RESULT for: "${query}"`);
            const result = { success: false, error: 'Address not found' };
            cache.set(cacheKey, { result, at: Date.now() });
            return result;
        }

        const top = results[0];
        const result = {
            success: true,
            lat: parseFloat(top.lat),
            lng: parseFloat(top.lon),
            displayName: top.display_name || query,
        };

        console.log(`🗺️ Geocoded "${query}" → ${result.lat}, ${result.lng}`);
        cache.set(cacheKey, { result, at: Date.now() });
        return result;

    } catch (error) {
        console.error('🗺️ Geocode error:', error.message);
        return { success: false, error: 'Geocoding service unavailable' };
    }
}

module.exports = { geocodeAddress };