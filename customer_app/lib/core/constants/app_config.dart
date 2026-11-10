class AppConfig {
  /// PayU Merchant Key (Test Mode)
  /// Drop client's key in --dart-define=PAYU_KEY=... or edit defaultValue here
  static const String payuMerchantKey = String.fromEnvironment(
    'PAYU_KEY',
    defaultValue: 'mv5iBR',
  );

  /// PayU Environment - 'production' (Live gateway)
  static const String payuEnvironment = String.fromEnvironment(
    'PAYU_ENV',
    defaultValue: 'production',
  );

  /// Legacy alias so any remaining code referencing razorpayKeyId still compiles
  static const String razorpayKeyId = payuMerchantKey;

  /// Plug-and-Play Google Maps API Key
  /// Drop client's key in --dart-define=GOOGLE_MAPS_API_KEY=... or AndroidManifest
  static const String googleMapsApiKey = String.fromEnvironment(
    'GOOGLE_MAPS_API_KEY',
    defaultValue: 'AIzaSyB_ZC0cTMgCcoLByus4krDNd4RA27qnjMs',
  );

  static const String appName = "TeFFe's";
  static const String supportPhone = "+918340010000";
}
