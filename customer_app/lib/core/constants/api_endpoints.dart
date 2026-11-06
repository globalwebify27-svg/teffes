import 'package:flutter/foundation.dart';
import 'dart:io' show Platform;

class ApiEndpoints {
  ApiEndpoints._();

  /// Resolves the base URL dynamically based on whether running in Web, Android Emulator,
  /// iOS Simulator, or a custom device/production URL.
  static String get baseUrl {
    // Custom full URL passed via --dart-define=API_BASE_URL=https://your-backend.com
    const String customBaseUrl = String.fromEnvironment('API_BASE_URL');
    if (customBaseUrl.isNotEmpty) {
      return customBaseUrl.endsWith('/api') ? customBaseUrl : '$customBaseUrl/api';
    }

    const String customHost = String.fromEnvironment('API_HOST');
    if (customHost.isNotEmpty) {
      if (customHost == 'emulator') {
        return 'http://10.0.2.2:5000/api';
      }
      return 'http://$customHost:5000/api';
    }

    if (kIsWeb) {
      return 'https://teffes.onrender.com/api';
    }

    try {
      if (Platform.isAndroid || Platform.isIOS) {
        return 'https://teffes.onrender.com/api';
      }
      if (Platform.isMacOS || Platform.isWindows || Platform.isLinux) {
        return 'http://localhost:5000/api';
      }
    } catch (_) {
      // ignore
    }

    return 'https://teffes.onrender.com/api';
  }

  // Auth
  static const String sendOtp = '/auth/send-otp';
  static const String verifyOtp = '/auth/verify-otp';
  static const String firebaseLogin = '/auth/firebase-login';
  static const String getMe = '/auth/me';
  static const String updateMe = '/auth/me';

  // Products & Stores
  static const String stores = '/stores';
  static const String availableStores = '/stores/available';
  static const String activeStore = '/stores/active';
  static const String categories = '/categories';
  static const String products = '/products';
  static const String search = '/products/search';
  static const String banners = '/banners';
  static const String activeAnnouncements = '/announcements/active';

  // User Cart & Wishlist
  static const String cart = '/user/cart';
  static const String wishlist = '/user/wishlist';
  static const String toggleWishlist = '/user/wishlist/toggle';

  static String get socketUrl {
    final base = baseUrl;
    return base.endsWith('/api') ? base.substring(0, base.length - 4) : base;
  }

  // Location & Google Geocoding
  static const String reverseGeocode = '/location/reverse-geocode';
  static const String placesAutocomplete = '/location/places-autocomplete';

  // Addresses
  static const String addresses = '/user/addresses';

  // Wallet
  static const String walletDetails = '/wallet/details';
  static const String walletRecharge = '/user/wallet/recharge';
  static const String walletAdd = '/wallet/add';

  // Coupons
  static const String validateCoupon = '/coupons/validate';
  static const String activeCoupons = '/coupons/active';
  static const String superOffer = '/coupons/super-offer';

  // Orders
  static const String createOrder = '/orders';
  static const String myOrders = '/orders/my-orders';
  static String orderDetails(String id) => '/orders/$id';
  static String requestReturn(String id) => '/orders/$id/return';

  // PayU & Payments
  static const String createPayUOrder = '/payment/create-order';
  static const String verifyPayUPayment = '/payment/verify-payment';
  static const String generatePayUHash = '/payment/generate-hash';
  // Legacy aliases
  static const String createRazorpayOrder = createPayUOrder;
  static const String verifyRazorpayPayment = verifyPayUPayment;

  /// PayU Merchant Key - supports passing via --dart-define=PAYU_KEY=...
  static const String payuMerchantKey = String.fromEnvironment(
    'PAYU_KEY',
    defaultValue: 'mv5iBR',
  );
  // Legacy alias
  static const String razorpayKeyId = payuMerchantKey;

  /// Google Maps API Key - supports passing via --dart-define=GOOGLE_MAPS_API_KEY=...
  static const String googleMapsApiKey = String.fromEnvironment(
    'GOOGLE_MAPS_API_KEY',
    defaultValue: '',
  );

  // Reviews
  static const String reviews = '/reviews';
  static String productReviews(String productId) => '/reviews/product/$productId';
}
