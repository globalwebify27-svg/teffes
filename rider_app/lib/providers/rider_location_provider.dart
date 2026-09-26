import 'dart:async';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/constants/api_endpoints.dart';
import '../core/network/api_client.dart';

class RiderLocationProvider with ChangeNotifier {
  final ApiClient _api = ApiClient();

  bool _hasLocationPermission = false;
  double _currentLat = 23.3512;
  double _currentLng = 85.3154;
  final String _currentAddress = 'Albert Ekka Chowk, Main Road, Ranchi';
  Timer? _telemetryTimer;
  String? _activeBroadcastOrderId;

  bool get hasLocationPermission => _hasLocationPermission;
  bool get isPermissionGranted => _hasLocationPermission;
  double get currentLat => _currentLat;
  double get currentLng => _currentLng;
  double get latitude => _currentLat;
  double get longitude => _currentLng;
  String get currentAddress => _currentAddress;
  bool get isBroadcasting => _telemetryTimer != null && _telemetryTimer!.isActive;

  RiderLocationProvider() {
    _checkSavedPermission();
  }

  Future<void> init() async {
    await _checkSavedPermission();
    if (_hasLocationPermission) {
      await fetchCurrentPosition();
    }
  }

  Future<void> _checkSavedPermission() async {
    try {
      final status = await Geolocator.checkPermission();
      if (status == LocationPermission.always || status == LocationPermission.whileInUse) {
        _hasLocationPermission = true;
      } else {
        final prefs = await SharedPreferences.getInstance();
        _hasLocationPermission = prefs.getBool('location_granted') ?? false;
      }
    } catch (_) {
      final prefs = await SharedPreferences.getInstance();
      _hasLocationPermission = prefs.getBool('location_granted') ?? false;
    }
    notifyListeners();
  }

  Future<void> grantPermission() async {
    _hasLocationPermission = true;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('location_granted', true);
    await fetchCurrentPosition();
    notifyListeners();
  }

  Future<bool> requestPermission() async {
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        debugPrint('[Rider GPS] Location services are disabled.');
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          return false;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        return false;
      }

      await grantPermission();
      return true;
    } catch (e) {
      debugPrint('[Rider GPS] requestPermission error: $e');
      await grantPermission();
      return true;
    }
  }

  Future<Position?> fetchCurrentPosition() async {
    try {
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 4),
        ),
      );
      _currentLat = pos.latitude;
      _currentLng = pos.longitude;
      notifyListeners();
      return pos;
    } catch (e) {
      try {
        final last = await Geolocator.getLastKnownPosition();
        if (last != null) {
          _currentLat = last.latitude;
          _currentLng = last.longitude;
          notifyListeners();
          return last;
        }
      } catch (_) {}
    }
    return null;
  }

  void startTelemetryBroadcast(String? activeOrderId) {
    if (activeOrderId == null || activeOrderId.isEmpty) {
      stopTelemetryBroadcast();
      return;
    }

    if (_activeBroadcastOrderId == activeOrderId && _telemetryTimer != null && _telemetryTimer!.isActive) {
      return;
    }

    _activeBroadcastOrderId = activeOrderId;
    _telemetryTimer?.cancel();

    // Initial broadcast immediately
    _broadcastCurrentLocation(activeOrderId);

    // Periodic broadcast every 10 seconds during transit
    _telemetryTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      _broadcastCurrentLocation(activeOrderId);
    });
  }

  Future<void> _broadcastCurrentLocation(String orderId) async {
    try {
      if (_hasLocationPermission) {
        await fetchCurrentPosition();
      }

      await _api.post(ApiEndpoints.updateLocation, data: {
        'lat': _currentLat,
        'lng': _currentLng,
        'orderId': orderId,
      });
      debugPrint('[Rider GPS Broadcast] Lat: $_currentLat, Lng: $_currentLng -> Order #$orderId');
    } catch (e) {
      debugPrint('[Rider GPS Broadcast] Broadcast error: $e');
    }
  }

  void stopTelemetryBroadcast() {
    _activeBroadcastOrderId = null;
    _telemetryTimer?.cancel();
    _telemetryTimer = null;
    debugPrint('[Rider GPS Broadcast] Stopped broadcast stream.');
  }

  @override
  void dispose() {
    _telemetryTimer?.cancel();
    super.dispose();
  }
}
