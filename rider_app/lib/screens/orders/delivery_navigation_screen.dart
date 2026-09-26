import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../models/rider_order_model.dart';
import '../../providers/rider_location_provider.dart';
import 'doorstep_delivery_screen.dart';
import 'rider_order_details_screen.dart';

class DeliveryNavigationScreen extends StatelessWidget {
  final RiderOrder order;

  const DeliveryNavigationScreen({super.key, required this.order});

  Future<void> _callCustomer(BuildContext context) async {
    final cleanPhone = order.customerPhone.replaceAll(RegExp(r'\D'), '');
    if (cleanPhone.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Customer phone number not available')),
      );
      return;
    }
    final uri = Uri.parse('tel:$cleanPhone');
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri);
      } else {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not open phone dialer: $e')),
        );
      }
    }
  }

  Future<void> _openGoogleMapsNavigation(BuildContext context) async {
    final lat = order.customerLat;
    final lng = order.customerLng;
    final address = Uri.encodeComponent(order.customerAddress);

    Uri uri;
    if (lat != null && lng != null && lat != 0.0 && lng != 0.0) {
      uri = Uri.parse('google.navigation:q=$lat,$lng&mode=d');
    } else {
      uri = Uri.parse('https://www.google.com/maps/dir/?api=1&destination=$address');
    }

    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri);
      } else {
        final webUri = Uri.parse(
          (lat != null && lng != null && lat != 0.0)
              ? 'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng'
              : 'https://www.google.com/maps/dir/?api=1&destination=$address',
        );
        await launchUrl(webUri, mode: LaunchMode.externalApplication);
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not launch Google Maps: $e')),
        );
      }
    }
  }

  void _showCallCustomerDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            const Icon(Icons.phone_in_talk_rounded, color: AppColors.dutyOnline),
            const SizedBox(width: 10),
            Text(order.customerName),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Call customer via registered mobile:',
              style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 8),
            Text(
              order.customerPhone.isNotEmpty ? order.customerPhone : 'Phone not available',
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton.icon(
            onPressed: () {
              Navigator.of(ctx).pop();
              _callCustomer(context);
            },
            icon: const Icon(Icons.call, size: 18),
            label: const Text('Dial Now'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.dutyOnline,
              foregroundColor: Colors.white,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final locationProvider = context.watch<RiderLocationProvider>();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<RiderLocationProvider>().startTelemetryBroadcast(order.orderId);
    });

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(
          'In-Transit • #${order.orderNumber}',
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17),
        ),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.textPrimary,
        elevation: 0.5,
        actions: [
          IconButton(
            icon: const Icon(Icons.receipt_long_rounded, color: AppColors.primaryMaroon),
            tooltip: 'Order Details',
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => RiderOrderDetailsScreen(order: order),
                ),
              );
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Live Route Visualizer Card
            Container(
              height: 180,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF1E293B), Color(0xFF0F172A)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: AppDimensions.roundedLg,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.12),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              padding: const EdgeInsets.all(20),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.dutyOnline.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: AppColors.dutyOnline),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.gps_fixed_rounded, size: 12, color: AppColors.dutyOnline),
                            SizedBox(width: 6),
                            Text(
                              'GPS ACTIVE & TELEMETRY LIVE',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                color: AppColors.dutyOnline,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Text(
                        'ETA: ~8 mins',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),

                  // Route Progress representation
                  Row(
                    children: [
                      Column(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(6),
                            decoration: const BoxDecoration(
                              color: AppColors.primaryMaroon,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.store, size: 16, color: Colors.white),
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'Hub',
                            style: TextStyle(fontSize: 10, color: Colors.white70, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                      Expanded(
                        child: Column(
                          children: [
                            Stack(
                              alignment: Alignment.center,
                              children: [
                                Container(
                                  height: 4,
                                  color: Colors.white24,
                                ),
                                Container(
                                  height: 4,
                                  color: AppColors.dutyOnline,
                                  width: double.infinity,
                                ),
                                Container(
                                  padding: const EdgeInsets.all(6),
                                  decoration: const BoxDecoration(
                                    color: AppColors.dutyOnline,
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(Icons.two_wheeler_rounded, size: 16, color: Colors.white),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            const Text(
                              '1.4 km remaining',
                              style: TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.w700),
                            ),
                          ],
                        ),
                      ),
                      Column(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(6),
                            decoration: const BoxDecoration(
                              color: AppColors.dutyOnline,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.home_rounded, size: 16, color: Colors.white),
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'Drop',
                            style: TextStyle(fontSize: 10, color: Colors.white70, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ],
                  ),

                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Lat: ${locationProvider.latitude.toStringAsFixed(4)}, Lon: ${locationProvider.longitude.toStringAsFixed(4)}',
                        style: const TextStyle(fontSize: 11, color: Colors.white60),
                      ),
                      const Text(
                        'Speed: 24 km/h',
                        style: TextStyle(fontSize: 11, color: Colors.white60, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Customer Contact & Destination Card
            Container(
              padding: const EdgeInsets.all(16),
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
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'DELIVERY DESTINATION',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: AppColors.textSecondary,
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            order.customerName,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ],
                      ),
                      IconButton(
                        onPressed: () => _showCallCustomerDialog(context),
                        style: IconButton.styleFrom(
                          backgroundColor: AppColors.dutyOnlineBg,
                          foregroundColor: AppColors.dutyOnline,
                        ),
                        icon: const Icon(Icons.phone_rounded),
                        tooltip: 'Call Customer',
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  const Divider(color: AppColors.borderHairline, height: 1),
                  const SizedBox(height: 10),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.location_on_rounded, size: 20, color: AppColors.primaryMaroon),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          order.customerAddress,
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppColors.textPrimary,
                            height: 1.35,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    height: 42,
                    child: OutlinedButton.icon(
                      onPressed: () => _openGoogleMapsNavigation(context),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: AppColors.dutyOnline, width: 1.5),
                        foregroundColor: AppColors.dutyOnline,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      icon: const Icon(Icons.navigation_rounded, size: 18),
                      label: const Text(
                        'Start Turn-by-Turn GPS Navigation',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceSubtle,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.info_outline, size: 16, color: AppColors.deliveryAmber),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Instructions: Handle fresh meat packet upright. Ring doorbell.',
                            style: TextStyle(
                              fontSize: 12,
                              color: AppColors.textSecondary,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Freshness Safety Card
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: AppDimensions.roundedLg,
                border: Border.all(color: AppColors.borderHairline),
              ),
              child: const Row(
                children: [
                  Icon(Icons.verified_user_rounded, color: AppColors.hygieneEmerald, size: 22),
                  SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      '100% Fresh butchery cuts guaranteed. Ensure delivery handover occurs promptly in insulated delivery box.',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                        height: 1.35,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Arrived at Doorstep Action
            SizedBox(
              height: 52,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => DoorstepDeliveryScreen(order: order),
                    ),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.dutyOnline,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: AppDimensions.roundedLg,
                  ),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.pin_drop_rounded, size: 20),
                    SizedBox(width: 8),
                    Text(
                      'I Have Arrived at Doorstep',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
