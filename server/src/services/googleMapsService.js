/**
 * googleMapsService.js
 * Authoritative Google Maps Platform Service for TeFFe.
 * Handles Google Routes, Geocoding, and Places Autocomplete with
 * intelligent caching, debouncing, and resilient offline fallbacks.
 */

// In-memory ETA cache to throttle Google Routes API calls
// Key: `${orderId}` -> { lat, lng, distanceKm, durationMins, polyline, cachedAt }
const routeCache = new Map();

const getApiKey = () => {
  return (
    process.env.GOOGLE_MAPS_SERVER_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    ''
  );
};

/**
 * Calculates road distance and transit duration between origin and destination.
 * Throttled: Only re-queries Google Routes if rider moved > 150m or cache is older than 60s.
 */
async function getRoadDistanceAndDuration(origin, destination, options = {}) {
  const { orderId, forceRefresh = false } = options;

  const oLat = Number(origin.lat || origin.latitude);
  const oLng = Number(origin.lng || origin.longitude);
  const dLat = Number(destination.lat || destination.latitude);
  const dLng = Number(destination.lng || destination.longitude);

  if (!oLat || !oLng || !dLat || !dLng) {
    return {
      distanceKm: 3.5,
      durationMinutes: 15,
      polyline: '',
      isGoogleRoute: false,
    };
  }

  // Check cache for this order
  if (orderId && !forceRefresh && routeCache.has(orderId)) {
    const cached = routeCache.get(orderId);
    const now = Date.now();
    const ageSeconds = (now - cached.cachedAt) / 1000;

    // Movement delta check in meters (1 deg ~ 111km)
    const latDeltaM = Math.abs(cached.lat - oLat) * 111000;
    const lngDeltaM = Math.abs(cached.lng - oLng) * 111000;
    const movedM = Math.sqrt(latDeltaM * latDeltaM + lngDeltaM * lngDeltaM);

    if (ageSeconds < 60 && movedM < 150) {
      return {
        distanceKm: cached.distanceKm,
        durationMinutes: cached.durationMinutes,
        polyline: cached.polyline || '',
        isGoogleRoute: cached.isGoogleRoute,
        cached: true,
      };
    }
  }

  const apiKey = getApiKey();

  // If Google API Key is present, call Google Routes API
  if (apiKey && !apiKey.includes('placeholder') && !apiKey.includes('your_')) {
    try {
      const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
        },
        body: JSON.stringify({
          origin: {
            location: {
              latLng: { latitude: oLat, longitude: oLng },
            },
          },
          destination: {
            location: {
              latLng: { latitude: dLat, longitude: dLng },
            },
          },
          travelMode: 'TWO_WHEELER', // Two-wheeler for Indian delivery bikes
          routingPreference: 'TRAFFIC_AWARE',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const route = data.routes && data.routes[0];
        if (route) {
          const distanceMeters = route.distanceMeters || 3500;
          const durationSecondsStr = (route.duration || '900s').replace('s', '');
          const durationSeconds = Number(durationSecondsStr) || 900;

          const distanceKm = Number((distanceMeters / 1000).toFixed(2));
          const durationMinutes = Math.max(2, Math.round(durationSeconds / 60));
          const polyline = route.polyline?.encodedPolyline || '';

          const result = {
            distanceKm,
            durationMinutes,
            polyline,
            isGoogleRoute: true,
          };

          if (orderId) {
            routeCache.set(orderId, {
              ...result,
              lat: oLat,
              lng: oLng,
              cachedAt: Date.now(),
            });
          }

          return result;
        }
      } else {
        const errText = await response.text();
        console.warn('[Google Routes] API error response:', errText);
      }
    } catch (err) {
      console.warn('[Google Routes] Fetch failed:', err.message);
    }
  }

  // Fallback: Calibrated mathematical road model (1.3x road tortuosity factor)
  const R = 6371;
  const dLatRad = ((dLat - oLat) * Math.PI) / 180;
  const dLngRad = ((dLng - oLng) * Math.PI) / 180;
  const a =
    Math.sin(dLatRad / 2) * Math.sin(dLatRad / 2) +
    Math.cos((oLat * Math.PI) / 180) *
      Math.cos((dLat * Math.PI) / 180) *
      Math.sin(dLngRad / 2) *
      Math.sin(dLngRad / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightLine = R * c;
  const roadDistKm = Number((straightLine * 1.3).toFixed(2));
  const travelMins = Math.max(2, Math.round((roadDistKm / 22) * 60));

  const fallbackResult = {
    distanceKm: roadDistKm,
    durationMinutes: travelMins,
    polyline: '',
    isGoogleRoute: false,
  };

  if (orderId) {
    routeCache.set(orderId, {
      ...fallbackResult,
      lat: oLat,
      lng: oLng,
      cachedAt: Date.now(),
    });
  }

  return fallbackResult;
}

/**
 * Google Reverse Geocoding API: converts lat/lng coordinates into a structured address.
 */
async function reverseGeocode(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);

  if (isNaN(latitude) || isNaN(longitude)) {
    throw new Error('Valid latitude and longitude are required');
  }

  const apiKey = getApiKey();

  if (apiKey && !apiKey.includes('placeholder') && !apiKey.includes('your_')) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}&language=en`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'OK' && data.results && data.results.length > 0) {
          const result = data.results[0];
          let line1 = '';
          let locality = '';
          let city = 'Ranchi';
          let state = 'Jharkhand';
          let pincode = '834001';

          for (const component of result.address_components) {
            const types = component.types;
            if (types.includes('premise') || types.includes('subpremise') || types.includes('route')) {
              line1 = line1 ? `${line1}, ${component.long_name}` : component.long_name;
            }
            if (types.includes('sublocality') || types.includes('neighborhood')) {
              locality = component.long_name;
            }
            if (types.includes('locality')) {
              city = component.long_name;
            }
            if (types.includes('administrative_area_level_1')) {
              state = component.long_name;
            }
            if (types.includes('postal_code')) {
              pincode = component.long_name;
            }
          }

          if (!line1 && locality) line1 = locality;
          if (!line1) line1 = result.formatted_address.split(',')[0] || 'Current Location';

          return {
            success: true,
            addressLine: line1,
            locality: locality || city,
            city,
            state,
            pincode,
            formattedAddress: result.formatted_address,
            latitude,
            longitude,
            provider: 'google',
          };
        }
      }
    } catch (err) {
      console.warn('[Google Geocode] API request failed:', err.message);
    }
  }

  // Graceful fallback for development / offline environments
  return {
    success: true,
    addressLine: 'Albert Ekka Chowk, Main Road',
    locality: 'Kishore Ganj',
    city: 'Ranchi',
    state: 'Jharkhand',
    pincode: '834001',
    formattedAddress: 'Kishore Ganj, Harmu Road, Ranchi, Jharkhand 834001',
    latitude,
    longitude,
    provider: 'fallback',
  };
}

/**
 * Google Places Autocomplete: search query -> list of predicted locations.
 */
async function placesAutocomplete(query, location = null) {
  if (!query || query.trim().length === 0) {
    return { success: true, predictions: [] };
  }

  const apiKey = getApiKey();

  if (apiKey && !apiKey.includes('placeholder') && !apiKey.includes('your_')) {
    try {
      let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
        query
      )}&key=${apiKey}&components=country:in&language=en`;

      if (location && location.lat && location.lng) {
        url += `&location=${location.lat},${location.lng}&radius=50000`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'OK' && data.predictions) {
          const predictions = data.predictions.map((p) => ({
            placeId: p.place_id,
            description: p.description,
            mainText: p.structured_formatting?.main_text || p.description,
            secondaryText: p.structured_formatting?.secondary_text || '',
          }));
          return { success: true, predictions, provider: 'google' };
        }
      }
    } catch (err) {
      console.warn('[Google Places] Autocomplete request failed:', err.message);
    }
  }

  // Fallback demo places in Ranchi for seamless offline dev experience
  const fallbackList = [
    { placeId: 'ranchi_1', description: 'Harmu Road, Kishore Ganj, Ranchi', mainText: 'Kishore Ganj', secondaryText: 'Harmu Road, Ranchi' },
    { placeId: 'ranchi_2', description: 'Main Road, Albert Ekka Chowk, Ranchi', mainText: 'Albert Ekka Chowk', secondaryText: 'Main Road, Ranchi' },
    { placeId: 'ranchi_3', description: 'Morabadi Ground, Ranchi', mainText: 'Morabadi', secondaryText: 'Ranchi, Jharkhand' },
    { placeId: 'ranchi_4', description: 'Kanke Road, Ranchi', mainText: 'Kanke Road', secondaryText: 'Ranchi, Jharkhand' },
  ].filter((p) => p.description.toLowerCase().includes(query.toLowerCase()));

  return { success: true, predictions: fallbackList, provider: 'fallback' };
}

/**
 * Google Place Details: gets exact lat/lng coordinates and address for a placeId.
 */
async function getPlaceDetails(placeId) {
  const apiKey = getApiKey();

  if (apiKey && !apiKey.includes('placeholder') && !apiKey.includes('your_')) {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
        placeId
      )}&fields=formatted_address,geometry,name,address_components&key=${apiKey}`;

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'OK' && data.result) {
          const loc = data.result.geometry?.location || {};
          return {
            success: true,
            name: data.result.name,
            formattedAddress: data.result.formatted_address,
            latitude: loc.lat,
            longitude: loc.lng,
            provider: 'google',
          };
        }
      }
    } catch (err) {
      console.warn('[Google Place Details] Request failed:', err.message);
    }
  }

  return {
    success: true,
    name: 'Kishore Ganj',
    formattedAddress: 'Kishore Ganj, Harmu Road, Ranchi, Jharkhand 834001',
    latitude: 23.3441,
    longitude: 85.3096,
    provider: 'fallback',
  };
}

module.exports = {
  getRoadDistanceAndDuration,
  reverseGeocode,
  placesAutocomplete,
  getPlaceDetails,
};
