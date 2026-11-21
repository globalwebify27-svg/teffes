import 'dart:math' as math;
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/constants/api_endpoints.dart';
import '../core/network/api_client.dart';
import '../models/user_model.dart';

class LocationProvider with ChangeNotifier {
  final ApiClient _api = ApiClient();

  AddressModel? _selectedAddress;
  List<AddressModel> _savedAddresses = [];
  bool _isLoading = false;
  bool _isGpsDetected = false;
  bool _hasPromptedPermission = false;

  AddressModel? get selectedAddress => _selectedAddress;
  List<AddressModel> get savedAddresses => _savedAddresses;
  bool get isLoading => _isLoading;
  bool get isGpsDetected => _isGpsDetected;
  bool get hasPromptedPermission => _hasPromptedPermission;
  bool get hasSelectedAddress => _selectedAddress != null;
  double? get latitude => _selectedAddress?.latitude;
  double? get longitude => _selectedAddress?.longitude;

  /// Central Hub latitude & longitude (Ranchi Doranda / Main Counter)
  static const double storeLat = 23.3320;
  static const double storeLng = 85.3210;

  /// Calculates Haversine distance in km between two GPS coordinates
  static double calculateHaversineDistanceKm(double lat1, double lon1, double lat2, double lon2) {
    const double r = 6371.0;
    final dLat = (lat2 - lat1) * math.pi / 180.0;
    final dLon = (lon2 - lon1) * math.pi / 180.0;
    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(lat1 * math.pi / 180.0) * math.cos(lat2 * math.pi / 180.0) *
        math.sin(dLon / 2) * math.sin(dLon / 2);
    final c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
    return r * c;
  }

  /// Distance from selected address to central store in km
  double? get activeDistanceKm {
    final double? addrLat = _selectedAddress?.latitude ?? latitude;
    final double? addrLng = _selectedAddress?.longitude ?? longitude;
    if (addrLat == null || addrLng == null) return null;
    return calculateHaversineDistanceKm(addrLat, addrLng, storeLat, storeLng);
  }

  /// Whether current active location is outside standard 10km delivery radius
  bool get isOutOfDeliveryRadius {
    final dist = activeDistanceKm;
    if (dist == null) return false;
    return dist > 10.0;
  }

  String get activeLabel {
    if (_selectedAddress != null) {
      return _selectedAddress!.tag;
    }
    if (_isGpsDetected) {
      return 'Current Location';
    }
    return 'Select Location';
  }

  String get activeAddressString {
    if (_selectedAddress != null) {
      return _selectedAddress!.fullAddress;
    }
    return 'Tap to choose delivery address';
  }

  LocationProvider() {
    _loadPersistedLocation();
    fetchAddresses();
  }

