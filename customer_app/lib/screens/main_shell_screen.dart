import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/cart_provider.dart';
import '../../widgets/common/bottom_nav_bar.dart';
import '../../widgets/common/floating_cart_bar.dart';
import 'category/category_listing_screen.dart';
import 'home/home_screen.dart';
import 'profile/profile_screen.dart';
import 'wishlist/wishlist_screen.dart';

class MainShellScreen extends StatefulWidget {
  const MainShellScreen({super.key});

  @override
  State<MainShellScreen> createState() => _MainShellScreenState();
}

class _MainShellScreenState extends State<MainShellScreen> {
  int _currentIndex = 0;
  int _previousIndex = 0;

  late final List<Widget> _pages;

  @override
  void initState() {
    super.initState();
    _pages = [
      const HomeScreen(),
      WishlistScreen(onExplore: () => _switchTab(2)),
      const CategoryListingScreen(showBackButton: false),
      const ProfileScreen(),
    ];
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        context.read<CartProvider>().fetchCartFromServer();
      }
    });
  }

  void _switchTab(int index) {
    if (_currentIndex != index) {
      setState(() {
        _previousIndex = _currentIndex;
        _currentIndex = index;
      });
    }
  }

  void _handleCategoryBack() {
    setState(() {
      _currentIndex = (_previousIndex == 2) ? 0 : _previousIndex;
    });
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();

    return PopScope(
      canPop: _currentIndex == 0,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        if (_currentIndex != 0) {
          _handleCategoryBack();
        }
      },
      child: Scaffold(
        body: IndexedStack(
          index: _currentIndex,
          children: _pages,
        ),
        bottomNavigationBar: TeffeBottomNavBar(
          currentIndex: _currentIndex,
          onTap: _switchTab,
        ),
        // Floating Cart Preview Bar (Active on Home, Wishlist, and Categories tabs)
        bottomSheet: cart.itemCount > 0 && _currentIndex != 3
            ? const FloatingCartBar()
            : null,
      ),
    );
  }
}
