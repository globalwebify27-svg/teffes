import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/api_endpoints.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../core/network/api_client.dart';
import '../../core/utils/currency_formatter.dart';
import '../../core/utils/page_transitions.dart';
import '../../providers/cart_provider.dart';
import '../../providers/location_provider.dart';
import '../../widgets/common/quantity_stepper.dart';
import '../orders/order_tracking_screen.dart';

import '../checkout/payment_proceed_screen.dart';
import '../../providers/auth_provider.dart';
import '../../models/order_model.dart';

class CartCheckoutScreen extends StatefulWidget {
  const CartCheckoutScreen({super.key});

  @override
  State<CartCheckoutScreen> createState() => _CartCheckoutScreenState();
}

class _CartCheckoutScreenState extends State<CartCheckoutScreen> {
  final TextEditingController _couponController = TextEditingController();
  String _fulfillmentType = 'delivery'; // 'delivery' or 'pickup'
  String _selectedPaymentMethod = 'razorpay'; // 'razorpay', 'cod', 'wallet'
  String _selectedSlot = '90 Mins Express Delivery';
  bool _isPlacingOrder = false;

  @override
  void dispose() {
    _couponController.dispose();
    super.dispose();
  }

  void _showAddressPicker(BuildContext context, LocationProvider location) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Container(
          padding: const EdgeInsets.all(AppDimensions.spaceMd),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Select Delivery Address', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                  IconButton(
                    icon: const Icon(Icons.close_rounded),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              ...location.savedAddresses.map((addr) {
                final isSelected = location.selectedAddress?.id == addr.id;
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(
                    addr.tag.toLowerCase() == 'home' ? Icons.home_rounded : Icons.business_rounded,
                    color: isSelected ? AppColors.primaryMaroon : AppColors.textSecondary,
                  ),
                  title: Text(addr.tag, style: TextStyle(fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600)),
                  subtitle: Text(addr.fullAddress, style: const TextStyle(fontSize: 11.5)),
                  trailing: isSelected ? const Icon(Icons.check_circle_rounded, color: AppColors.primaryMaroon) : null,
                  onTap: () {
                    location.selectAddress(addr);
                    Navigator.pop(ctx);
                  },
                );
              }),
            ],
          ),
        );
      },
    );
  }

  Future<void> _handlePlaceOrder(CartProvider cart, LocationProvider location, AuthProvider auth) async {
    final isPickup = _fulfillmentType == 'pickup';
    final effectiveDeliveryFee = isPickup ? 0.0 : cart.deliveryFee;
    final effectiveGrandTotal = (cart.subtotal + effectiveDeliveryFee - cart.couponDiscount).clamp(0.0, double.infinity);

    // 1. If Razorpay is selected, navigate directly to dedicated Payment Proceed Screen
    if (_selectedPaymentMethod == 'razorpay') {
      Navigator.of(context).push(
        SmoothPageRoute(
          page: PaymentProceedScreen(
            payableAmount: effectiveGrandTotal,
            deliveryAddress: isPickup ? 'Store Pickup: Kishore Ganj Hub, Harmu Road, Ranchi' : location.activeAddressString,
            deliverySlot: isPickup ? 'Store Pickup (Counter Takeaway)' : _selectedSlot,
            paymentMethod: 'razorpay',
            isPickup: isPickup,
            fulfillmentType: _fulfillmentType,
          ),
        ),
      );
      return;
    }

    // 2. If Wallet is selected, verify sufficient balance
    if (_selectedPaymentMethod == 'wallet') {
      final userBalance = auth.user?.walletBalance ?? 0.0;
      if (userBalance < effectiveGrandTotal) {
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Insufficient Wallet Balance', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            content: Text(
              'Your Teffe\'s Cash balance is ${CurrencyFormatter.format(userBalance)}, but this order requires ${CurrencyFormatter.format(effectiveGrandTotal)}. Please choose Razorpay or Pay at Counter.',
              style: const TextStyle(fontSize: 13),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel'),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.primaryMaroon),
                onPressed: () {
                  Navigator.pop(ctx);
                  setState(() => _selectedPaymentMethod = 'razorpay');
                },
                child: const Text('Switch to Razorpay', style: TextStyle(color: Colors.white)),
              ),
            ],
          ),
        );
        return;
      }

      // Deduct wallet balance
      auth.deductWallet(effectiveGrandTotal);
    }

    setState(() => _isPlacingOrder = true);

    try {
      final orderId = 'TEF-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}';
      final payload = {
        'orderId': orderId,
        'items': cart.items.values.map((i) => {
          'productId': i.product.id,
          'name': i.product.name,
          'price': i.product.price,
          'quantity': i.quantity,
          'weight': i.selectedWeight,
          'image': i.product.image,
        }).toList(),
        'subtotal': cart.subtotal,
        'deliveryFee': effectiveDeliveryFee,
        'discount': cart.couponDiscount,
        'amount': effectiveGrandTotal,
        'totalAmount': effectiveGrandTotal,
        'fulfillmentType': _fulfillmentType,
        'pickupMode': isPickup,
        'paymentMethod': _selectedPaymentMethod == 'wallet'
            ? "Teffe's Cash Wallet"
            : isPickup
                ? 'Pay at Store Counter'
                : 'Cash on Delivery (COD)',
        'paymentStatus': _selectedPaymentMethod == 'wallet' ? 'Paid' : 'Pending',
        'shippingAddress': isPickup ? 'Store Pickup: Kishore Ganj Hub, Harmu Road, Ranchi' : location.activeAddressString,
        'deliverySlot': isPickup ? 'Store Pickup (Counter Takeaway)' : _selectedSlot,
        'storeName': 'Kishore Ganj Hub',
      };

      final api = ApiClient();
      try {
        final res = await api.post(ApiEndpoints.createOrder, data: payload);
        if (res.data != null && res.data['success'] == true && res.data['order'] != null) {
          final serverOrder = OrderModel.fromJson(res.data['order'] as Map<String, dynamic>);
          auth.addOrder(serverOrder);
          cart.clearCart();
          if (mounted) {
            Navigator.of(context).pushReplacement(
              SmoothPageRoute(page: OrderTrackingScreen(orderId: serverOrder.orderId)),
            );
          }
          return;
        }
      } catch (_) {}

      // Add to AuthProvider live orders list (fallback if offline)
      final createdOrder = OrderModel(
        id: 'ord-${DateTime.now().millisecondsSinceEpoch}',
        orderId: orderId,
        status: 'Pending',
        amount: effectiveGrandTotal,
        placedAt: 'Just Now',
        items: cart.items.values.map((i) => {
          'name': i.product.name,
          'quantity': i.quantity,
          'price': i.product.price,
          'weight': i.selectedWeight,
        }).toList(),
        deliveryAddress: isPickup ? 'Store Pickup: Kishore Ganj Hub, Ranchi' : location.activeAddressString,
        paymentMethod: _selectedPaymentMethod == 'wallet'
            ? "Teffe's Cash Wallet"
            : isPickup
                ? 'Pay at Store Counter'
                : 'Cash on Delivery (COD)',
        paymentStatus: _selectedPaymentMethod == 'wallet' ? 'Paid' : 'Pending',
        storeName: 'Kishore Ganj Hub',
        fulfillmentType: _fulfillmentType,
        pickupMode: isPickup,
        targetDeliveryTime: DateTime.now().add(const Duration(minutes: 35)).toIso8601String(),
        prepTimeMinutes: 25,
        remainingTransitMinutes: isPickup ? 0 : 12,
        etaStage: 'PREPARING',
        rider: isPickup
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
        Navigator.of(context).pushReplacement(
          SmoothPageRoute(page: OrderTrackingScreen(orderId: orderId)),
        );
      }
    } catch (e) {
      final fallbackId = 'TEF-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}';
      cart.clearCart();
      if (mounted) {
        Navigator.of(context).pushReplacement(
          SmoothPageRoute(page: OrderTrackingScreen(orderId: fallbackId)),
        );
      }
    } finally {
      if (mounted) setState(() => _isPlacingOrder = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    final location = context.watch<LocationProvider>();
    final auth = context.watch<AuthProvider>();
    final items = cart.items.values.toList();
    final isPickup = _fulfillmentType == 'pickup';
    final effectiveDeliveryFee = isPickup ? 0.0 : cart.deliveryFee;
    final effectiveGrandTotal = (cart.subtotal + effectiveDeliveryFee - cart.couponDiscount).clamp(0.0, double.infinity);

    return Scaffold(
      backgroundColor: AppColors.surfacePorcelain,
      appBar: AppBar(
        title: const Text('Cart & Checkout'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: items.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.shopping_basket_outlined, size: 64, color: Colors.grey.shade300),
                  const SizedBox(height: 12),
                  Text('Your Cart is Empty', style: Theme.of(context).textTheme.headlineSmall),
                  const SizedBox(height: 4),
                  Text('Explore tender, antibiotic-free cuts', style: Theme.of(context).textTheme.bodySmall),
                  const SizedBox(height: 20),
                  ElevatedButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Browse Cuts'),
                  ),
                ],
              ),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.only(bottom: 120),
              physics: const BouncingScrollPhysics(),
              child: Column(
                children: [
                  // 0. Fulfillment Type Switcher (Home Delivery vs Store Pickup)
                  Container(
                    margin: const EdgeInsets.fromLTRB(AppDimensions.spaceMd, AppDimensions.spaceSm, AppDimensions.spaceMd, 0),
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceSubtle,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.borderHairline),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: GestureDetector(
                            onTap: () => setState(() {
                              _fulfillmentType = 'delivery';
                              _selectedSlot = '90 Mins Express Delivery';
                            }),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 9),
                              decoration: BoxDecoration(
                                color: !isPickup ? Colors.white : Colors.transparent,
                                borderRadius: BorderRadius.circular(8),
                                boxShadow: !isPickup ? [const BoxShadow(color: Colors.black12, blurRadius: 4)] : null,
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.two_wheeler_rounded, size: 16, color: !isPickup ? AppColors.primaryMaroon : AppColors.textSecondary),
                                  const SizedBox(width: 6),
                                  Text(
                                    'Home Delivery',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: !isPickup ? FontWeight.w800 : FontWeight.w600,
                                      color: !isPickup ? AppColors.primaryMaroon : AppColors.textPrimary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                        Expanded(
                          child: GestureDetector(
                            onTap: () => setState(() {
                              _fulfillmentType = 'pickup';
                              _selectedSlot = 'Immediate Pickup (30 Mins)';
                            }),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 9),
                              decoration: BoxDecoration(
                                color: isPickup ? Colors.white : Colors.transparent,
                                borderRadius: BorderRadius.circular(8),
                                boxShadow: isPickup ? [const BoxShadow(color: Colors.black12, blurRadius: 4)] : null,
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.storefront_rounded, size: 16, color: isPickup ? AppColors.primaryMaroon : AppColors.textSecondary),
                                  const SizedBox(width: 6),
                                  Text(
                                    'Store Pickup (Free)',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: isPickup ? FontWeight.w800 : FontWeight.w600,
                                      color: isPickup ? AppColors.primaryMaroon : AppColors.textPrimary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  // 1. Address / Store Pickup Card
                  if (isPickup)
                    Container(
                      margin: const EdgeInsets.all(AppDimensions.spaceMd),
                      padding: const EdgeInsets.all(AppDimensions.spaceMd),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: AppDimensions.roundedLg,
                        border: Border.all(color: AppColors.borderHairline),
                        boxShadow: AppDimensions.cardShadow,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: AppColors.primaryLight,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Icon(Icons.storefront_rounded, color: AppColors.primaryMaroon, size: 20),
                              ),
                              const SizedBox(width: 10),
                              const Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('Kishore Ganj Artisanal Butchery Hub', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                                    SizedBox(height: 2),
                                    Text('Kishore Ganj Chowk, Harmu Road, Ranchi - 834001', style: TextStyle(fontSize: 11.5, color: AppColors.textSecondary)),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          const Divider(height: 1, color: AppColors.borderHairline),
                          const SizedBox(height: 8),
                          const Row(
                            children: [
                              Icon(Icons.timer_outlined, size: 14, color: AppColors.hygieneDark),
                              SizedBox(width: 6),
                              Text('Ready in 30 Mins • Free Fresh-Lock Insulated Bag', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.hygieneDark)),
                            ],
                          ),
                        ],
                      ),
                    )
                  else
                    Container(
                      margin: const EdgeInsets.all(AppDimensions.spaceMd),
                      padding: const EdgeInsets.all(AppDimensions.spaceMd),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: AppDimensions.roundedLg,
                        border: Border.all(color: AppColors.borderHairline),
                        boxShadow: AppDimensions.cardShadow,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(Icons.location_on_rounded, color: AppColors.primaryMaroon, size: 22),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(
                                          'Delivering to ${location.activeLabel}',
                                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                                        ),
                                        GestureDetector(
                                          onTap: () => _showAddressPicker(context, location),
                                          child: const Text(
                                            'CHANGE',
                                            style: TextStyle(
                                              color: AppColors.primaryMaroon,
                                              fontWeight: FontWeight.w800,
                                              fontSize: 11.5,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      location.activeAddressString,
                                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          const Divider(height: 1, color: AppColors.borderHairline),
                          const SizedBox(height: 8),
                          const Row(
                            children: [
                              Icon(Icons.bolt_rounded, size: 14, color: AppColors.deliveryAmber),
                              SizedBox(width: 4),
                              Text(
                                'Dispatched from Kishore Ganj Artisanal Butchery Hub',
                                style: TextStyle(
                                  color: AppColors.deliveryAmber,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),

                  // 1.1 Slot Selector (Pickup Slots vs Delivery Slots)
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: AppDimensions.spaceMd),
                    padding: const EdgeInsets.all(AppDimensions.spaceMd),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: AppDimensions.roundedLg,
                      border: Border.all(color: AppColors.borderHairline),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(isPickup ? 'Pickup Time Slot' : 'Delivery Slot', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: GestureDetector(
                                onTap: () => setState(() => _selectedSlot = isPickup ? 'Immediate Pickup (30 Mins)' : '90 Mins Express Delivery'),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
                                  decoration: BoxDecoration(
                                    color: (_selectedSlot.contains('30 Mins') || _selectedSlot.contains('Express')) ? AppColors.primaryLight.withOpacity(0.35) : AppColors.surfaceSubtle,
                                    borderRadius: AppDimensions.roundedMd,
                                    border: Border.all(
                                      color: (_selectedSlot.contains('30 Mins') || _selectedSlot.contains('Express')) ? AppColors.primaryMaroon : AppColors.borderHairline,
                                    ),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        isPickup ? '⚡ Ready in 30 Mins' : '⚡ Express 90 Mins',
                                        style: TextStyle(
                                          fontWeight: FontWeight.w800,
                                          fontSize: 11.5,
                                          color: (_selectedSlot.contains('30 Mins') || _selectedSlot.contains('Express')) ? AppColors.primaryMaroon : AppColors.textPrimary,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(isPickup ? 'Freshly packed' : 'Priority butchering', style: const TextStyle(fontSize: 10, color: AppColors.textMuted)),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: GestureDetector(
                                onTap: () => setState(() => _selectedSlot = isPickup ? 'Evening Pickup (5-8 PM)' : 'Evening Delivery (6-9 PM)'),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
                                  decoration: BoxDecoration(
                                    color: _selectedSlot.contains('Evening') ? AppColors.primaryLight.withOpacity(0.35) : AppColors.surfaceSubtle,
                                    borderRadius: AppDimensions.roundedMd,
                                    border: Border.all(
                                      color: _selectedSlot.contains('Evening') ? AppColors.primaryMaroon : AppColors.borderHairline,
                                    ),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        isPickup ? '🌅 Evening (5-8 PM)' : '🌅 Evening (6-9 PM)',
                                        style: TextStyle(
                                          fontWeight: FontWeight.w800,
                                          fontSize: 11.5,
                                          color: _selectedSlot.contains('Evening') ? AppColors.primaryMaroon : AppColors.textPrimary,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      const Text('Evening fresh cuts', style: TextStyle(fontSize: 10, color: AppColors.textMuted)),
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
                  const SizedBox(height: AppDimensions.spaceMd),

                  // 2. Free delivery progress notice (Only for Home Delivery)
                  if (!isPickup && cart.subtotal < 399)
                    Container(
                      margin: const EdgeInsets.symmetric(horizontal: AppDimensions.spaceMd),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: AppColors.deliveryAmberBg,
                        borderRadius: AppDimensions.roundedMd,
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.local_shipping_outlined, size: 16, color: AppColors.deliveryAmber),
                          const SizedBox(width: 8),
                          Text(
                            'Add ${CurrencyFormatter.format(399 - cart.subtotal)} more for FREE Delivery!',
                            style: const TextStyle(
                              color: AppColors.deliveryAmber,
                              fontSize: 11.5,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),

                  // 3. Cart Items List
                  Container(
                    margin: const EdgeInsets.all(AppDimensions.spaceMd),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: AppDimensions.roundedLg,
                      border: Border.all(color: AppColors.borderHairline),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('Selected Cuts (${items.length})', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                              Text(CurrencyFormatter.format(cart.subtotal), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.primaryMaroon)),
                            ],
                          ),
                        ),
                        const Divider(height: 1, color: AppColors.borderHairline),
                        ...items.map((cartItem) {
                          final prod = cartItem.product;
                          return Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            child: Row(
                              children: [
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(8),
                                  child: CachedNetworkImage(
                                    imageUrl: prod.image,
                                    width: 50,
                                    height: 50,
                                    fit: BoxFit.cover,
                                    placeholder: (context, url) => Container(color: AppColors.surfaceSubtle),
                                    errorWidget: (context, url, error) => Container(color: AppColors.surfaceSubtle, child: const Icon(Icons.broken_image_rounded, size: 16)),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(prod.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis),
                                      const SizedBox(height: 2),
                                      Text('${cartItem.selectedWeight} • ${CurrencyFormatter.format(prod.price)}', style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary)),
                                    ],
                                  ),
                                ),
                                QuantityStepper(
                                  quantity: cartItem.quantity,
                                  onAdd: () => cart.addToCart(prod, weight: cartItem.selectedWeight),
                                  onIncrement: () => cart.increment(prod.id),
                                  onDecrement: () => cart.decrement(prod.id),
                                ),
                              ],
                            ),
                          );
                        }),
                      ],
                    ),
                  ),

                  // 4. Coupon Input Box
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: AppDimensions.spaceMd),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: AppDimensions.roundedLg,
                      border: Border.all(color: AppColors.borderHairline),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.local_offer_outlined, color: AppColors.primaryMaroon, size: 18),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextField(
                            controller: _couponController,
                            textCapitalization: TextCapitalization.characters,
                            decoration: InputDecoration(
                              hintText: cart.appliedCoupon != null ? 'COUPON: ${cart.appliedCoupon}' : 'Enter Butchery Promo Code',
                              hintStyle: TextStyle(
                                fontSize: 12.5,
                                fontWeight: cart.appliedCoupon != null ? FontWeight.bold : FontWeight.normal,
                                color: cart.appliedCoupon != null ? AppColors.hygieneDark : AppColors.textMuted,
                              ),
                              border: InputBorder.none,
                              enabledBorder: InputBorder.none,
                              focusedBorder: InputBorder.none,
                              isDense: true,
                            ),
                          ),
                        ),
                        TextButton(
                          onPressed: () {
                            if (cart.appliedCoupon != null) {
                              cart.removeCoupon();
                            } else {
                              cart.applyCoupon(_couponController.text);
                            }
                          },
                          child: Text(
                            cart.appliedCoupon != null ? 'REMOVE' : 'APPLY',
                            style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.primaryMaroon),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppDimensions.spaceMd),

                  // 5. Payment Method Selector
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: AppDimensions.spaceMd),
                    padding: const EdgeInsets.all(AppDimensions.spaceMd),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: AppDimensions.roundedLg,
                      border: Border.all(color: AppColors.borderHairline),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text('Payment Method', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5)),
                            Text('100% Secure', style: TextStyle(fontSize: 11, color: AppColors.hygieneDark, fontWeight: FontWeight.bold)),
                          ],
                        ),
                        const SizedBox(height: 8),
                        _buildPaymentOption(
                          'razorpay',
                          'Online UPI / Card / NetBanking (Razorpay)',
                          Icons.credit_card_rounded,
                          badge: 'Recommended',
                        ),
                        _buildPaymentOption(
                          'wallet',
                          "Teffe's Cash Wallet (${CurrencyFormatter.format(auth.user?.walletBalance ?? 0)})",
                          Icons.account_balance_wallet_rounded,
                        ),
                        _buildPaymentOption(
                          'cod',
                          isPickup ? 'Pay at Store Counter (Cash / POS Machine)' : 'Cash on Delivery (COD)',
                          Icons.money_rounded,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppDimensions.spaceMd),

                  // 6. Bill Breakdown
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: AppDimensions.spaceMd),
                    padding: const EdgeInsets.all(AppDimensions.spaceMd),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: AppDimensions.roundedLg,
                      border: Border.all(color: AppColors.borderHairline),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Bill Summary', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5)),
                        const SizedBox(height: 10),
                        _buildBillRow('Item Total', CurrencyFormatter.format(cart.subtotal)),
                        _buildBillRow(
                          'Delivery Fee',
                          isPickup
                              ? 'FREE (Store Pickup)'
                              : effectiveDeliveryFee == 0
                                  ? 'FREE'
                                  : CurrencyFormatter.format(effectiveDeliveryFee),
                          isHighlight: effectiveDeliveryFee == 0,
                        ),
                        if (cart.couponDiscount > 0)
                          _buildBillRow('Coupon Discount', '- ${CurrencyFormatter.format(cart.couponDiscount)}', isHighlight: true),
                        const Divider(height: 18, color: AppColors.borderHairline),
                        _buildBillRow('To Pay', CurrencyFormatter.format(effectiveGrandTotal), isBold: true),
                      ],
                    ),
                  ),
                ],
              ),
            ),
      // Sticky Checkout Bottom Bar
      bottomSheet: items.isNotEmpty
          ? Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                boxShadow: AppDimensions.floatingShadow,
                border: Border(top: BorderSide(color: AppColors.borderHairline.withOpacity(0.9))),
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
                        const Text('TOTAL AMOUNT', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.textMuted)),
                        Text(CurrencyFormatter.format(effectiveGrandTotal), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
                      ],
                    ),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primaryMaroon,
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: AppDimensions.roundedMd),
                      ),
                      onPressed: _isPlacingOrder ? null : () => _handlePlaceOrder(cart, location, auth),
                      child: _isPlacingOrder
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : Text(
                              _selectedPaymentMethod == 'razorpay' ? 'Proceed to Pay →' : (isPickup ? 'Confirm Pickup →' : 'Place Order →'),
                              style: const TextStyle(fontWeight: FontWeight.w800, color: Colors.white),
                            ),
                    ),
                  ],
                ),
              ),
            )
          : null,
    );
  }

  Widget _buildPaymentOption(String key, String label, IconData icon, {String? badge}) {
    final isSelected = _selectedPaymentMethod == key;
    return GestureDetector(
      onTap: () => setState(() => _selectedPaymentMethod = key),
      child: Container(
        margin: const EdgeInsets.only(top: 6),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primaryLight.withOpacity(0.3) : AppColors.surfaceSubtle,
          borderRadius: AppDimensions.roundedMd,
          border: Border.all(color: isSelected ? AppColors.primaryMaroon : AppColors.borderHairline),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: isSelected ? AppColors.primaryMaroon : AppColors.textSecondary),
            const SizedBox(width: 10),
            Expanded(
              child: Row(
                children: [
                  Flexible(
                    child: Text(
                      label,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: isSelected ? FontWeight.w800 : FontWeight.w500,
                        color: isSelected ? AppColors.primaryMaroon : AppColors.textPrimary,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (badge != null) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                      decoration: BoxDecoration(
                        color: AppColors.hygieneLight,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        badge,
                        style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: AppColors.hygieneDark),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            Icon(
              isSelected ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded,
              size: 16,
              color: isSelected ? AppColors.primaryMaroon : AppColors.textMuted,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBillRow(String label, String value, {bool isBold = false, bool isHighlight = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2.5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: isBold ? 14 : 12.5,
              fontWeight: isBold ? FontWeight.w800 : FontWeight.w500,
              color: isBold ? AppColors.textPrimary : AppColors.textSecondary,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: isBold ? 15 : 12.5,
              fontWeight: isBold ? FontWeight.w900 : FontWeight.w700,
              color: isHighlight
                  ? AppColors.discountGreen
                  : isBold
                      ? AppColors.primaryMaroon
                      : AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}
