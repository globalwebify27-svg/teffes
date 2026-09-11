import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/api_endpoints.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../core/network/api_client.dart';
import '../../core/utils/currency_formatter.dart';
import '../../models/order_model.dart';
import '../../providers/auth_provider.dart';

class OrderTrackingScreen extends StatefulWidget {
  final String orderId;

  const OrderTrackingScreen({super.key, required this.orderId});

  @override
  State<OrderTrackingScreen> createState() => _OrderTrackingScreenState();
}

class _OrderTrackingScreenState extends State<OrderTrackingScreen> with SingleTickerProviderStateMixin {
  final ApiClient _api = ApiClient();
  OrderModel? _serverOrder;
  bool _isRefreshing = false;
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
    _pulseAnimation = Tween<double>(begin: 0.9, end: 1.15).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    _fetchLiveOrderDetails();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  Future<void> _fetchLiveOrderDetails() async {
    setState(() => _isRefreshing = true);
    try {
      final res = await _api.get(ApiEndpoints.orderDetails(widget.orderId));
      if (res.data['success'] == true && res.data['order'] != null) {
        if (mounted) {
          setState(() {
            _serverOrder = OrderModel.fromJson(res.data['order'] as Map<String, dynamic>);
          });
        }
      }
    } catch (_) {
      // Offline fallback: will read from AuthProvider
    } finally {
      if (mounted) setState(() => _isRefreshing = false);
    }
  }

