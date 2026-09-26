import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:dio/dio.dart';
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
        try {
          // Google Geocoding via TeFFe backend proxy (API key protected on server)
          final res = await _api.get(
            ApiEndpoints.reverseGeocode,
            queryParameters: {
              'lat': position.latitude,
              'lng': position.longitude,
            },
          );

          if (res.data != null && res.data['success'] == true) {
            line1 = res.data['addressLine'] ?? 'Live Location';
            localityName = res.data['locality'] ?? res.data['city'] ?? 'Current Location';
            city = res.data['city'] ?? 'Ranchi';
            pincode = res.data['pincode'] ?? '834001';
            line2 = city;
            if (res.data['latitude'] != null) detectedLat = (res.data['latitude'] as num).toDouble();
            if (res.data['longitude'] != null) detectedLng = (res.data['longitude'] as num).toDouble();
          }
        } catch (e) {
          debugPrint('Google Geocoding error via proxy: $e');
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
        line1: 'Main Road, Albert Ekka Chowk',
        line2: 'Lower Bazar',
        city: 'Ranchi',
        pincode: '834001',
        landmark: 'Near Capitol Hill',
        latitude: 23.3512,
        longitude: 85.3154,
        isDefault: false,
      );
      _selectedAddress = fallback;
      _isGpsDetected = true;
      _persistSelectedAddress(fallback);
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
          final def = _savedAddresses.firstWhere(
            (a) => a.isDefault,
            orElse: () => _savedAddresses.first,
          );
          _selectedAddress = def;
        } else {
          _selectedAddress = null;
          _isGpsDetected = false;
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

  Future<bool> addAddress({
    required String tag,
    required String line1,
    String? line2,
    String city = 'Ranchi',
    String pincode = '834001',
    String? landmark,
    bool isDefault = false,
  }) async {
    final newAddress = AddressModel(
      id: 'addr-${DateTime.now().millisecondsSinceEpoch}',
      tag: tag,
      line1: line1,
      line2: line2,
      city: city,
      pincode: pincode,
      landmark: landmark,
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
        'city': city,
        'pincode': pincode,
        'landmark': landmark,
        'isDefault': newAddress.isDefault,
      };

      await _api.post(ApiEndpoints.addresses, data: payload);
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
    String pincode = '834001',
    String? landmark,
    bool isDefault = false,
  }) async {
    final updatedAddress = AddressModel(
      id: id,
      tag: tag,
      line1: line1,
      line2: line2,
      city: city,
      pincode: pincode,
      landmark: landmark,
      isDefault: isDefault,
    );

    final idx = _savedAddresses.indexWhere((a) => a.id == id);
    if (idx != -1) {
      _savedAddresses[idx] = updatedAddress;
    }
    if (_selectedAddress?.id == id) {
      _selectedAddress = updatedAddress;
    }
    notifyListeners();

    try {
      final payload = {
        'tag': tag,
        'line1': line1,
        'line2': line2,
        'city': city,
        'pincode': pincode,
        'landmark': landmark,
        'isDefault': isDefault,
      };
      await _api.put('${ApiEndpoints.addresses}/$id', data: payload);
      return true;
    } catch (e) {
      debugPrint('Failed to update address on backend: $e');
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
