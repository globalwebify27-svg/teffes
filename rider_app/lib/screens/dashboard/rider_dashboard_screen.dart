import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../core/utils/currency_formatter.dart';
import '../../providers/rider_auth_provider.dart';
import '../../providers/rider_orders_provider.dart';
import '../orders/hub_pickup_screen.dart';
import '../orders/delivery_navigation_screen.dart';
import '../orders/doorstep_delivery_screen.dart';
import '../notifications/notifications_screen.dart';
import '../support/support_screen.dart';
import 'new_order_alert_sheet.dart';

class RiderDashboardScreen extends StatefulWidget {
  const RiderDashboardScreen({super.key});

  @override
  State<RiderDashboardScreen> createState() => _RiderDashboardScreenState();
}

class _RiderDashboardScreenState extends State<RiderDashboardScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<RiderOrdersProvider>().fetchDashboard();
    });
  }

  void _showSosDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: AppColors.error, size: 28),
            SizedBox(width: 8),
            Text('SOS Emergency Alert'),
          ],
        ),
        content: const Text(
          'Do you need immediate emergency assistance? This will notify Ranchi Dark Store Dispatch Manager and Emergency Services (112) with your live GPS location.',
          style: TextStyle(fontSize: 13, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('SOS Alert sent to Ranchi Dispatch & Police Services.'),
                  backgroundColor: AppColors.error,
                ),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
            ),
            child: const Text('Trigger SOS'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<RiderAuthProvider>();
    final orders = context.watch<RiderOrdersProvider>();
    final rider = auth.rider;
    final isOnline = auth.isDutyOnline;
    final activeOrder = orders.activeOrder;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.primaryMaroon,
          onRefresh: () => orders.fetchDashboard(),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Top App Bar Row
                Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: AppColors.primaryLight.withOpacity(0.6),
                        shape: BoxShape.circle,
                        border: Border.all(color: AppColors.primaryMaroon.withOpacity(0.2)),
                      ),
                      child: const Center(
                        child: Icon(Icons.person, color: AppColors.primaryMaroon, size: 24),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                rider?.name ?? 'Ravi Kumar',
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: AppColors.surfaceSubtle,
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  rider?.vehicleNumber ?? 'JH01-EC-4821',
                                  style: const TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Row(
                            children: [
                              const Icon(Icons.storefront_rounded, size: 13, color: AppColors.textMuted),
                              const SizedBox(width: 4),
                              Text(
                                rider?.assignedStore ?? 'Ranchi Central Hub (S001)',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textSecondary,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    // SOS Button
                    IconButton(
                      onPressed: () => _showSosDialog(context),
                      style: IconButton.styleFrom(
                        backgroundColor: AppColors.dutyOfflineBg,
                        foregroundColor: AppColors.error,
                      ),
                      icon: const Icon(Icons.sos_rounded, size: 22),
                      tooltip: 'Emergency SOS',
                    ),
                    const SizedBox(width: 6),
                    // Notification Button
                    IconButton(
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const NotificationsScreen()),
                        );
                      },
                      style: IconButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: AppColors.textPrimary,
                      ),
                      icon: const Icon(Icons.notifications_none_rounded, size: 22),
                      tooltip: 'Notifications',
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                // Duty Toggle Card
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: AppDimensions.roundedLg,
                    border: Border.all(
                      color: isOnline ? AppColors.dutyOnline : AppColors.borderHairline,
                      width: isOnline ? 1.8 : 1.0,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: isOnline
                            ? AppColors.dutyOnline.withOpacity(0.08)
                            : Colors.black.withOpacity(0.03),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: isOnline ? AppColors.dutyOnlineBg : AppColors.dutyOfflineBg,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          isOnline ? Icons.power_settings_new_rounded : Icons.pause_circle_outline_rounded,
                          color: isOnline ? AppColors.dutyOnline : AppColors.dutyOffline,
                          size: 26,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              isOnline ? 'You are ONLINE' : 'You are OFFLINE',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: isOnline ? AppColors.dutyOnline : AppColors.textSecondary,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              isOnline
                                  ? 'Receiving meat delivery assignments'
                                  : 'Turn online to receive delivery requests',
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Switch.adaptive(
                        value: isOnline,
                        activeColor: AppColors.dutyOnline,
                        onChanged: (val) async {
                          await auth.toggleDuty();
                          if (mounted) {
                            orders.fetchDashboard();
                          }
                        },
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Active Delivery Card (if rider has an ongoing order)
                if (activeOrder != null) ...[
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: AppDimensions.roundedLg,
                      border: Border.all(color: AppColors.deliveryAmber, width: 1.5),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.deliveryAmber.withOpacity(0.1),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: AppColors.deliveryAmberBg,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.delivery_dining_rounded, size: 16, color: AppColors.deliveryAmber),
                                  const SizedBox(width: 4),
                                  Text(
                                    'ACTIVE DELIVERY #${activeOrder.orderNumber}',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w800,
                                      color: AppColors.deliveryAmber,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Text(
                              CurrencyFormatter.format(activeOrder.riderEarning),
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w900,
                                color: AppColors.dutyOnline,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(
                          activeOrder.customerName,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          activeOrder.customerAddress,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppColors.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 14),
                        SizedBox(
                          width: double.infinity,
                          height: 46,
                          child: ElevatedButton(
                            onPressed: () {
                              final st = activeOrder.status.toUpperCase();
                              if (st == 'CONFIRMED' || st == 'PACKED' || st == 'ACCEPTED') {
                                Navigator.of(context).push(
                                  MaterialPageRoute(builder: (_) => HubPickupScreen(order: activeOrder)),
                                );
                              } else if (st == 'OUT_FOR_DELIVERY' || st == 'PICKED_UP') {
                                Navigator.of(context).push(
                                  MaterialPageRoute(builder: (_) => DeliveryNavigationScreen(order: activeOrder)),
                                );
                              } else {
                                Navigator.of(context).push(
                                  MaterialPageRoute(builder: (_) => DoorstepDeliveryScreen(order: activeOrder)),
                                );
                              }
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primaryMaroon,
                              foregroundColor: Colors.white,
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: AppDimensions.roundedMd,
                              ),
                            ),
                            child: Text(
                              (activeOrder.status.toUpperCase() == 'CONFIRMED' ||
                                      activeOrder.status.toUpperCase() == 'PACKED' ||
                                      activeOrder.status.toUpperCase() == 'ACCEPTED')
                                  ? 'Proceed to Hub Pickup'
                                  : 'Resume Navigation & Handover',
                              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ] else if (isOnline) ...[
                  // Radar Searching Animation when online with no active order
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: AppDimensions.roundedLg,
                      border: Border.all(color: AppColors.borderHairline),
                    ),
                    child: Column(
                      children: [
                        Container(
                          width: 60,
                          height: 60,
                          decoration: BoxDecoration(
                            color: AppColors.dutyOnlineBg,
                            shape: BoxShape.circle,
                            border: Border.all(color: AppColors.dutyOnline.withOpacity(0.3)),
                          ),
                          child: const Center(
                            child: Icon(Icons.radar_rounded, size: 32, color: AppColors.dutyOnline),
                          ),
                        ),
                        const SizedBox(height: 14),
                        const Text(
                          'Radar Active & Scanning',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Waiting for new meat orders from Ranchi dark store...',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 13,
                            color: AppColors.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 12),
                        // Refresh / Check Available Orders button
                        OutlinedButton.icon(
                          onPressed: () async {
                            await orders.fetchDashboard();
                            if (orders.availableOrders.isNotEmpty && context.mounted) {
                              NewOrderAlertSheet.show(context, orders.availableOrders.first);
                            }
                          },
                          icon: const Icon(Icons.sync_rounded, size: 16, color: AppColors.primaryMaroon),
                          label: const Text(
                            'Check New Assignments',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.primaryMaroon),
                          ),
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: AppColors.primaryMaroon),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                // Today's Performance Metrics
                const Text(
                  "Today's Overview",
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: _buildMetricTile(
                        icon: Icons.account_balance_wallet_rounded,
                        iconColor: AppColors.dutyOnline,
                        label: "Today's Pay",
                        value: CurrencyFormatter.format(orders.todayEarnings),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _buildMetricTile(
                        icon: Icons.check_circle_rounded,
                        iconColor: AppColors.primaryMaroon,
                        label: 'Completed',
                        value: '${orders.todayDeliveriesCount}',
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _buildMetricTile(
                        icon: Icons.payments_rounded,
                        iconColor: AppColors.deliveryAmber,
                        label: 'COD Cash',
                        value: CurrencyFormatter.format(orders.cashInHand),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                // Available / Waiting Orders Section
                if (orders.availableOrders.isNotEmpty) ...[
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Orders Awaiting Rider',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      Text(
                        '${orders.availableOrders.length} available',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primaryMaroon,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  ...orders.availableOrders.map((ord) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: InkWell(
                          onTap: () => NewOrderAlertSheet.show(context, ord),
                          borderRadius: AppDimensions.roundedLg,
                          child: Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: AppDimensions.roundedLg,
                              border: Border.all(color: AppColors.borderHairline),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: AppColors.primaryLight.withOpacity(0.5),
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(Icons.moped_rounded, color: AppColors.primaryMaroon, size: 22),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'Order #${ord.orderNumber}',
                                        style: const TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w800,
                                          color: AppColors.textPrimary,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        '${ord.customerName} • ${ord.customerAddress}',
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          fontSize: 12,
                                          color: AppColors.textSecondary,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      CurrencyFormatter.format(ord.riderEarning),
                                      style: const TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.w900,
                                        color: AppColors.dutyOnline,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    const Text(
                                      'Tap to Accept',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.primaryMaroon,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                      )),
                  const SizedBox(height: 16),
                ],

                // Quick Support Tile
                InkWell(
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const SupportScreen()),
                    );
                  },
                  borderRadius: AppDimensions.roundedMd,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceSubtle,
                      borderRadius: AppDimensions.roundedMd,
                      border: Border.all(color: AppColors.borderHairline),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.headset_mic_rounded, color: AppColors.primaryMaroon, size: 20),
                        SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'Need Help? Contact Ranchi Hub Dispatch Support',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),
                        Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppColors.textMuted),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildMetricTile({
    required IconData icon,
    required Color iconColor,
    required String label,
    required String value,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: AppDimensions.roundedMd,
        border: Border.all(color: AppColors.borderHairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: iconColor, size: 20),
          const SizedBox(height: 10),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}
