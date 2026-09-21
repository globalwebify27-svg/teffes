import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../core/utils/page_transitions.dart';
import '../../models/category_model.dart';
import '../../providers/cart_provider.dart';
import '../../providers/location_provider.dart';
import '../../providers/products_provider.dart';
import '../../widgets/common/category_icon_pill.dart';
import '../../widgets/common/cold_chain_promise_card.dart';
import '../../widgets/common/product_card.dart';
import '../../widgets/common/brand_watermark_footer.dart';
import '../cart/cart_checkout_screen.dart';
import '../product_details/product_details_screen.dart';

class CategoryListingScreen extends StatefulWidget {
  final bool showBackButton;

  const CategoryListingScreen({
    super.key,
    this.showBackButton = true,
  });

  @override
  State<CategoryListingScreen> createState() => _CategoryListingScreenState();
}

class _CategoryListingScreenState extends State<CategoryListingScreen> {
  final TextEditingController _searchController = TextEditingController();
  bool _isSearching = false;
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String val, ProductsProvider provider) {
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      provider.setSearchQuery(val);
    });
  }

  @override
  Widget build(BuildContext context) {
    final productsProvider = context.watch<ProductsProvider>();
    final locationProvider = context.watch<LocationProvider>();
    final cart = context.watch<CartProvider>();

    final selectedCat = productsProvider.selectedCategory;
    final currentCatObj = productsProvider.categories.firstWhere(
      (c) => c.key == selectedCat,
      orElse: () => productsProvider.categories.isNotEmpty ? productsProvider.categories.first : CategoryModel(key: 'all', label: 'All', image: ''),
    );
    final products = productsProvider.filteredProducts;

    return Scaffold(
      backgroundColor: AppColors.surfacePorcelain,
      body: SafeArea(
        child: Column(
          children: [
            // 1. Custom Header matching Image 2
            _buildHeader(context, locationProvider, cart, currentCatObj.label),

            // 2. Search Input if search active (Debounced)
            if (_isSearching)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppDimensions.spaceMd, vertical: 4),
                child: TextField(
                  controller: _searchController,
                  autofocus: true,
                  onTapOutside: (event) => FocusScope.of(context).unfocus(),
                  onChanged: (val) => _onSearchChanged(val, productsProvider),
                  decoration: InputDecoration(
                    hintText: 'Search ${currentCatObj.label} cuts...',
                    prefixIcon: const Icon(Icons.search_rounded),
                    suffixIcon: IconButton(
                      icon: const Icon(Icons.close_rounded),
                      onPressed: () {
                        setState(() {
                          _isSearching = false;
                          _searchController.clear();
                          productsProvider.setSearchQuery('');
                        });
                      },
                    ),
                  ),
                ),
              ),

            // 3. Top Horizontal Category Switcher
            const SizedBox(height: 6),
            SizedBox(
              height: 80,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: AppDimensions.spaceMd),
                itemCount: productsProvider.categories.length,
                separatorBuilder: (_, __) => const SizedBox(width: 10),
                itemBuilder: (context, index) {
                  final cat = productsProvider.categories[index];
                  IconData icon = Icons.restaurant_menu_rounded;
                  if (cat.key.contains('chicken')) icon = Icons.kebab_dining_rounded;
                  if (cat.key.contains('mutton')) icon = Icons.outdoor_grill_rounded;
                  if (cat.key.contains('fish')) icon = Icons.set_meal_rounded;
                  if (cat.key.contains('egg')) icon = Icons.egg_outlined;

                  return CategoryIconPill(
                    label: cat.label,
                    icon: icon,
                    isSelected: selectedCat == cat.key,
                    onTap: () => productsProvider.selectCategory(cat.key),
                  );
                },
              ),
            ),
            const SizedBox(height: 6),

            // 4. Cold Chain Promise Banner
            const ColdChainPromiseCard(),

            // 6. Product List
            Expanded(
              child: products.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.inventory_2_outlined, size: 48, color: Colors.grey.shade400),
                          const SizedBox(height: 8),
                          Text(
                            'No cuts found in this category',
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                        ],
                      ),
                    )
                  : ListView.builder(
                      physics: const BouncingScrollPhysics(),
                      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                      padding: const EdgeInsets.symmetric(horizontal: AppDimensions.spaceMd, vertical: 4),
                      itemCount: products.length + 1,
                      itemBuilder: (context, index) {
                        if (index == products.length) {
                          return const BrandWatermarkFooter(showExploreButton: false);
                        }
                        final product = products[index];
                        return ProductCard(
                          product: product,
                          layout: ProductCardLayout.horizontal,
                          onTap: () {
                            Navigator.of(context).push(
                              SmoothPageRoute(page: ProductDetailsScreen(product: product)),
                            );
                          },
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(
    BuildContext context,
    LocationProvider location,
    CartProvider cart,
    String categoryLabel,
  ) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppDimensions.spaceMd, vertical: 8),
      child: Row(
        children: [
          // Back Button in circular container (only visible if opened from a sub-page/card)
          if (widget.showBackButton) ...[
            GestureDetector(
              onTap: () {
                FocusScope.of(context).unfocus();
                if (Navigator.canPop(context)) {
                  Navigator.pop(context);
                }
              },
              child: Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: AppColors.surfaceSubtle,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.borderHairline),
                ),
                child: const Icon(Icons.arrow_back_ios_new_rounded, size: 16, color: AppColors.textPrimary),
              ),
            ),
            const SizedBox(width: 12),
          ],

          // Title & Location
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '$categoryLabel Cuts',
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.w800,
                            fontSize: 16,
                          ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                      decoration: BoxDecoration(
                        color: AppColors.hygieneLight,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text(
                        'Fresh Cut',
                        style: TextStyle(
                          color: AppColors.hygieneDark,
                          fontSize: 9.5,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 1),
                Text(
                  location.activeAddressString,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(fontSize: 11),
                ),
              ],
            ),
          ),

          // Search Toggle
          IconButton(
            icon: const Icon(Icons.search_rounded, size: 22, color: AppColors.textPrimary),
            onPressed: () {
              setState(() {
                _isSearching = !_isSearching;
              });
            },
          ),

          // Cart Icon with badge
          GestureDetector(
            onTap: () {
              Navigator.of(context).push(
                SmoothPageRoute(page: const CartCheckoutScreen()),
              );
            },
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceSubtle,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.borderHairline),
                  ),
                  child: const Icon(Icons.shopping_bag_outlined, size: 20, color: AppColors.textPrimary),
                ),
                if (cart.itemCount > 0)
                  Positioned(
                    top: -2,
                    right: -2,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(
                        color: AppColors.primaryMaroon,
                        shape: BoxShape.circle,
                      ),
                      constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
                      child: Text(
                        '${cart.itemCount}',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9.5,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
