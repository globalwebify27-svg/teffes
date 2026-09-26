import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/constants/api_endpoints.dart';
import '../core/network/api_client.dart';
import '../core/services/rider_fcm_service.dart';
import '../models/rider_user_model.dart';

class RiderAuthProvider with ChangeNotifier {
  final ApiClient _api = ApiClient();

  RiderUserModel? _rider;
  bool _isLoading = false;
  String? _errorMessage;
  bool _hasCheckedAuth = false;

  RiderUserModel? get rider => _rider;
  bool get isAuthenticated => _rider != null;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get hasCheckedAuth => _hasCheckedAuth;
  bool get isOnline => _rider?.isOnline ?? true;
  bool get isDutyOnline => isOnline;

  RiderAuthProvider() {
    checkSavedAuth();
  }

  Future<void> init() async {
    await checkSavedAuth();
  }

  Future<void> checkSavedAuth() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('rider_token');

    if (token != null && token.isNotEmpty) {
      try {
        final res = await _api.get(ApiEndpoints.riderDashboard);
        if (res.data['success'] == true && res.data['rider'] != null) {
          _rider = RiderUserModel.fromJson(res.data['rider']);
          await RiderFcmService.instance.syncUserSession();
        }
      } catch (e) {
        debugPrint('Auto-auth check failed: $e');
      }
    }
    _hasCheckedAuth = true;
    notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await _api.post(ApiEndpoints.riderLogin, data: {
        'email': email.trim(),
        'password': password.trim(),
      });

      if (res.data['success'] == true) {
        final token = res.data['accessToken'];
        final prefs = await SharedPreferences.getInstance();
        if (token != null) {
          await prefs.setString('rider_token', token);
        }

        // Fetch rider dashboard to populate profile
        final dashRes = await _api.get(ApiEndpoints.riderDashboard);
        if (dashRes.data['success'] == true && dashRes.data['rider'] != null) {
          _rider = RiderUserModel.fromJson(dashRes.data['rider']);
        } else if (res.data['user'] != null) {
          _rider = RiderUserModel.fromJson(res.data['user']);
        }

        await RiderFcmService.instance.syncUserSession();

        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _errorMessage = res.data['message'] ?? 'Login failed. Check credentials.';
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = 'Unable to connect to TeFFe dispatch server. Check credentials.';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> toggleDuty([bool? online]) async {
    final newOnline = online ?? !isDutyOnline;
    if (_rider == null) return;
    try {
      final res = await _api.post(ApiEndpoints.riderDuty, data: {'isOnline': newOnline});
      if (res.data['success'] == true) {
        _rider = _rider!.copyWith(
          isOnline: newOnline,
          riderStatus: newOnline ? 'Available' : 'Offline',
        );
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Error toggling duty: $e');
      _rider = _rider!.copyWith(
        isOnline: newOnline,
        riderStatus: newOnline ? 'Available' : 'Offline',
      );
      notifyListeners();
    }
  }

  Future<void> logout() async {
    await RiderFcmService.instance.unregisterOnLogout();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('rider_token');
    _rider = null;
    notifyListeners();
  }
}
