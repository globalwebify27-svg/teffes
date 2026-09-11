import 'package:flutter/foundation.dart';
import 'dart:io' show Platform;

class ApiEndpoints {
  ApiEndpoints._();

  static String get baseUrl {
    const String customHost = String.fromEnvironment('API_HOST');
    if (customHost.isNotEmpty) {
      return 'http://$customHost:5000/api';
    }

    if (kIsWeb) {
      return 'http://localhost:5000/api';
    }

    try {
      if (Platform.isAndroid) {
        return 'http://10.0.2.2:5000/api';
      }
    } catch (_) {}
    return 'http://localhost:5000/api';
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
