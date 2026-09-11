import 'dart:async';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../main_shell_screen.dart';
import '../onboarding/onboarding_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _scaleAnimation;
  late Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();

    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );

    _scaleAnimation = Tween<double>(begin: 0.88, end: 1.0).animate(
      CurvedAnimation(parent: _animController, curve: Curves.easeOutBack),
    );

    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _animController, curve: Curves.easeIn),
    );

    _animController.forward();

    // 1.5s splash display duration, then navigate based on onboarding status
    Timer(const Duration(milliseconds: 1500), _handleNavigation);
  }

  Future<void> _handleNavigation() async {
    if (!mounted) return;

    final prefs = await SharedPreferences.getInstance();
    final bool hasSeenOnboarding = prefs.getBool('has_seen_onboarding') ?? false;

    if (!mounted) return;

    Navigator.pushReplacement(
      context,
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) {
          return hasSeenOnboarding ? const MainShellScreen() : const OnboardingScreen();
        },
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(opacity: animation, child: child);
        },
        transitionDuration: const Duration(milliseconds: 400),
      ),
    );
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFBF8F5),
      body: Stack(
        children: [
          // Centered Animated Logo & Branding
          Center(
            child: AnimatedBuilder(
              animation: _animController,
              builder: (context, child) {
                return Opacity(
                  opacity: _fadeAnimation.value,
                  child: Transform.scale(
                    scale: _scaleAnimation.value,
                    child: child,
                  ),
                );
              },
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Official TeFFe Maroon Logo
                  Image.asset(
                    'assets/images/teffes-logo-maroon.png',
                    width: 170,
                    fit: BoxFit.contain,
                    errorBuilder: (context, error, stackTrace) {
                      // High-fidelity fallback if asset is loading
                      return const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.restaurant_menu_rounded, color: Color(0xFF7A0C14), size: 36),
                          SizedBox(width: 8),
                          Text(
                            "TeFFe",
                            style: TextStyle(
                              fontSize: 32,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF5E0B14),
                              letterSpacing: -1.0,
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                  const SizedBox(height: 12),

                  // Tagline
                  const Text(
                    "Where health matters most",
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF8C7373),
                      letterSpacing: 0.2,
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Bottom Signature & Freshness Assurance
          Positioned(
            bottom: 36,
            left: 0,
            right: 0,
            child: Column(
              children: [
                // Subtle progress indicator
                const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Color(0xFF7A0C14),
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  "100% Fresh Daily Cuts • Ranchi Butchery Hub",
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF7A0C14).withOpacity(0.75),
                    letterSpacing: 0.3,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
