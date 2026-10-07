class AppConfig {
  /// Plug-and-Play Razorpay Key ID
  /// Drop client's key in --dart-define=RAZORPAY_KEY_ID=... or edit defaultValue here
  static const String razorpayKeyId = String.fromEnvironment(
    'RAZORPAY_KEY_ID',
    defaultValue: 'rzp_test_placeholder',
  );

  /// Plug-and-Play Google Maps API Key
  /// Drop client's key in --dart-define=GOOGLE_MAPS_API_KEY=... or AndroidManifest
  static const String googleMapsApiKey = String.fromEnvironment(
    'GOOGLE_MAPS_API_KEY',
    defaultValue: 'AIzaSy_demo_placeholder_key',
  );

  static const String appName = "TeFFe's Artisanal Butchery";
  static const String supportPhone = "+918340010000";
}