  void _openGoogleMapsDirections() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Opening Google Maps Live GPS Route: Kishore Ganj Hub → Customer Kitchen...'),
        duration: Duration(seconds: 2),
      ),
    );
  }

  Map<String, String> _getEtaDisplayInfo(OrderModel order) {
    final status = order.status;
    final isPickup = order.isPickup;

    if (status == 'Delivered') {
      return {
        'badge': 'DELIVERY COMPLETED',
        'title': isPickup ? 'Picked Up ✓' : 'Delivered Fresh ✓',
        'sub': isPickup
            ? 'Collected from ${order.storeName ?? "Kishore Ganj Hub"}'
            : 'Delivered fresh from ${order.storeName ?? "Kishore Ganj Hub"}',
      };
    }

    if (isPickup) {
      if (status == 'Ready') {
        return {
          'badge': 'READY FOR PICKUP',
          'title': 'Ready at Counter',
          'sub': 'Collect at: ${order.storeName ?? "Kishore Ganj Hub"} Counter',
        };
      }
      return {
        'badge': 'LIVE STATUS FROM STORE ADMIN',
        'title': 'Butcher Preparing Cuts',
        'sub': 'Live butchery station: ${order.storeName ?? "Kishore Ganj Hub"}',
      };
    }

    // Delivery Flow
    if (status == 'Out for Delivery') {
      final transitMins = order.remainingTransitMinutes ?? 12;
      final isNearDoorstep = order.etaStage == 'NEAR_DOORSTEP' || transitMins <= 5;

      if (isNearDoorstep) {
        return {
          'badge': 'RIDER IN NEIGHBORHOOD',
          'title': 'Arriving in ~5 min',
          'sub': 'Keep your 4-digit doorstep delivery code ready',
        };
      }

      return {
        'badge': 'RIDER ON THE ROAD',
        'title': 'Arriving in $transitMins min',
        'sub': 'Dispatched fresh from ${order.storeName ?? "Kishore Ganj Hub"}',
      };
    }

    // Preparation Phase: Pending, Cutting, Ready
    String targetClock = '';
    if (order.targetDeliveryTime != null && order.targetDeliveryTime!.isNotEmpty) {
      try {
        final dt = DateTime.parse(order.targetDeliveryTime!).toLocal();
        final hour = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
        final minute = dt.minute.toString().padLeft(2, '0');
        final ampm = dt.hour >= 12 ? 'PM' : 'AM';
        targetClock = '$hour:$minute $ampm';
      } catch (_) {
        targetClock = order.targetDeliveryTime!;
      }
    }

    final targetText = targetClock.isNotEmpty ? 'Arriving by $targetClock' : 'Preparing your cuts';

    if (status == 'Cutting') {
      return {
        'badge': 'LIVE BUTCHERY STATION',
        'title': targetText,
        'sub': 'Master butcher slicing & packing your fresh cuts',
      };
    } else if (status == 'Ready') {
      return {
        'badge': 'PACKED FRESH',
        'title': targetText,
        'sub': 'Fresh insulated pack assigned to rider',
      };
    }

    return {
      'badge': 'ORDER IN PREPARATION',
      'title': targetText,
      'sub': 'Fresh butcher cuts in preparation',
    };
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    final OrderModel? localMatched = auth.myOrders.where(
      (o) => o.orderId == widget.orderId || o.id == widget.orderId,
    ).isNotEmpty
        ? auth.myOrders.firstWhere((o) => o.orderId == widget.orderId || o.id == widget.orderId)
        : null;

    final order = _serverOrder ?? localMatched;

    if (order == null) {
      return Scaffold(
        backgroundColor: AppColors.surfacePorcelain,
        appBar: AppBar(
          title: Text('Track Order #${widget.orderId}'),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
            onPressed: () => Navigator.pop(context),
          ),
        ),
        body: Center(
          child: _isRefreshing
              ? const CircularProgressIndicator(color: AppColors.primaryMaroon)
              : Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.receipt_long_rounded, size: 54, color: AppColors.textMuted),
                    const SizedBox(height: 12),
                    Text(
                      'Order #${widget.orderId} not found',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                    const SizedBox(height: 8),
                    const Text('Unable to load order details from server.', style: TextStyle(color: AppColors.textMuted)),
                  ],
                ),
        ),
      );
    }

    final status = order.status;
    final etaInfo = _getEtaDisplayInfo(order);

    return Scaffold(
      backgroundColor: AppColors.surfacePorcelain,
      appBar: AppBar(
        title: Text('Track Order #${order.orderId}'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: _isRefreshing
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primaryMaroon))
                : const Icon(Icons.sync_rounded, color: AppColors.primaryMaroon),
            tooltip: 'Sync Live Status from Store Admin',
            onPressed: _fetchLiveOrderDetails,
          ),
          IconButton(
            icon: const Icon(Icons.map_rounded, color: AppColors.primaryMaroon),
            tooltip: 'Google Maps Route',
            onPressed: _openGoogleMapsDirections,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _fetchLiveOrderDetails,
        color: AppColors.primaryMaroon,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppDimensions.spaceMd),
          physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Live ETA & Status Banner
              Container(
                padding: const EdgeInsets.all(AppDimensions.spaceMd),
                decoration: BoxDecoration(
                  color: status == 'Delivered'
                      ? AppColors.hygieneLight
                      : (status == 'Out for Delivery' && (order.remainingTransitMinutes ?? 12) <= 5)
                          ? const Color(0xFFFFF7ED)
                          : status == 'Cutting'
                              ? Colors.amber.shade50
                              : AppColors.deliveryAmberBg,
                  borderRadius: AppDimensions.roundedLg,
                  border: Border.all(
                    color: status == 'Delivered'
                        ? AppColors.hygieneDark.withOpacity(0.3)
                        : (status == 'Out for Delivery' && (order.remainingTransitMinutes ?? 12) <= 5)
                            ? const Color(0xFFFDBA74)
                            : AppColors.deliveryAmber.withOpacity(0.3),
                  ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(
                                  color: status == 'Delivered'
                                      ? AppColors.hygieneDark
                                      : (status == 'Out for Delivery' && (order.remainingTransitMinutes ?? 12) <= 5)
                                          ? const Color(0xFFEA580C)
                                          : Colors.amber.shade800,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                etaInfo['badge']!,
                                style: TextStyle(
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w800,
                                  color: status == 'Delivered'
                                      ? AppColors.hygieneDark
                                      : (status == 'Out for Delivery' && (order.remainingTransitMinutes ?? 12) <= 5)
                                          ? const Color(0xFFC2410C)
                                          : AppColors.deliveryAmber,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 3),
                          Text(
                            etaInfo['title']!,
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                              color: status == 'Delivered'
                                  ? AppColors.hygieneDark
                                  : (status == 'Out for Delivery' && (order.remainingTransitMinutes ?? 12) <= 5)
                                      ? const Color(0xFF9A3412)
                                      : const Color(0xFF78350F),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            etaInfo['sub']!,
                            style: TextStyle(
                              fontSize: 11.5,
                              color: status == 'Delivered'
                                  ? AppColors.hygieneDark
                                  : (status == 'Out for Delivery' && (order.remainingTransitMinutes ?? 12) <= 5)
                                      ? const Color(0xFFC2410C)
                                      : Colors.amber.shade900,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: status == 'Delivered'
                            ? AppColors.hygieneLight
                            : (status == 'Out for Delivery' && (order.remainingTransitMinutes ?? 12) <= 5)
                                ? const Color(0xFFFFEDD5)
                                : AppColors.deliveryAmber.withOpacity(0.2),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        status == 'Delivered'
                            ? Icons.check_circle_rounded
                            : status == 'Cutting'
                                ? Icons.content_cut_rounded
                                : (status == 'Out for Delivery' && (order.remainingTransitMinutes ?? 12) <= 5)
                                    ? Icons.near_me_rounded
                                    : order.isPickup
                                        ? Icons.storefront_rounded
                                        : Icons.two_wheeler_rounded,
                        color: status == 'Delivered'
                            ? AppColors.hygieneDark
                            : (status == 'Out for Delivery' && (order.remainingTransitMinutes ?? 12) <= 5)
                                ? const Color(0xFFEA580C)
                                : AppColors.deliveryAmber,
                        size: 26,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppDimensions.spaceMd),

              // 4-Digit Delivery Code Card (for customer to share with rider at doorstep)
              if (order.deliveryOtp != null && status == 'Out for Delivery' && !order.isPickup) ...[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF3C7),
                    borderRadius: AppDimensions.roundedLg,
                    border: Border.all(color: const Color(0xFFFDE68A)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: const BoxDecoration(
                          color: Color(0xFFD97706),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.pin_rounded, color: Colors.white, size: 18),
                      ),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Doorstep Delivery Code',
                              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: Color(0xFF92400E)),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'Share this code with your delivery partner upon arrival',
                              style: TextStyle(fontSize: 10, color: Color(0xFFB45309)),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFF59E0B)),
                        ),
                        child: Text(
                          order.deliveryOtp!,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 3,
                            color: Color(0xFF92400E),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppDimensions.spaceMd),
              ],

              // 2. Google Maps Live Route Radar matching website GoogleLiveMap.tsx
              Container(
                height: 220,
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: AppDimensions.roundedLg,
                  border: Border.all(color: AppColors.borderHairline),
                  boxShadow: AppDimensions.cardShadow,
                ),
                child: ClipRRect(
                  borderRadius: AppDimensions.roundedLg,
                  child: Stack(
                    children: [
                      // City Map Grid
                      Positioned.fill(
                        child: CustomPaint(painter: _MapGridPainter()),
                      ),

                      // Radar waves (active while in transit)
                      if (status != 'Delivered')
                        Center(
                          child: AnimatedBuilder(
                            animation: _pulseAnimation,
                            builder: (context, child) {
                              return Transform.scale(
                                scale: _pulseAnimation.value,
                                child: Container(
                                  width: 140,
                                  height: 140,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    border: Border.all(color: Colors.amber.withOpacity(0.35), width: 2),
                                  ),
                                ),
                              );
                            },
                          ),
                        ),

                      // Connecting Route Polyline
                      Positioned.fill(
                        child: CustomPaint(painter: _RoutePolylinePainter()),
                      ),

                      // Store Marker (Origin)
                      Positioned(
                        left: 18,
                        bottom: 24,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(7),
                              decoration: BoxDecoration(
                                color: AppColors.primaryMaroon,
                                shape: BoxShape.circle,
                                border: Border.all(color: Colors.white, width: 2),
                                boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 4)],
                              ),
                              child: const Icon(Icons.storefront_rounded, color: Colors.white, size: 16),
                            ),
                            const SizedBox(height: 3),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(4),
                                boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 2)],
                              ),
                              child: Text(order.storeName ?? 'Kishore Ganj Hub', style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold)),
                            ),
                          ],
                        ),
                      ),

                      // Live Moving Rider Marker (Center)
                      Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: status == 'Delivered' ? AppColors.hygieneEmerald : Colors.amber.shade600,
                                shape: BoxShape.circle,
                                border: Border.all(color: Colors.white, width: 2.5),
                                boxShadow: [
                                  BoxShadow(color: (status == 'Delivered' ? Colors.green : Colors.amber).withOpacity(0.5), blurRadius: 10, spreadRadius: 3),
                                ],
                              ),
                              child: Icon(
                                status == 'Delivered' ? Icons.check_circle_rounded : Icons.two_wheeler_rounded,
                                color: Colors.white,
                                size: 20,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: status == 'Delivered' ? AppColors.hygieneLight : Colors.amber.shade100,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: status == 'Delivered' ? AppColors.hygieneDark.withOpacity(0.3) : Colors.amber.shade300),
                              ),
                              child: Text(
                                status == 'Delivered' ? 'Order Delivered' : '${order.rider?.name ?? "Rider"} is here',
                                style: TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 10,
                                  color: status == 'Delivered' ? AppColors.hygieneDark : const Color(0xFF78350F),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Destination Marker (Customer Kitchen)
                      Positioned(
                        right: 18,
                        top: 24,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(7),
                              decoration: BoxDecoration(
                                color: AppColors.hygieneEmerald,
                                shape: BoxShape.circle,
                                border: Border.all(color: Colors.white, width: 2),
                                boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 4)],
                              ),
                              child: const Icon(Icons.home_rounded, color: Colors.white, size: 16),
                            ),
                            const SizedBox(height: 3),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(4),
                                boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 2)],
                              ),
                              child: const Text('Your Kitchen', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold)),
                            ),
                          ],
                        ),
                      ),

                      // Top Left GPS / Temp Badge
                      Positioned(
                        top: 10,
                        left: 10,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.92),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: AppColors.borderHairline),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 8,
                                height: 8,
                                decoration: const BoxDecoration(
                                  color: AppColors.hygieneEmerald,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                'Live GPS · ${order.status} (Insulated Fresh-Box)',
                                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 9.5, color: AppColors.textPrimary),
                              ),
                            ],
                          ),
                        ),
                      ),

                      // Bottom Right Google Maps Button
                      Positioned(
                        bottom: 10,
                        right: 10,
                        child: ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white,
                            foregroundColor: AppColors.primaryMaroon,
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            elevation: 2,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                          ),
                          icon: const Icon(Icons.directions_rounded, size: 14, color: AppColors.primaryMaroon),
                          label: const Text('Google Maps Route', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 10.5)),
                          onPressed: _openGoogleMapsDirections,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: AppDimensions.spaceMd),

              // 3. Contact Card (Store Counter for Pickup vs Rider for Delivery)
              order.isPickup
                  ? Container(
                      padding: const EdgeInsets.all(AppDimensions.spaceMd),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: AppDimensions.roundedLg,
                        border: Border.all(color: const Color(0xFFFDE68A)),
                        boxShadow: AppDimensions.cardShadow,
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: const BoxDecoration(
                              color: Color(0xFFFEF3C7),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.storefront_rounded, color: Color(0xFFB45309), size: 24),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${order.storeName ?? "Kishore Ganj"} Takeaway Counter',
                                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5),
                                ),
                                const SizedBox(height: 2),
                                const Text(
                                  'Harmu Road, Kishore Ganj, Ranchi • Open till 09:00 PM',
                                  style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.phone_in_talk_rounded, color: AppColors.primaryMaroon),
                            onPressed: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Calling Kishore Ganj Butchery Counter at +91 94311 88200...')),
                              );
                            },
                          ),
                        ],
                      ),
                    )
                  : Container(
                      padding: const EdgeInsets.all(AppDimensions.spaceMd),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: AppDimensions.roundedLg,
                        border: Border.all(color: AppColors.borderHairline),
                        boxShadow: AppDimensions.cardShadow,
                      ),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 22,
                            backgroundColor: AppColors.surfaceSubtle,
                            child: const Icon(Icons.person_rounded, color: AppColors.textPrimary),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  order.rider?.name ?? 'Md. Imran Ansari',
                                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '${order.rider?.vehicle ?? "Honda Activa"} • ${order.rider?.rating ?? "4.9 ★"} (840+ deliveries)',
                                  style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.phone_in_talk_rounded, color: AppColors.primaryMaroon),
                            onPressed: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Calling rider at ${order.rider?.phone ?? "+91 94311 88204"}...')),
                              );
                            },
                          ),
                          IconButton(
                            icon: const Icon(Icons.chat_rounded, color: Color(0xFF25D366)),
                            onPressed: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Opening WhatsApp with Teffe\'s Butchery Delivery Agent...')),
                              );
                            },
                          ),
                        ],
                      ),
                    ),
              const SizedBox(height: AppDimensions.spaceMd),

              // 4. Exact Timeline Steps Matching Website
              Container(
                padding: const EdgeInsets.all(AppDimensions.spaceMd),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: AppDimensions.roundedLg,
                  border: Border.all(color: AppColors.borderHairline),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          order.isPickup ? 'Store Takeaway Timeline' : 'Live Butchery Timeline',
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.hygieneLight,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text('Live Sync with Store Admin', style: TextStyle(fontSize: 9.5, color: AppColors.hygieneDark, fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),

                    // Step 1: Order Confirmed
                    _buildDynamicTimelineStep(
                      stepNumber: 1,
                      title: 'Order Confirmed',
                      desc: order.isPickup
                          ? 'Verified for counter pickup at ${order.storeName ?? "Kishore Ganj Hub"}'
                          : 'Verified by butchery manager',
                      isCompleted: true,
                      isActive: false,
                      showLine: true,
                    ),

                    // Step 2: Master Butcher Cutting Meat / Fresh Meat Cut & Packed
                    _buildDynamicTimelineStep(
                      stepNumber: 2,
                      title: status == 'Cutting' ? 'Master Butcher Cutting Meat' : 'Fresh Meat Cut & Packed',
                      desc: status == 'Cutting'
                          ? 'Clean cutting on sanitized butcher block in progress'
                          : ['Ready', 'Out for Delivery', 'Delivered'].contains(status)
                              ? 'Cleanly butchered upon order & sealed fresh'
                              : 'Next up: Butchery preparation',
                      isCompleted: ['Ready', 'Out for Delivery', 'Delivered'].contains(status),
                      isActive: status == 'Cutting',
                      showLine: true,
                    ),

                    // Step 3: Out for Express Delivery vs Ready at Store Counter
                    order.isPickup
                        ? _buildDynamicTimelineStep(
                            stepNumber: 3,
                            title: 'Ready at Store Counter',
                            desc: status == 'Ready'
                                ? 'Your fresh cuts are packed and waiting at the takeaway counter!'
                                : status == 'Delivered'
                                    ? 'Order picked up from store counter'
                                    : 'Awaiting butcher completion',
                            isCompleted: status == 'Delivered',
                            isActive: status == 'Ready',
                            showLine: true,
                          )
                        : _buildDynamicTimelineStep(
                            stepNumber: 3,
                            title: 'Out for Express Delivery',
                            desc: status == 'Out for Delivery'
                                ? ((order.remainingTransitMinutes ?? 12) <= 5
                                    ? 'Rider in neighborhood with insulated box'
                                    : 'Rider is on the way (arriving in ${order.remainingTransitMinutes ?? 12} min)')
                                : status == 'Delivered'
                                    ? 'Dispatched & safely reached your address'
                                    : 'Assigned to delivery fleet from ${order.storeName ?? "Kishore Ganj"}',
                            isCompleted: status == 'Delivered',
                            isActive: status == 'Out for Delivery',
                            showLine: true,
                          ),

                    // Step 4: Delivered to Doorstep vs Collected by Customer
                    _buildDynamicTimelineStep(
                      stepNumber: 4,
                      title: order.isPickup ? 'Handed Over at Store Counter' : 'Delivered to Doorstep',
                      desc: status == 'Delivered'
                          ? (order.isPickup ? 'Collected fresh at store counter' : 'Handed over fresh & verified')
                          : order.isPickup
                              ? 'Show Order #${order.orderId} at the butchery counter'
                              : 'Temperature-controlled doorstep delivery',
                      isCompleted: status == 'Delivered',
                      isActive: false,
                      showLine: false,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppDimensions.spaceMd),

              // 5. Order Cuts Breakdown (Dynamic data for THIS specific order)
              Container(
                padding: const EdgeInsets.all(AppDimensions.spaceMd),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: AppDimensions.roundedLg,
                  border: Border.all(color: AppColors.borderHairline),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Order Cuts (${order.items.length} item(s))', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5)),
                        Text(
                          CurrencyFormatter.format(order.amount),
                          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: AppColors.primaryMaroon),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    ...order.items.map((item) {
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 3),
                        child: Row(
                          children: [
                            const Icon(Icons.check_circle_outline_rounded, size: 14, color: AppColors.hygieneEmerald),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                "${item['quantity'] ?? 1}x ${item['name'] ?? 'Artisanal Cut'} (${item['weight'] ?? item['netWeight'] ?? '500g'})",
                                style: const TextStyle(fontSize: 12, color: AppColors.textPrimary, fontWeight: FontWeight.w500),
                              ),
                            ),
                            if (item['price'] != null)
                              Text(
                                CurrencyFormatter.format((item['price'] as num).toDouble()),
                                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                              ),
                          ],
                        ),
                      );
                    }),
                    const SizedBox(height: 8),
                    const Divider(height: 1, color: AppColors.borderHairline),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        const Icon(Icons.location_on_rounded, size: 14, color: AppColors.textMuted),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            order.deliveryAddress ?? 'Ranchi',
                            style: const TextStyle(fontSize: 11.5, color: AppColors.textMuted),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // 6. Back Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryMaroon,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  onPressed: () => Navigator.of(context).popUntil((route) => route.isFirst),
                  child: const Text('Back to Home', style: TextStyle(fontWeight: FontWeight.w800, color: Colors.white)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDynamicTimelineStep({
    required int stepNumber,
    required String title,
    required String desc,
    required bool isCompleted,
    required bool isActive,
    required bool showLine,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            if (isCompleted)
              const Icon(Icons.check_circle_rounded, size: 20, color: AppColors.hygieneEmerald)
            else if (isActive)
              Container(
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  color: Colors.amber.shade100,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.amber.shade800, width: 2),
                ),
                child: Center(
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: Colors.amber.shade800,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
              )
            else
              const Icon(Icons.radio_button_unchecked_rounded, size: 20, color: AppColors.textMuted),
            if (showLine)
              Container(
                width: 2,
                height: 36,
                color: isCompleted ? AppColors.hygieneEmerald : AppColors.borderHairline,
              ),
          ],
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 13,
                  color: isActive
                      ? Colors.amber.shade900
                      : isCompleted
                          ? AppColors.textPrimary
                          : AppColors.textMuted,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                desc,
                style: TextStyle(
                  fontSize: 11.5,
                  color: isActive ? Colors.amber.shade900 : AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ],
    );
  }
}

class _MapGridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFFCBD5E1).withOpacity(0.5)
      ..strokeWidth = 1;

    for (double x = 0; x < size.width; x += 28) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += 28) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _RoutePolylinePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(size.width * 0.15, size.height * 0.8)
      ..quadraticBezierTo(
        size.width * 0.35,
        size.height * 0.6,
        size.width * 0.5,
        size.height * 0.5,
      )
      ..quadraticBezierTo(
        size.width * 0.65,
        size.height * 0.4,
        size.width * 0.85,
        size.height * 0.22,
      );

    final linePaint = Paint()
      ..color = AppColors.primaryMaroon
      ..strokeWidth = 3.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    canvas.drawPath(path, linePaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
