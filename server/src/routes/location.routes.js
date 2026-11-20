const { Router } = require('express');
const {
  reverseGeocode,
  placesAutocomplete,
  placeDetails,
  roadDistance,
  geocodeAddress,
} = require('../controllers/location.controller');

const router = Router();

// Public location services for address picker and delivery setup
router.get('/reverse-geocode', reverseGeocode);
router.get('/places-autocomplete', placesAutocomplete);
router.get('/place-details/:placeId', placeDetails);
router.get('/road-distance', roadDistance);
router.get('/geocode', geocodeAddress);
router.post('/geocode', geocodeAddress);

module.exports = router;
