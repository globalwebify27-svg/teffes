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

    // Override with custom IP if testing on a physical device on the same Wi-Fi
    const String customHost = String.fromEnvironment('API_HOST');
    if (customHost.isNotEmpty) {
      return 'http://$customHost:5000/api';
    }

    if (kIsWeb) {
      return 'http://localhost:5000/api';
    }

    try {
      if (Platform.isAndroid) {
        // 10.0.2.2 is the standard alias to your host loopback interface in Android emulator
        return 'http://10.0.2.2:5000/api';
      }
    } catch (_) {
      // Platform check may throw on unsupported environments
    }
    return 'http://localhost:5000/api';
  }

  // Auth
  static const String sendOtp = '/auth/send-otp';
  static const String verifyOtp = '/auth/verify-otp';
  static const String getMe = '/auth/me';
  static const String updateMe = '/auth/me';

  // Products & Stores
  static const String stores = '/stores';
  static const String activeStore = '/stores/active';
  static const String categories = '/categories';
  static const String products = '/products';
  static const String search = '/products/search';
  static const String banners = '/banners';

  // User Cart & Wishlist
  static const String cart = '/user/cart';
  static const String wishlist = '/user/wishlist';
  static const String toggleWishlist = '/user/wishlist/toggle';

  // Addresses
  static const String addresses = '/user/addresses';

  // Wallet
  static const String walletDetails = '/wallet/details';
  static const String walletRecharge = '/user/wallet/recharge';
  static const String walletAdd = '/wallet/add';

  // Coupons
  static const String validateCoupon = '/coupons/validate';
  static const String activeCoupons = '/coupons/active';

  // Orders
  static const String createOrder = '/orders';
  static const String myOrders = '/orders/my-orders';
  static String orderDetails(String id) => '/orders/$id';
  static String requestReturn(String id) => '/orders/$id/return';

  // Razorpay & Payments
  static const String createRazorpayOrder = '/payment/create-order';
  static const String verifyRazorpayPayment = '/payment/verify-payment';

  /// Razorpay Key ID - supports passing via --dart-define=RAZORPAY_KEY_ID=...
  /// or defaults to the same standard test key configured in the web client
  static const String razorpayKeyId = String.fromEnvironment(
    'RAZORPAY_KEY_ID',
    defaultValue: 'rzp_test_1DP5mmOlF5G5ag',
  );

  /// Google Maps API Key - supports passing via --dart-define=GOOGLE_MAPS_API_KEY=...
  static const String googleMapsApiKey = String.fromEnvironment(
    'GOOGLE_MAPS_API_KEY',
    defaultValue: '',
  );

  // Reviews
  static const String reviews = '/reviews';
  static String productReviews(String productId) => '/reviews/product/$productId';
}
