import 'package:flutter/material.dart';

/// Design tokens extracted directly from Teffe's Stitch Design System
class AppColors {
  AppColors._();

  // Signature Butchery Crimson
  static const Color primary = Color(0xFFDC2D1B);
  static const Color primaryDark = Color(0xFFB70B01);
  static const Color primaryMaroon = Color(0xFF91000A);
  static const Color primaryHover = Color(0xFFB91C1C);
  static const Color primaryLight = Color(0xFFFEE2E2);
  static const Color primaryContainer = Color(0xFFDC2D1B);

  // Authority Slate & Text
  static const Color secondary = Color(0xFF111C36);
  static const Color onSurface = Color(0xFF111C2C);
  static const Color textPrimary = Color(0xFF111C2C);
  static const Color textSecondary = Color(0xFF5A6578);
  static const Color textMuted = Color(0xFF9CA3AF);

  // Hygiene & Cold-Chain Emerald
  static const Color hygieneEmerald = Color(0xFF10B981);
  static const Color hygieneDark = Color(0xFF047857);
  static const Color hygieneLight = Color(0xFFECFDF5);
  static const Color hygieneBorder = Color(0xFFA7F3D0);

  // Delivery & Speed Amber
  static const Color deliveryAmber = Color(0xFFD97706);
  static const Color deliveryAmberBg = Color(0xFFFEF3C7);

  // Clean Surfaces & Backgrounds
  static const Color background = Color(0xFFF9F9FF);
  static const Color surfacePorcelain = Color(0xFFFBFBFB);
  static const Color surfacePure = Color(0xFFFFFFFF);
  static const Color surfaceSubtle = Color(0xFFF3F4F6);
  static const Color surfaceInput = Color(0xFFF1F5F9);

  // Borders & Dividers
  static const Color borderHairline = Color(0xFFE5E7EB);
  static const Color borderSubtle = Color(0xFFE2E8F0);

  // Badges & Accents
  static const Color ratingStar = Color(0xFFF59E0B);
  static const Color discountGreen = Color(0xFF16A34A);
  static const Color error = Color(0xFFBA1A1A);

  // Gradients
  static const LinearGradient promoBannerGradient = LinearGradient(
    colors: [Color(0xFF8B0000), Color(0xFFB70B01), Color(0xFF6E0E0E)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}
