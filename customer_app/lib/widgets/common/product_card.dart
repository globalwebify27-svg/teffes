import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../core/utils/currency_formatter.dart';
import '../../models/product_model.dart';
import '../../providers/cart_provider.dart';
import '../../providers/wishlist_provider.dart';
import 'quantity_stepper.dart';

enum ProductCardLayout { horizontal, compactGrid }

class ProductCard extends StatelessWidget {
  final ProductModel product;
  final ProductCardLayout layout;
  final VoidCallback? onTap;

  const ProductCard({
    super.key,
    required this.product,
    this.layout = ProductCardLayout.horizontal,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    if (layout == ProductCardLayout.compactGrid) {
      return _buildCompactGrid(context);
    }
    return _buildHorizontalCard(context);
  }

  // 1. Compact Grid Card (Matches Image 1 - Fresh Butchery Cuts)
  Widget _buildCompactGrid(BuildContext context) {
    final cart = context.watch<CartProvider>();
    final quantity = cart.getQuantity(product.id);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: AppDimensions.roundedLg,
          border: Border.all(color: AppColors.borderHairline),
          boxShadow: AppDimensions.cardShadow,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image with top badge
            Stack(
              children: [
                ClipRRect(
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(AppDimensions.radiusLg)),
                  child: SizedBox(
                    height: 130,
                    width: double.infinity,
                    child: CachedNetworkImage(
                      imageUrl: product.image,
                      fit: BoxFit.cover,
                      placeholder: (context, url) => Container(color: AppColors.surfaceSubtle),
                      errorWidget: (context, url, error) => Container(
                        color: AppColors.surfaceSubtle,
                        child: const Icon(Icons.restaurant_rounded, color: AppColors.textMuted),
                      ),
                    ),
                  ),
                ),
                // Badge overlay (Fresh Cut / Cleaned)
                if (product.badge != null)
                  Positioned(
                    top: 8,
                    left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.primaryMaroon,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        product.badge!,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9.5,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.2,
                        ),
                      ),
                    ),
                  ),
                // Wishlist Heart Button
                Positioned(
                  top: 8,
                  right: 8,
                  child: Consumer<WishlistProvider>(
                    builder: (context, wishlist, _) {
                      final isWishlisted = wishlist.isInWishlist(product.id);
                      return GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: () => wishlist.toggleWishlist(product.id),
                        child: Container(
                          width: 30,
                          height: 30,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.12),
                                blurRadius: 4,
                                offset: const Offset(0, 1),
                              ),
                            ],
                          ),
                          child: Icon(
                            isWishlisted ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                            size: 16,
                            color: isWishlisted ? AppColors.primaryMaroon : Colors.grey.shade600,
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),

            // Content
            Padding(
              padding: const EdgeInsets.all(AppDimensions.spaceSm),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${product.netWeight}${product.grossWeight != null ? " • Gross: ${product.grossWeight}" : ""}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(fontSize: 11),
                  ),
                  const SizedBox(height: 10),

