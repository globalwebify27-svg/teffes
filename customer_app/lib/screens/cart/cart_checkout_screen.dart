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
import '../auth/login_screen.dart';
import '../../providers/auth_provider.dart';
import '../../models/order_model.dart';
import '../../models/store_model.dart';

class CartCheckoutScreen extends StatefulWidget {
  const CartCheckoutScreen({super.key});

  @override
  State<CartCheckoutScreen> createState() => _CartCheckoutScreenState();
}

class _CartCheckoutScreenState extends State<CartCheckoutScreen> {
  final TextEditingController _couponController = TextEditingController();
  final TextEditingController _customTipController = TextEditingController();
  final TextEditingController _pickupInstructionController = TextEditingController();
  String _fulfillmentType = 'delivery'; // 'delivery' or 'pickup'
  String _selectedPaymentMethod = 'razorpay'; // 'razorpay', 'cod', 'wallet'
  String _selectedSlot = '90 Mins Express Delivery';
  bool _isPlacingOrder = false;
  int _selectedTip = 0;
  bool _showCustomTipInput = false;
  String _deliveryInstruction = '';
  bool _isCouponsExpanded = false;

  List<StoreModel> _stores = [];
  String _selectedStoreId = 'S001';

  @override
  void initState() {
    super.initState();
    _initDefaultStores();
    _fetchStores();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        context.read<CartProvider>().fetchAvailableCoupons();
      }
    });
  }

  void _initDefaultStores() {
    _stores = [
      const StoreModel(
        storeId: 'S001',
        name: "TeFFe's — Kishore Ganj",
        address: 'Plot 42, Main Road, Kishore Ganj, Ranchi, Jharkhand 834001',
        city: 'Ranchi',
        phone: '+91 9779687955',
        status: 'Active',
        pickupEnabled: true,
        timings: '08:00 AM - 08:00 PM',
        distance: '0.8 km away',
      ),
      const StoreModel(
        storeId: 'S002',
        name: "TeFFe's — Doranda Hub",
        address: 'Doranda Bazar, Near High Court, Ranchi, Jharkhand 834002',
        city: 'Ranchi',
        phone: '+91 9279682955',
        status: 'Active',
        pickupEnabled: true,
        timings: '08:00 AM - 08:00 PM',
        distance: '1.6 km away',
      ),
      const StoreModel(
        storeId: 'S004',
        name: 'Teffes - Doranda store',
        address: 'North office pada doranda, Ranchi',
        city: 'Ranchi',
        phone: '1234567891',
        status: 'Active',
        pickupEnabled: true,
        timings: '08:00 AM - 08:00 PM',
        distance: '2.4 km away',
      ),
    ];
    _selectedStoreId = _stores.first.storeId;
  }

  Future<void> _fetchStores() async {
    try {
      final api = ApiClient();
      final res = await api.get(ApiEndpoints.stores);
      if (res.data != null && res.data['success'] == true && res.data['stores'] is List) {
        final list = (res.data['stores'] as List)
            .asMap()
            .entries
            .map((entry) => StoreModel.fromJson(entry.value as Map<String, dynamic>, entry.key))
            .where((s) => s.pickupEnabled && s.status.toLowerCase() != 'inactive')
            .toList();

        if (list.isNotEmpty && mounted) {
          setState(() {
            _stores = list;
            if (!_stores.any((s) => s.storeId == _selectedStoreId)) {
              _selectedStoreId = _stores.first.storeId;
            }
          });
        }
      }
    } catch (e) {
      debugPrint('Error fetching stores for pickup: $e');
    }
  }

  StoreModel? get _selectedStore {
    try {
      return _stores.firstWhere((s) => s.storeId == _selectedStoreId);
    } catch (_) {
      return _stores.isNotEmpty ? _stores.first : null;
    }
  }

  @override
  void dispose() {
    _couponController.dispose();
    _customTipController.dispose();
    _pickupInstructionController.dispose();
    super.dispose();
  }

  void _showAddAddressDialog(BuildContext context, LocationProvider location) {
    String selectedTag = 'Home';
    final line1Controller = TextEditingController();
    final landmarkController = TextEditingController();
    final pincodeController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                left: AppDimensions.spaceMd,
                right: AppDimensions.spaceMd,
                top: AppDimensions.spaceMd,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + AppDimensions.spaceMd,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Add New Delivery Address', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                      IconButton(icon: const Icon(Icons.close_rounded), onPressed: () => Navigator.pop(ctx)),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: ['Home', 'Office', 'Other'].map((tag) {
                      final isSelected = selectedTag == tag;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: Text(tag),
                          selected: isSelected,
                          selectedColor: AppColors.primaryLight,
                          labelStyle: TextStyle(
                            color: isSelected ? AppColors.primaryMaroon : AppColors.textPrimary,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                          ),
                          onSelected: (_) => setModalState(() => selectedTag = tag),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: line1Controller,
                    decoration: InputDecoration(
                      hintText: 'Flat / House No. / Street Address',
                      filled: true,
                      fillColor: AppColors.surfaceSubtle,
                      border: OutlineInputBorder(borderRadius: AppDimensions.roundedMd, borderSide: BorderSide.none),
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: landmarkController,
                    decoration: InputDecoration(
                      hintText: 'Landmark (e.g. Near CMPDI / Circular Road)',
                      filled: true,
                      fillColor: AppColors.surfaceSubtle,
                      border: OutlineInputBorder(borderRadius: AppDimensions.roundedMd, borderSide: BorderSide.none),
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: pincodeController,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      hintText: 'Enter 6-digit Pincode',
                      filled: true,
                      fillColor: AppColors.surfaceSubtle,
                      border: OutlineInputBorder(borderRadius: AppDimensions.roundedMd, borderSide: BorderSide.none),
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: AppColors.primaryMaroon),
                      onPressed: () async {
                        if (line1Controller.text.trim().isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Please enter your house/street address')),
                          );
                          return;
                        }
                        if (pincodeController.text.trim().isEmpty || pincodeController.text.trim().length < 6) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Please enter a valid 6-digit pincode')),
                          );
                          return;
                        }
                        await location.addAddress(
                          tag: selectedTag,
                          line1: line1Controller.text.trim(),
                          landmark: landmarkController.text.trim(),
                          pincode: pincodeController.text.trim(),
                          city: 'Ranchi',
                        );
                        if (ctx.mounted) Navigator.pop(ctx);
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Address saved & selected for delivery!')),
                          );
                        }
                      },
                      child: const Text('Save Address', style: TextStyle(fontWeight: FontWeight.w800, color: Colors.white)),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _showAddressPicker(BuildContext context, LocationProvider location) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Container(
          padding: EdgeInsets.only(
            left: AppDimensions.spaceMd,
            right: AppDimensions.spaceMd,
            top: AppDimensions.spaceMd,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + AppDimensions.spaceMd,
          ),
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.75,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Select Delivery Address', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                  IconButton(
                    icon: const Icon(Icons.close_rounded),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              // 1. "Use Current Location" (GPS) Option
              InkWell(
                onTap: () async {
                  Navigator.pop(ctx);
                  final ok = await location.detectGpsLocation(userTriggered: true);
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Row(
                          children: [
                            const Icon(Icons.my_location_rounded, color: Colors.white, size: 18),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                ok
                                    ? 'Location detected: ${location.activeAddressString}'
                                    : 'Using location: ${location.activeAddressString}',
                              ),
                            ),
                          ],
                        ),
                        backgroundColor: AppColors.primaryMaroon,
                        behavior: SnackBarBehavior.floating,
                        duration: const Duration(seconds: 3),
                      ),
                    );
                  }
                },
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight.withValues(alpha: 0.35),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.primaryMaroon.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: const BoxDecoration(
                          color: AppColors.primaryMaroon,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.my_location_rounded, color: Colors.white, size: 16),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Use Current Location (GPS)',
                              style: TextStyle(
                                color: AppColors.primaryMaroon,
                                fontWeight: FontWeight.w800,
                                fontSize: 13.5,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              location.isGpsDetected
                                  ? 'Live GPS • ${location.activeAddressString}'
                                  : 'Detect live location via device GPS',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppColors.primaryMaroon),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 8),
              // 2. "+ Add New Delivery Address" Option
              InkWell(
                onTap: () {
                  Navigator.pop(ctx);
                  _showAddAddressDialog(context, location);
                },
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: AppColors.primaryMaroon.withValues(alpha: 0.06),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.primaryMaroon.withValues(alpha: 0.25)),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.add_location_alt_rounded, color: AppColors.primaryMaroon, size: 20),
                      SizedBox(width: 10),
                      Text(
                        '+ Add New Delivery Address',
                        style: TextStyle(
                          color: AppColors.primaryMaroon,
                          fontWeight: FontWeight.w800,
                          fontSize: 13.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              if (location.savedAddresses.isEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 24),
                  alignment: Alignment.center,
                  child: const Text(
                    'No saved addresses yet.\nTap above to add your delivery address.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                  ),
                )
              else
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: location.savedAddresses.length,
                    separatorBuilder: (_, __) => const Divider(height: 1, color: AppColors.borderHairline),
                    itemBuilder: (context, idx) {
                      final addr = location.savedAddresses[idx];
                      final isSelected = location.selectedAddress?.id == addr.id;
                      return ListTile(
                        contentPadding: const EdgeInsets.symmetric(vertical: 4),
                        leading: Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: isSelected ? AppColors.primaryLight : AppColors.surfaceSubtle,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(
                            addr.tag.toLowerCase().contains('work') || addr.tag.toLowerCase().contains('office')
                                ? Icons.business_rounded
                                : Icons.home_rounded,
                            color: isSelected ? AppColors.primaryMaroon : AppColors.textSecondary,
                            size: 20,
                          ),
                        ),
                        title: Row(
                          children: [
                            Text(
                              addr.tag,
                              style: TextStyle(
                                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w700,
                                color: isSelected ? AppColors.primaryMaroon : AppColors.textPrimary,
                                fontSize: 13.5,
                              ),
                            ),
                            if (addr.isDefault) ...[
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                                decoration: BoxDecoration(
                                  color: Colors.green.withOpacity(0.12),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: const Text(
                                  'DEFAULT',
                                  style: TextStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w800,
                                    color: Colors.green,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        subtitle: Text(
                          addr.fullAddress,
                          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                        ),
                        trailing: isSelected
                            ? const Icon(Icons.check_circle_rounded, color: AppColors.primaryMaroon, size: 22)
                            : const Icon(Icons.radio_button_unchecked_rounded, color: AppColors.borderHairline, size: 22),
                        onTap: () {
                          location.selectAddress(addr);
                          Navigator.pop(ctx);
                        },
                      );
                    },
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _handlePlaceOrder(CartProvider cart, LocationProvider location, AuthProvider auth) async {
    // 0. Enforce user authentication: must be logged in to proceed with checkout or payment
    if (!auth.isAuthenticated) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Row(
            children: [
              Icon(Icons.lock_outline_rounded, color: Colors.white, size: 20),
              SizedBox(width: 8),
              Expanded(child: Text('Please log in to proceed with your order')),
            ],
          ),
          backgroundColor: AppColors.primaryMaroon,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          duration: const Duration(seconds: 3),
        ),
      );
      await Navigator.of(context).push<bool>(
        SmoothPageRoute(page: const LoginScreen()),
      );
      return;
    }

    final isPickup = _fulfillmentType == 'pickup';

    if (!isPickup && location.selectedAddress == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please add a delivery address to proceed with your order.')),
      );
      _showAddAddressDialog(context, location);
      return;
    }

    final effectiveDeliveryFee = isPickup ? 0.0 : cart.deliveryFee;
    final effectiveTip = isPickup ? 0 : _selectedTip;
    final effectiveGrandTotal = (cart.subtotal + effectiveDeliveryFee + effectiveTip - cart.couponDiscount).clamp(0.0, double.infinity);

    final selStore = _selectedStore;
    final storeName = isPickup ? (selStore?.name ?? "TeFFe's — Kishore Ganj") : "TeFFe's — Kishore Ganj";
    final storeId = isPickup ? (selStore?.storeId ?? 'S001') : 'S001';
    final shippingAddress = isPickup
        ? 'Store Pickup: ${selStore?.name ?? "TeFFe's Hub"}, ${selStore?.address ?? "Ranchi"}'
        : location.activeAddressString;
    final activeInstruction = isPickup ? _pickupInstructionController.text.trim() : _deliveryInstruction;

    // 1. If Razorpay is selected, navigate directly to dedicated Payment Proceed Screen
    if (_selectedPaymentMethod == 'razorpay') {
      Navigator.of(context).push(
        SmoothPageRoute(
          page: PaymentProceedScreen(
            payableAmount: effectiveGrandTotal,
            deliveryAddress: shippingAddress,
            deliverySlot: isPickup ? 'Store Pickup (Counter Takeaway)' : _selectedSlot,
            paymentMethod: 'razorpay',
            isPickup: isPickup,
            fulfillmentType: _fulfillmentType,
            storeId: storeId,
            storeName: storeName,
            instruction: activeInstruction,
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
        'couponCode': cart.appliedCoupon,
        'discountAmount': cart.couponDiscount,
        'amount': effectiveGrandTotal,
        'totalAmount': effectiveGrandTotal,
        'fulfillmentType': _fulfillmentType,
        'pickupMode': isPickup,
        'tip': effectiveTip,
        'deliveryInstruction': activeInstruction,
        'paymentMethod': _selectedPaymentMethod == 'wallet'
            ? "Teffe's Cash Wallet"
            : isPickup
                ? 'Pay at Store Counter'
                : 'Cash on Delivery (COD)',
        'paymentStatus': _selectedPaymentMethod == 'wallet' ? 'Paid' : 'Pending',
        'shippingAddress': shippingAddress,
        'deliverySlot': isPickup ? 'Store Pickup (Counter Takeaway)' : _selectedSlot,
        'storeId': storeId,
        'storeName': storeName,
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
        deliveryAddress: shippingAddress,
        paymentMethod: _selectedPaymentMethod == 'wallet'
            ? "Teffe's Cash Wallet"
            : isPickup
                ? 'Pay at Store Counter'
                : 'Cash on Delivery (COD)',
        paymentStatus: _selectedPaymentMethod == 'wallet' ? 'Paid' : 'Pending',
        storeName: storeName,
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
    final effectiveGrandTotal = (cart.subtotal + effectiveDeliveryFee + _selectedTip - cart.couponDiscount).clamp(0.0, double.infinity);

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

                  // 1. Store Pickup Section (Store List Selector)
                  if (isPickup)
                    Container(
                      margin: const EdgeInsets.fromLTRB(AppDimensions.spaceMd, AppDimensions.spaceMd, AppDimensions.spaceMd, AppDimensions.spaceSm),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Row(
                                children: [
                                  Icon(Icons.location_searching_rounded, size: 18, color: AppColors.primaryMaroon),
                                  SizedBox(width: 6),
                                  Text(
                                    'Select Pickup Store nearby you',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 13.5,
                                      color: AppColors.textPrimary,
                                    ),
                                  ),
                                ],
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: AppColors.discountGreen.withOpacity(0.12),
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(color: AppColors.discountGreen.withOpacity(0.3)),
                                ),
                                child: Text(
                                  '${_stores.length} Available',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.discountGreen,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          ..._stores.map((store) {
                            final isSelected = store.storeId == _selectedStoreId;
                            return GestureDetector(
                              onTap: () => setState(() => _selectedStoreId = store.storeId),
                              child: Container(
                                margin: const EdgeInsets.only(bottom: 8),
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: isSelected ? AppColors.primaryLight.withOpacity(0.35) : Colors.white,
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(
                                    color: isSelected ? AppColors.primaryMaroon : AppColors.borderHairline,
                                    width: isSelected ? 1.5 : 1.0,
                                  ),
                                  boxShadow: isSelected
                                      ? [BoxShadow(color: AppColors.primaryMaroon.withOpacity(0.08), blurRadius: 6, offset: const Offset(0, 2))]
                                      : [const BoxShadow(color: Colors.black12, blurRadius: 2, offset: Offset(0, 1))],
                                ),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    // Radio circle indicator
                                    Container(
                                      width: 18,
                                      height: 18,
                                      margin: const EdgeInsets.only(top: 2, right: 10),
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        border: Border.all(
                                          color: isSelected ? AppColors.primaryMaroon : AppColors.borderHairline,
                                          width: 2,
                                        ),
                                        color: isSelected ? AppColors.primaryMaroon : Colors.white,
                                      ),
                                      child: isSelected
                                          ? Center(
                                              child: Container(
                                                width: 6,
                                                height: 6,
                                                decoration: const BoxDecoration(
                                                  shape: BoxShape.circle,
                                                  color: Colors.white,
                                                ),
                                              ),
                                            )
                                          : null,
                                    ),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                            children: [
                                              Expanded(
                                                child: Text(
                                                  store.name,
                                                  style: TextStyle(
                                                    fontWeight: FontWeight.w800,
                                                    fontSize: 13.5,
                                                    color: isSelected ? AppColors.primaryMaroon : AppColors.textPrimary,
                                                  ),
                                                ),
                                              ),
                                              if (isSelected)
                                                Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                  decoration: BoxDecoration(
                                                    color: AppColors.primaryMaroon,
                                                    borderRadius: BorderRadius.circular(4),
                                                  ),
                                                  child: const Text(
                                                    'SELECTED',
                                                    style: TextStyle(
                                                      color: Colors.white,
                                                      fontSize: 9,
                                                      fontWeight: FontWeight.w900,
                                                      letterSpacing: 0.5,
                                                    ),
                                                  ),
                                                ),
                                            ],
                                          ),
                                          const SizedBox(height: 3),
                                          Text(
                                            store.address,
                                            style: const TextStyle(
                                              fontSize: 11.5,
                                              color: AppColors.textSecondary,
                                              height: 1.3,
                                            ),
                                          ),
                                          const SizedBox(height: 6),
                                          Row(
                                            children: [
                                              Container(
                                                width: 6,
                                                height: 6,
                                                decoration: const BoxDecoration(
                                                  shape: BoxShape.circle,
                                                  color: AppColors.discountGreen,
                                                ),
                                              ),
                                              const SizedBox(width: 4),
                                              const Text(
                                                'Open for Pickup',
                                                style: TextStyle(
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.bold,
                                                  color: AppColors.discountGreen,
                                                ),
                                              ),
                                              const Text(' • ', style: TextStyle(color: AppColors.textMuted)),
                                              Text(
                                                store.timings,
                                                style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                                              ),
                                              if (store.distance.isNotEmpty) ...[
                                                const Text(' • ', style: TextStyle(color: AppColors.textMuted)),
                                                Text(
                                                  store.distance,
                                                  style: const TextStyle(
                                                    fontSize: 11,
                                                    fontWeight: FontWeight.bold,
                                                    color: AppColors.primaryMaroon,
                                                  ),
                                                ),
                                              ],
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          }),
                          const SizedBox(height: 4),
                          // Quick Pickup Alert Box (matching website)
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFFFBEB),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: const Color(0xFFFDE68A)),
                            ),
                            child: const Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Icon(Icons.schedule_rounded, size: 18, color: Color(0xFFD97706)),
                                SizedBox(width: 8),
                                Expanded(
                                  child: Text.rich(
                                    TextSpan(
                                      text: 'Quick Pickup: ',
                                      style: TextStyle(
                                        fontWeight: FontWeight.w800,
                                        fontSize: 11.5,
                                        color: Color(0xFF78350F),
                                      ),
                                      children: [
                                        TextSpan(
                                          text: 'Order will be freshly carved and packaged within ',
                                          style: TextStyle(fontWeight: FontWeight.normal),
                                        ),
                                        TextSpan(
                                          text: '15 minutes',
                                          style: TextStyle(fontWeight: FontWeight.w800),
                                        ),
                                        TextSpan(
                                          text: '. Collect anytime before 8:00 PM today!',
                                          style: TextStyle(fontWeight: FontWeight.normal),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
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
                          if (location.selectedAddress == null) ...[
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.center,
                              children: [
                                Container(
                                  width: 36,
                                  height: 36,
                                  decoration: BoxDecoration(
                                    color: AppColors.primaryMaroon.withOpacity(0.08),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: const Icon(Icons.add_location_alt_rounded, color: AppColors.primaryMaroon, size: 20),
                                ),
                                const SizedBox(width: 10),
                                const Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'No delivery address added',
                                        style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: AppColors.textPrimary),
                                      ),
                                      SizedBox(height: 2),
                                      Text(
                                        'Add an address to deliver your order',
                                        style: TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
                                      ),
                                    ],
                                  ),
                                ),
                                ElevatedButton(
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: AppColors.primaryMaroon,
                                    foregroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                    minimumSize: Size.zero,
                                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                    elevation: 0,
                                  ),
                                  onPressed: () => _showAddAddressDialog(context, location),
                                  child: const Text('+ ADD', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11.5)),
                                ),
                              ],
                            ),
                          ] else ...[
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
                          ],
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
                                      Row(
                                        children: [
                                          Icon(Icons.bolt_rounded, size: 16, color: (_selectedSlot.contains('30 Mins') || _selectedSlot.contains('Express')) ? AppColors.primaryMaroon : AppColors.textPrimary),
                                          const SizedBox(width: 4),
                                          Text(
                                            isPickup ? 'Ready in 30 Mins' : 'Express 90 Mins',
                                            style: TextStyle(
                                              fontWeight: FontWeight.w800,
                                              fontSize: 11.5,
                                              color: (_selectedSlot.contains('30 Mins') || _selectedSlot.contains('Express')) ? AppColors.primaryMaroon : AppColors.textPrimary,
                                            ),
                                          ),
                                        ],
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
                                      Row(
                                        children: [
                                          Icon(Icons.schedule_rounded, size: 15, color: _selectedSlot.contains('Evening') ? AppColors.primaryMaroon : AppColors.textPrimary),
                                          const SizedBox(width: 4),
                                          Text(
                                            isPickup ? 'Evening (5-8 PM)' : 'Evening (6-9 PM)',
                                            style: TextStyle(
                                              fontWeight: FontWeight.w800,
                                              fontSize: 11.5,
                                              color: _selectedSlot.contains('Evening') ? AppColors.primaryMaroon : AppColors.textPrimary,
                                            ),
                                          ),
                                        ],
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

                  // 3.5 Tip & Instructions (Home Delivery vs Store Pickup)
                  if (!isPickup) ...[
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
                          const Text('Tip for Rider', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5)),
                          const SizedBox(height: 6),
                          const Text('100% of this tip goes to your delivery partner.', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              ...[10, 35, 50].map((tip) {
                                final isSelected = _selectedTip == tip && !_showCustomTipInput;
                                return Expanded(
                                  child: GestureDetector(
                                    onTap: () => setState(() {
                                      _showCustomTipInput = false;
                                      _selectedTip = isSelected ? 0 : tip;
                                    }),
                                    child: Container(
                                      margin: const EdgeInsets.only(right: 8),
                                      padding: const EdgeInsets.symmetric(vertical: 8),
                                      decoration: BoxDecoration(
                                        color: isSelected ? AppColors.primaryLight.withOpacity(0.35) : AppColors.surfaceSubtle,
                                        borderRadius: AppDimensions.roundedMd,
                                        border: Border.all(color: isSelected ? AppColors.primaryMaroon : AppColors.borderHairline),
                                      ),
                                      child: Center(
                                        child: Text(
                                          '₹$tip',
                                          style: TextStyle(
                                            fontWeight: FontWeight.bold,
                                            fontSize: 13,
                                            color: isSelected ? AppColors.primaryMaroon : AppColors.textPrimary,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                );
                              }),
                              // Option: Custom
                              Expanded(
                                child: GestureDetector(
                                  onTap: () => setState(() {
                                    _showCustomTipInput = !_showCustomTipInput;
                                  }),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(vertical: 8),
                                    decoration: BoxDecoration(
                                      color: (_showCustomTipInput || (_selectedTip > 0 && ![10, 35, 50].contains(_selectedTip)))
                                          ? AppColors.primaryLight.withOpacity(0.35)
                                          : AppColors.surfaceSubtle,
                                      borderRadius: AppDimensions.roundedMd,
                                      border: Border.all(
                                        color: (_showCustomTipInput || (_selectedTip > 0 && ![10, 35, 50].contains(_selectedTip)))
                                            ? AppColors.primaryMaroon
                                            : AppColors.borderHairline,
                                      ),
                                    ),
                                    child: Center(
                                      child: Text(
                                        (_selectedTip > 0 && ![10, 35, 50].contains(_selectedTip))
                                            ? '₹$_selectedTip'
                                            : 'Custom',
                                        style: TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 12.5,
                                          color: (_showCustomTipInput || (_selectedTip > 0 && ![10, 35, 50].contains(_selectedTip)))
                                              ? AppColors.primaryMaroon
                                              : AppColors.textPrimary,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          if (_showCustomTipInput) ...[
                            const SizedBox(height: 10),
                            Row(
                              children: [
                                Expanded(
                                  child: Container(
                                    height: 38,
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: AppColors.primaryMaroon.withOpacity(0.5)),
                                    ),
                                    child: TextField(
                                      controller: _customTipController,
                                      keyboardType: TextInputType.number,
                                      autofocus: true,
                                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                                      decoration: const InputDecoration(
                                        prefixText: '₹ ',
                                        prefixStyle: TextStyle(fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                                        hintText: 'Enter amount (e.g. 25)',
                                        hintStyle: TextStyle(fontSize: 11.5, color: AppColors.textMuted),
                                        contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                        border: InputBorder.none,
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                SizedBox(
                                  height: 38,
                                  child: ElevatedButton(
                                    onPressed: () {
                                      final val = int.tryParse(_customTipController.text.trim()) ?? 0;
                                      setState(() {
                                        _selectedTip = val;
                                        _showCustomTipInput = false;
                                      });
                                    },
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: AppColors.primaryMaroon,
                                      foregroundColor: Colors.white,
                                      elevation: 0,
                                      padding: const EdgeInsets.symmetric(horizontal: 14),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                    ),
                                    child: const Text('Add', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                                  ),
                                ),
                                const SizedBox(width: 2),
                                IconButton(
                                  icon: const Icon(Icons.close_rounded, size: 20, color: AppColors.textMuted),
                                  onPressed: () {
                                    setState(() {
                                      _showCustomTipInput = false;
                                      if (![10, 35, 50].contains(_selectedTip)) {
                                        _selectedTip = 0;
                                      }
                                    });
                                  },
                                ),
                              ],
                            ),
                          ],
                          const SizedBox(height: 16),
                          const Text('Delivery Instructions', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5)),
                          const SizedBox(height: 8),
                          TextField(
                            onChanged: (val) => _deliveryInstruction = val,
                            decoration: const InputDecoration(
                              hintText: 'E.g. Leave at door, Don\'t ring bell',
                              hintStyle: TextStyle(fontSize: 12),
                              border: OutlineInputBorder(),
                              contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppDimensions.spaceMd),
                  ] else ...[
                    // 3.5 Store Pickup Notes Box (matching website)
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
                            children: [
                              Icon(Icons.edit_note_rounded, color: AppColors.primaryMaroon, size: 20),
                              SizedBox(width: 6),
                              Text(
                                'Pickup Instructions / Notes (Optional)',
                                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          TextField(
                            controller: _pickupInstructionController,
                            decoration: InputDecoration(
                              hintText: 'e.g. Keep marinated separately / Pack in double bag',
                              hintStyle: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                              fillColor: AppColors.surfaceSubtle,
                              filled: true,
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(10),
                                borderSide: const BorderSide(color: AppColors.borderHairline),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(10),
                                borderSide: const BorderSide(color: AppColors.borderHairline),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(10),
                                borderSide: const BorderSide(color: AppColors.primaryMaroon),
                              ),
                              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            ),
                          ),
                          const SizedBox(height: 8),
                          const Row(
                            children: [
                              Icon(Icons.verified_rounded, size: 15, color: AppColors.discountGreen),
                              SizedBox(width: 5),
                              Expanded(
                                child: Text(
                                  'Your order will be packed and ready to collect at the counter!',
                                  style: TextStyle(fontSize: 11, color: AppColors.textSecondary, fontWeight: FontWeight.w500),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppDimensions.spaceMd),
                  ],

                  // 4. Collapsible Offers & Coupon Section
                  _buildCouponSection(cart),
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
                          _buildBillRow(
                            'Coupon Discount (${cart.appliedCoupon ?? ''})',
                            '- ${CurrencyFormatter.format(cart.couponDiscount)}',
                            isHighlight: true,
                          ),
                        if (!isPickup && _selectedTip > 0)
                          _buildBillRow('Tip for Rider', CurrencyFormatter.format(_selectedTip.toDouble())),
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
                              !auth.isAuthenticated
                                  ? 'Login to proceed'
                                  : (_selectedPaymentMethod == 'razorpay'
                                      ? 'Proceed to Pay →'
                                      : (isPickup ? 'Confirm Pickup →' : 'Place Order →')),
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

  Widget _buildCouponSection(CartProvider cart) {
    final hasAppliedCoupon = cart.appliedCoupon != null;
    final availableCoupons = cart.availableCoupons;
    final appliedModel = cart.appliedCouponModel;
    final description = appliedModel?.description.isNotEmpty == true
        ? appliedModel!.description
        : (appliedModel != null && appliedModel.discountType == 'percentage'
            ? '${appliedModel.discountValue.toInt()}% OFF'
            : 'Coupon discount applied to order');

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: AppDimensions.spaceMd),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: AppDimensions.roundedLg,
        border: Border.all(
          color: hasAppliedCoupon ? const Color(0xFF86EFAC) : AppColors.borderHairline,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Collapsible Header Button
          InkWell(
            onTap: () {
              setState(() {
                _isCouponsExpanded = !_isCouponsExpanded;
              });
            },
            borderRadius: AppDimensions.roundedLg,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: hasAppliedCoupon
                          ? const Color(0xFFDCFCE7)
                          : AppColors.primaryLight.withOpacity(0.35),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      hasAppliedCoupon ? Icons.check_circle_rounded : Icons.local_offer_outlined,
                      color: hasAppliedCoupon ? const Color(0xFF15803D) : AppColors.primaryMaroon,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: hasAppliedCoupon
                        ? Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    '${cart.appliedCoupon} Applied',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 13.5,
                                      color: Color(0xFF14532D),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFDCFCE7),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      'SAVING ₹${cart.couponDiscount.toInt()}',
                                      style: const TextStyle(
                                        fontSize: 9.5,
                                        fontWeight: FontWeight.w900,
                                        color: Color(0xFF166534),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 2),
                              Text(
                                description,
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: AppColors.textMuted,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          )
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Apply Coupon / Promo Code',
                                style: TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 13.5,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                availableCoupons.isNotEmpty
                                    ? '${availableCoupons.length} offers available to save more'
                                    : 'Tap to enter promo code',
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: AppColors.textMuted,
                                ),
                              ),
                            ],
                          ),
                  ),
                  if (hasAppliedCoupon && !_isCouponsExpanded)
                    TextButton(
                      onPressed: () {
                        cart.removeCoupon();
                        _couponController.clear();
                      },
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        backgroundColor: Colors.red.shade50,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(6),
                          side: BorderSide(color: Colors.red.shade200),
                        ),
                      ),
                      child: Text(
                        'Remove',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: Colors.red.shade700,
                        ),
                      ),
                    ),
                  const SizedBox(width: 4),
                  AnimatedRotation(
                    turns: _isCouponsExpanded ? 0.25 : 0.0,
                    duration: const Duration(milliseconds: 200),
                    child: Icon(
                      Icons.chevron_right_rounded,
                      size: 20,
                      color: _isCouponsExpanded ? AppColors.primaryMaroon : AppColors.textMuted,
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Collapsible Content
          if (_isCouponsExpanded) ...[
            const Divider(height: 1, color: AppColors.borderHairline),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (hasAppliedCoupon)
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFFF0FDF4), Color(0xFFE6F9EE)],
                        ),
                        borderRadius: AppDimensions.roundedMd,
                        border: Border.all(color: const Color(0xFFA7F3D0)),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text(
                                      cart.appliedCoupon ?? '',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w900,
                                        fontSize: 14,
                                        color: Color(0xFF064E3B),
                                        letterSpacing: 0.5,
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFBBF7D0),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: const Text(
                                        'APPLIED',
                                        style: TextStyle(
                                          fontSize: 9.5,
                                          fontWeight: FontWeight.w900,
                                          color: Color(0xFF065F46),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  description,
                                  style: const TextStyle(
                                    fontSize: 11.5,
                                    color: Color(0xFF047857),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                '-₹${cart.couponDiscount.toInt()}',
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w900,
                                  color: Color(0xFF047857),
                                ),
                              ),
                              const SizedBox(height: 4),
                              InkWell(
                                onTap: () {
                                  cart.removeCoupon();
                                  _couponController.clear();
                                },
                                child: Text(
                                  'Remove',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.red.shade700,
                                    decoration: TextDecoration.underline,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    )
                  else ...[
                    // Input row
                    Row(
                      children: [
                        Expanded(
                          child: Container(
                            height: 42,
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceSubtle,
                              borderRadius: AppDimensions.roundedMd,
                              border: Border.all(color: AppColors.borderHairline),
                            ),
                            child: TextField(
                              controller: _couponController,
                              textCapitalization: TextCapitalization.characters,
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.5,
                              ),
                              decoration: const InputDecoration(
                                hintText: 'Enter Promo Code (e.g. MEAT25)',
                                hintStyle: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.normal,
                                  color: AppColors.textMuted,
                                ),
                                border: InputBorder.none,
                                isDense: true,
                                contentPadding: EdgeInsets.symmetric(vertical: 11),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        SizedBox(
                          height: 42,
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primaryMaroon,
                              padding: const EdgeInsets.symmetric(horizontal: 16),
                              shape: RoundedRectangleBorder(
                                borderRadius: AppDimensions.roundedMd,
                              ),
                              elevation: 0,
                            ),
                            onPressed: () async {
                              final code = _couponController.text.trim();
                              if (code.isEmpty) return;
                              final success = await cart.applyCoupon(code);
                              if (success) {
                                _couponController.clear();
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text('Coupon $code applied successfully!'),
                                      backgroundColor: Colors.green.shade700,
                                      duration: const Duration(seconds: 2),
                                    ),
                                  );
                                }
                              } else if (cart.couponError != null && context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(cart.couponError!),
                                    backgroundColor: Colors.red.shade700,
                                    duration: const Duration(seconds: 3),
                                  ),
                                );
                              }
                            },
                            child: const Text(
                              'APPLY',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w800,
                                fontSize: 12,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (cart.couponError != null) ...[
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Icon(Icons.error_outline_rounded, size: 14, color: Colors.red.shade700),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              cart.couponError!,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: Colors.red.shade700,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],

                    // Available Offers List
                    if (availableCoupons.isNotEmpty) ...[
                      const SizedBox(height: 14),
                      const Divider(height: 1, color: AppColors.borderHairline),
                      const SizedBox(height: 10),
                      const Text(
                        'AVAILABLE OFFERS',
                        style: TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.6,
                          color: AppColors.textMuted,
                        ),
                      ),
                      const SizedBox(height: 8),
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: availableCoupons.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, index) {
                          final c = availableCoupons[index];
                          final isPercent = c.discountType == 'percentage';
                          final desc = c.description.isNotEmpty
                              ? c.description
                              : (isPercent ? '${c.discountValue.toInt()}% OFF' : '₹${c.discountValue.toInt()} OFF');
                          final minOrder = c.minOrderAmount.toInt();

                          return Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAFC),
                              borderRadius: AppDimensions.roundedMd,
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Text(
                                            c.code,
                                            style: const TextStyle(
                                              fontWeight: FontWeight.w900,
                                              fontSize: 13,
                                              color: AppColors.textPrimary,
                                              letterSpacing: 0.5,
                                            ),
                                          ),
                                          if (c.isSuperOffer) ...[
                                            const SizedBox(width: 6),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                                              decoration: BoxDecoration(
                                                color: const Color(0xFFFEF3C7),
                                                borderRadius: BorderRadius.circular(4),
                                              ),
                                              child: const Text(
                                                'SUPER OFFER',
                                                style: TextStyle(
                                                  fontSize: 8.5,
                                                  fontWeight: FontWeight.w900,
                                                  color: Color(0xFF92400E),
                                                ),
                                              ),
                                            ),
                                          ],
                                          if (c.firstOrderOnly) ...[
                                            const SizedBox(width: 6),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                                              decoration: BoxDecoration(
                                                color: const Color(0xFFE0E7FF),
                                                borderRadius: BorderRadius.circular(4),
                                              ),
                                              child: const Text(
                                                '1ST ORDER',
                                                style: TextStyle(
                                                  fontSize: 8.5,
                                                  fontWeight: FontWeight.w900,
                                                  color: Color(0xFF3730A3),
                                                ),
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                      const SizedBox(height: 3),
                                      Text(
                                        '$desc · Min order ₹$minOrder',
                                        style: const TextStyle(
                                          fontSize: 11,
                                          color: AppColors.textMuted,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 8),
                                OutlinedButton(
                                  style: OutlinedButton.styleFrom(
                                    backgroundColor: Colors.white,
                                    foregroundColor: const Color(0xFF047857),
                                    side: const BorderSide(color: Color(0xFF6EE7B7)),
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                                    minimumSize: Size.zero,
                                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                  ),
                                  onPressed: () async {
                                    final success = await cart.applyCoupon(c.code);
                                    if (success && context.mounted) {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(
                                          content: Text('Coupon ${c.code} claimed!'),
                                          backgroundColor: Colors.green.shade700,
                                          duration: const Duration(seconds: 2),
                                        ),
                                      );
                                    } else if (cart.couponError != null && context.mounted) {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(
                                          content: Text(cart.couponError!),
                                          backgroundColor: Colors.red.shade700,
                                          duration: const Duration(seconds: 3),
                                        ),
                                      );
                                    }
                                  },
                                  child: const Text(
                                    'Claim',
                                    style: TextStyle(
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ],
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
