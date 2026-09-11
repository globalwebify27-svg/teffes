import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'core/theme/app_theme.dart';
import 'providers/auth_provider.dart';
import 'providers/cart_provider.dart';
import 'providers/location_provider.dart';
import 'providers/products_provider.dart';
import 'providers/wishlist_provider.dart';
import 'screens/main_shell_screen.dart';
import 'screens/onboarding/onboarding_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Set immersive status bar matching white/porcelain theme
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      systemNavigationBarColor: Colors.white,
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
  );

  final prefs = await SharedPreferences.getInstance();
  final bool hasSeenOnboarding = prefs.getBool('has_seen_onboarding') ?? false;

  runApp(TeffesCustomerApp(hasSeenOnboarding: hasSeenOnboarding));
}

class TeffesCustomerApp extends StatelessWidget {
  final bool hasSeenOnboarding;

  const TeffesCustomerApp({super.key, required this.hasSeenOnboarding});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => ProductsProvider()),
        ChangeNotifierProvider(create: (_) => CartProvider()),
        ChangeNotifierProvider(create: (_) => LocationProvider()),
        ChangeNotifierProvider(create: (_) => WishlistProvider()),
      ],
      child: MaterialApp(
        title: "TeFFe's Artisanal Butchery",
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        home: hasSeenOnboarding ? const MainShellScreen() : const OnboardingScreen(),
      ),
    );
  }
}
