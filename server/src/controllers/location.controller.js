const googleMapsService = require('../services/googleMapsService');

/**
 * GET /api/location/reverse-geocode?lat=...&lng=...
 */
const reverseGeocode = async (req, res, next) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: 'Latitude and longitude query params are required' });
    }

    const data = await googleMapsService.reverseGeocode(lat, lng);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/location/places-autocomplete?query=...&lat=...&lng=...
 */
const placesAutocomplete = async (req, res, next) => {
  try {
    const { query, lat, lng } = req.query;
    const location = lat && lng ? { lat: Number(lat), lng: Number(lng) } : null;

    const data = await googleMapsService.placesAutocomplete(query, location);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/location/place-details/:placeId
 */
const placeDetails = async (req, res, next) => {
  try {
    const { placeId } = req.params;
    if (!placeId) {
      return res.status(400).json({ success: false, message: 'placeId parameter is required' });
    }

    const data = await googleMapsService.getPlaceDetails(placeId);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/location/road-distance
 */
const roadDistance = async (req, res, next) => {
  try {
    const { originLat, originLng, destLat, destLng, orderId } = req.query;
    if (!originLat || !originLng || !destLat || !destLng) {
      return res.status(400).json({
        success: false,
        message: 'originLat, originLng, destLat, and destLng query parameters are required',
      });
    }

    const data = await googleMapsService.getRoadDistanceAndDuration(
      { lat: originLat, lng: originLng },
      { lat: destLat, lng: destLng },
      { orderId }
    );

    res.status(200).json({
      success: true,
      ...data,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  reverseGeocode,
  placesAutocomplete,
  placeDetails,
  roadDistance,
};
