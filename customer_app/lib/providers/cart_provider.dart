import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/constants/api_endpoints.dart';
import '../core/network/api_client.dart';
import '../models/cart_item_model.dart';
import '../models/product_model.dart';
import '../models/coupon_model.dart';

class CartProvider with ChangeNotifier {
  final ApiClient _api = ApiClient();

  final Map<String, CartItemModel> _items = {};
  String? _appliedCoupon;
  CouponModel? _appliedCouponModel;
  double _couponDiscount = 0.0;
  String? _couponError;
  bool _isSyncing = false;
  List<CouponModel> _availableCoupons = [];
  bool _isLoadingCoupons = false;

  Map<String, CartItemModel> get items => {..._items};
  int get itemCount => _items.values.fold(0, (sum, item) => sum + item.quantity);
  int get uniqueItemCount => _items.length;

  double get subtotal => _items.values.fold(0.0, (sum, item) => sum + item.totalPrice);
  double get deliveryFee => (subtotal >= 399 || subtotal == 0) ? 0.0 : 35.0;
  double get couponDiscount => _couponDiscount;
  String? get appliedCoupon => _appliedCoupon;
  CouponModel? get appliedCouponModel => _appliedCouponModel;
  String? get couponError => _couponError;
  List<CouponModel> get availableCoupons => [..._availableCoupons];
  bool get isLoadingCoupons => _isLoadingCoupons;
  double get grandTotal => (subtotal - _couponDiscount + deliveryFee).clamp(0.0, double.infinity);

  CartProvider() {
    _loadPersistedCart();
    fetchAvailableCoupons();
  }

  Future<void> _loadPersistedCart() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cartJson = prefs.getString('customer_cart');
      final savedCoupon = prefs.getString('customer_cart_coupon');

      if (cartJson != null && cartJson.isNotEmpty) {
        final List<dynamic> decoded = jsonDecode(cartJson);
        for (final itemRaw in decoded) {
          if (itemRaw is Map) {
            final map = Map<String, dynamic>.from(itemRaw);
            final cartItem = CartItemModel.fromJson(map);
            if (cartItem.product.id.isNotEmpty) {
              _items[cartItem.product.id] = cartItem;
            }
          }
        }
      }

      if (savedCoupon != null && savedCoupon.isNotEmpty && _items.isNotEmpty) {
        _appliedCoupon = savedCoupon;
      }

