import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../providers/wishlist_provider.dart';

class TeffeBottomNavBar extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;

  const TeffeBottomNavBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppColors.borderHairline.withOpacity(0.8), width: 1)),
        boxShadow: const [
          BoxShadow(
            color: Color.fromRGBO(0, 0, 0, 0.04),
            blurRadius: 10,
            offset: Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildNavItem(context, 0, Icons.home_rounded, Icons.home_outlined, 'Home'),
              _buildNavItem(context, 1, Icons.favorite_rounded, Icons.favorite_border_rounded, 'Wishlist'),
              _buildNavItem(context, 2, Icons.grid_view_rounded, Icons.grid_view_outlined, 'Categories'),
              _buildNavItem(context, 3, Icons.person_rounded, Icons.person_outline_rounded, 'Account'),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(BuildContext context, int index, IconData activeIcon, IconData inactiveIcon, String label) {
    final isSelected = currentIndex == index;
    final color = isSelected ? AppColors.primaryMaroon : AppColors.textMuted;

    Widget iconWidget = Icon(
      isSelected ? activeIcon : inactiveIcon,
      size: 22,
      color: color,
    );

    if (index == 1) {
      final wishlistCount = context.watch<WishlistProvider>().count;
      if (wishlistCount > 0) {
        iconWidget = Badge(
          label: Text(
            wishlistCount.toString(),
            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white),
          ),
          backgroundColor: AppColors.primaryMaroon,
          child: iconWidget,
        );
      }
    }

    return GestureDetector(
      onTap: () => onTap(index),
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            iconWidget,
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontSize: 10.5,
                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
