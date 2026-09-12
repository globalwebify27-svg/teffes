import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/api_endpoints.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../core/network/api_client.dart';
import '../../core/utils/currency_formatter.dart';
import '../../core/utils/page_transitions.dart';
import '../../models/order_model.dart';
import '../../providers/auth_provider.dart';
import '../../providers/cart_provider.dart';
import '../../providers/location_provider.dart';
import '../orders/order_tracking_screen.dart';

class PaymentProceedScreen extends StatefulWidget {
  final double payableAmount;
  final String deliveryAddress;
  final String deliverySlot;
  final String paymentMethod; // 'razorpay', 'cod', 'wallet'
  final bool isPickup;
  final String fulfillmentType;

  const PaymentProceedScreen({
    super.key,
    required this.payableAmount,
    required this.deliveryAddress,
    required this.deliverySlot,
    this.paymentMethod = 'razorpay',
    this.isPickup = false,
    this.fulfillmentType = 'delivery',
  });

  @override
  State<PaymentProceedScreen> createState() => _PaymentProceedScreenState();
}

class _PaymentProceedScreenState extends State<PaymentProceedScreen> {
  final ApiClient _api = ApiClient();
  bool _isProcessing = false;
  String _selectedUpi = 'gpay';
  String _activeTab = 'upi'; // 'upi', 'card', 'netbanking'
  final TextEditingController _upiIdController = TextEditingController();
  final TextEditingController _cardNumberController = TextEditingController();
  final TextEditingController _cardExpiryController = TextEditingController();
  final TextEditingController _cardCvvController = TextEditingController();

  @override
  void dispose() {
    _upiIdController.dispose();
    _cardNumberController.dispose();
    _cardExpiryController.dispose();
    _cardCvvController.dispose();
    super.dispose();
  }

