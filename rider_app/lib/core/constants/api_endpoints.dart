import 'package:flutter/foundation.dart';
import 'dart:io' show Platform;

class ApiEndpoints {
  ApiEndpoints._();

  static String get baseUrl {
    // Custom full URL passed via --dart-define=API_BASE_URL=https://your-backend.com
    const String customBaseUrl = String.fromEnvironment('API_BASE_URL');
    if (customBaseUrl.isNotEmpty) {
      return customBaseUrl.endsWith('/api') ? customBaseUrl : '$customBaseUrl/api';
    }

    const String customHost = String.fromEnvironment('API_HOST');
    if (customHost.isNotEmpty) {
      return 'http://$customHost:5000/api';
    }

    if (kIsWeb) {
      return 'https://teffes.onrender.com/api';
    }

    try {
      if (Platform.isAndroid) {
        return 'https://teffes.onrender.com/api';
      }
    } catch (_) {
      // ignore
    }
    return 'https://teffes.onrender.com/api';
  }

  // Auth
  static const String riderLogin = '/auth/admin-login';
  static const String getMe = '/auth/me';

  // Rider Fleet APIs
  static const String riderDashboard = '/rider/dashboard';
  static const String riderDuty = '/rider/duty';
  static const String availableOrders = '/rider/available-orders';
  static String acceptOrder(String id) => '/rider/orders/$id/accept';
  static String rejectOrder(String id) => '/rider/orders/$id/reject';
  static String confirmPickup(String id) => '/rider/orders/$id/confirm-pickup';
  static const String updateLocation = '/rider/location';
  static String completeDelivery(String id) => '/rider/orders/$id/complete-delivery';
  static const String riderEarnings = '/rider/earnings';
  static const String riderOrders = '/rider/orders';
  static const String riderDispatchSupport = '/rider/dispatch-support';
  static String orderDetails(String id) => '/orders/$id';
}
