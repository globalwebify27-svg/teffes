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

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
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
                  "Check out ${product.name} on Teffe's Artisanal Butchery!\n"
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
                                    return ProductVideoPlayer(videoUrl: media.url);
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
                                color: Colors.amber.shade50,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.star_rounded, size: 14, color: AppColors.ratingStar),
                                  const SizedBox(width: 3),
                                  Text(
                                    '${product.rating} (${product.reviewsCount} reviews)',
                                    style: const TextStyle(
                                      fontSize: 10.5,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.textPrimary,
                                    ),
                                  ),
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
                          'About this Butchery Cut',
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 15),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          product.description.isNotEmpty
                              ? product.description
                              : '100% freshly slaughtered and cleaned in our temperature-controlled butchery hub. Carefully packaged in vacuum cold-seal for maximum nutrition and freshness.',
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
                              _buildCheckItem('100% certified butchering process'),
                              _buildCheckItem('Veterinary inspected before dispatch'),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Sticky Bottom Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: Color(0xE6E2E8F0))),
              boxShadow: [
                BoxShadow(color: Color.fromRGBO(0, 0, 0, 0.05), blurRadius: 10, offset: Offset(0, -3)),
              ],
            ),
            child: SafeArea(
              top: false,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          Text(
                            CurrencyFormatter.format(product.price),
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w900,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          if (product.originalPrice > product.price) ...[
                            const SizedBox(width: 6),
                            Text(
                              CurrencyFormatter.format(product.originalPrice),
                              style: const TextStyle(
                                fontSize: 13,
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
                          style: const TextStyle(
                            color: AppColors.discountGreen,
                            fontSize: 11,
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
}