                  // Price & Stepper Row
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          Text(
                            CurrencyFormatter.format(product.price),
                            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w800,
                                ),
                          ),
                          if (product.originalPrice > product.price) ...[
                            const SizedBox(width: 4),
                            Text(
                              CurrencyFormatter.format(product.originalPrice),
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    decoration: TextDecoration.lineThrough,
                                    decorationColor: AppColors.primaryMaroon,
                                    decorationThickness: 2.0,
                                    fontSize: 10.5,
                                  ),
                            ),
                          ],
                        ],
                      ),
                      QuantityStepper(
                        quantity: quantity,
                        isCompact: true,
                        inStock: product.inStock,
                        onAdd: () => cart.addToCart(product),
                        onIncrement: () => cart.increment(product.id),
                        onDecrement: () => cart.decrement(product.id),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // 2. Horizontal Listing Card (Matches Image 2 - Category Details)
  Widget _buildHorizontalCard(BuildContext context) {
    final cart = context.watch<CartProvider>();
    final quantity = cart.getQuantity(product.id);
    final discountText = CurrencyFormatter.formatDiscount(product.originalPrice, product.price);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: AppDimensions.spaceSm),
        padding: const EdgeInsets.all(AppDimensions.spaceSm),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: AppDimensions.roundedLg,
          border: Border.all(color: AppColors.borderHairline.withOpacity(0.9)),
          boxShadow: AppDimensions.cardShadow,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Badges Row: "✓ 100% Antibiotic-free" and "★ 4.9 (480)"
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                if (product.badge != null)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2.5),
                    decoration: BoxDecoration(
                      color: AppColors.hygieneLight,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.check_rounded, size: 12, color: AppColors.hygieneDark),
                        const SizedBox(width: 3),
                        Text(
                          product.badge!,
                          style: const TextStyle(
                            color: AppColors.hygieneDark,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  const SizedBox.shrink(),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.star_rounded, size: 14, color: AppColors.ratingStar),
                    const SizedBox(width: 2),
                    Text(
                      '${product.rating} (${product.reviewsCount})',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 8),

            // Card Body (Image + Details)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Thumbnail with temperature badge
                Stack(
                  children: [
                    ClipRRect(
                      borderRadius: AppDimensions.roundedMd,
                      child: SizedBox(
                        width: 100,
                        height: 100,
                        child: CachedNetworkImage(
                          imageUrl: product.image,
                          fit: BoxFit.cover,
                          placeholder: (context, url) => Container(color: AppColors.surfaceSubtle),
                          errorWidget: (context, url, error) => Container(
                            color: AppColors.surfaceSubtle,
                            child: const Icon(Icons.restaurant_rounded, color: AppColors.textMuted),
                          ),
                        ),
                      ),
                    ),
                    // Freshness Tag (e.g. "100% Fresh Cut")
                    Positioned(
                      bottom: 4,
                      left: 4,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.75),
                          borderRadius: BorderRadius.circular(3),
                        ),
                        child: Text(
                          product.temperatureTag,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                    // Wishlist Heart Button
                    Positioned(
                      top: 4,
                      right: 4,
                      child: Consumer<WishlistProvider>(
                        builder: (context, wishlist, _) {
                          final isWishlisted = wishlist.isInWishlist(product.id);
                          return GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onTap: () => wishlist.toggleWishlist(product.id),
                            child: Container(
                              width: 26,
                              height: 26,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(0.15),
                                    blurRadius: 3,
                                    offset: const Offset(0, 1),
                                  ),
                                ],
                              ),
                              child: Icon(
                                isWishlisted ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                                size: 15,
                                color: isWishlisted ? AppColors.primaryMaroon : Colors.grey.shade600,
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 12),

                // Details
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        product.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              height: 1.25,
                            ),
                      ),
                      if (product.description.isNotEmpty) ...[
                        const SizedBox(height: 3),
                        Text(
                          product.description,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                fontSize: 11,
                                color: AppColors.textSecondary,
                                height: 1.3,
                              ),
                        ),
                      ],
                      const SizedBox(height: 6),

                      // Spec Chips: "Net: 500g", "Skinless • Boneless"
                      Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: [
                          if (product.netWeight.trim().isNotEmpty && product.netWeight.trim() != 'Net:')
                            _buildSpecChip('Net: ${product.netWeight.trim()}'),
                          if (product.cutType != null && product.cutType!.trim().isNotEmpty)
                            _buildSpecChip(product.cutType!.trim()),
                          if (product.pieces != null && product.pieces!.trim().isNotEmpty)
                            _buildSpecChip(product.pieces!.trim()),
                        ],
                      ),
                      const SizedBox(height: 10),

                      // Price & Stepper Row
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.baseline,
                                textBaseline: TextBaseline.alphabetic,
                                children: [
                                  Text(
                                    CurrencyFormatter.format(product.price),
                                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w800,
                                        ),
                                  ),
                                  if (product.originalPrice > product.price) ...[
                                    const SizedBox(width: 6),
                                    Text(
                                      CurrencyFormatter.format(product.originalPrice),
                                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                            decoration: TextDecoration.lineThrough,
                                            decorationColor: AppColors.primaryMaroon,
                                            decorationThickness: 2.0,
                                            fontSize: 11,
                                          ),
                                    ),
                                  ],
                                ],
                              ),
                              if (discountText.isNotEmpty)
                                Text(
                                  discountText,
                                  style: const TextStyle(
                                    color: AppColors.discountGreen,
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                            ],
                          ),
                          QuantityStepper(
                            quantity: quantity,
                            inStock: product.inStock,
                            onAdd: () => cart.addToCart(product),
                            onIncrement: () => cart.increment(product.id),
                            onDecrement: () => cart.decrement(product.id),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSpecChip(String label) {
    final clean = label.trim();
    if (clean.isEmpty || clean == 'Net:' || clean == 'Net') return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
      decoration: BoxDecoration(
        color: AppColors.surfaceSubtle,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: AppColors.borderHairline.withOpacity(0.6)),
      ),
      child: Text(
        clean,
        style: const TextStyle(
          color: AppColors.textSecondary,
          fontSize: 10,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
