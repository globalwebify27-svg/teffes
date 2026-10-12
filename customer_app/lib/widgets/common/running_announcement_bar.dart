import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/constants/api_endpoints.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../core/network/api_client.dart';
import '../../models/coupon_model.dart';

enum AnnouncementType {
  storeAlert,
  coupon,
  deliveryPromise,
}

class AnnouncementItem {
  final AnnouncementType type;
  final String badgeText;
  final IconData badgeIcon;
  final String content;
  final String? couponCode;
  final String? discount;
  final String? description;
  final double? minOrder;
  final String? validTill;
  final bool isSuperOffer;

  const AnnouncementItem({
    required this.type,
    required this.badgeText,
    required this.badgeIcon,
    required this.content,
    this.couponCode,
    this.discount,
    this.description,
    this.minOrder,
    this.validTill,
    this.isSuperOffer = false,
  });
}

/// A smooth, continuous horizontal marquee text widget.
/// Automatically detects text overflow and scrolls horizontally from right to left
/// with seamless looping so long text is never truncated.
class ContinuousMarqueeText extends StatefulWidget {
  final String text;
  final TextStyle style;

  const ContinuousMarqueeText({
    super.key,
    required this.text,
    required this.style,
  });

  @override
  State<ContinuousMarqueeText> createState() => _ContinuousMarqueeTextState();
}

class _ContinuousMarqueeTextState extends State<ContinuousMarqueeText> {
  late final ScrollController _scrollController;
  Timer? _tickerTimer;
  bool _isInteracting = false;

  @override
  void initState() {
    super.initState();
    _scrollController = ScrollController();
    WidgetsBinding.instance.addPostFrameCallback((_) => _startMarquee());
  }

