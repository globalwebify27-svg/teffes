import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../core/utils/page_transitions.dart';
import '../../models/product_model.dart';
import '../../providers/products_provider.dart';
import '../../widgets/common/category_card.dart';
import '../../widgets/common/cold_chain_promise_card.dart';
import '../../widgets/common/location_header.dart';
import '../../widgets/common/product_card.dart';
import '../../widgets/common/promo_banner.dart';
import '../../widgets/common/search_input_bar.dart';
import '../category/category_listing_screen.dart';
import '../product_details/product_details_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final TextEditingController _searchController = TextEditingController();
  Timer? _debounce;
  String _activeQuery = '';

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String query) {
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (mounted) {
        setState(() {
          _activeQuery = query.trim();
        });
      }
    });
  }

  void _clearSearch() {
    _searchController.clear();
    setState(() {
      _activeQuery = '';
    });
  }

  @override
  Widget build(BuildContext context) {
    final productsProvider = context.watch<ProductsProvider>();
    final categories = productsProvider.categories;
    final chickenCuts = productsProvider.homeChickenCuts;
    final fishCuts = productsProvider.homeFishCuts;
    final muttonCuts = productsProvider.homeMuttonCuts;
    final farmFreshEggs = productsProvider.farmFreshEggs;
    final searchResults = _activeQuery.isNotEmpty
        ? productsProvider.searchAllProducts(_activeQuery)
        : <ProductModel>[];

    return Scaffold(
      backgroundColor: AppColors.surfacePorcelain,
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.primaryMaroon,
          onRefresh: () => productsProvider.fetchCatalog(),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
            padding: const EdgeInsets.only(bottom: 100),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. Top Location Header (Home ⌄ + Address + Bell)
                const LocationHeader(),

                // 2. Search Bar - Active on Home screen with Debounce
                SearchInputBar(
                  controller: _searchController,
                  readOnly: false,
                  hintText: 'Search all meats, cuts, chicken, mutton...',
                  onChanged: _onSearchChanged,
                ),
                const SizedBox(height: 6),

                // If user is searching on Home, show Search Results view
                if (_activeQuery.isNotEmpty) ...[
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: AppDimensions.spaceMd, vertical: 8),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Found ${searchResults.length} items for "$_activeQuery"',
                          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary,
                              ),
                        ),
                        TextButton(
                          onPressed: _clearSearch,
                          style: TextButton.styleFrom(
                            padding: EdgeInsets.zero,
                            minimumSize: const Size(50, 30),
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                          child: const Text(
                            'Clear',
                            style: TextStyle(
                              color: AppColors.primaryMaroon,
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (searchResults.isEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
                      alignment: Alignment.center,
                      child: Column(
                        children: [
                          const Icon(Icons.search_off_rounded, size: 52, color: AppColors.textMuted),
                          const SizedBox(height: 12),
                          Text(
                            'No products matching "$_activeQuery"',
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'Try searching for chicken, mutton, fish, keema, or eggs',
                            style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                          ),
                        ],
                      ),
                    )
                  else
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: AppDimensions.spaceMd),
                      child: GridView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          crossAxisSpacing: 12,
                          mainAxisSpacing: 14,
                          mainAxisExtent: 235,
                        ),
                        itemCount: searchResults.length,
                        itemBuilder: (context, index) {
                          final product = searchResults[index];
                          return ProductCard(
                            product: product,
                            layout: ProductCardLayout.compactGrid,
                            onTap: () {
                              Navigator.of(context).push(
                                SmoothPageRoute(page: ProductDetailsScreen(product: product)),
                              );
                            },
                          );
                        },
                      ),
                    ),
                ] else ...[
                  // 3. Crispy Treaty Binge Promo Banner
                  PromoBanner(
                    onShopNow: () {
                      productsProvider.selectCategory('chicken');
                      Navigator.of(context).push(
                        SmoothPageRoute(page: const CategoryListingScreen()),
                      );
                    },
                  ),
                  const SizedBox(height: AppDimensions.spaceMd),

                  // 4. Shop by Categories Section
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: AppDimensions.spaceMd),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Shop by categories',
                          style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                                color: AppColors.textPrimary,
                              ),
                        ),
                        const SizedBox(height: 1),
                        Text(
                          'Freshest meat just for you',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                fontSize: 12,
                                color: AppColors.textSecondary,
                              ),
                        ),
                        const SizedBox(height: 12),

                        // 2x2 Category Grid
                        GridView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            crossAxisSpacing: 12,
                            mainAxisSpacing: 12,
                            childAspectRatio: 1.45,
                          ),
                          itemCount: categories.length,
                          itemBuilder: (context, index) {
                            final cat = categories[index];
                            return CategoryCard(
                              category: cat,
                              onTap: () {
                                productsProvider.selectCategory(cat.key);
                                Navigator.of(context).push(
                                  SmoothPageRoute(page: const CategoryListingScreen()),
                                );
                              },
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppDimensions.spaceMd),

                  // Cold Chain Promise Card
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: AppDimensions.spaceMd),
                    child: ColdChainPromiseCard(),
                  ),
                  const SizedBox(height: AppDimensions.spaceMd),

                  // 5. Fresh Chicken Cuts Section (4 items)
                  _buildProductSection(
                    context: context,
                    title: 'Fresh Chicken Cuts',
                    subtitle: 'Antibiotic-free, freshly butchered today',
                    categoryKey: 'chicken',
                    products: chickenCuts,
                    productsProvider: productsProvider,
                  ),
                  const SizedBox(height: AppDimensions.spaceLg),

                  // 6. Fresh Fish & Seafood Section (2 items)
                  _buildProductSection(
                    context: context,
                    title: 'Fresh Fish & Seafood',
                    subtitle: 'Daily chemical-free catch, cleaned & fresh',
                    categoryKey: 'fish-seafood',
                    products: fishCuts,
                    productsProvider: productsProvider,
                  ),
                  const SizedBox(height: AppDimensions.spaceLg),

                  // 7. Fresh Mutton Cuts Section (2 items with new heading)
                  _buildProductSection(
                    context: context,
                    title: 'Fresh Mutton Cuts',
                    subtitle: 'Tender pasture-raised rich cuts',
                    categoryKey: 'mutton',
                    products: muttonCuts,
                    productsProvider: productsProvider,
                  ),

                  if (farmFreshEggs.isNotEmpty) ...[
                    const SizedBox(height: AppDimensions.spaceLg),
                    // 6. Farm Fresh Eggs Section
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: AppDimensions.spaceMd),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Farm Fresh Eggs',
                                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                                          fontSize: 18,
                                          fontWeight: FontWeight.w800,
                                          color: AppColors.textPrimary,
                                        ),
                                  ),
                                  const SizedBox(height: 1),
                                  Text(
                                    'Naturally laid, nutrient-rich & hygienic',
                                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                          fontSize: 12,
                                          color: AppColors.textSecondary,
                                        ),
                                  ),
                                ],
                              ),
                              GestureDetector(
                                onTap: () {
                                  productsProvider.selectCategory('eggs');
                                  Navigator.of(context).push(
                                    SmoothPageRoute(page: const CategoryListingScreen()),
                                  );
                                },
                                child: const Text(
                                  'View all',
                                  style: TextStyle(
                                    color: AppColors.primaryMaroon,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),

                          GridView.builder(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 2,
                              crossAxisSpacing: 12,
                              mainAxisSpacing: 14,
                              mainAxisExtent: 235,
                            ),
                            itemCount: farmFreshEggs.length,
                            itemBuilder: (context, index) {
                              final product = farmFreshEggs[index];
                              return ProductCard(
                                product: product,
                                layout: ProductCardLayout.compactGrid,
                                onTap: () {
                                  Navigator.of(context).push(
                                    SmoothPageRoute(page: ProductDetailsScreen(product: product)),
                                  );
                                },
                              );
                            },
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildProductSection({
    required BuildContext context,
    required String title,
    required String subtitle,
    required String categoryKey,
    required List<ProductModel> products,
    required ProductsProvider productsProvider,
  }) {
    if (products.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppDimensions.spaceMd),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    subtitle,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                  ),
                ],
              ),
              GestureDetector(
                onTap: () {
                  productsProvider.selectCategory(categoryKey);
                  Navigator.of(context).push(
                    SmoothPageRoute(page: const CategoryListingScreen()),
                  );
                },
                child: const Text(
                  'View all',
                  style: TextStyle(
                    color: AppColors.primaryMaroon,
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 12,
              mainAxisSpacing: 14,
              mainAxisExtent: 235,
            ),
            itemCount: products.length,
            itemBuilder: (context, index) {
              final product = products[index];
              return ProductCard(
                product: product,
                layout: ProductCardLayout.compactGrid,
                onTap: () {
                  Navigator.of(context).push(
                    SmoothPageRoute(page: ProductDetailsScreen(product: product)),
                  );
                },
              );
            },
          ),
        ],
      ),
    );
  }
}