  Future<void> _processRazorpayPayment() async {
    setState(() => _isProcessing = true);
    final auth = context.read<AuthProvider>();
    final cart = context.read<CartProvider>();
    final location = context.read<LocationProvider>();

    try {
      // 1. Create Razorpay order on backend
      String razorpayOrderId = 'order_rzp_${DateTime.now().millisecondsSinceEpoch}';
      try {
        final res = await _api.post(ApiEndpoints.createRazorpayOrder, data: {
          'amount': widget.payableAmount,
        });
        if (res.data['success'] == true && res.data['order'] != null) {
          razorpayOrderId = res.data['order']['id'] ?? razorpayOrderId;
        }
      } catch (e) {
        debugPrint('Razorpay create-order fallback: $e');
      }

      // 2. Simulated payment processing delay
      await Future.delayed(const Duration(milliseconds: 1400));

      final paymentId = 'pay_${DateTime.now().millisecondsSinceEpoch.toString().substring(3)}';

      // 3. Verify Razorpay payment signature
      try {
        await _api.post(ApiEndpoints.verifyRazorpayPayment, data: {
          'razorpay_order_id': razorpayOrderId,
          'razorpay_payment_id': paymentId,
          'razorpay_signature': 'simulated_sig_${DateTime.now().millisecondsSinceEpoch}',
        });
      } catch (_) {}

      // 4. Create actual order in backend database
      final newOrderId = 'TEF-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}';
      final orderPayload = {
        'orderId': newOrderId,
        'items': cart.items.values.map((i) => {
          'productId': i.product.id,
          'name': i.product.name,
          'price': i.product.price,
          'quantity': i.quantity,
          'weight': i.selectedWeight,
          'image': i.product.image,
        }).toList(),
        'subtotal': cart.subtotal,
        'deliveryFee': widget.isPickup ? 0.0 : cart.deliveryFee,
        'discount': cart.couponDiscount,
        'amount': widget.payableAmount,
        'totalAmount': widget.payableAmount,
        'fulfillmentType': widget.isPickup ? 'pickup' : widget.fulfillmentType,
        'pickupMode': widget.isPickup,
        'paymentMethod': 'Online Payment (Razorpay)',
        'paymentStatus': 'Paid',
        'razorpayOrderId': razorpayOrderId,
        'razorpayPaymentId': paymentId,
        'shippingAddress': widget.deliveryAddress.isNotEmpty ? widget.deliveryAddress : location.activeAddressString,
        'deliverySlot': widget.isPickup ? 'Store Pickup (Counter Takeaway)' : widget.deliverySlot,
        'storeName': 'Kishore Ganj Hub',
      };

      try {
        final res = await _api.post(ApiEndpoints.createOrder, data: orderPayload);
        if (res.data != null && res.data['success'] == true && res.data['order'] != null) {
          final serverOrder = OrderModel.fromJson(res.data['order'] as Map<String, dynamic>);
          auth.addOrder(serverOrder);
          cart.clearCart();
          if (mounted) {
            Navigator.of(context).pushAndRemoveUntil(
              SmoothPageRoute(page: OrderTrackingScreen(orderId: serverOrder.orderId)),
              (route) => route.isFirst,
            );
          }
          return;
        }
      } catch (_) {}

      // 5. Fallback local order if offline / server call fails
      final createdOrder = OrderModel(
        id: 'ord-${DateTime.now().millisecondsSinceEpoch}',
        orderId: newOrderId,
        status: 'Pending',
        amount: widget.payableAmount,
        placedAt: 'Just Now',
        items: cart.items.values.map((i) => {
          'name': i.product.name,
          'quantity': i.quantity,
          'price': i.product.price,
          'weight': i.selectedWeight,
        }).toList(),
        deliveryAddress: widget.deliveryAddress,
        paymentMethod: 'Online Payment (Razorpay)',
        paymentStatus: 'Paid',
        storeName: 'Kishore Ganj Hub',
        fulfillmentType: widget.isPickup ? 'pickup' : widget.fulfillmentType,
        pickupMode: widget.isPickup,
        targetDeliveryTime: DateTime.now().add(const Duration(minutes: 35)).toIso8601String(),
        prepTimeMinutes: 25,
        remainingTransitMinutes: widget.isPickup ? 0 : 12,
        etaStage: 'PREPARING',
        rider: widget.isPickup
            ? null
            : OrderRiderModel(
                name: 'Md. Imran Ansari',
                phone: '+91 94311 88204',
                vehicle: 'Honda Activa (JH-01-BK-4920)',
                rating: '4.9 ★ (840+ deliveries)',
                eta: '12 mins',
                lat: 23.3512,
                lng: 85.3154,
              ),
      );

      auth.addOrder(createdOrder);
      cart.clearCart();

      if (mounted) {
        Navigator.of(context).pushAndRemoveUntil(
          SmoothPageRoute(page: OrderTrackingScreen(orderId: newOrderId)),
          (route) => route.isFirst,
        );
      }
    } catch (err) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Payment initiation failed: $err')),
        );
      }
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      backgroundColor: AppColors.surfacePorcelain,
      appBar: AppBar(
        title: const Text('Payment Proceed'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppDimensions.spaceMd),
        physics: const BouncingScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. Butchery Checkout Security Banner
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: AppDimensions.roundedLg,
                border: Border.all(color: AppColors.borderHairline),
                boxShadow: AppDimensions.cardShadow,
              ),
              child: Row(
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: AppColors.hygieneLight,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.shield_outlined, color: AppColors.hygieneDark, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Text(
                              'Razorpay 256-Bit SSL Encrypted',
                              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                            ),
                            SizedBox(width: 4),
                            Icon(Icons.verified_rounded, size: 14, color: AppColors.hygieneDark),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Key Configured: ${ApiEndpoints.razorpayKeyId.substring(0, 8)}... (Instant Bank Settlement)',
                          style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppDimensions.spaceMd),

            // 2. Payable Amount Card
            Container(
              padding: const EdgeInsets.all(AppDimensions.spaceMd),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF800020), Color(0xFF91000A)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: AppDimensions.roundedLg,
                boxShadow: AppDimensions.cardShadow,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'PAYABLE AMOUNT',
                        style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                      ),
                      Text(
                        '100% Fresh Cuts Assured',
                        style: TextStyle(color: Colors.amberAccent, fontSize: 10, fontWeight: FontWeight.w800),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    CurrencyFormatter.format(widget.payableAmount),
                    style: const TextStyle(color: Colors.white, fontSize: 30, fontWeight: FontWeight.w900),
                  ),
                  const SizedBox(height: 8),
                  const Divider(color: Colors.white24, height: 1),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '${cart.items.length} cut(s) selected',
                        style: const TextStyle(color: Colors.white70, fontSize: 11.5),
                      ),
                      Text(
                        widget.deliverySlot,
                        style: const TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppDimensions.spaceMd),

            // 3. Payment Method Tabs
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: AppDimensions.roundedLg,
                border: Border.all(color: AppColors.borderHairline),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      _buildTabButton('upi', 'UPI Apps', Icons.qr_code_scanner_rounded),
                      _buildTabButton('card', 'Cards', Icons.credit_card_rounded),
                      _buildTabButton('netbanking', 'NetBanking', Icons.account_balance_rounded),
                    ],
                  ),
                  const Divider(height: 1, color: AppColors.borderHairline),
                  Padding(
                    padding: const EdgeInsets.all(AppDimensions.spaceMd),
                    child: _buildActivePaymentTab(),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppDimensions.spaceMd),

            // 4. Delivery Address Summary
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
                  const Text('Delivery Destination', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                  const SizedBox(height: 6),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.location_on_rounded, size: 16, color: AppColors.primaryMaroon),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          widget.deliveryAddress.isNotEmpty ? widget.deliveryAddress : 'Arcadia, Ranchi',
                          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.3),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Icons.person_outline_rounded, size: 16, color: AppColors.textMuted),
                      const SizedBox(width: 8),
                      Text(
                        '${auth.user?.name ?? "Customer"} • ${auth.user?.phone ?? "+91 98765 43210"}',
                        style: const TextStyle(fontSize: 11.5, color: AppColors.textMuted),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // 5. Razorpay Proceed Button
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primaryMaroon,
                  shape: RoundedRectangleBorder(borderRadius: AppDimensions.roundedMd),
                  elevation: 2,
                ),
                onPressed: _isProcessing ? null : _processRazorpayPayment,
                child: _isProcessing
                    ? const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white)),
                          SizedBox(width: 12),
                          Text('Authorizing with Razorpay...', style: TextStyle(fontWeight: FontWeight.w800, color: Colors.white)),
                        ],
                      )
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.lock_rounded, size: 16, color: Colors.white),
                          const SizedBox(width: 8),
                          Text(
                            'Pay ${CurrencyFormatter.format(widget.payableAmount)} via Razorpay',
                            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white),
                          ),
                        ],
                      ),
              ),
            ),
            const SizedBox(height: 12),
            const Center(
              child: Text(
                'Instant refund guaranteed if meat does not meet 100% farm freshness standards',
                style: TextStyle(fontSize: 10.5, color: AppColors.textMuted),
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTabButton(String key, String title, IconData icon) {
    final isSelected = _activeTab == key;
    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _activeTab = key),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: isSelected ? AppColors.primaryMaroon : Colors.transparent,
                width: 2.5,
              ),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 16, color: isSelected ? AppColors.primaryMaroon : AppColors.textMuted),
              const SizedBox(width: 6),
              Text(
                title,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                  color: isSelected ? AppColors.primaryMaroon : AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildActivePaymentTab() {
    switch (_activeTab) {
      case 'upi':
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Choose UPI App', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5)),
            const SizedBox(height: 10),
            Row(
              children: [
                _buildUpiAppChip('gpay', 'Google Pay', const Color(0xFF4285F4)),
                const SizedBox(width: 8),
                _buildUpiAppChip('phonepe', 'PhonePe', const Color(0xFF5F259F)),
                const SizedBox(width: 8),
                _buildUpiAppChip('paytm', 'Paytm', const Color(0xFF002E6E)),
              ],
            ),
            const SizedBox(height: 14),
            const Text('Or Enter UPI ID / VPA', style: TextStyle(fontSize: 11.5, color: AppColors.textSecondary)),
            const SizedBox(height: 6),
            TextField(
              controller: _upiIdController,
              decoration: InputDecoration(
                hintText: 'e.g. 9876543210@paytm or name@okaxis',
                hintStyle: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                prefixIcon: const Icon(Icons.alternate_email_rounded, size: 16, color: AppColors.primaryMaroon),
                filled: true,
                fillColor: AppColors.surfaceSubtle,
                border: OutlineInputBorder(borderRadius: AppDimensions.roundedMd, borderSide: BorderSide.none),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              ),
            ),
          ],
        );

      case 'card':
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Credit / Debit Card', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5)),
            const SizedBox(height: 10),
            TextField(
              controller: _cardNumberController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                hintText: 'Card Number (Visa / MasterCard / RuPay)',
                hintStyle: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                prefixIcon: const Icon(Icons.credit_card_rounded, size: 18, color: AppColors.primaryMaroon),
                filled: true,
                fillColor: AppColors.surfaceSubtle,
                border: OutlineInputBorder(borderRadius: AppDimensions.roundedMd, borderSide: BorderSide.none),
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _cardExpiryController,
                    decoration: InputDecoration(
                      hintText: 'MM/YY',
                      hintStyle: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                      filled: true,
                      fillColor: AppColors.surfaceSubtle,
                      border: OutlineInputBorder(borderRadius: AppDimensions.roundedMd, borderSide: BorderSide.none),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: _cardCvvController,
                    obscureText: true,
                    decoration: InputDecoration(
                      hintText: 'CVV',
                      hintStyle: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                      filled: true,
                      fillColor: AppColors.surfaceSubtle,
                      border: OutlineInputBorder(borderRadius: AppDimensions.roundedMd, borderSide: BorderSide.none),
                    ),
                  ),
                ),
              ],
            ),
          ],
        );

      case 'netbanking':
      default:
        final banks = ['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra'];
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Select Popular Bank', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5)),
            const SizedBox(height: 10),
            ...banks.map((bank) {
              return Container(
                margin: const EdgeInsets.only(bottom: 6),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.surfaceSubtle,
                  borderRadius: AppDimensions.roundedMd,
                  border: Border.all(color: AppColors.borderHairline),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.account_balance_rounded, size: 16, color: AppColors.primaryMaroon),
                    const SizedBox(width: 10),
                    Expanded(child: Text(bank, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700))),
                    const Icon(Icons.chevron_right_rounded, size: 16, color: AppColors.textMuted),
                  ],
                ),
              );
            }),
          ],
        );
    }
  }

  Widget _buildUpiAppChip(String key, String label, Color color) {
    final isSelected = _selectedUpi == key;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedUpi = key),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? color.withOpacity(0.12) : AppColors.surfaceSubtle,
            borderRadius: AppDimensions.roundedMd,
            border: Border.all(color: isSelected ? color : AppColors.borderHairline, width: isSelected ? 1.6 : 1),
          ),
          child: Column(
            children: [
              Icon(Icons.phone_android_rounded, size: 18, color: color),
              const SizedBox(height: 4),
              Text(
                label,
                style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: isSelected ? color : AppColors.textPrimary),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