  @override
  void didUpdateWidget(ContinuousMarqueeText oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.text != widget.text) {
      _startMarquee();
    }
  }

  @override
  void dispose() {
    _tickerTimer?.cancel();
    _scrollController.dispose();
    super.dispose();
  }

  void _startMarquee() {
    _tickerTimer?.cancel();
    if (!mounted || !_scrollController.hasClients) return;

    _scrollController.jumpTo(0.0);

    // Continuous marquee ticker (~33 fps, smooth 1.1px step)
    _tickerTimer = Timer.periodic(const Duration(milliseconds: 30), (_) {
      if (!mounted || !_scrollController.hasClients || _isInteracting) return;

      final maxScroll = _scrollController.position.maxScrollExtent;
      if (maxScroll <= 4.0) return;

      final current = _scrollController.offset;
      final next = current + 1.1;

      if (next >= maxScroll) {
        _scrollController.jumpTo(0.0);
      } else {
        _scrollController.jumpTo(next);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final textSpan = TextSpan(text: widget.text, style: widget.style);
        final tp = TextPainter(
          text: textSpan,
          textDirection: TextDirection.ltr,
          maxLines: 1,
        )..layout();

        final bool overflows = tp.width > constraints.maxWidth;

        if (!overflows) {
          return Align(
            alignment: Alignment.centerLeft,
            child: Text(
              widget.text,
              style: widget.style,
              maxLines: 1,
            ),
          );
        }

        // When text overflows, wrap in continuous infinite marquee
        return Listener(
          onPointerDown: (_) => setState(() => _isInteracting = true),
          onPointerUp: (_) => setState(() => _isInteracting = false),
          onPointerCancel: (_) => setState(() => _isInteracting = false),
          child: ClipRect(
            child: SingleChildScrollView(
              controller: _scrollController,
              scrollDirection: Axis.horizontal,
              physics: const NeverScrollableScrollPhysics(),
              child: Row(
                children: [
                  Text(widget.text, style: widget.style),
                  const SizedBox(width: 64),
                  Text(widget.text, style: widget.style),
                  const SizedBox(width: 64),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

/// A modern quick-commerce announcement bar inspired by Zepto, Blinkit & Swiggy Instamart.
/// Displays Store Admin Emergency Notices and Super Admin Coupons/Offers cycling one by one.
class RunningAnnouncementBar extends StatefulWidget {
  const RunningAnnouncementBar({super.key});

  @override
  State<RunningAnnouncementBar> createState() => _RunningAnnouncementBarState();
}

class _RunningAnnouncementBarState extends State<RunningAnnouncementBar> {
  final ApiClient _api = ApiClient();

  List<AnnouncementItem> _items = [];
  int _currentIndex = 0;
  Timer? _cycleTimer;
  bool _isUserHolding = false;
  bool _isLoading = true;

  static const String _defaultDeliveryPromise =
      '90-Min Superfast Express Delivery in Ranchi • 100% Antibiotic-Free Fresh Cuts • Never Frozen';

  @override
  void initState() {
    super.initState();
    _fetchAnnouncementsAndCoupons();
  }

  @override
  void dispose() {
    _cycleTimer?.cancel();
    super.dispose();
  }

  Future<void> _fetchAnnouncementsAndCoupons() async {
    final List<AnnouncementItem> loadedItems = [];

    try {
      // 1. Fetch Store Admin Emergency Notice / Alert
      try {
        final noticeRes = await _api.get(ApiEndpoints.activeAnnouncements);
        if (noticeRes.data is Map && noticeRes.data['success'] == true) {
          final notice = (noticeRes.data['notice'] ?? '').toString().trim();
          final storeName = (noticeRes.data['storeName'] ?? '').toString().trim();
          if (notice.isNotEmpty) {
            loadedItems.add(AnnouncementItem(
              type: AnnouncementType.storeAlert,
              badgeText: 'STORE ALERT',
              badgeIcon: Icons.warning_amber_rounded,
              content: storeName.isNotEmpty ? '$notice  ($storeName)' : notice,
            ));
          }
        }
      } catch (_) {}

      // 1b. Fallback to available stores if activeAnnouncements is 404 on cloud backend
      if (loadedItems.isEmpty) {
        try {
          final storesRes = await _api.get(ApiEndpoints.availableStores);
          if (storesRes.data is Map && storesRes.data['success'] == true) {
            final storesList = storesRes.data['stores'];
            if (storesList is List) {
              for (final s in storesList) {
                if (s is Map) {
                  final notice = (s['emergencyNotice'] ?? '').toString().trim();
                  final storeName = (s['name'] ?? '').toString().trim();
                  if (notice.isNotEmpty) {
                    loadedItems.add(AnnouncementItem(
                      type: AnnouncementType.storeAlert,
                      badgeText: 'STORE ALERT',
                      badgeIcon: Icons.warning_amber_rounded,
                      content: storeName.isNotEmpty ? '$notice  ($storeName)' : notice,
                    ));
                    break;
                  }
                }
              }
            }
          }
        } catch (_) {}
      }

      // 2. Fetch Super Admin Active Coupons & Offers
      try {
        final couponsRes = await _api.get(ApiEndpoints.activeCoupons);
        if (couponsRes.data is Map && couponsRes.data['success'] == true) {
          final rawCoupons = couponsRes.data['coupons'];
          if (rawCoupons is List && rawCoupons.isNotEmpty) {
            final List<CouponModel> couponModels = rawCoupons
                .whereType<Map>()
                .map((c) => CouponModel.fromJson(Map<String, dynamic>.from(c)))
                .where((c) => c.isActive && c.code.isNotEmpty)
                .toList();

            // Sort super offers to the front, matching web behavior
            couponModels.sort((a, b) {
              if (a.isSuperOffer && !b.isSuperOffer) return -1;
              if (!a.isSuperOffer && b.isSuperOffer) return 1;
              return 0;
            });

            for (final c in couponModels) {
              final String discountDesc = c.discount.isNotEmpty
                  ? c.discount
                  : (c.description.isNotEmpty ? c.description : '${c.discountValue.toInt()}% OFF');
              final String minOrderText = (c.minOrder > 0) ? ' on orders above ₹${c.minOrder.toInt()}' : '';

              // For regular coupons, badge already displays the code, so text does not duplicate it
              final String offerText = c.isSuperOffer
                  ? '${c.code} • $discountDesc$minOrderText'
                  : '$discountDesc$minOrderText';

              loadedItems.add(AnnouncementItem(
                type: AnnouncementType.coupon,
                badgeText: c.isSuperOffer ? 'SUPER DEAL' : c.code,
                badgeIcon: c.isSuperOffer ? Icons.stars_rounded : Icons.local_offer_rounded,
                content: offerText,
                couponCode: c.code,
                discount: discountDesc,
                description: c.description,
                minOrder: c.minOrder,
                validTill: c.humanValidTill,
                isSuperOffer: c.isSuperOffer,
              ));
            }
          }
        }
      } catch (_) {}
    } catch (_) {
      // Fallback handled below
    }

    // 3. Fallback delivery promise if nothing is active
    if (loadedItems.isEmpty) {
      loadedItems.add(const AnnouncementItem(
        type: AnnouncementType.deliveryPromise,
        badgeText: 'LIVE UPDATE',
        badgeIcon: Icons.bolt_rounded,
        content: _defaultDeliveryPromise,
      ));
    }

    if (mounted) {
      setState(() {
        _items = loadedItems;
        _currentIndex = 0;
        _isLoading = false;
      });
      _startRotation();
    }
  }

  void _startRotation() {
    _cycleTimer?.cancel();
    if (_items.length <= 1) return;

    // Cycle one by one every 5.5 seconds, giving ample time to read the scrolling text
    _cycleTimer = Timer.periodic(const Duration(milliseconds: 5500), (_) {
      if (!mounted || _isUserHolding || _items.length <= 1) return;

      setState(() {
        _currentIndex = (_currentIndex + 1) % _items.length;
      });
    });
  }

  void _onItemTapped(AnnouncementItem item) {
    if (item.couponCode != null) {
      Clipboard.setData(ClipboardData(text: item.couponCode!));
      HapticFeedback.lightImpact();

      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Coupon "${item.couponCode}" copied! Apply it at checkout.',
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                ),
              ),
            ],
          ),
          backgroundColor: AppColors.primaryMaroon,
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        ),
      );

      // Also open the full offer details bottom sheet so user can see all terms
      _showOfferDetailsBottomSheet(item);
    }
  }

  void _showOfferDetailsBottomSheet(AnnouncementItem item) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Drag handle
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),

              // Header: Badge + Coupon Code Pill + Copy Chip
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF1F2),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFFECDD3)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.local_offer_rounded, size: 14, color: AppColors.primaryMaroon),
                        const SizedBox(width: 6),
                        Text(
                          item.couponCode ?? '',
                          style: const TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 14,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.8,
                            color: AppColors.primaryMaroon,
                          ),
                        ),
                      ],
                    ),
                  ),
                  InkWell(
                    borderRadius: BorderRadius.circular(8),
                    onTap: () {
                      Clipboard.setData(ClipboardData(text: item.couponCode ?? ''));
                      HapticFeedback.lightImpact();
                      Navigator.pop(context);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('Coupon "${item.couponCode}" copied!'),
                          duration: const Duration(seconds: 1),
                        ),
                      );
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: AppColors.primaryMaroon,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.copy_rounded, color: Colors.white, size: 12),
                          SizedBox(width: 4),
                          Text(
                            'COPY CODE',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 10.5,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.4,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Offer Title & Description
              Text(
                item.discount ?? item.content,
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF1E293B),
                ),
              ),
              if (item.description != null && item.description!.isNotEmpty && item.description != item.discount) ...[
                const SizedBox(height: 4),
                Text(
                  item.description!,
                  style: TextStyle(
                    fontSize: 13,
                    color: Colors.grey.shade700,
                    height: 1.3,
                  ),
                ),
              ],
              const SizedBox(height: 16),

              // Offer conditions card
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  children: [
                    if (item.minOrder != null && item.minOrder! > 0)
                      _buildDetailRow(
                        Icons.shopping_bag_outlined,
                        'Minimum Order Value',
                        '₹${item.minOrder!.toInt()}',
                      ),
                    if (item.validTill != null && item.validTill!.isNotEmpty)
                      _buildDetailRow(
                        Icons.event_outlined,
                        'Valid Till',
                        item.validTill!,
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Close / Apply button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryMaroon,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: const Text(
                    'Got It',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildDetailRow(IconData icon, String title, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: Colors.grey.shade600),
          const SizedBox(width: 8),
          SizedBox(
            width: 140,
            child: Text(
              title,
              style: TextStyle(
                fontSize: 12.5,
                color: Colors.grey.shade700,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
                color: Color(0xFF1E293B),
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading || _items.isEmpty) return const SizedBox.shrink();

    final item = _items[_currentIndex % _items.length];

    // Dynamic styling based on announcement type
    final Color bgColor;
    final Color borderColor;
    final Color badgeBg;
    final Color badgeTextColor;
    final Color textColor;

    switch (item.type) {
      case AnnouncementType.storeAlert:
        bgColor = const Color(0xFFFFFBEB);
        borderColor = const Color(0xFFFDE68A);
        badgeBg = const Color(0xFFD97706);
        badgeTextColor = Colors.white;
        textColor = const Color(0xFF78350F);
        break;
      case AnnouncementType.coupon:
        if (item.isSuperOffer) {
          bgColor = const Color(0xFFFFF1F2);
          borderColor = const Color(0xFFFECDD3);
          badgeBg = const Color(0xFFBE123C);
          badgeTextColor = Colors.white;
          textColor = const Color(0xFF881337);
        } else {
          bgColor = const Color(0xFFFAF5FF);
          borderColor = const Color(0xFFE9D5FF);
          badgeBg = const Color(0xFF7E22CE);
          badgeTextColor = Colors.white;
          textColor = const Color(0xFF581C87);
        }
        break;
      case AnnouncementType.deliveryPromise:
        bgColor = const Color(0xFFF0FDF4);
        borderColor = const Color(0xFFBBF7D0);
        badgeBg = const Color(0xFF16A34A);
        badgeTextColor = Colors.white;
        textColor = const Color(0xFF14532D);
        break;
    }

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: AppDimensions.spaceMd, vertical: 4),
      height: 38,
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: borderColor, width: 1.2),
        boxShadow: const [
          BoxShadow(
            color: Color(0x06000000),
            blurRadius: 4,
            offset: Offset(0, 1),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: item.couponCode != null ? () => _onItemTapped(item) : null,
          child: Row(
            children: [
              // 1. Left Animated Badge Pill
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 300),
                transitionBuilder: (child, anim) => ScaleTransition(scale: anim, child: child),
                child: Container(
                  key: ValueKey('${item.badgeText}_${item.type}'),
                  margin: const EdgeInsets.only(left: 6, right: 6),
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(
                    color: badgeBg,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(item.badgeIcon, color: badgeTextColor, size: 12),
                      const SizedBox(width: 3),
                      Text(
                        item.badgeText,
                        style: TextStyle(
                          color: badgeTextColor,
                          fontSize: 9.5,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.3,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // 2. Center Text - AnimatedSwitcher for vertical slide transition + ContinuousMarqueeText for smooth scrolling
              Expanded(
                child: Listener(
                  onPointerDown: (_) => setState(() => _isUserHolding = true),
                  onPointerUp: (_) => setState(() => _isUserHolding = false),
                  onPointerCancel: (_) => setState(() => _isUserHolding = false),
                  child: ClipRect(
                    child: AnimatedSwitcher(
                      duration: const Duration(milliseconds: 300),
                      layoutBuilder: (currentChild, previousChildren) {
                        return Stack(
                          clipBehavior: Clip.hardEdge,
                          alignment: Alignment.centerLeft,
                          children: [
                            ...previousChildren,
                            if (currentChild != null) currentChild,
                          ],
                        );
                      },
                      transitionBuilder: (child, animation) {
                        return SlideTransition(
                          position: Tween<Offset>(
                            begin: const Offset(0.0, 0.4),
                            end: Offset.zero,
                          ).animate(CurvedAnimation(parent: animation, curve: Curves.easeOutCubic)),
                          child: FadeTransition(opacity: animation, child: child),
                        );
                      },
                      child: ContinuousMarqueeText(
                        key: ValueKey('marquee_${_currentIndex}_${item.content}'),
                        text: item.content,
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: textColor,
                          height: 1.2,
                        ),
                      ),
                    ),
                  ),
                ),
              ),

              // 3. Right Action Pill (Tap to Copy for coupons, or page indicator)
              if (item.couponCode != null)
                Container(
                  margin: const EdgeInsets.only(right: 6, left: 4),
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.8),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: borderColor),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.copy_rounded, size: 10, color: textColor),
                      const SizedBox(width: 2),
                      Text(
                        'COPY',
                        style: TextStyle(
                          fontSize: 8.5,
                          fontWeight: FontWeight.w900,
                          color: textColor,
                          letterSpacing: 0.3,
                        ),
                      ),
                    ],
                  ),
                )
              else if (_items.length > 1)
                Padding(
                  padding: const EdgeInsets.only(right: 8, left: 4),
                  child: Text(
                    '${_currentIndex + 1}/${_items.length}',
                    style: TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w800,
                      color: textColor.withValues(alpha: 0.5),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
