import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../core/utils/currency_formatter.dart';
import '../../core/utils/page_transitions.dart';
import '../../providers/cart_provider.dart';
import '../../widgets/common/bottom_nav_bar.dart';
import 'cart/cart_checkout_screen.dart';
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

  late final List<Widget> _pages;

  @override
  void initState() {
    super.initState();
    _pages = [
      const HomeScreen(),
      WishlistScreen(onExplore: () => setState(() => _currentIndex = 2)),
      const CategoryListingScreen(),
      const ProfileScreen(),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();

    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _pages,
      ),
      bottomNavigationBar: TeffeBottomNavBar(
        currentIndex: _currentIndex,
        onTap: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
      ),
      // Floating Cart Preview Bar (Zepto / Blinkit / Teffe's quick checkout bar)
      bottomSheet: cart.itemCount > 0 && _currentIndex != 2
          ? Container(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: const BoxDecoration(
                color: AppColors.primaryMaroon,
                borderRadius: AppDimensions.roundedLg,
                boxShadow: AppDimensions.floatingShadow,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${cart.itemCount} ${cart.itemCount == 1 ? "ITEM" : "ITEMS"}',
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.5,
                        ),
                      ),
                      Text(
                        CurrencyFormatter.format(cart.grandTotal),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ],
                  ),
                  InkWell(
                    onTap: () {
                      Navigator.of(context).push(
                        SmoothPageRoute(page: const CartCheckoutScreen()),
                      );
                    },
                    borderRadius: AppDimensions.roundedMd,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        borderRadius: AppDimensions.roundedMd,
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'View Cart',
                            style: TextStyle(
                              color: AppColors.primaryMaroon,
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          SizedBox(width: 4),
                          Icon(Icons.arrow_forward_rounded, size: 16, color: AppColors.primaryMaroon),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            )
          : null,
    );
  }
}
