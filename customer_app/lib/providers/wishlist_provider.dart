import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/constants/api_endpoints.dart';
import '../core/network/api_client.dart';
import '../models/product_model.dart';

class WishlistProvider with ChangeNotifier {
  static const String _storageKey = 'teffes_customer_wishlist';
  final ApiClient _api = ApiClient();

  final Set<String> _wishlistIds = {};
  bool _isInitialized = false;

  Set<String> get wishlistIds => _wishlistIds;
  int get count => _wishlistIds.length;
  bool get isInitialized => _isInitialized;

  WishlistProvider() {
    _loadWishlist();
  }

  Future<void> _loadWishlist() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedJson = prefs.getString(_storageKey);
      if (savedJson != null) {
        final List<dynamic> decoded = jsonDecode(savedJson);
        _wishlistIds.addAll(decoded.map((e) => e.toString()));
      }

      // Try fetching from server if user is logged in
      try {
        final res = await _api.get(ApiEndpoints.wishlist);
        if (res.data != null && res.data['success'] == true && res.data['wishlist'] is List) {
          final serverList = (res.data['wishlist'] as List).map((e) => e.toString()).toSet();
          _wishlistIds.addAll(serverList);
          await _saveToStorage();
        }
      } catch (_) {}
    } catch (e) {
      debugPrint('Error loading wishlist: $e');
    } finally {
      _isInitialized = true;
      notifyListeners();
    }
  }

  Future<void> _saveToStorage() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_storageKey, jsonEncode(_wishlistIds.toList()));
    } catch (e) {
      debugPrint('Error saving wishlist: $e');
    }
  }

  bool isInWishlist(String productId) {
    return _wishlistIds.contains(productId);
  }

  Future<bool> toggleWishlist(String productId) async {
    final bool isAdded;
    if (_wishlistIds.contains(productId)) {
      _wishlistIds.remove(productId);
      isAdded = false;
    } else {
      _wishlistIds.add(productId);
      isAdded = true;
    }
    notifyListeners();
    await _saveToStorage();

    // Sync with backend API in background
    try {
      await _api.post(ApiEndpoints.toggleWishlist, data: {'productId': productId});
    } catch (_) {}

    return isAdded;
  }

  Future<void> removeFromWishlist(String productId) async {
    if (_wishlistIds.contains(productId)) {
      _wishlistIds.remove(productId);
      notifyListeners();
      await _saveToStorage();

      try {
        await _api.post(ApiEndpoints.toggleWishlist, data: {'productId': productId});
      } catch (_) {}
    }
  }

  Future<void> clearWishlist() async {
    _wishlistIds.clear();
    notifyListeners();
    await _saveToStorage();
  }

  List<ProductModel> getWishlistItems(List<ProductModel> allProducts) {
    return allProducts.where((p) => _wishlistIds.contains(p.id)).toList();
  }
}
