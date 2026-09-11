import 'dart:async';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../core/utils/page_transitions.dart';
import '../../models/banner_model.dart';
import '../../providers/products_provider.dart';
import '../../screens/category/category_listing_screen.dart';

class PromoBanner extends StatefulWidget {
  final VoidCallback? onShopNow;

  const PromoBanner({super.key, this.onShopNow});

  @override
  State<PromoBanner> createState() => _PromoBannerState();
}

class _PromoBannerState extends State<PromoBanner> {
  late PageController _pageController;
  int _currentPage = 0;
  Timer? _autoSlideTimer;

  static final List<BannerModel> _fallbackBanners = [
    BannerModel(
      id: 'default-1',
      title: 'Fresh • Hygienic • Farm-Raised Chicken',
      image: 'https://cdn.dotpe.in/longtail/themes/7524323/pLA8ptbh.webp',
      link: 'category:chicken',
      order: 1,
    ),
    BannerModel(
      id: 'default-2',
      title: "TeFFe's Farm Quality Meat • 90 Min Delivery",
      image: 'https://cdn.dotpe.in/longtail/themes/7524323/VRLhTQ4p.webp',
      link: 'all',
      order: 2,
    ),
  ];

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: 0);
    _startAutoSlide();
  }

  void _startAutoSlide() {
    _autoSlideTimer?.cancel();
    _autoSlideTimer = Timer.periodic(const Duration(seconds: 4), (timer) {
      if (!mounted || !_pageController.hasClients) return;
      final productsProvider = Provider.of<ProductsProvider>(context, listen: false);
      final bannerList = productsProvider.banners.isNotEmpty ? productsProvider.banners : _fallbackBanners;
      if (bannerList.length <= 1) return;

      final nextPage = (_currentPage + 1) % bannerList.length;
      _pageController.animateToPage(
        nextPage,
        duration: const Duration(milliseconds: 600),
        curve: Curves.easeInOutCubic,
      );
    });
  }

  void _handleBannerTap(BannerModel banner, ProductsProvider productsProvider) {
    final link = (banner.link ?? '').toLowerCase().trim();
    if (link.contains('chicken')) {
      productsProvider.selectCategory('chicken');
      Navigator.of(context).push(
        SmoothPageRoute(page: const CategoryListingScreen()),
      );
    } else if (link.contains('mutton')) {
      productsProvider.selectCategory('mutton');
      Navigator.of(context).push(
        SmoothPageRoute(page: const CategoryListingScreen()),
      );
    } else if (link.contains('fish')) {
      productsProvider.selectCategory('fish-seafood');
      Navigator.of(context).push(
        SmoothPageRoute(page: const CategoryListingScreen()),
      );
    } else if (link.contains('egg')) {
      productsProvider.selectCategory('eggs');
      Navigator.of(context).push(
        SmoothPageRoute(page: const CategoryListingScreen()),
      );
    } else if (widget.onShopNow != null) {
      widget.onShopNow!();
    } else {
      productsProvider.selectCategory('chicken');
      Navigator.of(context).push(
        SmoothPageRoute(page: const CategoryListingScreen()),
      );
    }
  }

  @override
  void dispose() {
    _autoSlideTimer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<ProductsProvider>(
      builder: (context, productsProvider, child) {
        final bannerList = productsProvider.banners.isNotEmpty
            ? productsProvider.banners
            : _fallbackBanners;

        return Container(
          margin: const EdgeInsets.symmetric(
            horizontal: AppDimensions.spaceMd,
            vertical: AppDimensions.spaceXs,
          ),
          height: 156,
          decoration: BoxDecoration(
            borderRadius: AppDimensions.roundedLg,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.18),
                blurRadius: 14,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: AppDimensions.roundedLg,
            child: Stack(
              fit: StackFit.expand,
              children: [
                // 1. Sliding Window PageView
                PageView.builder(
                  controller: _pageController,
                  physics: const BouncingScrollPhysics(),
                  itemCount: bannerList.length,
                  onPageChanged: (index) {
                    setState(() {
                      _currentPage = index;
                    });
                  },
                  itemBuilder: (context, index) {
                    final banner = bannerList[index];
                    return GestureDetector(
                      onTap: () => _handleBannerTap(banner, productsProvider),
                      child: Container(
                        color: const Color(0xFF14100E),
                        child: CachedNetworkImage(
                          imageUrl: banner.image,
                          fit: BoxFit.cover,
                          alignment: Alignment.center,
                          placeholder: (context, url) => Container(
                            color: const Color(0xFF1E1A18),
                            child: const Center(
                              child: SizedBox(
                                width: 24,
                                height: 24,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
                                ),
                              ),
                            ),
                          ),
                          errorWidget: (context, url, error) => Container(
                            color: const Color(0xFF1E1A18),
                            child: const Center(
                              child: Icon(
                                Icons.broken_image_rounded,
                                color: Colors.white38,
                                size: 36,
                              ),
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),

                // 2. Dots Indicator
                if (bannerList.length > 1)
                  Positioned(
                    bottom: 10,
                    left: 0,
                    right: 0,
                    child: Center(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.38),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: Colors.white.withOpacity(0.15),
                            width: 0.8,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: List.generate(
                            bannerList.length,
                            (index) {
                              final isActive = _currentPage == index;
                              return AnimatedContainer(
                                duration: const Duration(milliseconds: 250),
                                curve: Curves.easeOutCubic,
                                margin: const EdgeInsets.symmetric(horizontal: 3),
                                width: isActive ? 20 : 6,
                                height: 6,
                                decoration: BoxDecoration(
                                  color: isActive
                                      ? AppColors.primary
                                      : Colors.white.withOpacity(0.6),
                                  borderRadius: BorderRadius.circular(3),
                                  boxShadow: isActive
                                      ? [
                                          BoxShadow(
                                            color: AppColors.primary.withOpacity(0.6),
                                            blurRadius: 4,
                                            offset: const Offset(0, 1),
                                          )
                                        ]
                                      : null,
                                ),
                              );
                            },
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}
