import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:provider/provider.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:url_launcher/url_launcher.dart';
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

  // Real-time Socket.IO & Google Maps State
  IO.Socket? _socket;
  GoogleMapController? _mapController;
  double? _riderLat;
  double? _riderLng;
  int? _liveEtaMinutes;
  double? _liveRoadDistanceKm;
  bool _socketConnected = false;

  // Default coordinate constants (Ranchi)
  static const double _defaultStoreLat = 23.3685;
  static const double _defaultStoreLng = 85.3240;
  static const double _defaultCustLat = 23.3441;
  static const double _defaultCustLng = 85.3096;

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
    _initSocket();
  }

  @override
  void dispose() {
    _socket?.disconnect();
    _socket?.dispose();
    _mapController?.dispose();
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

  Set<Marker> _buildMapMarkers(OrderModel order) {
    final markers = <Marker>{};

    final storeLat = order.storeLat ?? _defaultStoreLat;
    final storeLng = order.storeLng ?? _defaultStoreLng;
    final custLat = order.deliveryLat ?? _defaultCustLat;
    final custLng = order.deliveryLng ?? _defaultCustLng;
    final riderLat = _riderLat ?? order.rider?.lat ?? (storeLat + (custLat - storeLat) * 0.45);
    final riderLng = _riderLng ?? order.rider?.lng ?? (storeLng + (custLng - storeLng) * 0.45);

    // 1. Store Marker
    markers.add(
      Marker(
        markerId: const MarkerId('store_hub'),
        position: LatLng(storeLat, storeLng),
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueOrange),
        infoWindow: InfoWindow(
          title: order.storeName ?? 'Kishore Ganj Hub',
          snippet: 'Fulfillment & Butchery Hub',
        ),
      ),
    );

    // 2. Customer Destination Marker
    markers.add(
      Marker(
        markerId: const MarkerId('customer_dest'),
        position: LatLng(custLat, custLng),
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
        infoWindow: InfoWindow(
          title: 'Your Delivery Location',
          snippet: order.deliveryAddress ?? 'Customer Address',
        ),
      ),
    );

    // 3. Rider Marker (shown when in transit or assigned)
    if (order.status == 'Out for Delivery' || order.rider != null) {
      markers.add(
        Marker(
          markerId: const MarkerId('rider_live'),
          position: LatLng(riderLat, riderLng),
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueAzure),
          infoWindow: InfoWindow(
            title: '${order.rider?.name ?? "Delivery Rider"} (Live GPS)',
            snippet: _liveEtaMinutes != null
                ? 'Arriving in ~$_liveEtaMinutes min'
                : 'En route to your doorstep',
          ),
        ),
      );
    }

    return markers;
  }

  Set<Polyline> _buildMapPolylines(OrderModel order) {
    final polylines = <Polyline>{};

    final storeLat = order.storeLat ?? _defaultStoreLat;
    final storeLng = order.storeLng ?? _defaultStoreLng;
    final custLat = order.deliveryLat ?? _defaultCustLat;
    final custLng = order.deliveryLng ?? _defaultCustLng;
    final riderLat = _riderLat ?? order.rider?.lat;
    final riderLng = _riderLng ?? order.rider?.lng;

    final points = <LatLng>[
      LatLng(storeLat, storeLng),
      if (riderLat != null && riderLng != null) LatLng(riderLat, riderLng),
      LatLng(custLat, custLng),
    ];

    polylines.add(
      Polyline(
        polylineId: const PolylineId('order_delivery_route'),
        points: points,
        color: AppColors.primaryMaroon,
        width: 4,
        jointType: JointType.round,
        startCap: Cap.roundCap,
        endCap: Cap.roundCap,
      ),
    );

    return polylines;
  }

  void _initSocket() {
    try {
      final socketUri = ApiEndpoints.socketUrl;
      debugPrint('[Customer Tracking] Connecting to Socket.IO at $socketUri for order ${widget.orderId}');
      _socket = IO.io(
        socketUri,
        IO.OptionBuilder()
            .setTransports(['websocket', 'polling'])
            .disableAutoConnect()
            .enableReconnection()
            .setReconnectionAttempts(10)
            .setReconnectionDelay(2000)
            .build(),
      );

      _socket?.connect();

      _socket?.onConnect((_) {
        debugPrint('[Customer Tracking] Connected to real-time telemetry socket');
        if (mounted) setState(() => _socketConnected = true);
        _socket?.emit('join:order', widget.orderId);
        _socket?.emit('join', 'order:${widget.orderId}');
      });

      _socket?.onDisconnect((_) {
        debugPrint('[Customer Tracking] Disconnected from telemetry socket');
        if (mounted) setState(() => _socketConnected = false);
      });

      _socket?.on('rider:location:update', (data) {
        _handleRiderLocationPayload(data);
      });

      _socket?.on('rider:location_changed', (data) {
        _handleRiderLocationPayload(data);
      });

      _socket?.on('order:status_updated', (_) {
        _fetchLiveOrderDetails();
      });
    } catch (e) {
      debugPrint('[Customer Tracking] Socket initialization error: $e');
    }
  }

  void _handleRiderLocationPayload(dynamic data) {
    if (data == null || !mounted) return;
    try {
      final map = data is Map ? data : Map<String, dynamic>.from(data);
      final lat = (map['latitude'] ?? map['lat'] as num?)?.toDouble();
      final lng = (map['longitude'] ?? map['lng'] as num?)?.toDouble();
      final eta = (map['etaMinutes'] as num?)?.toInt();
      final dist = (map['roadDistanceKm'] as num?)?.toDouble();

      setState(() {
        if (lat != null && lng != null) {
          _riderLat = lat;
          _riderLng = lng;
        }
        if (eta != null) _liveEtaMinutes = eta;
        if (dist != null) _liveRoadDistanceKm = dist;
      });

      if (_mapController != null && lat != null && lng != null) {
        _mapController?.animateCamera(
          CameraUpdate.newLatLng(LatLng(lat, lng)),
        );
      }
    } catch (e) {
      debugPrint('[Customer Tracking] Payload error: $e');
    }
  }

  Future<void> _openGoogleMapsDirections({double? destLat, double? destLng}) async {
    final lat = destLat ?? _defaultCustLat;
    final lng = destLng ?? _defaultCustLng;
    final uri = Uri.parse('https://www.google.com/maps/dir/?api=1&destination=$lat,$lng&travelmode=two-wheeler');
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        await launchUrl(uri);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Opening Google Maps Route to: $lat, $lng')),
        );
      }
    }
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
      if (status == 'Cutting') {
        return {
          'badge': 'LIVE BUTCHERY STATION',
          'title': 'Butcher Preparing Cuts',
          'sub': 'Live butchery station: ${order.storeName ?? "Kishore Ganj Hub"}',
        };
      }
      return {
        'badge': 'ORDER RECEIVED',
        'title': 'Order Confirmed',
        'sub': 'Verified for counter pickup at ${order.storeName ?? "Kishore Ganj Hub"}',
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

              // 2. Interactive Google Maps Live Tracking Card
              Container(
                height: 250,
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
                      // Google Maps Platform View
                      GoogleMap(
                        initialCameraPosition: CameraPosition(
                          target: LatLng(
                            _riderLat ?? order.deliveryLat ?? _defaultStoreLat,
                            _riderLng ?? order.deliveryLng ?? _defaultStoreLng,
                          ),
                          zoom: 13.5,
                        ),
                        markers: _buildMapMarkers(order),
                        polylines: _buildMapPolylines(order),
                        myLocationButtonEnabled: false,
                        zoomControlsEnabled: false,
                        mapToolbarEnabled: false,
                        compassEnabled: true,
                        onMapCreated: (controller) {
                          _mapController = controller;
                        },
                      ),

                      // Top Left Telemetry Status & Socket.IO Indicator
                      Positioned(
                        top: 10,
                        left: 10,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.95),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: AppColors.borderHairline),
                            boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 4)],
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(
                                  color: _socketConnected ? AppColors.hygieneEmerald : Colors.amber.shade700,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                status == 'Out for Delivery'
                                    ? 'Live GPS · ${_liveEtaMinutes ?? order.remainingTransitMinutes ?? 12} min'
                                    : 'Live Order · $status',
                                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 10, color: AppColors.textPrimary),
                              ),
                            ],
                          ),
                        ),
                      ),

                      // Bottom Left Live Road Distance Pill (Google Routes API)
                      if (_liveRoadDistanceKm != null && status == 'Out for Delivery')
                        Positioned(
                          bottom: 10,
                          left: 10,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.primaryMaroon.withOpacity(0.92),
                              borderRadius: BorderRadius.circular(6),
                              boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 4)],
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.two_wheeler_rounded, color: Colors.white, size: 13),
                                const SizedBox(width: 4),
                                Text(
                                  '${_liveRoadDistanceKm!.toStringAsFixed(1)} km away',
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 10, color: Colors.white),
                                ),
                              ],
                            ),
                          ),
                        ),

                      // Bottom Right External Navigation Action
                      Positioned(
                        bottom: 10,
                        right: 10,
                        child: ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white,
                            foregroundColor: AppColors.primaryMaroon,
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            elevation: 3,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                          ),
                          icon: const Icon(Icons.directions_rounded, size: 14, color: AppColors.primaryMaroon),
                          label: const Text('Google Maps', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 10.5)),
                          onPressed: () => _openGoogleMapsDirections(
                            destLat: order.deliveryLat ?? _defaultCustLat,
                            destLng: order.deliveryLng ?? _defaultCustLng,
                          ),
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
                      isCompleted: status != 'Pending',
                      isActive: status == 'Pending',
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