      _revalidateCoupon();
      notifyListeners();
    } catch (e) {
      debugPrint('[CartProvider] Error loading persisted cart: $e');
    }
  }

  Future<void> _saveCartToStorage() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (_items.isEmpty) {
        await prefs.remove('customer_cart');
        await prefs.remove('customer_cart_coupon');
      } else {
        final encoded = jsonEncode(_items.values.map((i) => i.toJson()).toList());
        await prefs.setString('customer_cart', encoded);
        if (_appliedCoupon != null) {
          await prefs.setString('customer_cart_coupon', _appliedCoupon!);
        } else {
          await prefs.remove('customer_cart_coupon');
        }
      }
    } catch (e) {
      debugPrint('[CartProvider] Error saving cart to storage: $e');
    }
  }

  int getQuantity(String productId) {
    return _items[productId]?.quantity ?? 0;
  }

  Future<void> fetchAvailableCoupons() async {
    _isLoadingCoupons = true;
    notifyListeners();
    try {
      final res = await _api.get(ApiEndpoints.activeCoupons);
      if (res.data != null && res.data['success'] == true && res.data['coupons'] is List) {
        _availableCoupons = (res.data['coupons'] as List)
            .map((c) => CouponModel.fromJson(Map<String, dynamic>.from(c as Map)))
            .toList();

        if (_appliedCoupon != null && _availableCoupons.isNotEmpty) {
          final match = _availableCoupons.where((c) => c.code.toUpperCase() == _appliedCoupon!.toUpperCase()).firstOrNull;
          if (match != null) {
            _appliedCouponModel = match;
            _revalidateCoupon();
          }
        }
      }
    } catch (e) {
      debugPrint('Error fetching active coupons: $e');
    } finally {
      _isLoadingCoupons = false;
      notifyListeners();
    }
  }

  void addToCart(ProductModel product, {String? weight}) {
    if (_items.containsKey(product.id)) {
      _items[product.id]!.quantity += 1;
    } else {
      _items[product.id] = CartItemModel(
        product: product,
        selectedWeight: weight ?? product.netWeight,
      );
    }
    _revalidateCoupon();
    _saveCartToStorage();
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
    _revalidateCoupon();
    _saveCartToStorage();
    notifyListeners();
    _syncCartWithBackend();
  }

  void increment(String productId) {
    if (_items.containsKey(productId)) {
      _items[productId]!.quantity += 1;
      _revalidateCoupon();
      _saveCartToStorage();
      notifyListeners();
      _syncCartWithBackend();
    }
  }

  void decrementQuantity(String productId) {
    if (!_items.containsKey(productId)) return;
    if (_items[productId]!.quantity > 1) {
      _items[productId]!.quantity -= 1;
    } else {
      _items.remove(productId);
    }
    _revalidateCoupon();
    _saveCartToStorage();
    notifyListeners();
    _syncCartWithBackend();
  }

  void decrement(String productId) => decrementQuantity(productId);

  void removeFromCart(String productId) {
    _items.remove(productId);
    _revalidateCoupon();
    _saveCartToStorage();
    notifyListeners();
    _syncCartWithBackend();
  }

  void clearCart() {
    _items.clear();
    _appliedCoupon = null;
    _appliedCouponModel = null;
    _couponDiscount = 0.0;
    _couponError = null;
    _saveCartToStorage();
    notifyListeners();
    _syncCartWithBackend();
  }

  void _revalidateCoupon() {
    if (_appliedCoupon == null) return;
    if (_items.isEmpty) {
      _appliedCoupon = null;
      _appliedCouponModel = null;
      _couponDiscount = 0.0;
      return;
    }
    final minRequired = _appliedCouponModel?.minOrderAmount ?? _appliedCouponModel?.minOrder ?? 0.0;
    if (subtotal < minRequired) {
      final code = _appliedCoupon;
      _appliedCoupon = null;
      _appliedCouponModel = null;
      _couponDiscount = 0.0;
      _couponError = 'Coupon "$code" removed: Minimum order of ₹${minRequired.toInt()} not met.';
      return;
    }
    if (_appliedCouponModel != null && _appliedCouponModel!.discountType == 'percentage') {
      double calculated = (subtotal * _appliedCouponModel!.discountValue) / 100.0;
      if (_appliedCouponModel!.maxDiscountAmount != null && _appliedCouponModel!.maxDiscountAmount! > 0) {
        calculated = calculated.clamp(0.0, _appliedCouponModel!.maxDiscountAmount!);
      }
      _couponDiscount = calculated;
    }
  }

  Future<bool> applyCoupon(String code) async {
    final cleanCode = code.trim().toUpperCase();
    if (cleanCode.isEmpty) {
      _couponError = 'Please enter a coupon code';
      notifyListeners();
      return false;
    }

    // Business rule: Only one coupon can be applied per order
    if (_appliedCoupon != null && _appliedCoupon != cleanCode) {
      _couponError = 'Only one coupon can be applied per order. Please remove the current coupon first.';
      notifyListeners();
      return false;
    }

    if (subtotal <= 0) {
      _couponError = 'Cart is empty. Add items to apply coupon.';
      notifyListeners();
      return false;
    }

    try {
      final res = await _api.post(ApiEndpoints.validateCoupon, data: {
        'code': cleanCode,
        'cartTotal': subtotal,
      });

      if (res.data != null && res.data['success'] == true) {
        _appliedCoupon = cleanCode;
        _couponDiscount = (res.data['discount'] as num?)?.toDouble() ?? 0.0;
        _couponError = null;

        if (res.data['coupon'] != null) {
          _appliedCouponModel = CouponModel.fromJson(Map<String, dynamic>.from(res.data['coupon'] as Map));
        } else {
          try {
            _appliedCouponModel = _availableCoupons.firstWhere((c) => c.code.toUpperCase() == cleanCode);
          } catch (_) {
            _appliedCouponModel = CouponModel(
              id: cleanCode,
              code: cleanCode,
              discount: '₹${_couponDiscount.toInt()} OFF',
              description: 'Coupon applied successfully',
              discountValue: _couponDiscount,
              minOrderAmount: 0,
            );
          }
        }
        _saveCartToStorage();
        notifyListeners();
        return true;
      } else {
        _couponError = (res.data != null && res.data['message'] != null)
            ? res.data['message'].toString()
            : 'Invalid coupon code';
        notifyListeners();
        return false;
      }
    } catch (e) {
      String msg = 'Failed to apply coupon';
      try {
        if ((e as dynamic).response?.data?['message'] != null) {
          msg = (e as dynamic).response.data['message'].toString();
        }
      } catch (_) {}
      _couponError = msg;
      notifyListeners();
      return false;
    }
  }

  void removeCoupon() {
    _appliedCoupon = null;
    _appliedCouponModel = null;
    _couponDiscount = 0.0;
    _couponError = null;
    _saveCartToStorage();
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
