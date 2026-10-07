import 'package:flutter/material.dart';
import '../core/constants/api_endpoints.dart';
import '../core/network/api_client.dart';
import '../models/rider_order_model.dart';
import '../models/rider_earnings_model.dart';

class RiderOrdersProvider with ChangeNotifier {
  final ApiClient _api = ApiClient();

  RiderOrderModel? _activeOrder;
  List<RiderOrderModel> _availableOrders = [];
  List<RiderOrderModel> _historyOrders = [];
  RiderEarningsModel? _earnings;
  int _completedTodayCount = 0;
  double _todayEarnings = 0.0;
  bool _isLoading = false;
  String? _error;

  RiderOrderModel? get activeOrder => _activeOrder;
  List<RiderOrderModel> get availableOrders => _availableOrders;
  List<RiderOrderModel> get historyOrders => _historyOrders;
  List<RiderOrderModel> get orders => _historyOrders;
  RiderEarningsModel? get earnings => _earnings;
  int get completedTodayCount => _completedTodayCount;
  int get todayDeliveriesCount => _completedTodayCount;
  double get todayEarnings => _todayEarnings;
  double get cashInHand => _earnings?.cashInHand ?? 0.0;
  bool get isLoading => _isLoading;
  String? get error => _error;
  String? get errorMessage => _error;

  Future<void> fetchDashboard() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final res = await _api.get(ApiEndpoints.riderDashboard);
      if (res.data['success'] == true) {
        if (res.data['activeOrder'] != null) {
          _activeOrder = RiderOrderModel.fromJson(res.data['activeOrder']);
        } else {
          _activeOrder = null;
        }

        final todayStats = res.data['todayStats'];
        if (todayStats != null) {
          _completedTodayCount = (todayStats['completedCount'] as num?)?.toInt() ?? 0;
          _todayEarnings = (todayStats['todayEarnings'] as num?)?.toDouble() ?? 0.0;
        }
      }
      await fetchAvailableOrders();
    } catch (e) {
      _error = 'Failed to load dashboard data';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchAvailableOrders() async {
    try {
      final res = await _api.get(ApiEndpoints.availableOrders);
      if (res.data['success'] == true && res.data['orders'] != null) {
        final raw = res.data['orders'] as List;
        _availableOrders = raw.map((o) => RiderOrderModel.fromJson(o)).toList();
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Error fetching available orders: $e');
    }
  }

  Future<bool> acceptOrder(String orderId) async {
    _error = null;
    try {
      final res = await _api.post(ApiEndpoints.acceptOrder(orderId));
      if (res.data['success'] == true && res.data['order'] != null) {
        _activeOrder = RiderOrderModel.fromJson(res.data['order']);
        _availableOrders.removeWhere((o) => o.orderId == orderId || o.id == orderId);
        notifyListeners();
        return true;
      }
      _error = res.data['message'] ?? 'Failed to accept order';
      return false;
    } catch (e) {
      _error = 'Error accepting order';
      return false;
    }
  }

  Future<bool> rejectOrder(String orderId) async {
    _error = null;
    try {
      final res = await _api.post(ApiEndpoints.rejectOrder(orderId));
      if (res.data['success'] == true) {
        _availableOrders.removeWhere((o) => o.orderId == orderId || o.id == orderId);
        if (_activeOrder?.orderId == orderId || _activeOrder?.id == orderId) {
          _activeOrder = null;
        }
        notifyListeners();
        return true;
      }
      return false;
    } catch (e) {
      _error = 'Error rejecting order';
      return false;
    }
  }

  Future<bool> confirmPickup(String orderId) async {
    _error = null;
    try {
      final res = await _api.post(ApiEndpoints.confirmPickup(orderId));
      if (res.data['success'] == true && res.data['order'] != null) {
        _activeOrder = RiderOrderModel.fromJson(res.data['order']);
        notifyListeners();
        return true;
      }
      _error = res.data['message'] ?? 'Failed to confirm pickup';
      return false;
    } catch (e) {
      _error = 'Error confirming pickup';
      return false;
    }
  }

  Future<bool> completeDelivery({
    required String orderId,
    required String otp,
    double? cashCollected,
  }) async {
    _error = null;
    try {
      final res = await _api.post(ApiEndpoints.completeDelivery(orderId), data: {
        'otp': otp.trim(),
        'cashReceived': cashCollected,
      });

      if (res.data['success'] == true) {
        _completedTodayCount += 1;
        _todayEarnings += (_activeOrder?.riderEarning ?? 65.0);
        _activeOrder = null;
        notifyListeners();
        fetchDashboard();
        return true;
      } else {
        _error = res.data['message'] ?? 'OTP verification failed';
        return false;
      }
    } catch (e) {
      _error = 'OTP verification failed. Please ask customer to re-check code.';
      return false;
    }
  }

  Future<void> fetchOrders({String filter = 'all'}) async {
    await fetchOrdersHistory(filter: filter);
  }

  Future<void> fetchOrdersHistory({String filter = 'all'}) async {
    _isLoading = true;
    notifyListeners();
    try {
      final res = await _api.get('${ApiEndpoints.riderOrders}?filter=$filter');
      if (res.data['success'] == true && res.data['orders'] != null) {
        final raw = res.data['orders'] as List;
        _historyOrders = raw.map((o) => RiderOrderModel.fromJson(o)).toList();
      }
    } catch (e) {
      debugPrint('Error loading history: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchEarnings() async {
    try {
      final res = await _api.get(ApiEndpoints.riderEarnings);
      if (res.data['success'] == true) {
        _earnings = RiderEarningsModel.fromJson(res.data);
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Error fetching earnings: $e');
    }
  }
}
