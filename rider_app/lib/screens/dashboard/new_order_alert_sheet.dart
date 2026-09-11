import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../core/utils/currency_formatter.dart';
import '../../models/rider_order_model.dart';
import '../../providers/rider_orders_provider.dart';
import '../orders/hub_pickup_screen.dart';

class NewOrderAlertSheet extends StatefulWidget {
  final RiderOrder order;

  const NewOrderAlertSheet({super.key, required this.order});

  static Future<void> show(BuildContext context, RiderOrder order) {
    return showModalBottomSheet(
      context: context,
      isDismissible: false,
      enableDrag: false,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => NewOrderAlertSheet(order: order),
    );
  }

  @override
  State<NewOrderAlertSheet> createState() => _NewOrderAlertSheetState();
}

class _NewOrderAlertSheetState extends State<NewOrderAlertSheet> {
  int _countdownSeconds = 45;
  Timer? _timer;
  bool _isProcessing = false;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  void _startTimer() {
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_countdownSeconds <= 1) {
        timer.cancel();
        if (mounted) {
          Navigator.of(context).pop();
        }
      } else {
        if (mounted) {
          setState(() => _countdownSeconds--);
        }
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _handleAccept() async {
    setState(() => _isProcessing = true);
    final ordersProvider = context.read<RiderOrdersProvider>();
    final success = await ordersProvider.acceptOrder(widget.order.id);
    setState(() => _isProcessing = false);

    if (!mounted) return;

    if (success) {
      Navigator.of(context).pop(); // dismiss sheet
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => HubPickupScreen(order: ordersProvider.activeOrder ?? widget.order),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(ordersProvider.errorMessage ?? 'Failed to accept order'),
          backgroundColor: AppColors.error,
        ),
      );
    }
  }

  Future<void> _handleReject() async {
    setState(() => _isProcessing = true);
    final ordersProvider = context.read<RiderOrdersProvider>();
    await ordersProvider.rejectOrder(widget.order.id);
    if (!mounted) return;
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header with Alert pulse & countdown
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.dutyOnlineBg,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.dutyOnline.withOpacity(0.3)),
                  ),
                  child: const Icon(
                    Icons.notifications_active_rounded,
                    color: AppColors.dutyOnline,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'New Delivery Assigned!',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      Text(
                        'Order #${order.orderNumber}',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.deliveryAmberBg,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.timer_outlined, size: 14, color: AppColors.deliveryAmber),
                      const SizedBox(width: 4),
                      Text(
                        '${_countdownSeconds}s',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: AppColors.deliveryAmber,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Divider(color: AppColors.borderHairline, height: 1),
            const SizedBox(height: 16),

            // Payout Highlight Card
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.surfacePorcelain,
                borderRadius: AppDimensions.roundedMd,
                border: Border.all(color: AppColors.borderHairline),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Estimated Earning',
                        style: TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        CurrencyFormatter.format(order.riderEarning),
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                          color: AppColors.dutyOnline,
                        ),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.borderHairline),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.route_outlined, size: 16, color: AppColors.textSecondary),
                        const SizedBox(width: 4),
                        const Text(
                          '~3.2 km total',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Route points: Store Hub -> Customer Address
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Column(
                  children: [
                    const Icon(Icons.circle, size: 12, color: AppColors.primaryMaroon),
                    Container(width: 2, height: 36, color: AppColors.borderHairline),
                    const Icon(Icons.location_on, size: 14, color: AppColors.dutyOnline),
                  ],
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        order.storeName,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      Text(
                        order.storeAddress,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 18),
                      Text(
                        order.customerName,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      Text(
                        order.customerAddress,
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
              ],
            ),
            const SizedBox(height: 16),

            // Items and Payment Badge
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceSubtle,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    '${order.items.length} Meat Item${order.items.length > 1 ? 's' : ''}',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: order.isCod ? AppColors.deliveryAmberBg : AppColors.dutyOnlineBg,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    order.isCod ? 'Cash on Delivery (${CurrencyFormatter.format(order.totalAmount)})' : 'Prepaid Online',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: order.isCod ? AppColors.deliveryAmber : AppColors.dutyOnline,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Action Buttons: Accept / Reject
            Row(
              children: [
                Expanded(
                  flex: 2,
                  child: SizedBox(
                    height: 50,
                    child: OutlinedButton(
                      onPressed: _isProcessing ? null : _handleReject,
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: AppColors.borderSubtle),
                        shape: RoundedRectangleBorder(
                          borderRadius: AppDimensions.roundedMd,
                        ),
                      ),
                      child: const Text(
                        'Decline',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 3,
                  child: SizedBox(
                    height: 50,
                    child: ElevatedButton(
                      onPressed: _isProcessing ? null : _handleAccept,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.dutyOnline,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: AppDimensions.roundedMd,
                        ),
                      ),
                      child: _isProcessing
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                              ),
                            )
                          : const Text(
                              'Accept Delivery',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