  Future<void> _loadPersistedLocation() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _hasPromptedPermission = prefs.getBool('has_prompted_location_permission') ?? false;
      final savedId = prefs.getString('selected_addr_id');
      if (savedId != null && _selectedAddress == null) {
        _selectedAddress = AddressModel(
          id: savedId,
          tag: prefs.getString('selected_addr_tag') ?? 'Current Location',
          line1: prefs.getString('selected_addr_line1') ?? 'Ranchi',
          line2: prefs.getString('selected_addr_line2'),
          city: prefs.getString('selected_addr_city') ?? 'Ranchi',
          pincode: prefs.getString('selected_addr_pincode') ?? '834001',
          landmark: prefs.getString('selected_addr_landmark'),
          latitude: prefs.getDouble('selected_addr_lat'),
          longitude: prefs.getDouble('selected_addr_lng'),
          isDefault: false,
        );
        _isGpsDetected = savedId.startsWith('gps-');
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<void> _persistSelectedAddress(AddressModel addr) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('selected_addr_id', addr.id);
      await prefs.setString('selected_addr_tag', addr.tag);
      await prefs.setString('selected_addr_line1', addr.line1);
      if (addr.line2 != null) {
        await prefs.setString('selected_addr_line2', addr.line2!);
      } else {
        await prefs.remove('selected_addr_line2');
      }
      await prefs.setString('selected_addr_city', addr.city);
      await prefs.setString('selected_addr_pincode', addr.pincode);
      if (addr.landmark != null) {
        await prefs.setString('selected_addr_landmark', addr.landmark!);
      } else {
        await prefs.remove('selected_addr_landmark');
      }
      if (addr.latitude != null) {
        await prefs.setDouble('selected_addr_lat', addr.latitude!);
      } else {
        await prefs.remove('selected_addr_lat');
      }
      if (addr.longitude != null) {
        await prefs.setDouble('selected_addr_lng', addr.longitude!);
      } else {
        await prefs.remove('selected_addr_lng');
      }
    } catch (_) {}
  }

  void markPermissionPrompted() async {
    _hasPromptedPermission = true;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('has_prompted_location_permission', true);
    } catch (_) {}
  }

  /// Real GPS location detection: queries device GPS, requests permission, and reverse-geocodes locality
  Future<bool> detectGpsLocation({bool userTriggered = false}) async {
    _isLoading = true;
    markPermissionPrompted();

    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        // Location service disabled on device
        _fallbackGpsLocation(userTriggered);
        _isLoading = false;
        notifyListeners();
        return false;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          _fallbackGpsLocation(userTriggered);
          _isLoading = false;
          notifyListeners();
          return false;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        _fallbackGpsLocation(userTriggered);
        _isLoading = false;
        notifyListeners();
        return false;
      }

      // Fetch position with high accuracy
      Position? position;
      try {
        position = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
            timeLimit: Duration(seconds: 10),
          ),
        );
      } catch (_) {
        position = await Geolocator.getLastKnownPosition();
      }

      double detectedLat = position?.latitude ?? 23.3441;
      double detectedLng = position?.longitude ?? 85.3096;

      String localityName = 'Current Location';
      String line1 = 'Live Location';
      String? line2;
      String city = 'Ranchi';
      String pincode = '834001';

      if (position != null) {
        bool resolvedLive = false;
        try {
          // Google Geocoding via TeFFe backend proxy (API key protected on server)
          final res = await _api.get(
            ApiEndpoints.reverseGeocode,
            queryParameters: {
              'lat': position.latitude,
              'lng': position.longitude,
            },
          );

          if (res.data != null &&
              res.data['success'] == true &&
              res.data['provider'] != 'fallback' &&
              res.data['locality'] != 'Kishore Ganj') {
            line1 = res.data['addressLine'] ?? 'Live Location';
            localityName = res.data['locality'] ?? res.data['city'] ?? 'Current Location';
            city = res.data['city'] ?? 'Ranchi';
            pincode = res.data['pincode'] ?? '834001';
            line2 = city;
            if (res.data['latitude'] != null) detectedLat = (res.data['latitude'] as num).toDouble();
            if (res.data['longitude'] != null) detectedLng = (res.data['longitude'] as num).toDouble();
            resolvedLive = true;
          }
        } catch (e) {
          debugPrint('Backend reverse geocoding error: $e');
        }

        // If backend proxy didn't resolve live locality or returned fallback, query Nominatim directly
        if (!resolvedLive) {
          await _reverseGeocodeNominatim(position.latitude, position.longitude, (l1, loc, c, p) {
            line1 = l1;
            localityName = loc;
            city = c;
            pincode = p;
            line2 = c;
          });
        }
      }

      final gpsLocation = AddressModel(
        id: 'gps-${DateTime.now().millisecondsSinceEpoch}',
        tag: localityName,
        line1: line1,
        line2: line2,
        city: city,
        pincode: pincode,
        latitude: detectedLat,
        longitude: detectedLng,
        isDefault: false,
      );

      _selectedAddress = gpsLocation;
      _isGpsDetected = true;
      _isLoading = false;
      _persistSelectedAddress(gpsLocation);
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('detectGpsLocation error: $e');
      _fallbackGpsLocation(userTriggered);
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  void _fallbackGpsLocation(bool userTriggered) {
    if (_selectedAddress == null || userTriggered) {
      final fallback = AddressModel(
        id: 'gps-${DateTime.now().millisecondsSinceEpoch}',
        tag: 'Current Location',
        line1: 'Live Location',
        line2: 'Ranchi',
        city: 'Ranchi',
        pincode: '834001',
        latitude: 23.3441,
        longitude: 85.3096,
        isDefault: false,
      );
      _selectedAddress = fallback;
      _isGpsDetected = true;
      _persistSelectedAddress(fallback);
    }
  }

  Future<void> _reverseGeocodeNominatim(
    double lat,
    double lng,
    void Function(String line1, String locality, String city, String pincode) onResult,
  ) async {
    try {
      final dio = Dio();
      final res = await dio.get(
        'https://nominatim.openstreetmap.org/reverse',
        queryParameters: {
          'format': 'json',
          'lat': lat,
          'lon': lng,
          'zoom': 18,
          'addressdetails': 1,
        },
        options: Options(
          headers: {'User-Agent': 'TeffesCustomerApp/1.0 (contact@teffes.com)'},
          sendTimeout: const Duration(seconds: 5),
          receiveTimeout: const Duration(seconds: 5),
        ),
      );
      if (res.data != null && res.data['address'] is Map) {
        final addr = res.data['address'] as Map<String, dynamic>;
        final locality = addr['suburb'] ??
            addr['neighbourhood'] ??
            addr['residential'] ??
            addr['city_district'] ??
            addr['county'] ??
            addr['city'] ??
            'Current Location';
        final road = addr['road'] ?? addr['street'] ?? locality;
        final city = addr['city'] ?? addr['town'] ?? addr['village'] ?? addr['state_district'] ?? 'Ranchi';
        final pincode = addr['postcode'] ?? '834001';
        onResult(road.toString(), locality.toString(), city.toString(), pincode.toString());
      }
    } catch (e) {
      debugPrint('Nominatim direct reverse geocode error: $e');
    }
  }

  /// Google Places Autocomplete search for address selection
  Future<List<Map<String, dynamic>>> searchPlaces(String query) async {
    if (query.trim().isEmpty) return [];
    try {
      final res = await _api.get(
        ApiEndpoints.placesAutocomplete,
        queryParameters: {'query': query.trim()},
      );
      if (res.data != null && res.data['success'] == true && res.data['predictions'] is List) {
        return List<Map<String, dynamic>>.from(res.data['predictions']);
      }
    } catch (e) {
      debugPrint('Places autocomplete search error: $e');
    }
    return [];
  }

  Future<void> fetchAddresses() async {
    _isLoading = true;
    notifyListeners();

    try {
      final res = await _api.get(ApiEndpoints.addresses);
      if (res.data['success'] == true && res.data['addresses'] is List) {
        _savedAddresses = (res.data['addresses'] as List)
            .map((a) => AddressModel.fromJson(a as Map<String, dynamic>))
            .toList();

        if (_savedAddresses.isNotEmpty) {
          final existing = _selectedAddress != null
              ? _savedAddresses.firstWhere(
                  (a) => a.id == _selectedAddress!.id,
                  orElse: () => _savedAddresses.firstWhere(
                    (a) => a.isDefault,
                    orElse: () => _savedAddresses.first,
                  ),
                )
              : _savedAddresses.firstWhere(
                  (a) => a.isDefault,
                  orElse: () => _savedAddresses.first,
                );
          _selectedAddress = existing;
          _persistSelectedAddress(existing);
        } else {
          if (!_isGpsDetected) {
            _selectedAddress = null;
          }
        }
      } else {
        _savedAddresses = [];
        _selectedAddress = null;
      }
    } catch (_) {
      // Gracefully ignore 401 when user is not yet logged in
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void setSavedAddresses(List<AddressModel> addrs) {
    if (addrs.isNotEmpty) {
      _savedAddresses = List<AddressModel>.from(addrs);
      final def = _savedAddresses.firstWhere(
        (a) => a.isDefault,
        orElse: () => _savedAddresses.first,
      );
      _selectedAddress = def;
      notifyListeners();
    }
  }

  void selectAddress(AddressModel address) {
    _selectedAddress = address;
    _isGpsDetected = address.id.startsWith('gps-');
    _persistSelectedAddress(address);
    notifyListeners();
  }

  // High-accuracy offline coordinates for key Indian zones (0ms, 100% resilient)
  static final Map<String, Map<String, dynamic>> _pincodeCoordinates = {
    // Ranchi Hubs & Localities (all 834xxx within ~0-6 km of store)
    '834001': {'lat': 23.3441, 'lng': 85.3096, 'city': 'Ranchi', 'state': 'Jharkhand'}, // Kishore Ganj / Main Road
    '834002': {'lat': 23.3320, 'lng': 85.3210, 'city': 'Ranchi', 'state': 'Jharkhand'}, // Doranda / Hinoo
    '834003': {'lat': 23.3600, 'lng': 85.3350, 'city': 'Ranchi', 'state': 'Jharkhand'}, // Morabadi
    '834004': {'lat': 23.3750, 'lng': 85.3520, 'city': 'Ranchi', 'state': 'Jharkhand'}, // Bariatu
    '834005': {'lat': 23.3850, 'lng': 85.3100, 'city': 'Ranchi', 'state': 'Jharkhand'}, // Ratu
    '834006': {'lat': 23.3620, 'lng': 85.3300, 'city': 'Ranchi', 'state': 'Jharkhand'}, // Kanke
    '834008': {'lat': 23.3100, 'lng': 85.2900, 'city': 'Ranchi', 'state': 'Jharkhand'}, // Hatia / Dhurwa
    '834009': {'lat': 23.3700, 'lng': 85.3250, 'city': 'Ranchi', 'state': 'Jharkhand'}, // Morabadi North
    '834010': {'lat': 23.3750, 'lng': 85.2950, 'city': 'Ranchi', 'state': 'Jharkhand'}, // Ratu Road
    '834011': {'lat': 23.3400, 'lng': 85.3500, 'city': 'Ranchi', 'state': 'Jharkhand'}, // Kokar / Lalpur
    '834012': {'lat': 23.3950, 'lng': 85.3350, 'city': 'Ranchi', 'state': 'Jharkhand'}, // BIT Mesra
    // Pune Localities (411xxx ~1300 km away)
    '411038': {'lat': 18.5074, 'lng': 73.8077, 'city': 'Pune', 'state': 'Maharashtra'}, // Kothrud
    '411001': {'lat': 18.5204, 'lng': 73.8567, 'city': 'Pune', 'state': 'Maharashtra'}, // Pune Station
    '411004': {'lat': 18.5167, 'lng': 73.8417, 'city': 'Pune', 'state': 'Maharashtra'}, // Deccan Gymkhana
    '411014': {'lat': 18.5529, 'lng': 73.9350, 'city': 'Pune', 'state': 'Maharashtra'}, // Viman Nagar
    '411057': {'lat': 18.5913, 'lng': 73.7389, 'city': 'Pune', 'state': 'Maharashtra'}, // Hinjewadi
  };

  static Map<String, dynamic> _fallbackIndianPincodeCoordinates(String cleanPin) {
    if (_pincodeCoordinates.containsKey(cleanPin)) {
      return _pincodeCoordinates[cleanPin]!;
    }
    if (cleanPin.startsWith('834')) {
      return {'lat': 23.3500, 'lng': 85.3300, 'city': 'Ranchi', 'state': 'Jharkhand'};
    }
    if (cleanPin.startsWith('411')) {
      return {'lat': 18.5204, 'lng': 73.8567, 'city': 'Pune', 'state': 'Maharashtra'};
    }
    if (cleanPin.startsWith('400')) {
      return {'lat': 19.0760, 'lng': 72.8777, 'city': 'Mumbai', 'state': 'Maharashtra'};
    }
    if (cleanPin.startsWith('110')) {
      return {'lat': 28.6139, 'lng': 77.2090, 'city': 'New Delhi', 'state': 'Delhi'};
    }
    if (cleanPin.startsWith('560')) {
      return {'lat': 12.9716, 'lng': 77.5946, 'city': 'Bengaluru', 'state': 'Karnataka'};
    }
    if (cleanPin.startsWith('500')) {
      return {'lat': 17.3850, 'lng': 78.4867, 'city': 'Hyderabad', 'state': 'Telangana'};
    }
    if (cleanPin.startsWith('700')) {
      return {'lat': 22.5726, 'lng': 88.3639, 'city': 'Kolkata', 'state': 'West Bengal'};
    }
    if (cleanPin.startsWith('600')) {
      return {'lat': 13.0827, 'lng': 80.2707, 'city': 'Chennai', 'state': 'Tamil Nadu'};
    }
    if (cleanPin.startsWith('800')) {
      return {'lat': 25.5941, 'lng': 85.1376, 'city': 'Patna', 'state': 'Bihar'};
    }
    if (cleanPin.startsWith('835')) {
      return {'lat': 23.4000, 'lng': 85.1500, 'city': 'Ranchi Rural', 'state': 'Jharkhand'};
    }
    if (cleanPin.startsWith('831')) {
      return {'lat': 22.8046, 'lng': 86.2029, 'city': 'Jamshedpur', 'state': 'Jharkhand'};
    }
    if (cleanPin.startsWith('826')) {
      return {'lat': 23.7957, 'lng': 86.4304, 'city': 'Dhanbad', 'state': 'Jharkhand'};
    }

    switch (cleanPin[0]) {
      case '1': return {'lat': 28.6139, 'lng': 77.2090, 'city': 'North Zone', 'state': 'India'};
      case '2': return {'lat': 26.8467, 'lng': 80.9462, 'city': 'Central Zone', 'state': 'India'};
      case '3': return {'lat': 26.9124, 'lng': 75.7873, 'city': 'West Zone', 'state': 'India'};
      case '4': return {'lat': 19.0760, 'lng': 72.8777, 'city': 'Maharashtra Zone', 'state': 'India'};
      case '5': return {'lat': 15.0000, 'lng': 78.0000, 'city': 'South Central Zone', 'state': 'India'};
      case '6': return {'lat': 11.0000, 'lng': 78.0000, 'city': 'South Zone', 'state': 'India'};
      case '7': return {'lat': 22.5726, 'lng': 88.3639, 'city': 'East Zone', 'state': 'India'};
      case '8': return {'lat': 24.0000, 'lng': 85.0000, 'city': 'Jharkhand/Bihar', 'state': 'India'};
      default: return {'lat': 20.5937, 'lng': 78.9629, 'city': 'India', 'state': 'India'};
    }
  }

  /// Geocodes an Indian pincode / address text to coordinates with 3-tier fallback
  Future<Map<String, dynamic>?> geocodeAddress({
    required String pincode,
    String? address,
    String? city,
  }) async {
    final cleanPin = pincode.replaceAll(RegExp(r'\D'), '').trim();
    if (cleanPin.length != 6) return null;

    // 1. Direct Instant In-App Coordinates Table
    if (_pincodeCoordinates.containsKey(cleanPin)) {
      final hit = _pincodeCoordinates[cleanPin]!;
      return {
        'latitude': hit['lat'] as double,
        'longitude': hit['lng'] as double,
        'city': hit['city'] as String,
        'state': hit['state'] as String,
        'pincode': cleanPin,
      };
    }

    // 2. Direct Nominatim OpenStreetMap Geocoding (3s timeout)
    try {
      final dio = Dio();
      final nomRes = await dio.get(
        'https://nominatim.openstreetmap.org/search',
        queryParameters: {
          'format': 'json',
          'postalcode': cleanPin,
          'country': 'India',
          'addressdetails': 1,
        },
        options: Options(
          headers: {'User-Agent': 'TeffesCustomerApp/1.0 (contact@teffes.com)'},
          sendTimeout: const Duration(seconds: 3),
          receiveTimeout: const Duration(seconds: 3),
        ),
      );
      if (nomRes.data is List && (nomRes.data as List).isNotEmpty) {
        final item = (nomRes.data as List).first as Map<String, dynamic>;
        final lat = double.tryParse(item['lat']?.toString() ?? '');
        final lon = double.tryParse(item['lon']?.toString() ?? '');
        if (lat != null && lon != null) {
          final addr = (item['address'] as Map<String, dynamic>?) ?? {};
          final resCity = addr['city'] ?? addr['town'] ?? addr['village'] ?? city ?? 'Unknown';
          final resState = addr['state'] ?? 'India';
          return {
            'latitude': lat,
            'longitude': lon,
            'city': resCity.toString(),
            'state': resState.toString(),
            'pincode': cleanPin,
          };
        }
      }
    } catch (_) {}

    // 3. Indian Postal Region Mathematical Fallback (Guaranteed to return coordinates)
    final fallback = _fallbackIndianPincodeCoordinates(cleanPin);
    return {
      'latitude': fallback['lat'] as double,
      'longitude': fallback['lng'] as double,
      'city': fallback['city'] as String,
      'state': fallback['state'] as String,
      'pincode': cleanPin,
    };
  }

  /// Automatically resolves coordinates for the selected address in the background if it has a pincode
  Future<bool> autoResolveSelectedAddressCoordinates() async {
    final addr = _selectedAddress;
    if (addr == null) return false;
    if (addr.latitude != null && addr.longitude != null) return true;

    final cleanPin = addr.pincode.replaceAll(RegExp(r'\D'), '').trim();
    if (cleanPin.length != 6) return false;

    return await verifyAndSaveAddressCoordinates(addressId: addr.id, pincode: cleanPin);
  }

  /// Verifies an address pincode and saves real coordinates into database & local state
  Future<bool> verifyAndSaveAddressCoordinates({
    required String addressId,
    required String pincode,
  }) async {
    final cleanPin = pincode.replaceAll(RegExp(r'\D'), '').trim();
    if (cleanPin.length != 6) return false;

    final targetIdx = _savedAddresses.indexWhere((a) => a.id == addressId);
    final currentAddr = targetIdx != -1 ? _savedAddresses[targetIdx] : _selectedAddress;
    if (currentAddr == null) return false;

    final geo = await geocodeAddress(
      pincode: cleanPin,
      address: currentAddr.line1,
      city: currentAddr.city,
    );

    final double? lat = geo != null ? (geo['latitude'] as num?)?.toDouble() : null;
    final double? lng = geo != null ? (geo['longitude'] as num?)?.toDouble() : null;
    final String resolvedCity = (geo != null && geo['city'] != null) ? geo['city'].toString() : currentAddr.city;

    if (lat == null || lng == null) return false;

    final updated = AddressModel(
      id: currentAddr.id,
      tag: currentAddr.tag,
      line1: currentAddr.line1,
      line2: currentAddr.line2,
      city: resolvedCity,
      pincode: cleanPin,
      landmark: currentAddr.landmark,
      latitude: lat,
      longitude: lng,
      isDefault: currentAddr.isDefault,
    );

    if (targetIdx != -1) {
      _savedAddresses[targetIdx] = updated;
    }
    if (_selectedAddress?.id == addressId || _selectedAddress?.id == currentAddr.id) {
      _selectedAddress = updated;
      await _persistSelectedAddress(updated);
    }
    notifyListeners();

    try {
      final payload = {
        'pincode': cleanPin,
        'city': resolvedCity,
        'latitude': lat,
        'longitude': lng,
      };
      await _api.put('${ApiEndpoints.addresses}/$addressId', data: payload);
    } catch (_) {}

    return true;
  }

  Future<bool> addAddress({
    required String tag,
    required String line1,
    String? line2,
    String city = 'Ranchi',
    required String pincode,
    String? landmark,
    bool isDefault = false,
    double? latitude,
    double? longitude,
  }) async {
    final cleanPin = pincode.replaceAll(RegExp(r'\D'), '').trim();
    double? lat = latitude;
    double? lng = longitude;
    String resolvedCity = city;

    if ((lat == null || lng == null) && cleanPin.isNotEmpty) {
      final geo = await geocodeAddress(pincode: cleanPin, address: line1, city: city);
      if (geo != null) {
        lat = geo['latitude'] as double?;
        lng = geo['longitude'] as double?;
        if (geo['city'] != null) resolvedCity = geo['city'].toString();
      }
    }

    final newAddress = AddressModel(
      id: 'addr-${DateTime.now().millisecondsSinceEpoch}',
      tag: tag,
      line1: line1,
      line2: line2,
      city: resolvedCity,
      pincode: cleanPin,
      landmark: landmark,
      latitude: lat,
      longitude: lng,
      isDefault: isDefault || _savedAddresses.isEmpty,
    );

    _savedAddresses.insert(0, newAddress);
    _selectedAddress = newAddress;
    _isGpsDetected = false;
    _persistSelectedAddress(newAddress);
    notifyListeners();

    try {
      final payload = {
        'tag': tag,
        'line1': line1,
        'line2': line2,
        'city': resolvedCity,
        'pincode': cleanPin,
        'landmark': landmark,
        'isDefault': newAddress.isDefault,
        if (lat != null) 'latitude': lat,
        if (lng != null) 'longitude': lng,
      };

      final res = await _api.post(ApiEndpoints.addresses, data: payload);
      if (res.data != null && res.data['address'] != null) {
        final serverAddr = res.data['address'];
        final serverLat = (serverAddr['latitude'] as num?)?.toDouble();
        final serverLng = (serverAddr['longitude'] as num?)?.toDouble();
        if (serverLat != null && serverLng != null && (lat == null || lng == null)) {
          final enriched = AddressModel(
            id: serverAddr['_id'] ?? serverAddr['id'] ?? newAddress.id,
            tag: newAddress.tag,
            line1: newAddress.line1,
            line2: newAddress.line2,
            city: serverAddr['city'] ?? newAddress.city,
            pincode: newAddress.pincode,
            landmark: newAddress.landmark,
            latitude: serverLat,
            longitude: serverLng,
            isDefault: newAddress.isDefault,
          );
          _selectedAddress = enriched;
          _savedAddresses[0] = enriched;
          _persistSelectedAddress(enriched);
          notifyListeners();
        }
      }
      return true;
    } catch (e) {
      debugPrint('Failed to sync address to backend: $e');
      return true;
    }
  }

  Future<bool> editAddress({
    required String id,
    required String tag,
    required String line1,
    String? line2,
    String city = 'Ranchi',
    required String pincode,
    String? landmark,
    bool isDefault = false,
    double? latitude,
    double? longitude,
  }) async {
    final cleanPin = pincode.replaceAll(RegExp(r'\D'), '').trim();
    double? lat = latitude;
    double? lng = longitude;
    String resolvedCity = city;

    if ((lat == null || lng == null) && cleanPin.isNotEmpty) {
      final geo = await geocodeAddress(pincode: cleanPin, address: line1, city: city);
      if (geo != null) {
        lat = geo['latitude'] as double?;
        lng = geo['longitude'] as double?;
        if (geo['city'] != null) resolvedCity = geo['city'].toString();
      }
    }

    final updatedAddress = AddressModel(
      id: id,
      tag: tag,
      line1: line1,
      line2: line2,
      city: resolvedCity,
      pincode: cleanPin,
      landmark: landmark,
      latitude: lat,
      longitude: lng,
      isDefault: isDefault,
    );

    final idx = _savedAddresses.indexWhere((a) => a.id == id);
    if (idx != -1) {
      _savedAddresses[idx] = updatedAddress;
    }
    if (_selectedAddress?.id == id) {
      _selectedAddress = updatedAddress;
      _persistSelectedAddress(updatedAddress);
    }
    notifyListeners();

    try {
      final payload = {
        'tag': tag,
        'line1': line1,
        'line2': line2,
        'city': resolvedCity,
        'pincode': cleanPin,
        'landmark': landmark,
        'isDefault': isDefault,
        if (lat != null) 'latitude': lat,
        if (lng != null) 'longitude': lng,
      };

      await _api.put('${ApiEndpoints.addresses}/$id', data: payload);
      return true;
    } catch (e) {
      debugPrint('Failed to update address in backend: $e');
      return true;
    }
  }

  Future<bool> deleteAddress(String id) async {
    _savedAddresses.removeWhere((a) => a.id == id);
    if (_selectedAddress?.id == id) {
      _selectedAddress = _savedAddresses.isNotEmpty ? _savedAddresses.first : null;
    }
    notifyListeners();

    try {
      await _api.delete('${ApiEndpoints.addresses}/$id');
      return true;
    } catch (e) {
      debugPrint('Failed to delete address on backend: $e');
      return true;
    }
  }
}
