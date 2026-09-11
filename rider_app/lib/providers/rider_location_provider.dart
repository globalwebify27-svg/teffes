import 'dart:async';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/constants/api_endpoints.dart';
import '../core/network/api_client.dart';

class RiderLocationProvider with ChangeNotifier {
  final ApiClient _api = ApiClient();

  bool _hasLocationPermission = false;
  double _currentLat = 23.3512;
  double _currentLng = 85.3154;
  String _currentAddress = 'Albert Ekka Chowk, Main Road, Ranchi';
  Timer? _telemetryTimer;

  bool get hasLocationPermission => _hasLocationPermission;
  bool get isPermissionGranted => _hasLocationPermission;
  double get currentLat => _currentLat;
  double get currentLng => _currentLng;
  double get latitude => _currentLat;
  double get longitude => _currentLng;
  String get currentAddress => _currentAddress;

  RiderLocationProvider() {
    _checkSavedPermission();
  }

  Future<void> init() async {
    await _checkSavedPermission();
  }

  Future<void> _checkSavedPermission() async {
    final prefs = await SharedPreferences.getInstance();
    _hasLocationPermission = prefs.getBool('location_granted') ?? false;
    notifyListeners();
  }

  Future<void> grantPermission() async {
    _hasLocationPermission = true;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('location_granted', true);
    notifyListeners();
  }

  Future<bool> requestPermission() async {
    await grantPermission();
    return true;
  }

  void startTelemetryBroadcast(String? activeOrderId) {
    _telemetryTimer?.cancel();
    if (activeOrderId == null) return;

    _telemetryTimer = Timer.periodic(const Duration(seconds: 15), (timer) async {
      try {
        await _api.post(ApiEndpoints.updateLocation, data: {
          'lat': _currentLat,
          'lng': _currentLng,
          'orderId': activeOrderId,
        });
      } catch (_) {}
    });
  }

  void stopTelemetryBroadcast() {
    _telemetryTimer?.cancel();
  }

  @override
  void dispose() {
    _telemetryTimer?.cancel();
    super.dispose();
  }
}
