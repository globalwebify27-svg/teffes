import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../core/utils/page_transitions.dart';
import '../../models/product_model.dart';
import '../../providers/products_provider.dart';
import '../../providers/wishlist_provider.dart';
import '../../widgets/common/product_card.dart';
import '../product_details/product_details_screen.dart';

class WishlistScreen extends StatelessWidget {
  final VoidCallback? onExplore;

  const WishlistScreen({super.key, this.onExplore});

  @override
  Widget build(BuildContext context) {
    final wishlist = context.watch<WishlistProvider>();
    final productsProvider = context.watch<ProductsProvider>();
    final List<ProductModel> items = wishlist.getWishlistItems(productsProvider.products);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Row(
          children: [
            const Text(
              'Saved Cuts & Wishlist',
              style: TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 18,
                color: AppColors.textPrimary,
              ),
            ),
            if (items.isNotEmpty) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.primaryMaroon.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '${items.length}',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: AppColors.primaryMaroon,
                  ),
                ),
              ),
            ],
          ],
        ),
        centerTitle: false,
        actions: [
          if (items.isNotEmpty)
            TextButton(
              onPressed: () {
                showDialog(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text('Clear Wishlist?'),
                    content: const Text('Are you sure you want to remove all saved cuts?'),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text('Cancel'),
                      ),
                      TextButton(
                        onPressed: () {
                          wishlist.clearWishlist();
                          Navigator.pop(ctx);
                        },
                        child: const Text('Clear', style: TextStyle(color: Colors.red)),
                      ),
                    ],
                  ),
                );
              },
              child: const Text(
                'Clear All',
                style: TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
        ],
      ),
      body: items.isEmpty
          ? _buildEmptyState(context)
          : ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
              itemCount: items.length,
              itemBuilder: (context, index) {
                final product = items[index];
                return ProductCard(
                  product: product,
                  layout: ProductCardLayout.horizontal,
                  onTap: () {
                    Navigator.of(context).push(
                      SmoothPageRoute(
                        page: ProductDetailsScreen(product: product),
                      ),
                    );
                  },
                );
              },
            ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 90,
              height: 90,
              decoration: BoxDecoration(
                color: AppColors.primaryMaroon.withOpacity(0.08),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.favorite_border_rounded,
                size: 46,
                color: AppColors.primaryMaroon,
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Your Wishlist is Empty',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
                letterSpacing: -0.3,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Tap the heart icon on any butchery cut to save your favorite cuts for quick repeat orders.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13.5,
                color: AppColors.textMuted,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 28),
            ElevatedButton(
              onPressed: onExplore,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primaryMaroon,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppDimensions.radiusLg),
                ),
                elevation: 0,
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.restaurant_menu_rounded, size: 18),
                  SizedBox(width: 8),
                  Text(
                    'Explore Butchery Cuts',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
