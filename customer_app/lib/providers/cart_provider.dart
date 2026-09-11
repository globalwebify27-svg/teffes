import 'package:flutter/foundation.dart';
import '../core/constants/api_endpoints.dart';
import '../core/network/api_client.dart';
import '../models/cart_item_model.dart';
import '../models/product_model.dart';

class CartProvider with ChangeNotifier {
  final ApiClient _api = ApiClient();

  final Map<String, CartItemModel> _items = {};
  String? _appliedCoupon;
  double _couponDiscount = 0.0;
  bool _isSyncing = false;

  Map<String, CartItemModel> get items => {..._items};
  int get itemCount => _items.values.fold(0, (sum, item) => sum + item.quantity);
  int get uniqueItemCount => _items.length;

  double get subtotal => _items.values.fold(0.0, (sum, item) => sum + item.totalPrice);
  double get deliveryFee => (subtotal >= 399 || subtotal == 0) ? 0.0 : 35.0;
  double get couponDiscount => _couponDiscount;
  String? get appliedCoupon => _appliedCoupon;
  double get grandTotal => (subtotal - _couponDiscount + deliveryFee).clamp(0.0, double.infinity);

  int getQuantity(String productId) {
    return _items[productId]?.quantity ?? 0;
  }

  void addToCart(ProductModel product, {String? weight}) {
    if (_items.containsKey(product.id)) {
      _items[product.id]!.quantity += 1;
    } else {
      _items[product.id] = CartItemModel(
        product: product,
        quantity: 1,
        selectedWeight: weight ?? product.netWeight,
      );
    }
    notifyListeners();
    _syncCartWithBackend();
  }

  void updateQuantity(String productId, int quantity) {
    if (!_items.containsKey(productId)) return;

    if (quantity <= 0) {
      _items.remove(productId);
    } else {
      _items[productId]!.quantity = quantity;
    }
    notifyListeners();
    _syncCartWithBackend();
  }

  void increment(String productId) {
    if (_items.containsKey(productId)) {
      _items[productId]!.quantity += 1;
      notifyListeners();
      _syncCartWithBackend();
    }
  }

  void decrement(String productId) {
    if (!_items.containsKey(productId)) return;

    if (_items[productId]!.quantity > 1) {
      _items[productId]!.quantity -= 1;
    } else {
      _items.remove(productId);
    }
    notifyListeners();
    _syncCartWithBackend();
  }

  void clearCart() {
    _items.clear();
    _appliedCoupon = null;
    _couponDiscount = 0.0;
    notifyListeners();
    _syncCartWithBackend();
  }

  Future<bool> applyCoupon(String code) async {
    final cleanCode = code.trim().toUpperCase();
    if (cleanCode.isEmpty) return false;

    try {
      final res = await _api.post(ApiEndpoints.validateCoupon, data: {
        'code': cleanCode,
        'cartTotal': subtotal,
      });

      if (res.data['success'] == true) {
        _appliedCoupon = cleanCode;
        _couponDiscount = (res.data['discount'] as num?)?.toDouble() ?? 50.0;
        notifyListeners();
        return true;
      }
    } catch (_) {
      // Fallback local coupon evaluation for demo/offline
      if (cleanCode == 'TEFFES50' && subtotal >= 299) {
        _appliedCoupon = 'TEFFES50';
        _couponDiscount = 50.0;
        notifyListeners();
        return true;
      }
    }
    return false;
  }

  void removeCoupon() {
    _appliedCoupon = null;
    _couponDiscount = 0.0;
    notifyListeners();
  }

  Future<void> _syncCartWithBackend() async {
    if (_isSyncing) return;
    _isSyncing = true;
    try {
      final payload = _items.values.map((i) => i.toJson()).toList();
      await _api.put(ApiEndpoints.cart, data: {'cart': payload});
    } catch (_) {
      // Offline local cart is retained smoothly
    } finally {
      _isSyncing = false;
    }
  }
}
