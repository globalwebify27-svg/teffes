import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../core/utils/currency_formatter.dart';
import '../../models/rider_order_model.dart';
import '../../providers/rider_orders_provider.dart';
import 'delivery_navigation_screen.dart';

class HubPickupScreen extends StatefulWidget {
  final RiderOrder order;

  const HubPickupScreen({super.key, required this.order});

  @override
  State<HubPickupScreen> createState() => _HubPickupScreenState();
}

class _HubPickupScreenState extends State<HubPickupScreen> {
  bool _bagChecked = true;
  bool _sealChecked = true;
  bool _gelPouchChecked = true;
  bool _isConfirming = false;

  Future<void> _handleConfirmPickup() async {
    setState(() => _isConfirming = true);
    final ordersProvider = context.read<RiderOrdersProvider>();
    final success = await ordersProvider.confirmPickup(widget.order.id);
    setState(() => _isConfirming = false);

    if (!mounted) return;

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Order Picked Up! Delivery OTP generated and shared with customer.'),
          backgroundColor: AppColors.dutyOnline,
          behavior: SnackBarBehavior.floating,
        ),
      );

      final updatedOrder = ordersProvider.activeOrder ?? widget.order;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => DeliveryNavigationScreen(order: updatedOrder),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(ordersProvider.errorMessage ?? 'Failed to confirm pickup'),
          backgroundColor: AppColors.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text(
          'Store Hub Pickup',
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
        ),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.textPrimary,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Store Hub Header Card
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
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppColors.primaryLight.withOpacity(0.5),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(
                          Icons.storefront_rounded,
                          color: AppColors.primaryMaroon,
                          size: 24,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              order.storeName,
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              order.storeAddress,
                              style: const TextStyle(
                                fontSize: 13,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceSubtle,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text(
                          'Bay #02',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: AppColors.primaryMaroon,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  const Divider(color: AppColors.borderHairline, height: 1),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Order #${order.orderNumber}',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.deliveryAmberBg,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text(
                          'READY FOR PICKUP',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: AppColors.deliveryAmber,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Packing Items List
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
                  const Text(
                    'Order Package Contents',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 12),
                  ...order.items.map((item) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Row(
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: const BoxDecoration(
                                color: AppColors.primaryMaroon,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item.name,
                                    style: const TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.textPrimary,
                                    ),
                                  ),
                                  if (item.unit.isNotEmpty)
                                    Text(
                                      item.unit,
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: AppColors.textSecondary,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                            Text(
                              'x${item.quantity}',
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            const SizedBox(width: 16),
                            Text(
                              CurrencyFormatter.format(item.price * item.quantity),
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      )),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Cold-Chain Handover Checklist
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
                  const Text(
                    'Handover Checklist',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Verify package integrity before departing the store hub',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 12),
                  CheckboxListTile(
                    value: _bagChecked,
                    onChanged: (val) => setState(() => _bagChecked = val ?? false),
                    title: const Text(
                      'Placed in insulated delivery bag',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    activeColor: AppColors.primaryMaroon,
                  ),
                  CheckboxListTile(
                    value: _gelPouchChecked,
                    onChanged: (val) => setState(() => _gelPouchChecked = val ?? false),
                    title: const Text(
                      'Fresh-lock thermal packs intact',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    activeColor: AppColors.primaryMaroon,
                  ),
                  CheckboxListTile(
                    value: _sealChecked,
                    onChanged: (val) => setState(() => _sealChecked = val ?? false),
                    title: const Text(
                      'TeFFe tamper-evident seal is undamaged',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    activeColor: AppColors.primaryMaroon,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Confirm Pickup Action
            SizedBox(
              height: 52,
              child: ElevatedButton(
                onPressed: (_bagChecked && _sealChecked && _gelPouchChecked && !_isConfirming)
                    ? _handleConfirmPickup
                    : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primaryMaroon,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: AppDimensions.roundedLg,
                  ),
                ),
                child: _isConfirming
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.5,
                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      )
                    : const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.check_circle_outline_rounded, size: 20),
                          SizedBox(width: 8),
                          Text(
                            'Confirm Pickup & Start Delivery',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
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
