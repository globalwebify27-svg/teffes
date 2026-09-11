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

  // 4 Separate Controllers and FocusNodes for the 4 Square OTP Boxes
  final TextEditingController _box1 = TextEditingController();
  final TextEditingController _box2 = TextEditingController();
  final TextEditingController _box3 = TextEditingController();
  final TextEditingController _box4 = TextEditingController();

  final FocusNode _fn1 = FocusNode();
  final FocusNode _fn2 = FocusNode();
  final FocusNode _fn3 = FocusNode();
  final FocusNode _fn4 = FocusNode();

  bool _isOtpSent = false;
  final String _demoOtp = '1234';
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
    _fn1.dispose();
    _fn2.dispose();
    _fn3.dispose();
    _fn4.dispose();
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
    if (clean.length >= 4) {
      _box1.text = clean[0];
      _box2.text = clean[1];
      _box3.text = clean[2];
      _box4.text = clean[3];
      _fn4.requestFocus();
      setState(() {});
    }
  }

  String get _currentOtp => '${_box1.text}${_box2.text}${_box3.text}${_box4.text}'.trim();

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
    await auth.sendOtp(cleanPhone);

    if (!mounted) return;

    setState(() {
      _isOtpSent = true;
    });
    _fillOtp(_demoOtp);
    _startResendTimer();

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: const [
            Icon(Icons.mark_email_read_rounded, color: Colors.white, size: 20),
            SizedBox(width: 8),
            Expanded(child: Text('Your Teffe\'s Login OTP is: 1234')),
          ],
        ),
        backgroundColor: AppColors.primaryMaroon,
        duration: const Duration(seconds: 6),
      ),
    );
  }

  Future<void> _handleVerifyOtp() async {
    final cleanOtp = _currentOtp;
    if (cleanOtp.length < 4) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter the complete 4-digit OTP'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    final auth = context.read<AuthProvider>();
    final location = context.read<LocationProvider>();

    // Verify OTP via backend API
    final cleanPhone = _phoneController.text.replaceAll(RegExp(r'\D'), '');
    final success = await auth.verifyOtp(cleanPhone, cleanOtp);

    if (!success) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(auth.error ?? 'Invalid OTP code. Please try again.'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    if (auth.user != null && auth.user!.addresses.isNotEmpty) {
      location.setSavedAddresses(auth.user!.addresses);
    } else {
      // Zepto-style auto location detection for new users
      await location.detectGpsLocation(userTriggered: true);
    }

    if (!mounted) return;

    final userName = (auth.user?.name.isNotEmpty == true) ? auth.user!.name : 'Customer';
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Welcome back, $userName! Logged in successfully.'),
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
      width: 58,
      height: 60,
      decoration: BoxDecoration(
        color: hasFocus ? Colors.white : AppColors.surfaceInput,
        borderRadius: AppDimensions.roundedLg,
        border: Border.all(
          color: hasFocus
              ? AppColors.primaryMaroon
              : (hasValue ? AppColors.textPrimary : AppColors.borderHairline),
          width: hasFocus ? 2.0 : 1.2,
        ),
        boxShadow: hasFocus
            ? [
                BoxShadow(
                  color: AppColors.primaryMaroon.withOpacity(0.15),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ]
            : null,
      ),
      child: RawKeyboardListener(
        focusNode: FocusNode(), // auxiliary node for raw keys
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
            fontSize: 24,
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
                if (_currentOtp.length == 4) {
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
                    border: Border.all(color: AppColors.primaryMaroon.withOpacity(0.2), width: 1.5),
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
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
              ),
              const SizedBox(height: 6),
              Text(
                'Enter your mobile number to get an instant OTP for fresh delivery in Ranchi',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                      height: 1.4,
                    ),
              ),
              const SizedBox(height: 32),

              if (!_isOtpSent) ...[
                // Phone Number Input Step
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
                      // +91 Country Badge
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                        decoration: const BoxDecoration(
                          border: Border(right: BorderSide(color: AppColors.borderHairline)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: const [
                            Text(
                              '🇮🇳 +91',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w800,
                                color: AppColors.textPrimary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      // Input
                      Expanded(
                        child: TextField(
                          controller: _phoneController,
                          keyboardType: TextInputType.phone,
                          autofocus: true,
                          maxLength: 10,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1.2,
                          ),
                          decoration: const InputDecoration(
                            counterText: '',
                            hintText: '98765 43210',
                            hintStyle: TextStyle(
                              fontSize: 14,
                              color: AppColors.textMuted,
                              letterSpacing: 0,
                            ),
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
                  'Enter any 10-digit mobile number to sign in',
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
                  'Enter 4-Digit OTP',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 12),

                // 4 Separate Square Input Boxes
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
                      prevFocus: _fn3,
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Demo OTP Pill & Resend Action
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
                      onTap: () => _fillOtp(_demoOtp),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: AppColors.primaryLight,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: AppColors.primaryMaroon.withOpacity(0.3)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: const [
                            Icon(Icons.touch_app_rounded, size: 14, color: AppColors.primaryMaroon),
                            SizedBox(width: 4),
                            Text(
                              'Demo OTP: 1234',
                              style: TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w800,
                                color: AppColors.primaryMaroon,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                ElevatedButton(
                  onPressed: (_currentOtp.length < 4 || isLoading)
                      ? null
                      : _handleVerifyOtp,
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
                      : const Text(
                          'Verify & Proceed',
                          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                        ),
                ),
              ],

              const SizedBox(height: 32),

              // Ranchi Delivery Guarantee Note matching website
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.surfaceSubtle,
                  borderRadius: AppDimensions.roundedMd,
                  border: Border.all(color: AppColors.borderHairline),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: const [
                        Icon(Icons.bolt_rounded, size: 18, color: AppColors.deliveryAmber),
                        SizedBox(width: 6),
                        Text(
                          '90-Min Fresh Delivery in Ranchi',
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'No password needed — 100% secure OTP verification.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              const Text(
                'By continuing, you agree to Teffe\'s Terms of Service & Privacy Policy.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 11, color: AppColors.textMuted, height: 1.4),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
