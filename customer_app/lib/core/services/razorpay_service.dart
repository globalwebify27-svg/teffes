import 'package:flutter/foundation.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import '../constants/app_config.dart';

typedef OnPaymentSuccess = void Function(PaymentSuccessResponse response);
typedef OnPaymentError = void Function(PaymentFailureResponse response);
typedef OnExternalWallet = void Function(ExternalWalletResponse response);

class RazorpayService {
  late Razorpay _razorpay;
  OnPaymentSuccess? onSuccess;
  OnPaymentError? onError;
  OnExternalWallet? onExternalWallet;

  RazorpayService({
    this.onSuccess,
    this.onError,
    this.onExternalWallet,
  }) {
    _init();
  }

  void _init() {
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentError);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _handleExternalWallet);
  }

  void _handlePaymentSuccess(PaymentSuccessResponse response) {
    debugPrint('[Razorpay] Payment Success: ${response.paymentId}');
    onSuccess?.call(response);
  }

  void _handlePaymentError(PaymentFailureResponse response) {
    debugPrint('[Razorpay] Payment Error: ${response.code} - ${response.message}');
    onError?.call(response);
  }

  void _handleExternalWallet(ExternalWalletResponse response) {
    debugPrint('[Razorpay] External Wallet: ${response.walletName}');
    onExternalWallet?.call(response);
  }

  /// Launch Razorpay Native Checkout Dialog
  void openCheckout({
    required double amount,
    required String orderId,
    String? keyId,
    String? contact,
    String? email,
    String description = "Fresh Butchery Order Payment",
  }) {
    final activeKey = (keyId != null && keyId.isNotEmpty && !keyId.contains('placeholder'))
        ? keyId
        : AppConfig.razorpayKeyId;

    final options = {
      'key': activeKey,
      'amount': (amount * 100).toInt(), // amount in paise
      'name': AppConfig.appName,
      'description': description,
      'order_id': orderId.startsWith('order_') ? orderId : null,
      'timeout': 300, // 5 minutes
      'prefill': {
        'contact': contact ?? '',
        'email': email ?? 'customer@teffes.com',
      },
      'theme': {
        'color': '#941717', // Teffe's Primary Maroon
      },
      'external': {
        'wallets': ['paytm'],
      }
    };

    try {
      _razorpay.open(options);
    } catch (e) {
      debugPrint('[Razorpay] Error opening checkout: $e');
      onError?.call(PaymentFailureResponse(
        Razorpay.UNKNOWN_ERROR,
        e.toString(),
        null,
      ));
    }
  }

  void dispose() {
    _razorpay.clear();
  }
}
