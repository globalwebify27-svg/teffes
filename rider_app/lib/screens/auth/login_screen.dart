import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../providers/rider_auth_provider.dart';
import '../../providers/rider_location_provider.dart';
import 'location_permission_screen.dart';
import '../main_shell_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController(text: 'rider@teffes.com');
  final _passwordController = TextEditingController(text: 'Rider@12345');
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _fillDemoCredentials() {
    _emailController.text = 'rider@teffes.com';
    _passwordController.text = 'Rider@12345';
    setState(() {});
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    final authProvider = context.read<RiderAuthProvider>();
    final success = await authProvider.login(
      _emailController.text.trim(),
      _passwordController.text,
    );

    if (!mounted) return;

    if (success) {
      final locationProvider = context.read<RiderLocationProvider>();
      if (!locationProvider.isPermissionGranted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const LocationPermissionScreen()),
        );
      } else {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const MainShellScreen()),
        );
      }
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(authProvider.errorMessage ?? 'Login failed. Please check credentials.'),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<RiderAuthProvider>();

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 20.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 24),
                // Brand Header
                Center(
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.primaryLight.withOpacity(0.5),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.delivery_dining_rounded,
                      size: 54,
                      color: AppColors.primaryMaroon,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Center(
                  child: RichText(
                    text: const TextSpan(
                      text: "TeFFe's ",
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w900,
                        color: AppColors.primaryMaroon,
                        letterSpacing: -0.5,
                      ),
                      children: [
                        TextSpan(
                          text: 'Rider',
                          style: TextStyle(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                const Center(
                  child: Text(
                    'Partner Delivery Portal • Ranchi Hub',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
                const SizedBox(height: 36),

                // Form Section
                const Text(
                  'Email Address',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: InputDecoration(
                    hintText: 'Enter your registered email',
                    prefixIcon: const Icon(Icons.email_outlined, color: AppColors.textMuted, size: 20),
                    filled: true,
                    fillColor: AppColors.surfaceInput,
                    border: OutlineInputBorder(
                      borderRadius: AppDimensions.roundedMd,
                      borderSide: const BorderSide(color: AppColors.borderHairline),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: AppDimensions.roundedMd,
                      borderSide: const BorderSide(color: AppColors.borderHairline),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: AppDimensions.roundedMd,
                      borderSide: const BorderSide(color: AppColors.primaryMaroon, width: 1.5),
                    ),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  ),
                  validator: (val) {
                    if (val == null || val.trim().isEmpty) return 'Email is required';
                    if (!val.contains('@')) return 'Enter a valid email';
                    return null;
                  },
                ),
                const SizedBox(height: 18),

                const Text(
                  'Password',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
                  decoration: InputDecoration(
                    hintText: 'Enter your password',
                    prefixIcon: const Icon(Icons.lock_outline_rounded, color: AppColors.textMuted, size: 20),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                        color: AppColors.textMuted,
                        size: 20,
                      ),
                      onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                    ),
                    filled: true,
                    fillColor: AppColors.surfaceInput,
                    border: OutlineInputBorder(
                      borderRadius: AppDimensions.roundedMd,
                      borderSide: const BorderSide(color: AppColors.borderHairline),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: AppDimensions.roundedMd,
                      borderSide: const BorderSide(color: AppColors.borderHairline),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: AppDimensions.roundedMd,
                      borderSide: const BorderSide(color: AppColors.primaryMaroon, width: 1.5),
                    ),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  ),
                  validator: (val) {
                    if (val == null || val.isEmpty) return 'Password is required';
                    if (val.length < 5) return 'Password must be at least 5 characters';
                    return null;
                  },
                ),
                const SizedBox(height: 12),

                // Demo Credentials Fast-fill Chip
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton.icon(
                    onPressed: _fillDemoCredentials,
                    icon: const Icon(Icons.flash_on_rounded, size: 16, color: AppColors.primaryMaroon),
                    label: const Text(
                      'Use Demo Rider Credentials',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: AppColors.primaryMaroon,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Submit Button
                SizedBox(
                  height: 52,
                  child: ElevatedButton(
                    onPressed: auth.isLoading ? null : _handleLogin,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primaryMaroon,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: AppDimensions.roundedLg,
                      ),
                    ),
                    child: auth.isLoading
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.5,
                              valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                            ),
                          )
                        : const Text(
                            'Sign In to Duty',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.2,
                            ),
                          ),
                  ),
                ),
                const SizedBox(height: 32),

                // Rider Support Notice
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceSubtle,
                    borderRadius: AppDimensions.roundedMd,
                    border: Border.all(color: AppColors.borderHairline),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline_rounded, size: 20, color: AppColors.textSecondary),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'New rider or forgot password? Contact your assigned Store Admin or Central Fleet Dispatch.',
                          style: TextStyle(
                            fontSize: 12,
                            color: AppColors.textSecondary.withOpacity(0.9),
                            height: 1.35,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
