import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../core/utils/currency_formatter.dart';
import '../../core/utils/page_transitions.dart';
import '../../providers/cart_provider.dart';
import '../../screens/cart/cart_checkout_screen.dart';

/// Reusable floating quick-checkout preview bar.
/// Styled after Blinkit / Zepto / Teffe quick checkout bar.
class FloatingCartBar extends StatelessWidget {
  const FloatingCartBar({super.key});

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    if (cart.itemCount == 0) return const SizedBox.shrink();

    return Container(
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
          // Items count and total price
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

          // View Cart button
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
                  Icon(
                    Icons.arrow_forward_rounded,
                    size: 16,
                    color: AppColors.primaryMaroon,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
