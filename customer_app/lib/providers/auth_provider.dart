import 'package:flutter/foundation.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/constants/api_endpoints.dart';
import '../core/network/api_client.dart';
import '../core/services/fcm_service.dart';
import '../models/order_model.dart';
import '../models/user_model.dart';

class AuthProvider with ChangeNotifier {
  final ApiClient _api = ApiClient();
  final FirebaseAuth _firebaseAuth = FirebaseAuth.instance;

  UserModel? _user;
  String? _token;
  bool _isLoading = false;
  String? _error;
  List<OrderModel> _myOrders = [];

  UserModel? get user => _user;
  String? get token => _token;
  bool get isAuthenticated => _token != null && _token!.isNotEmpty && _user != null;
  bool get isLoading => _isLoading;
  String? get error => _error;
  List<OrderModel> get myOrders => _myOrders;
  OrderModel? get activeOrder => _myOrders.where((o) => o.isActive).isNotEmpty
      ? _myOrders.firstWhere((o) => o.isActive)
      : null;

  AuthProvider() {
    initAuth();
  }

  Future<void> initAuth() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('auth_token');
    if (_token != null && _token!.isNotEmpty) {
      final success = await fetchCurrentUser();
      if (!success || _user == null) {
        // Invalid or stale token restored - purge immediately to avoid phantom logins
        _token = null;
        _user = null;
        await prefs.remove('auth_token');
      } else {
        await fetchMyOrders();
        await FcmService.instance.syncUserSession();
      }
    }
    notifyListeners();
  }

  Future<void> fetchMyOrders() async {
    try {
      final res = await _api.get(ApiEndpoints.myOrders);
      if (res.data['success'] == true && res.data['orders'] is List) {
        final currentPhone = _user?.phone.replaceAll(RegExp(r'\D'), '') ?? '';
        final currentClean10 = currentPhone.length >= 10
            ? currentPhone.substring(currentPhone.length - 10)
            : currentPhone;
        final currentUserId = _user?.id ?? '';

        final serverOrders = (res.data['orders'] as List)
            .map((o) => OrderModel.fromJson(o as Map<String, dynamic>))
            .where((ord) {
              // Safety filter: Ensure the order belongs to this customer
              if (currentClean10.isNotEmpty && ord.customerPhone != null && ord.customerPhone!.isNotEmpty) {
                final ordPhone = ord.customerPhone!.replaceAll(RegExp(r'\D'), '');
                final ordClean10 = ordPhone.length >= 10
                    ? ordPhone.substring(ordPhone.length - 10)
                    : ordPhone;
                if (ordClean10 != currentClean10 && (ord.customerUserId != currentUserId || currentUserId.isEmpty)) {
                  return false;
                }
              }
              return true;
            })
            .toList();
        _myOrders = serverOrders;
        notifyListeners();
      }
    } catch (_) {}
  }

  // ─── FIREBASE PHONE AUTHENTICATION ─────────────────────────────────────────

  /// Send verification SMS via Firebase Phone Auth
  Future<void> sendFirebaseOtp({
    required String phone,
    required Function(String verificationId, int? resendToken) onCodeSent,
    required Function(String errorMessage) onFailed,
    Function(PhoneAuthCredential credential)? onAutoCompleted,
    int? resendToken,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    // Ensure clean 10-digit number and +91 prefix for Indian mobile numbers
    final digitsOnly = phone.replaceAll(RegExp(r'\D'), '');
    final clean10 = digitsOnly.length > 10 ? digitsOnly.substring(digitsOnly.length - 10) : digitsOnly;
    final formattedPhone = '+91$clean10';

    try {
      await _firebaseAuth.verifyPhoneNumber(
        phoneNumber: formattedPhone,
        timeout: const Duration(seconds: 60),
        forceResendingToken: resendToken,
        verificationCompleted: (PhoneAuthCredential credential) async {
          _isLoading = false;
          notifyListeners();
          if (onAutoCompleted != null) {
            onAutoCompleted(credential);
          } else {
            await _signInWithFirebaseCredential(credential, phone: clean10);
          }
        },
        verificationFailed: (FirebaseAuthException e) {
          debugPrint('[AuthProvider] Firebase phone verificationFailed: ${e.code} - ${e.message}');
          _isLoading = false;
          String friendlyMsg = 'Phone verification failed.';
          if (e.code == 'invalid-phone-number') {
            friendlyMsg = 'The phone number format is invalid.';
          } else if (e.code == 'too-many-requests') {
            friendlyMsg = 'Too many attempts. Please try again later.';
          } else if (e.code == 'quota-exceeded') {
            friendlyMsg = 'SMS quota reached. Please try again later.';
          } else if (e.message != null && e.message!.isNotEmpty) {
            friendlyMsg = e.message!;
          }
          _error = friendlyMsg;
          notifyListeners();
          onFailed(friendlyMsg);
        },
        codeSent: (String verificationId, int? resendToken) {
          _isLoading = false;
          notifyListeners();
          onCodeSent(verificationId, resendToken);
        },
        codeAutoRetrievalTimeout: (String verificationId) {
          // Auto retrieval timeout
        },
      );
    } catch (e) {
      debugPrint('[AuthProvider] verifyPhoneNumber threw exception: $e');
      _isLoading = false;
      _error = 'Failed to send verification SMS: $e';
      notifyListeners();
      onFailed(_error!);
    }
  }

  /// Verify 6-digit OTP code with Firebase and exchange ID Token with TeFFe backend
  Future<bool> verifyFirebaseOtp({
    required String verificationId,
    required String smsCode,
    String? phone,
    String? name,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    final cleanPhone = phone?.replaceAll(RegExp(r'\D'), '') ?? '';
    final clean10 = cleanPhone.length > 10 ? cleanPhone.substring(cleanPhone.length - 10) : cleanPhone;

    try {
      final credential = PhoneAuthProvider.credential(
        verificationId: verificationId,
        smsCode: smsCode.trim(),
      );

      return await _signInWithFirebaseCredential(credential, phone: clean10, name: name);
    } on FirebaseAuthException catch (e) {
      debugPrint('[AuthProvider] FirebaseAuthException: [${e.code}] ${e.message}');
      _isLoading = false;
      if (e.code == 'invalid-verification-code' || e.code == 'invalid-otp') {
        _error = 'Provided OTP is wrong. Please enter the correct code.';
      } else if (e.code == 'session-expired') {
        _error = 'Verification code has expired. Please request a new code.';
      } else if (e.code == 'too-many-requests') {
        _error = 'Too many attempts. Please try again later.';
      } else {
        _error = 'Provided OTP is wrong. Please enter the correct code.';
      }
      notifyListeners();
      return false;
    } catch (e) {
      debugPrint('[AuthProvider] Error verifying Firebase OTP: $e');
      _isLoading = false;
      _error = 'Provided OTP is wrong. Please enter the correct code.';
      notifyListeners();
      return false;
    }
  }

  /// Helper to sign in with PhoneAuthCredential, retrieve ID token, and exchange with TeFFe backend
  Future<bool> _signInWithFirebaseCredential(
    PhoneAuthCredential credential, {
    String? phone,
    String? name,
  }) async {
    try {
      final userCred = await _firebaseAuth.signInWithCredential(credential);
      final firebaseUser = userCred.user;
      if (firebaseUser == null) {
        throw Exception('User authentication failed in Firebase');
      }

      final idToken = await firebaseUser.getIdToken();
      if (idToken == null || idToken.isEmpty) {
        throw Exception('Unable to acquire Firebase ID token');
      }

      // Send Firebase ID Token to TeFFe backend to create/login customer & issue JWT
      final res = await _api.post(ApiEndpoints.firebaseLogin, data: {
        'idToken': idToken,
        if (phone != null) 'phone': phone,
        if (name != null) 'name': name,
      });

      if (res.data['success'] == true) {
        _token = (res.data['accessToken'] ?? res.data['token'])?.toString();
        if (_token != null && _token!.isNotEmpty) {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('auth_token', _token!);
        }

        if (res.data['user'] != null) {
          _user = UserModel.fromJson(res.data['user'] as Map<String, dynamic>);
        } else {
          _user = UserModel(
            id: 'cust-${phone ?? firebaseUser.phoneNumber ?? "user"}',
            name: name ?? 'Valued Customer',
            phone: phone ?? firebaseUser.phoneNumber ?? '',
            role: 'customer',
          );
        }

        await fetchMyOrders();
        await FcmService.instance.syncUserSession();
        _isLoading = false;
        notifyListeners();
        return true;
      }

      throw Exception('Failed to authenticate with TeFFe backend');
    } on FirebaseAuthException catch (e) {
      debugPrint('[AuthProvider] FirebaseAuthException: [${e.code}] ${e.message}');
      _isLoading = false;
      if (e.code == 'invalid-verification-code' || e.code == 'invalid-otp') {
        _error = 'Provided OTP is wrong. Please enter the correct code.';
      } else if (e.code == 'session-expired') {
        _error = 'Verification code has expired. Please request a new code.';
      } else if (e.code == 'too-many-requests') {
        _error = 'Too many attempts. Please try again later.';
      } else {
        _error = 'Provided OTP is wrong. Please enter the correct code.';
      }
      notifyListeners();
      return false;
    } catch (e) {
      debugPrint('[AuthProvider] Error exchanging token: $e');
      _error = 'Provided OTP is wrong. Please enter the correct code.';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  // ─── PROFILE & WALLET METHODS ─────────────────────────────────────────────

  Future<bool> fetchCurrentUser() async {
    try {
      final res = await _api.get(ApiEndpoints.getMe);
      if (res.data['success'] == true && res.data['user'] != null) {
        _user = UserModel.fromJson(res.data['user'] as Map<String, dynamic>);
        notifyListeners();
        return true;
      } else {
        _user = null;
        return false;
      }
    } catch (_) {
      _user = null;
      return false;
    }
  }

  Future<bool> updateProfileDetails({
    required String name,
    required String email,
    required String phone,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    if (_user != null) {
      _user = _user!.copyWith(name: name, email: email, phone: phone);
    }

    try {
      final res = await _api.put(ApiEndpoints.updateMe, data: {
        'name': name,
        'email': email,
        'phone': phone,
      });

      if (res.data['success'] == true && res.data['user'] != null) {
        _user = UserModel.fromJson(res.data['user'] as Map<String, dynamic>);
      }
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      return true;
    }
  }

  Future<bool> updateProfile({required String name, required String email}) async {
    return await updateProfileDetails(name: name, email: email, phone: _user?.phone ?? '');
  }

  Future<bool> addMoneyToWallet(double amount, {String? description, String? razorpayPaymentId}) async {
    final currentBal = _user?.walletBalance ?? 0.0;
    final newBal = currentBal + amount;
    _user = _user?.copyWith(walletBalance: newBal);
    notifyListeners();

    try {
      await _api.post(ApiEndpoints.walletAdd, data: {
        'amount': amount,
        'description': description ?? 'Recharge via Razorpay (${razorpayPaymentId ?? "UPI/Online"})',
      });
      return true;
    } catch (e) {
      debugPrint('Wallet API sync note: $e');
      return true;
    }
  }

  Future<bool> syncWalletBalance() async {
    try {
      final res = await _api.get(ApiEndpoints.walletDetails);
      if (res.data['success'] == true && res.data['wallet'] != null) {
        final bal = (res.data['wallet']['balance'] as num?)?.toDouble() ?? 0.0;
        if (_user != null) {
          _user = _user!.copyWith(walletBalance: bal);
          notifyListeners();
        }
      }
      return true;
    } catch (e) {
      debugPrint('Wallet API sync note: $e');
      return true;
    }
  }

  void deductWallet(double amount) {
    if (_user != null) {
      final newBal = (_user!.walletBalance - amount).clamp(0.0, double.infinity);
      _user = _user!.copyWith(walletBalance: newBal);
      notifyListeners();
    }
  }

  void addOrder(OrderModel newOrder) {
    _myOrders.insert(0, newOrder);
    notifyListeners();
  }

  Future<void> logout() async {
    try {
      await _firebaseAuth.signOut();
    } catch (_) {}
    await FcmService.instance.unregisterOnLogout();
    _user = null;
    _token = null;
    _myOrders = [];
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
    notifyListeners();
  }
}
