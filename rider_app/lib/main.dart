import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'core/services/rider_fcm_service.dart';
import 'core/theme/app_theme.dart';
import 'providers/rider_auth_provider.dart';
import 'providers/rider_location_provider.dart';
import 'providers/rider_orders_provider.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/location_permission_screen.dart';
import 'screens/main_shell_screen.dart';
import 'screens/onboarding/rider_onboarding_screen.dart';

final GlobalKey<NavigatorState> riderNavigatorKey = GlobalKey<NavigatorState>();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      systemNavigationBarColor: Colors.white,
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
  );

  final authProvider = RiderAuthProvider();
  final locationProvider = RiderLocationProvider();
  final ordersProvider = RiderOrdersProvider();

  await authProvider.init();
  await locationProvider.init();

  // Initialize Rider FCM push alerts
  await RiderFcmService.instance.initialize(riderNavigatorKey);

  final prefs = await SharedPreferences.getInstance();
  final bool hasSeenOnboarding = prefs.getBool('has_seen_rider_onboarding') ?? false;

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: authProvider),
        ChangeNotifierProvider.value(value: locationProvider),
        ChangeNotifierProvider.value(value: ordersProvider),
      ],
      child: TeffesRiderApp(hasSeenOnboarding: hasSeenOnboarding),
    ),
  );
}

class TeffesRiderApp extends StatelessWidget {
  final bool hasSeenOnboarding;

  const TeffesRiderApp({super.key, required this.hasSeenOnboarding});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: riderNavigatorKey,
      title: "TeFFe's Rider Partner",
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: hasSeenOnboarding ? const RiderRootGate() : const RiderOnboardingScreen(),
    );
  }
}

class RiderRootGate extends StatelessWidget {
  const RiderRootGate({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<RiderAuthProvider>();
    final location = context.watch<RiderLocationProvider>();

    if (!auth.isAuthenticated) {
      return const LoginScreen();
    }

    if (!location.isPermissionGranted) {
      return const LocationPermissionScreen();
    }

    return const MainShellScreen();
  }
}
