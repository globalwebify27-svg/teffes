import 'package:flutter/material.dart';

class AppDimensions {
  AppDimensions._();

  // Spacing
  static const double spaceXs = 4.0;
  static const double spaceSm = 8.0;
  static const double spaceMd = 16.0;
  static const double spaceLg = 20.0;
  static const double spaceXl = 24.0;
  static const double space2Xl = 32.0;

  // Border Radius
  static final BorderRadius roundedSm = BorderRadius.circular(6.0);
  static final BorderRadius roundedMd = BorderRadius.circular(10.0);
  static final BorderRadius roundedLg = BorderRadius.circular(14.0);
  static final BorderRadius roundedXl = BorderRadius.circular(18.0);
  static final BorderRadius roundedPill = BorderRadius.circular(999.0);

  // Shadows
  static const List<BoxShadow> cardShadow = [
    BoxShadow(
      color: Color(0x0A000000),
      offset: Offset(0, 2),
      blurRadius: 8,
      spreadRadius: 0,
    ),
  ];

  static const List<BoxShadow> floatingShadow = [
    BoxShadow(
      color: Color(0x18000000),
      offset: Offset(0, 4),
      blurRadius: 16,
      spreadRadius: 0,
    ),
  ];
}
