import 'package:flutter/foundation.dart';
import 'package:payu_checkoutpro_flutter/payu_checkoutpro_flutter.dart';
import 'package:payu_checkoutpro_flutter/PayUConstantKeys.dart';
import '../constants/api_endpoints.dart';
import '../constants/app_config.dart';
import '../network/api_client.dart';

typedef OnPayUSuccess = void Function(Map<dynamic, dynamic> response);
typedef OnPayUFailure = void Function(Map<dynamic, dynamic> response);
typedef OnPayUCancel = void Function(Map<dynamic, dynamic>? response);

class PayUService implements PayUCheckoutProProtocol {
  final ApiClient _api = ApiClient();
  late final PayUCheckoutProFlutter _checkoutPro;

  OnPayUSuccess? onSuccess;
  OnPayUFailure? onFailure;
  OnPayUCancel? onCancel;

  PayUService({
    this.onSuccess,
    this.onFailure,
    this.onCancel,
  }) {
    _checkoutPro = PayUCheckoutProFlutter(this);
  }

  /// Launch PayU Checkout Pro Native Dialog
  /// [payuParams] comes directly from /api/payment/create-order backend response
  void openCheckout({
    required Map<String, dynamic> payuParams,
  }) {
    final key = payuParams['key'] ?? AppConfig.payuMerchantKey;
    final email = payuParams['email'] ?? 'customer@teffes.com';
    final hashes = payuParams['hashes'] is Map ? Map<String, dynamic>.from(payuParams['hashes']) : <String, dynamic>{};
    final paymentHash = payuParams['hash'] ?? hashes['payment'] ?? '';
    final detailsHash = hashes['payment_related_details_for_mobile_sdk'] ?? '';
    final vasHash = hashes['vas_for_mobile_sdk'] ?? '';

    final Map<String, dynamic> additionalParams = {
      if (paymentHash.toString().isNotEmpty) 'payment': paymentHash,
      if (detailsHash.toString().isNotEmpty) 'payment_related_details_for_mobile_sdk': detailsHash,
      if (vasHash.toString().isNotEmpty) 'vas_for_mobile_sdk': vasHash,
    };

    final Map<String, dynamic> paymentParams = {
      PayUPaymentParamKey.key: key,
      PayUPaymentParamKey.transactionId: payuParams['txnid'] ?? '',
      PayUPaymentParamKey.amount: payuParams['amount']?.toString() ?? '0.00',
      PayUPaymentParamKey.productInfo: payuParams['productinfo'] ?? "TeFFe's Fresh Order",
      PayUPaymentParamKey.firstName: payuParams['firstname'] ?? 'Customer',
      PayUPaymentParamKey.email: email,
      PayUPaymentParamKey.phone: payuParams['phone'] ?? '9999999999',
      PayUPaymentParamKey.android_surl: payuParams['surl'] ?? '',
      PayUPaymentParamKey.android_furl: payuParams['furl'] ?? '',
      PayUPaymentParamKey.ios_surl: payuParams['surl'] ?? '',
      PayUPaymentParamKey.ios_furl: payuParams['furl'] ?? '',
      PayUPaymentParamKey.environment: AppConfig.payuEnvironment == 'production' ? '0' : '1',
      PayUPaymentParamKey.userCredential: '$key:default',
      if (additionalParams.isNotEmpty) PayUPaymentParamKey.additionalParam: additionalParams,
    };

    final Map<String, dynamic> checkoutConfig = {
      PayUCheckoutProConfigKeys.primaryColor: '#800020',
      PayUCheckoutProConfigKeys.secondaryColor: '#ffffff',
      PayUCheckoutProConfigKeys.merchantName: "TeFFe's",
      PayUCheckoutProConfigKeys.merchantLogo: 'https://teffes.onrender.com/uploads/teffes-logo-maroon.png',
      PayUCheckoutProConfigKeys.showExitConfirmationOnCheckoutScreen: true,
      PayUCheckoutProConfigKeys.showExitConfirmationOnPaymentScreen: true,
    };

    try {
      debugPrint('[PayU] Launching native checkout with params: $paymentParams');
      _checkoutPro.openCheckoutScreen(
        payUPaymentParams: paymentParams,
        payUCheckoutProConfig: checkoutConfig,
      );
    } catch (e) {
      debugPrint('[PayU] Error opening checkout: $e');
      onFailure?.call({'error': e.toString(), 'code': -1});
    }
  }

  // ── PayUCheckoutProProtocol Implementation ─────────────────────────────

  @override
  void generateHash(Map response) async {
    final hashName = response[PayUHashConstantsKeys.hashName]?.toString() ?? '';
    final hashString = response[PayUHashConstantsKeys.hashString]?.toString() ?? '';
    final postSalt = response[PayUHashConstantsKeys.postSalt]?.toString() ?? '';

    debugPrint('[PayU generateHash] callback requested: hashName=$hashName, hashString=$hashString, postSalt=$postSalt');

    try {
      final res = await _api.post(ApiEndpoints.generatePayUHash, data: {
        'hashName': hashName,
        'hashString': hashString,
        'postSalt': postSalt,
      });

      if (res.data != null && res.data['hash'] != null) {
        final hash = res.data['hash'].toString();
        debugPrint('[PayU generateHash] passing computed hash back to PayU SDK: {$hashName: $hash}');
        _checkoutPro.hashGenerated(hash: {hashName: hash});
      } else {
        debugPrint('[PayU generateHash] Warning: Backend returned null or empty hash');
      }
    } catch (e) {
      debugPrint('[PayU] Error generating hash from backend: $e');
    }
  }

  @override
  void onPaymentSuccess(dynamic response) {
    debugPrint('[PayU] Payment Success: $response');
    onSuccess?.call(response is Map ? response.cast<dynamic, dynamic>() : {'response': response});
  }

  @override
  void onPaymentFailure(dynamic response) {
    debugPrint('[PayU] Payment Failure: $response');
    onFailure?.call(response is Map ? response.cast<dynamic, dynamic>() : {'response': response});
  }

  @override
  void onPaymentCancel(Map? response) {
    debugPrint('[PayU] Payment Cancelled: $response');
    onCancel?.call(response?.cast<dynamic, dynamic>());
  }

  @override
  void onError(Map? response) {
    debugPrint('[PayU] Error: $response');
    onFailure?.call(response?.cast<dynamic, dynamic>() ?? {'error': 'Unknown PayU error'});
  }
}

// ── Legacy alias so any remaining imports compile seamlessly ───────────────
// ignore_for_file: unused_element
typedef RazorpayService = PayUService;
