import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../core/utils/currency_formatter.dart';
import '../../core/utils/page_transitions.dart';
import '../../models/product_model.dart';
import '../../providers/cart_provider.dart';
import '../../providers/wishlist_provider.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import '../../core/utils/video_utils.dart';
import '../../widgets/common/product_video_player.dart';
import '../../widgets/common/quantity_stepper.dart';
import '../cart/cart_checkout_screen.dart';
import '../../models/review_model.dart';
import '../../core/network/api_client.dart';
import '../../providers/auth_provider.dart';
import '../../providers/products_provider.dart';

enum ProductMediaType { image, video }

class ProductMediaItem {
  final ProductMediaType type;
  final String url;
  final bool isYouTube;
  final String? videoId;
  final String? thumbnailUrl;

  const ProductMediaItem({
    required this.type,
    required this.url,
    this.isYouTube = false,
    this.videoId,
    this.thumbnailUrl,
  });
}

class ProductDetailsScreen extends StatefulWidget {
  final ProductModel product;

  const ProductDetailsScreen({super.key, required this.product});

  @override
  State<ProductDetailsScreen> createState() => _ProductDetailsScreenState();
}

class _ProductDetailsScreenState extends State<ProductDetailsScreen> {
  late final PageController _pageController;
  int _selectedImageIndex = 0;
  List<ReviewModel> _reviews = [];
  bool _isLoadingReviews = true;
  late double _currentRating;
  late int _reviewsCount;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
    _currentRating = widget.product.rating;
    _reviewsCount = widget.product.reviewsCount;
    _fetchReviews();
  }

  Future<void> _fetchReviews() async {
    try {
      final res = await ApiClient().get('/reviews/${widget.product.id}');
      if (res.data != null && res.data['success'] == true) {
        final list = (res.data['reviews'] as List? ?? [])
            .map((e) => ReviewModel.fromJson(e as Map<String, dynamic>))
            .toList();
        final stats = res.data['stats'] as Map<String, dynamic>?;
        if (mounted) {
          setState(() {
            _reviews = list;
            _isLoadingReviews = false;
            if (stats != null) {
              _currentRating = (stats['averageRating'] as num?)?.toDouble() ?? _currentRating;
              _reviewsCount = (stats['totalRatings'] as num?)?.toInt() ?? _reviewsCount;
            }
          });
        }
      } else {
        if (mounted) setState(() => _isLoadingReviews = false);
      }
    } catch (_) {
      if (mounted) setState(() => _isLoadingReviews = false);
    }
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final product = widget.product;
    final images = product.allImages;
    final cart = context.watch<CartProvider>();
    final quantity = cart.getQuantity(product.id);
    final discountText = CurrencyFormatter.formatDiscount(product.originalPrice, product.price);

    final List<ProductMediaItem> mediaItems = [];
    for (final img in images) {
      if (img.trim().isNotEmpty) {
        mediaItems.add(ProductMediaItem(
          type: ProductMediaType.image,
          url: img.trim(),
        ));
      }
    }
    for (final vid in product.videoURLs) {
      if (vid.trim().isNotEmpty) {
        final cleanVid = vid.trim();
        final isYT = VideoUtils.isYouTubeUrl(cleanVid);
        mediaItems.add(ProductMediaItem(
          type: ProductMediaType.video,
          url: cleanVid,
          isYouTube: isYT,
          videoId: isYT ? VideoUtils.getYouTubeVideoId(cleanVid) : null,
          thumbnailUrl: isYT ? VideoUtils.getYouTubeThumbnailUrl(cleanVid) : null,
        ));
      }
    }

    final double bottomInset = MediaQuery.of(context).viewPadding.bottom;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          Consumer<WishlistProvider>(
            builder: (context, wishlist, _) {
              final isWishlisted = wishlist.isInWishlist(product.id);
              return IconButton(
                icon: Icon(
                  isWishlisted ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                  color: isWishlisted ? AppColors.primaryMaroon : AppColors.textPrimary,
                  size: 22,
                ),
                onPressed: () {
                  wishlist.toggleWishlist(product.id);
                  ScaffoldMessenger.of(context).hideCurrentSnackBar();
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        isWishlisted
                            ? '${product.name} removed from wishlist'
                            : '${product.name} saved to wishlist',
                      ),
                      duration: const Duration(seconds: 2),
                      behavior: SnackBarBehavior.floating,
                      backgroundColor: isWishlisted ? AppColors.textPrimary : AppColors.primaryMaroon,
                    ),
                  );
                },
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.share_outlined, size: 20),
            tooltip: 'Share Product',
            onPressed: () async {
              final shareText =
                  "Check out ${product.name} on TeFFe's!\n"
                  "Fresh, tender & hygienically packed.\n"
                  "Order now: https://teffes.com/product/${product.id}";
              try {
                // ignore: deprecated_member_use
                await Share.share(
                  shareText,
                  subject: "Fresh ${product.name} from Teffe's",
                );
              } catch (_) {
                await Clipboard.setData(ClipboardData(text: shareText));
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Product link copied to clipboard!'),
                      behavior: SnackBarBehavior.floating,
                      duration: Duration(seconds: 2),
                    ),
                  );
                }
              }
            },
          ),
          IconButton(
            icon: Stack(
              clipBehavior: Clip.none,
              children: [
                const Icon(Icons.shopping_bag_outlined, size: 22),
                if (cart.itemCount > 0)
                  Positioned(
                    top: -4,
                    right: -4,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(
                        color: AppColors.primaryMaroon,
                        shape: BoxShape.circle,
                      ),
                      child: Text(
                        '${cart.itemCount}',
                        style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
              ],
            ),
            onPressed: () {
              Navigator.of(context).push(
                SmoothPageRoute(page: const CartCheckoutScreen()),
              );
            },
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Multi-Media Carousel (Images & Videos)
                  Stack(
                    children: [
                      AspectRatio(
                        aspectRatio: 1.25,
                        child: mediaItems.isEmpty
                            ? Container(
                                color: AppColors.surfaceSubtle,
                                child: const Center(
                                  child: Icon(Icons.restaurant_rounded, size: 48, color: AppColors.textMuted),
                                ),
                              )
                            : PageView.builder(
                                controller: _pageController,
                                itemCount: mediaItems.length,
                                onPageChanged: (index) {
                                  setState(() {
                                    _selectedImageIndex = index;
                                  });
                                },
                                itemBuilder: (context, index) {
                                  final media = mediaItems[index];
                                  if (media.type == ProductMediaType.video) {
                                    return ProductVideoPlayer(
                                      videoUrl: media.url,
                                      isActive: _selectedImageIndex == index,
                                    );
                                  }
                                  return CachedNetworkImage(
                                    imageUrl: media.url,
                                    fit: BoxFit.cover,
                                    placeholder: (context, url) => Container(color: AppColors.surfaceSubtle),
                                    errorWidget: (context, url, error) => Container(
                                      color: AppColors.surfaceSubtle,
                                      child: const Icon(Icons.restaurant_rounded, size: 48, color: AppColors.textMuted),
                                    ),
                                  );
                                },
                              ),
                      ),
                      // Temperature Tag
                      Positioned(
                        bottom: 12,
                        left: 16,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.black87,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            product.temperatureTag,
                            style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700),
                          ),
                        ),
                      ),
                      // Media Counter Indicator (if more than 1 item)
                      if (mediaItems.length > 1)
                        Positioned(
                          bottom: 12,
                          right: 16,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: const Color(0xBF000000),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  (_selectedImageIndex < mediaItems.length &&
                                          mediaItems[_selectedImageIndex].type == ProductMediaType.video)
                                      ? Icons.videocam_outlined
                                      : Icons.photo_library_outlined,
                                  color: Colors.white,
                                  size: 12,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  '${_selectedImageIndex + 1}/${mediaItems.length}',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),

                  // Horizontal Thumbnails Strip (if more than 1 item)
                  if (mediaItems.length > 1)
                    Container(
                      height: 62,
                      margin: const EdgeInsets.only(top: 10, left: 16, right: 16),
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: mediaItems.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 10),
                        itemBuilder: (context, idx) {
                          final isSelected = idx == _selectedImageIndex;
                          final media = mediaItems[idx];
                          return GestureDetector(
                            onTap: () {
                              _pageController.animateToPage(
                                idx,
                                duration: const Duration(milliseconds: 300),
                                curve: Curves.easeInOut,
                              );
                            },
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              width: 58,
                              height: 58,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                  color: isSelected ? AppColors.primaryMaroon : AppColors.borderHairline,
                                  width: isSelected ? 2.5 : 1,
                                ),
                                boxShadow: isSelected
                                    ? [
                                        const BoxShadow(
                                          color: Color(0x33941717),
                                          blurRadius: 4,
                                          offset: Offset(0, 2),
                                        ),
                                      ]
                                    : null,
                              ),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(6),
                                child: media.type == ProductMediaType.image
                                    ? CachedNetworkImage(
                                        imageUrl: media.url,
                                        fit: BoxFit.cover,
                                        placeholder: (_, __) => Container(color: AppColors.surfaceSubtle),
                                        errorWidget: (_, __, ___) => const Icon(Icons.broken_image, size: 20, color: AppColors.textMuted),
                                      )
                                    : Stack(
                                        fit: StackFit.expand,
                                        children: [
                                          if (media.thumbnailUrl != null)
                                            CachedNetworkImage(
                                              imageUrl: media.thumbnailUrl!,
                                              fit: BoxFit.cover,
                                              errorWidget: (_, __, ___) => Container(color: Colors.black87),
                                            )
                                          else
                                            Container(color: Colors.black87),
                                          Container(
                                            color: Colors.black38,
                                            child: const Center(
                                              child: Icon(
                                                Icons.play_circle_fill_rounded,
                                                color: Colors.white,
                                                size: 22,
                                              ),
                                            ),
                                          ),
                                          Positioned(
                                            bottom: 2,
                                            right: 2,
                                            child: Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 1),
                                              decoration: BoxDecoration(
                                                color: Colors.black87,
                                                borderRadius: BorderRadius.circular(3),
                                              ),
                                              child: Text(
                                                media.isYouTube ? 'YT' : 'VID',
                                                style: const TextStyle(
                                                  color: Colors.white,
                                                  fontSize: 8,
                                                  fontWeight: FontWeight.w800,
                                                ),
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),

                  // Content
                  Padding(
                    padding: const EdgeInsets.all(AppDimensions.spaceMd),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Badges Row
                        Row(
                          children: [
                            if (product.badge != null) ...[
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: AppColors.hygieneLight,
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  product.badge!,
                                  style: const TextStyle(
                                    color: AppColors.hygieneDark,
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                            ],
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: _reviewsCount > 0 ? Colors.amber.shade50 : const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  if (_reviewsCount > 0) ...[
                                    const Icon(Icons.star_rounded, size: 14, color: AppColors.ratingStar),
                                    const SizedBox(width: 3),
                                    Text(
                                      '${_currentRating.toStringAsFixed(1)} ($_reviewsCount ${_reviewsCount == 1 ? "review" : "reviews"})',
                                      style: const TextStyle(
                                        fontSize: 10.5,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.textPrimary,
                                      ),
                                    ),
                                  ] else ...[
                                    const Icon(Icons.fiber_new_rounded, size: 14, color: AppColors.primary),
                                    const SizedBox(width: 2),
                                    const Text(
                                      'New Cut',
                                      style: TextStyle(
                                        fontSize: 10.5,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.primary,
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),

                        // Title
                        Text(
                          product.name,
                          style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                                fontWeight: FontWeight.w800,
                                fontSize: 20,
                              ),
                        ),
                        const SizedBox(height: 6),

                        // Specs Row - Wrap to prevent horizontal pixel overflow
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            _buildSpecPill(Icons.scale_rounded, 'Net wt: ${product.netWeight}'),
                            if (product.cutType != null && product.cutType!.isNotEmpty)
                              _buildSpecPill(Icons.content_cut_rounded, product.cutType!),
                            if (product.serves != null && product.serves!.isNotEmpty)
                              _buildSpecPill(Icons.group_rounded, 'Serves ${product.serves}'),
                          ],
                        ),
                        const SizedBox(height: 16),

                        const Divider(height: 1, color: AppColors.borderHairline),
                        const SizedBox(height: 16),

                        // Description
                        Text(
                          'About this Fresh Cut',
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 15),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          product.description.isNotEmpty
                              ? product.description
                              : '100% fresh and cleanly prepared in our temperature-controlled store hub. Carefully packaged in cold-seal for maximum nutrition and freshness.',
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                color: AppColors.textSecondary,
                                height: 1.5,
                              ),
                        ),
                        const SizedBox(height: 20),

                        // Hygiene checklist
                        Container(
                          padding: const EdgeInsets.all(AppDimensions.spaceMd),
                          decoration: BoxDecoration(
                            color: AppColors.surfacePorcelain,
                            borderRadius: AppDimensions.roundedLg,
                            border: Border.all(color: AppColors.borderHairline),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                "Teffe's Quality Standard",
                                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                              ),
                              const SizedBox(height: 8),
                              _buildCheckItem('Never frozen, cut strictly fresh on order'),
                              _buildCheckItem('100% certified hygienic cutting process'),
                              _buildCheckItem('Veterinary inspected before dispatch'),
                            ],
                          ),
                        ),
                        const SizedBox(height: 24),

                        // ─── Customer Reviews Section ───────────────────
                        _buildCustomerReviewsSection(context),

                        const SizedBox(height: 24),

                        // ─── You May Also Like Section ─────────────────
                        _buildYouMayAlsoLikeSection(context),

                        const SizedBox(height: 20),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Sticky Bottom Bar (Dynamically respects 3-button & gesture navigation)
          Container(
            padding: EdgeInsets.only(
              left: 16,
              right: 16,
              top: 10,
              bottom: 10 + bottomInset,
            ),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: Color(0xE6E2E8F0))),
              boxShadow: [
                BoxShadow(color: Color.fromRGBO(0, 0, 0, 0.05), blurRadius: 10, offset: Offset(0, -3)),
              ],
            ),
            child: Row(
              children: [
                // 1. Price & Discount Column (Flexible so it safely adapts to narrow screens)
                Expanded(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          Flexible(
                            child: Text(
                              CurrencyFormatter.format(product.price),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 19,
                                fontWeight: FontWeight.w900,
                                color: AppColors.textPrimary,
                              ),
                            ),
                          ),
                          if (product.originalPrice > product.price) ...[
                            const SizedBox(width: 5),
                            Text(
                              CurrencyFormatter.format(product.originalPrice),
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.textMuted,
                                decoration: TextDecoration.lineThrough,
                                decorationColor: AppColors.primaryMaroon,
                                decorationThickness: 2.0,
                              ),
                            ),
                          ],
                        ],
                      ),
                      if (discountText.isNotEmpty)
                        Text(
                          discountText,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: AppColors.discountGreen,
                            fontSize: 10.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),

                // 2. Action Area: Quantity Stepper & Responsive View Cart Button
                if (quantity == 0)
                  QuantityStepper(
                    quantity: quantity,
                    inStock: product.inStock,
                    onAdd: () => cart.addToCart(product),
                    onIncrement: () => cart.increment(product.id),
                    onDecrement: () => cart.decrement(product.id),
                  )
                else
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      QuantityStepper(
                        quantity: quantity,
                        inStock: product.inStock,
                        onAdd: () => cart.addToCart(product),
                        onIncrement: () => cart.increment(product.id),
                        onDecrement: () => cart.decrement(product.id),
                      ),
                      const SizedBox(width: 8),
                      // View Cart CTA Button
                      Material(
                        color: AppColors.primaryMaroon,
                        borderRadius: AppDimensions.roundedMd,
                        child: InkWell(
                          onTap: () {
                            Navigator.of(context).push(
                              SmoothPageRoute(page: const CartCheckoutScreen()),
                            );
                          },
                          borderRadius: AppDimensions.roundedMd,
                          child: Container(
                            height: 34,
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            decoration: BoxDecoration(
                              borderRadius: AppDimensions.roundedMd,
                              boxShadow: [
                                BoxShadow(
                                  color: AppColors.primaryMaroon.withValues(alpha: 0.22),
                                  blurRadius: 4,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  'View Cart',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0.3,
                                  ),
                                ),
                                SizedBox(width: 4),
                                Icon(
                                  Icons.arrow_forward_rounded,
                                  size: 14,
                                  color: Colors.white,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSpecPill(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.surfaceSubtle,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: AppColors.borderHairline),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: AppColors.textSecondary),
          const SizedBox(width: 4),
          Text(
            text,
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }

  Widget _buildCheckItem(String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          const Icon(Icons.check_circle_rounded, size: 15, color: AppColors.hygieneEmerald),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
          ),
        ],
      ),
    );
  }

  // ─── Customer Reviews Section ─────────────────────────────────────
  Widget _buildCustomerReviewsSection(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Customer Reviews',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                if (_reviewsCount > 0)
                  Row(
                    children: [
                      const Icon(Icons.star_rounded, size: 15, color: AppColors.ratingStar),
                      const SizedBox(width: 3),
                      Text(
                        '${_currentRating.toStringAsFixed(1)} based on $_reviewsCount ${_reviewsCount == 1 ? "review" : "reviews"}',
                        style: const TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  )
                else
                  const Text(
                    'No reviews yet',
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w500,
                      color: AppColors.textSecondary,
                    ),
                  ),
              ],
            ),
            InkWell(
              onTap: () => _openWriteReviewModal(context),
              borderRadius: BorderRadius.circular(20),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.25),
                      blurRadius: 4,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.edit_rounded, size: 13, color: Colors.white),
                    SizedBox(width: 4),
                    Text(
                      'Write a Review',
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (_isLoadingReviews)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 20),
            child: Center(
              child: SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
              ),
            ),
          )
        else if (_reviews.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 16),
            decoration: BoxDecoration(
              color: AppColors.surfacePorcelain,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.borderHairline),
            ),
            child: Column(
              children: [
                Icon(Icons.rate_review_outlined, size: 30, color: Colors.grey.shade400),
                const SizedBox(height: 6),
                const Text(
                  'No reviews yet',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 2),
                Text(
                  'Be the first verified customer to review this cut!',
                  style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          )
        else
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _reviews.length > 5 ? 5 : _reviews.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (ctx, i) {
              final rev = _reviews[i];
              return Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.borderHairline),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            CircleAvatar(
                              radius: 12,
                              backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                              child: Text(
                                rev.userName.isNotEmpty ? rev.userName[0].toUpperCase() : 'U',
                                style: const TextStyle(
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.primary,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  rev.userName,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 12,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                                if (rev.isVerifiedPurchase)
                                  const Row(
                                    children: [
                                      Icon(Icons.verified_rounded, size: 11, color: Color(0xFF16A34A)),
                                      SizedBox(width: 2),
                                      Text(
                                        'Verified Buyer',
                                        style: TextStyle(
                                          fontSize: 9.5,
                                          fontWeight: FontWeight.w600,
                                          color: Color(0xFF16A34A),
                                        ),
                                      ),
                                    ],
                                  ),
                              ],
                            ),
                          ],
                        ),
                        Row(
                          children: List.generate(
                            5,
                            (starIndex) => Icon(
                              Icons.star_rounded,
                              size: 13,
                              color: starIndex < rev.rating.round()
                                  ? AppColors.ratingStar
                                  : Colors.grey.shade300,
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (rev.title.isNotEmpty) ...[
                      const SizedBox(height: 5),
                      Text(
                        rev.title,
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 11.5),
                      ),
                    ],
                    if (rev.comment.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(
                        rev.comment,
                        style: const TextStyle(fontSize: 11, color: AppColors.textSecondary, height: 1.35),
                      ),
                    ],
                  ],
                ),
              );
            },
          ),
      ],
    );
  }

  // ─── Modal Sheet to Write Review ─────────────────────────────────
  void _openWriteReviewModal(BuildContext context) {
    final auth = context.read<AuthProvider>();
    if (!auth.isAuthenticated) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please log in to leave a review'),
          duration: Duration(seconds: 2),
          behavior: SnackBarBehavior.floating,
          backgroundColor: AppColors.primary,
        ),
      );
      return;
    }

    int selectedRating = 5;
    final titleController = TextEditingController();
    final commentController = TextEditingController();
    bool isSubmitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (bottomSheetCtx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            final bottomPad = MediaQuery.of(ctx).viewInsets.bottom;
            return Container(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: 24 + bottomPad,
              ),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Write a Review',
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        IconButton(
                          onPressed: () => Navigator.pop(bottomSheetCtx),
                          icon: const Icon(Icons.close_rounded, size: 20),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      widget.product.name,
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Star Rating Picker
                    const Text(
                      'Rate this Fresh Cut',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: List.generate(5, (index) {
                        final star = index + 1;
                        return InkWell(
                          onTap: () {
                            setModalState(() {
                              selectedRating = star;
                            });
                          },
                          borderRadius: BorderRadius.circular(20),
                          child: Padding(
                            padding: const EdgeInsets.only(right: 6),
                            child: Icon(
                              Icons.star_rounded,
                              size: 34,
                              color: star <= selectedRating
                                  ? AppColors.ratingStar
                                  : Colors.grey.shade300,
                            ),
                          ),
                        );
                      }),
                    ),
                    const SizedBox(height: 14),

                    // Title
                    const Text(
                      'Title (Optional)',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: titleController,
                      decoration: InputDecoration(
                        hintText: 'e.g. Extremely fresh and tender!',
                        hintStyle: TextStyle(fontSize: 12, color: Colors.grey.shade400),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: BorderSide(color: Colors.grey.shade300),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Comment
                    const Text(
                      'Your Feedback',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: commentController,
                      maxLines: 3,
                      decoration: InputDecoration(
                        hintText: 'How was the quality, freshness, and packaging?',
                        hintStyle: TextStyle(fontSize: 12, color: Colors.grey.shade400),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: BorderSide(color: Colors.grey.shade300),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                        ),
                      ),
                    ),
                    const SizedBox(height: 18),

                    // Submit Button
                    SizedBox(
                      width: double.infinity,
                      height: 46,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          elevation: 0,
                        ),
                        onPressed: isSubmitting
                            ? null
                            : () async {
                                final comment = commentController.text.trim();
                                if (comment.isEmpty) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text('Please enter your review feedback'),
                                      duration: Duration(seconds: 2),
                                      behavior: SnackBarBehavior.floating,
                                      backgroundColor: Colors.orange,
                                    ),
                                  );
                                  return;
                                }

                                setModalState(() => isSubmitting = true);
                                try {
                                  final res = await ApiClient().post(
                                    '/reviews',
                                    data: {
                                      'productId': widget.product.id,
                                      'rating': selectedRating,
                                      'title': titleController.text.trim(),
                                      'comment': comment,
                                    },
                                  );

                                  if (res.data != null && res.data['success'] == true) {
                                    if (bottomSheetCtx.mounted) {
                                      Navigator.pop(bottomSheetCtx);
                                    }
                                    if (context.mounted) {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(
                                          content: Text('Review submitted successfully! Thank you.'),
                                          duration: Duration(seconds: 2),
                                          behavior: SnackBarBehavior.floating,
                                          backgroundColor: Color(0xFF16A34A),
                                        ),
                                      );
                                    }
                                    // Refresh review list and stats
                                    _fetchReviews();
                                  } else {
                                    throw Exception(res.data?['message'] ?? 'Failed to submit review');
                                  }
                                } catch (e) {
                                  setModalState(() => isSubmitting = false);
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text('Error: $e'),
                                        duration: const Duration(seconds: 3),
                                        behavior: SnackBarBehavior.floating,
                                        backgroundColor: Colors.red,
                                      ),
                                    );
                                  }
                                }
                              },
                        child: isSubmitting
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Text(
                                'Submit Review',
                                style: TextStyle(
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white,
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
      },
    );
  }

  // ─── You May Also Like Section ────────────────────────────────────
  Widget _buildYouMayAlsoLikeSection(BuildContext context) {
    final related = context.watch<ProductsProvider>().getRelatedProducts(widget.product, limit: 4);
    if (related.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'You May Also Like',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
            Text(
              '${related.length} recommended',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 226,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            clipBehavior: Clip.none,
            itemCount: related.length,
            separatorBuilder: (_, __) => const SizedBox(width: 10),
            itemBuilder: (ctx, i) {
              final item = related[i];
              return _buildRelatedProductCard(context, item);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildRelatedProductCard(BuildContext context, ProductModel item) {
    final isOut = !item.inStock;
    final discount = item.originalPrice > item.price
        ? (((item.originalPrice - item.price) / item.originalPrice) * 100).round()
        : 0;

    return Container(
      width: 152,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.borderHairline),
        boxShadow: const [
          BoxShadow(
            color: Color.fromRGBO(0, 0, 0, 0.04),
            blurRadius: 6,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => ProductDetailsScreen(product: item),
              ),
            );
          },
          child: Padding(
            padding: const EdgeInsets.all(8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Image container
                Stack(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: AspectRatio(
                        aspectRatio: 1,
                        child: item.image.isNotEmpty
                            ? CachedNetworkImage(
                                imageUrl: item.image,
                                fit: BoxFit.cover,
                                errorWidget: (_, __, ___) => Container(
                                  color: Colors.grey.shade100,
                                  child: const Icon(Icons.restaurant, color: Colors.grey),
                                ),
                              )
                            : Container(
                                color: Colors.grey.shade100,
                                child: const Icon(Icons.restaurant, color: Colors.grey),
                              ),
                      ),
                    ),
                    if (discount > 0)
                      Positioned(
                        top: 5,
                        left: 5,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFF16A34A),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            '$discount% OFF',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 8.5,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 7),

                // Name
                Text(
                  item.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),

                // Net weight
                Text(
                  'Net wt: ${item.netWeight}',
                  style: const TextStyle(
                    fontSize: 10,
                    color: AppColors.textSecondary,
                  ),
                ),
                const Spacer(),

                // Price and Add Button Row
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          CurrencyFormatter.format(item.price),
                          style: const TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w800,
                            color: AppColors.primary,
                          ),
                        ),
                        if (item.originalPrice > item.price)
                          Text(
                            CurrencyFormatter.format(item.originalPrice),
                            style: const TextStyle(
                              fontSize: 9.5,
                              color: Colors.grey,
                              decoration: TextDecoration.lineThrough,
                            ),
                          ),
                      ],
                    ),
                    InkWell(
                      onTap: isOut
                          ? null
                          : () {
                              context.read<CartProvider>().addToCart(item);
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('Added "${item.name}" to cart'),
                                  duration: const Duration(milliseconds: 1400),
                                  behavior: SnackBarBehavior.floating,
                                  backgroundColor: const Color(0xFF16A34A),
                                ),
                              );
                            },
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: isOut ? Colors.grey.shade200 : AppColors.primary,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          isOut ? 'Out' : '+ Add',
                          style: TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w700,
                            color: isOut ? Colors.grey.shade600 : Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
