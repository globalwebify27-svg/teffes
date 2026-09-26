import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../providers/auth_provider.dart';
import '../../providers/location_provider.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _phoneController = TextEditingController();

  // 6 Separate Controllers and FocusNodes for the 6-Digit Firebase SMS Code
  final TextEditingController _box1 = TextEditingController();
  final TextEditingController _box2 = TextEditingController();
  final TextEditingController _box3 = TextEditingController();
  final TextEditingController _box4 = TextEditingController();
  final TextEditingController _box5 = TextEditingController();
  final TextEditingController _box6 = TextEditingController();

  final FocusNode _fn1 = FocusNode();
  final FocusNode _fn2 = FocusNode();
  final FocusNode _fn3 = FocusNode();
  final FocusNode _fn4 = FocusNode();
  final FocusNode _fn5 = FocusNode();
  final FocusNode _fn6 = FocusNode();

  bool _isOtpSent = false;
  String? _verificationId;
  final String _testOtp = '123456';
  int _resendTimerSeconds = 30;
  Timer? _countdownTimer;

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _phoneController.dispose();
    _box1.dispose();
    _box2.dispose();
    _box3.dispose();
    _box4.dispose();
    _box5.dispose();
    _box6.dispose();
    _fn1.dispose();
    _fn2.dispose();
    _fn3.dispose();
    _fn4.dispose();
    _fn5.dispose();
    _fn6.dispose();
    super.dispose();
  }

  void _startResendTimer() {
    _resendTimerSeconds = 30;
    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_resendTimerSeconds <= 1) {
        timer.cancel();
        if (mounted) setState(() => _resendTimerSeconds = 0);
      } else {
        if (mounted) setState(() => _resendTimerSeconds--);
      }
    });
  }

  void _fillOtp(String code) {
    final clean = code.replaceAll(RegExp(r'\D'), '');
    if (clean.length >= 6) {
      _box1.text = clean[0];
      _box2.text = clean[1];
      _box3.text = clean[2];
      _box4.text = clean[3];
      _box5.text = clean[4];
      _box6.text = clean[5];
      _fn6.requestFocus();
      setState(() {});
    }
  }

  void _clearOtpBoxes() {
    _box1.clear();
    _box2.clear();
    _box3.clear();
    _box4.clear();
    _box5.clear();
    _box6.clear();
    setState(() {});
  }

  String get _currentOtp =>
      '${_box1.text}${_box2.text}${_box3.text}${_box4.text}${_box5.text}${_box6.text}'.trim();

  Future<void> _handleSendOtp() async {
    final cleanPhone = _phoneController.text.replaceAll(RegExp(r'\D'), '');
    if (cleanPhone.length < 10) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a valid 10-digit mobile number'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    final auth = context.read<AuthProvider>();

    await auth.sendFirebaseOtp(
      phone: cleanPhone,
      onCodeSent: (verificationId, resendToken) {
        if (!mounted) return;
        setState(() {
          _verificationId = verificationId;
          _isOtpSent = true;
        });
        _clearOtpBoxes();
        _startResendTimer();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Row(
              children: [
                Icon(Icons.mark_email_read_rounded, color: Colors.white, size: 20),
                SizedBox(width: 8),
                Expanded(child: Text('6-digit verification code sent via SMS')),
              ],
            ),
            backgroundColor: AppColors.hygieneDark,
            duration: Duration(seconds: 4),
          ),
        );
      },
      onFailed: (errorMessage) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMessage),
            backgroundColor: AppColors.error,
          ),
        );
      },
      onAutoCompleted: (credential) async {
        if (!mounted) return;
        final success = await auth.verifyFirebaseOtp(
          verificationId: _verificationId ?? '',
          smsCode: credential.smsCode ?? '',
          phone: cleanPhone,
        );
        if (success && mounted) {
          _onLoginSuccess();
        }
      },
    );
  }

  Future<void> _handleVerifyOtp() async {
    final cleanOtp = _currentOtp;
    if (cleanOtp.length < 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter the complete 6-digit OTP code'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    final auth = context.read<AuthProvider>();
    final cleanPhone = _phoneController.text.replaceAll(RegExp(r'\D'), '');

    bool success = false;
    if (_verificationId != null && _verificationId!.isNotEmpty) {
      success = await auth.verifyFirebaseOtp(
        verificationId: _verificationId!,
        smsCode: cleanOtp,
        phone: cleanPhone,
      );
    } else {
      success = await auth.verifyOtp(cleanPhone, cleanOtp);
    }

    if (!success) {
      if (!mounted) return;
      String friendlyError = auth.error ?? 'Provided OTP is wrong. Please enter the correct code.';
      if (friendlyError.contains('invalid-verification-code') ||
          friendlyError.contains('SMS/TOTP is invalid') ||
          friendlyError.contains('Firebase') ||
          friendlyError.contains('Failed to create customer session')) {
        friendlyError = 'Provided OTP is wrong. Please enter the correct code.';
      } else if (friendlyError.contains('session-expired')) {
        friendlyError = 'Verification code has expired. Please request a new code.';
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.error_outline_rounded, color: Colors.white, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  friendlyError,
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                ),
              ),
            ],
          ),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          duration: const Duration(seconds: 4),
        ),
      );
      return;
    }

    if (!mounted) return;
    _onLoginSuccess();
  }

  Future<void> _onLoginSuccess() async {
    final auth = context.read<AuthProvider>();
    final location = context.read<LocationProvider>();

    if (auth.user != null && auth.user!.addresses.isNotEmpty) {
      location.setSavedAddresses(auth.user!.addresses);
    } else {
      await location.detectGpsLocation(userTriggered: true);
    }

    if (!mounted) return;

    final userName = (auth.user?.name.isNotEmpty == true) ? auth.user!.name : 'Customer';
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Welcome, $userName! Signed in successfully.'),
        backgroundColor: AppColors.hygieneDark,
      ),
    );

    Navigator.of(context).pop(true);
  }

  Widget _buildOtpSquare({
    required TextEditingController controller,
    required FocusNode focusNode,
    FocusNode? nextFocus,
    FocusNode? prevFocus,
  }) {
    final hasValue = controller.text.isNotEmpty;
    final hasFocus = focusNode.hasFocus;

    return Container(
      width: 44,
      height: 52,
      decoration: BoxDecoration(
        color: hasFocus ? Colors.white : AppColors.surfaceInput,
        borderRadius: AppDimensions.roundedMd,
        border: Border.all(
          color: hasFocus
              ? AppColors.primaryMaroon
              : (hasValue ? AppColors.textPrimary : AppColors.borderHairline),
          width: hasFocus ? 2.0 : 1.2,
        ),
        boxShadow: hasFocus
            ? [
                BoxShadow(
                  color: AppColors.primaryMaroon.withValues(alpha: 0.15),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ]
            : null,
      ),
      child: RawKeyboardListener(
        focusNode: FocusNode(),
        onKey: (event) {
          if (event is RawKeyDownEvent &&
              event.logicalKey == LogicalKeyboardKey.backspace &&
              controller.text.isEmpty &&
              prevFocus != null) {
            prevFocus.requestFocus();
          }
        },
        child: TextField(
          controller: controller,
          focusNode: focusNode,
          keyboardType: TextInputType.number,
          textAlign: TextAlign.center,
          maxLength: 1,
          style: const TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w900,
            color: AppColors.textPrimary,
          ),
          decoration: const InputDecoration(
            counterText: '',
            border: InputBorder.none,
            enabledBorder: InputBorder.none,
            focusedBorder: InputBorder.none,
            contentPadding: EdgeInsets.zero,
          ),
          inputFormatters: [
            FilteringTextInputFormatter.digitsOnly,
          ],
          onChanged: (val) {
            if (val.isNotEmpty) {
              if (nextFocus != null) {
                nextFocus.requestFocus();
              } else {
                focusNode.unfocus();
                if (_currentOtp.length == 6) {
                  _handleVerifyOtp();
                }
              }
            }
            setState(() {});
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final isLoading = auth.isLoading;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20, color: AppColors.textPrimary),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          'Customer Sign In',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 17,
            fontWeight: FontWeight.w800,
          ),
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 12),

              // Brand Hero Header matching website
              Center(
                child: Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.primaryMaroon.withValues(alpha: 0.2), width: 1.5),
                  ),
                  child: const Center(
                    child: Icon(
                      Icons.restaurant_menu_rounded,
                      size: 36,
                      color: AppColors.primaryMaroon,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),

              Text(
                'Customer Login / Sign Up',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                      color: AppColors.textPrimary,
                    ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),
              Text(
                _isOtpSent
                    ? 'Enter the 6-digit code sent via SMS to verify your account.'
                    : 'Enter your 10-digit mobile number to receive a secure login code.',
                style: const TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 13,
                  height: 1.4,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),

              if (!_isOtpSent) ...[
                // Phone Input Field with Country Code Badge
                const Text(
                  'Mobile Number',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),

                Container(
                  decoration: BoxDecoration(
                    color: AppColors.surfaceInput,
                    borderRadius: AppDimensions.roundedMd,
                    border: Border.all(color: AppColors.borderHairline),
                  ),
                  child: Row(
                    children: [
                      // +91 Flag / Prefix Badge
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                        decoration: const BoxDecoration(
                          border: Border(
                            right: BorderSide(color: AppColors.borderHairline),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: const [
                            Text('🇮🇳', style: TextStyle(fontSize: 18)),
                            SizedBox(width: 6),
                            Text(
                              '+91',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w800,
                                color: AppColors.textPrimary,
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Phone Number Input
                      Expanded(
                        child: TextField(
                          controller: _phoneController,
                          keyboardType: TextInputType.phone,
                          maxLength: 10,
                          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1.2,
                          ),
                          decoration: const InputDecoration(
                            hintText: '98765 43210',
                            hintStyle: TextStyle(
                              color: AppColors.textMuted,
                              letterSpacing: 0,
                              fontWeight: FontWeight.normal,
                            ),
                            counterText: '',
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            contentPadding: EdgeInsets.symmetric(horizontal: 14),
                          ),
                          onChanged: (val) => setState(() {}),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Enter your 10-digit mobile number to sign in',
                  style: TextStyle(fontSize: 11, color: AppColors.textMuted),
                ),
                const SizedBox(height: 24),

                // Submit Button
                ElevatedButton(
                  onPressed: (_phoneController.text.length < 10 || isLoading)
                      ? null
                      : _handleSendOtp,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryMaroon,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: AppColors.borderHairline,
                    disabledForegroundColor: AppColors.textMuted,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: AppDimensions.roundedMd),
                    elevation: 0,
                  ),
                  child: isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: const [
                            Text(
                              'Login with OTP',
                              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                            ),
                            SizedBox(width: 8),
                            Icon(Icons.arrow_forward_rounded, size: 18),
                          ],
                        ),
                ),
              ] else ...[
                // OTP Step: Phone change row
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceSubtle,
                    borderRadius: AppDimensions.roundedMd,
                    border: Border.all(color: AppColors.borderHairline),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Code sent to', style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
                          const SizedBox(height: 2),
                          Text(
                            '+91 ${_phoneController.text.isNotEmpty ? _phoneController.text : "9876543210"}',
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
                          ),
                        ],
                      ),
                      TextButton(
                        onPressed: () => setState(() => _isOtpSent = false),
                        child: const Text('Change', style: TextStyle(color: AppColors.primaryMaroon, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                const Text(
                  'Enter 6-Digit OTP',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 12),

                // 6 Separate Square Input Boxes
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _buildOtpSquare(
                      controller: _box1,
                      focusNode: _fn1,
                      nextFocus: _fn2,
                    ),
                    _buildOtpSquare(
                      controller: _box2,
                      focusNode: _fn2,
                      nextFocus: _fn3,
                      prevFocus: _fn1,
                    ),
                    _buildOtpSquare(
                      controller: _box3,
                      focusNode: _fn3,
                      nextFocus: _fn4,
                      prevFocus: _fn2,
                    ),
                    _buildOtpSquare(
                      controller: _box4,
                      focusNode: _fn4,
                      nextFocus: _fn5,
                      prevFocus: _fn3,
                    ),
                    _buildOtpSquare(
                      controller: _box5,
                      focusNode: _fn5,
                      nextFocus: _fn6,
                      prevFocus: _fn4,
                    ),
                    _buildOtpSquare(
                      controller: _box6,
                      focusNode: _fn6,
                      prevFocus: _fn5,
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Test OTP Pill & Resend Action
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    if (_resendTimerSeconds > 0)
                      Text(
                        'Resend code in ${_resendTimerSeconds}s',
                        style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                      )
                    else
                      GestureDetector(
                        onTap: _handleSendOtp,
                        child: const Text(
                          'Resend OTP',
                          style: TextStyle(
                            color: AppColors.primaryMaroon,
                            fontWeight: FontWeight.w800,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    GestureDetector(
                      onTap: () => _fillOtp(_testOtp),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: AppColors.primaryLight,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: AppColors.primaryMaroon.withValues(alpha: 0.3)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: const [
                            Icon(Icons.touch_app_rounded, size: 14, color: AppColors.primaryMaroon),
                            SizedBox(width: 4),
                            Text(
                              'Test Code: 123456',
                              style: TextStyle(
                                color: AppColors.primaryMaroon,
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // Verify Button
                ElevatedButton(
                  onPressed: (_currentOtp.length < 6 || isLoading) ? null : _handleVerifyOtp,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryMaroon,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: AppColors.borderHairline,
                    disabledForegroundColor: AppColors.textMuted,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: AppDimensions.roundedMd),
                    elevation: 0,
                  ),
                  child: isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: const [
                            Text(
                              'Verify & Proceed',
                              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                            ),
                            SizedBox(width: 8),
                            Icon(Icons.check_circle_outline_rounded, size: 18),
                          ],
                        ),
                ),
              ],

              const SizedBox(height: 36),

              // Trust Badges Grid
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surfaceSubtle,
                  borderRadius: AppDimensions.roundedLg,
                  border: Border.all(color: AppColors.borderHairline),
                ),
                child: Column(
                  children: [
                    _buildTrustRow(
                      icon: Icons.verified_user_rounded,
                      iconColor: AppColors.hygieneDark,
                      title: '100% Antibiotic & Chemical Free',
                      subtitle: 'Direct farm sourced, hygienically handled.',
                    ),
                    const Divider(height: 20, color: AppColors.borderHairline),
                    _buildTrustRow(
                      icon: Icons.kitchen_rounded,
                      iconColor: AppColors.hygieneDark,
                      title: 'Zero Cold Storage Guarantee',
                      subtitle: 'Cut strictly after your order is confirmed.',
                    ),
                    const Divider(height: 20, color: AppColors.borderHairline),
                    _buildTrustRow(
                      icon: Icons.electric_moped_rounded,
                      iconColor: AppColors.deliveryAmber,
                      title: '90-Min Doorstep Express Delivery',
                      subtitle: 'Temperature monitored delivery across Ranchi.',
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Terms Footer Note
              const Center(
                child: Text(
                  'By proceeding, you agree to Teffe\'s Terms of Service & Privacy Policy',
                  style: TextStyle(
                    fontSize: 11,
                    color: AppColors.textMuted,
                    height: 1.4,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTrustRow({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
  }) {
    return Row(
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: iconColor.withValues(alpha: 0.1),
            shape: BoxShape.circle,
          ),
          child: Center(
            child: Icon(icon, color: iconColor, size: 20),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: const TextStyle(
                  fontSize: 11,
                  color: AppColors.textMuted,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
