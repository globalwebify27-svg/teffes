import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../core/utils/currency_formatter.dart';
import '../../core/utils/page_transitions.dart';
import '../../providers/auth_provider.dart';
import '../../providers/location_provider.dart';
import '../../models/user_model.dart';
import '../../models/order_model.dart';
import '../auth/login_screen.dart';
import '../orders/order_tracking_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  // Edit Profile Dialog
  void _showEditProfileDialog(BuildContext context, AuthProvider auth) {
    final nameController = TextEditingController(text: auth.user?.name ?? '');
    final emailController = TextEditingController(text: auth.user?.email ?? '');
    final phoneController = TextEditingController(
      text: (auth.user?.phone ?? '').replaceFirst('+91 ', ''),
    );
    bool isSaving = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
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
                      const Text(
                        'Edit Profile Details',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close_rounded),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Text('Full Name', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  TextField(
                    controller: nameController,
                    decoration: InputDecoration(
                      hintText: 'Enter your full name',
                      filled: true,
                      fillColor: AppColors.surfaceSubtle,
                      border: OutlineInputBorder(borderRadius: AppDimensions.roundedMd, borderSide: BorderSide.none),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text('Email Address', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  TextField(
                    controller: emailController,
                    keyboardType: TextInputType.emailAddress,
                    decoration: InputDecoration(
                      hintText: 'e.g. yourname@teffes.in',
                      filled: true,
                      fillColor: AppColors.surfaceSubtle,
                      border: OutlineInputBorder(borderRadius: AppDimensions.roundedMd, borderSide: BorderSide.none),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text('Mobile Number', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  TextField(
                    controller: phoneController,
                    keyboardType: TextInputType.phone,
                    decoration: InputDecoration(
                      prefixText: '+91 ',
                      filled: true,
                      fillColor: AppColors.surfaceSubtle,
                      border: OutlineInputBorder(borderRadius: AppDimensions.roundedMd, borderSide: BorderSide.none),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    ),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primaryMaroon,
                        shape: RoundedRectangleBorder(borderRadius: AppDimensions.roundedMd),
                      ),
                      onPressed: isSaving
                          ? null
                          : () async {
                              setModalState(() => isSaving = true);
                              final rawPhone = phoneController.text.trim();
                              final formattedPhone = rawPhone.startsWith('+91') ? rawPhone : '+91 $rawPhone';
                              await auth.updateProfileDetails(
                                name: nameController.text.trim(),
                                email: emailController.text.trim(),
                                phone: formattedPhone,
                              );
                              if (ctx.mounted) Navigator.pop(ctx);
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Profile details updated successfully!')),
                                );
                              }
                            },
                      child: isSaving
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : const Text('Save Changes', style: TextStyle(fontWeight: FontWeight.w800, color: Colors.white)),
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

  // Add Money to Wallet Flow
  void _showAddMoneySheet(BuildContext context, AuthProvider auth) {
    final amountController = TextEditingController(text: '500');
    bool isRecharging = false;
    String selectedMethod = 'razorpay';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            final double enteredAmount = double.tryParse(amountController.text) ?? 0.0;

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
                      const Row(
                        children: [
                          Icon(Icons.account_balance_wallet_rounded, color: AppColors.primaryMaroon),
                          SizedBox(width: 8),
                          Text(
                            "Add Money to Teffe's Cash",
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                          ),
                        ],
                      ),
                      IconButton(
                        icon: const Icon(Icons.close_rounded),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Current Balance: ${CurrencyFormatter.format(auth.user?.walletBalance ?? 0)}',
                    style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 14),

                  // Amount Input
                  TextField(
                    controller: amountController,
                    keyboardType: TextInputType.number,
                    onChanged: (_) => setModalState(() {}),
                    style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
                    decoration: InputDecoration(
                      prefixText: '₹ ',
                      prefixStyle: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: AppColors.primaryMaroon),
                      hintText: 'Enter amount',
                      filled: true,
                      fillColor: AppColors.surfaceSubtle,
                      border: OutlineInputBorder(borderRadius: AppDimensions.roundedMd, borderSide: BorderSide.none),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    ),
                  ),
                  const SizedBox(height: 10),

                  // Quick Amount Chips
                  Row(
                    children: [200, 500, 1000, 2000].map((amt) {
                      return Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 3),
                          child: OutlinedButton(
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 6),
                              side: BorderSide(
                                color: enteredAmount == amt ? AppColors.primaryMaroon : AppColors.borderHairline,
                              ),
                              backgroundColor: enteredAmount == amt ? AppColors.primaryLight.withOpacity(0.3) : Colors.transparent,
                            ),
                            onPressed: () {
                              setModalState(() {
                                amountController.text = amt.toString();
                              });
                            },
                            child: Text(
                              '+ ₹$amt',
                              style: TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w800,
                                color: enteredAmount == amt ? AppColors.primaryMaroon : AppColors.textPrimary,
                              ),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 14),

                  // Payment Method Selector
                  const Text('Payment Gateway', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 6),
                  GestureDetector(
                    onTap: () => setModalState(() => selectedMethod = 'razorpay'),
                    child: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: selectedMethod == 'razorpay' ? AppColors.primaryLight.withOpacity(0.3) : AppColors.surfaceSubtle,
                        borderRadius: AppDimensions.roundedMd,
                        border: Border.all(color: selectedMethod == 'razorpay' ? AppColors.primaryMaroon : AppColors.borderHairline),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.credit_card_rounded, color: AppColors.primaryMaroon, size: 20),
                          const SizedBox(width: 10),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Razorpay Express (UPI, Cards, NetBanking)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                                Text('Instant auto-crediting to wallet', style: TextStyle(fontSize: 10.5, color: AppColors.textMuted)),
                              ],
                            ),
                          ),
                          Icon(
                            selectedMethod == 'razorpay' ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded,
                            color: AppColors.primaryMaroon,
                            size: 16,
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Recharge Button
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primaryMaroon,
                        shape: RoundedRectangleBorder(borderRadius: AppDimensions.roundedMd),
                      ),
                      onPressed: (isRecharging || enteredAmount <= 0)
                          ? null
                          : () async {
                              setModalState(() => isRecharging = true);
                              // Razorpay recharge simulation
                              await Future.delayed(const Duration(milliseconds: 900));
                              final payId = 'pay_${DateTime.now().millisecondsSinceEpoch.toString().substring(4)}';
                              await auth.addMoneyToWallet(
                                enteredAmount,
                                description: 'Recharge via Razorpay ($payId)',
                                razorpayPaymentId: payId,
                              );
                              if (ctx.mounted) Navigator.pop(ctx);
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text('₹$enteredAmount successfully added to your Teffe\'s Cash Wallet!'),
                                    backgroundColor: AppColors.hygieneDark,
                                  ),
                                );
                              }
                            },
                      child: isRecharging
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : Text(
                              'Proceed to Add ${CurrencyFormatter.format(enteredAmount)}',
                              style: const TextStyle(fontWeight: FontWeight.w800, color: Colors.white),
                            ),
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

  // Add New Address Modal
  void _showAddAddressDialog(BuildContext context, LocationProvider location) {
    String selectedTag = 'Home';
    final line1Controller = TextEditingController();
    final landmarkController = TextEditingController();
    final pincodeController = TextEditingController(text: '834001');

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
                  // Tag chips
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
                      hintText: 'Pincode (Ranchi)',
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
                        if (line1Controller.text.trim().isEmpty) return;
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
                            const SnackBar(content: Text('Address saved successfully!')),
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

  // Edit Existing Address Modal
  void _showEditAddressDialog(BuildContext context, LocationProvider location, AddressModel addr) {
    String selectedTag = addr.tag;
    final line1Controller = TextEditingController(text: addr.line1);
    final landmarkController = TextEditingController(text: addr.landmark ?? '');
    final pincodeController = TextEditingController(text: addr.pincode);

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
                      const Text('Edit Delivery Address', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
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
                    decoration: const InputDecoration(
                      hintText: 'Flat / House No. / Street Address',
                      filled: true,
                      fillColor: AppColors.surfaceSubtle,
                      border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(8)), borderSide: BorderSide.none),
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: landmarkController,
                    decoration: const InputDecoration(
                      hintText: 'Landmark (e.g. Near CMPDI / Circular Road)',
                      filled: true,
                      fillColor: AppColors.surfaceSubtle,
                      border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(8)), borderSide: BorderSide.none),
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: pincodeController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      hintText: 'Pincode (Ranchi)',
                      filled: true,
                      fillColor: AppColors.surfaceSubtle,
                      border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(8)), borderSide: BorderSide.none),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.red,
                          side: const BorderSide(color: Colors.red),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        ),
                        onPressed: () async {
                          await location.deleteAddress(addr.id);
                          if (ctx.mounted) Navigator.pop(ctx);
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Address deleted.')),
                            );
                          }
                        },
                        child: const Icon(Icons.delete_outline_rounded, color: Colors.red),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: SizedBox(
                          height: 48,
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primaryMaroon),
                            onPressed: () async {
                              if (line1Controller.text.trim().isEmpty) return;
                              await location.editAddress(
                                id: addr.id,
                                tag: selectedTag,
                                line1: line1Controller.text.trim(),
                                landmark: landmarkController.text.trim(),
                                pincode: pincodeController.text.trim(),
                                city: 'Ranchi',
                                isDefault: addr.isDefault,
                              );
                              if (ctx.mounted) Navigator.pop(ctx);
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Address updated successfully!')),
                                );
                              }
                            },
                            child: const Text('Update Address', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  // Delivered Order Receipt Modal (Replaces live tracking for already delivered orders)
  void _showOrderReceiptModal(BuildContext context, OrderModel ord) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.all(AppDimensions.spaceMd),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Order #${ord.orderId}',
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                      ),
                      Text(
                        'Completed • ${ord.placedAt}',
                        style: const TextStyle(fontSize: 11.5, color: AppColors.textMuted),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.hygieneLight,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.check_circle_rounded, size: 14, color: AppColors.hygieneDark),
                        SizedBox(width: 4),
                        Text('Delivered', style: TextStyle(color: AppColors.hygieneDark, fontWeight: FontWeight.bold, fontSize: 11)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              const Divider(height: 1, color: AppColors.borderHairline),
              const SizedBox(height: 12),
              const Text('Items Butchered & Delivered', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
              const SizedBox(height: 8),
              ...ord.items.map((item) {
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          "${item['quantity'] ?? 1}x ${item['name'] ?? 'Cuts'} (${item['weight'] ?? ''})",
                          style: const TextStyle(fontSize: 12.5),
                        ),
                      ),
                      if (item['price'] != null)
                        Text(
                          CurrencyFormatter.format((item['price'] as num).toDouble()),
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12.5),
                        ),
                    ],
                  ),
                );
              }),
              const SizedBox(height: 10),
              const Divider(height: 1, color: AppColors.borderHairline),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Payment Mode', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  Text(ord.paymentMethod ?? 'Razorpay / Online', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Total Amount Paid', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                  Text(
                    CurrencyFormatter.format(ord.amount),
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: AppColors.primaryMaroon),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.location_on_rounded, size: 14, color: AppColors.textMuted),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      ord.deliveryAddress ?? 'Ranchi',
                      style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.surfaceSubtle, foregroundColor: AppColors.textPrimary),
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Close Receipt', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final location = context.watch<LocationProvider>();

    return Scaffold(
      backgroundColor: AppColors.surfacePorcelain,
      appBar: AppBar(
        title: const Text('My Account & Orders'),
        centerTitle: false,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppDimensions.spaceMd),
        physics: const BouncingScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. User Header Card with Edit Profile Button
            Container(
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
                    radius: 28,
                    backgroundColor: AppColors.primaryLight,
                    child: Text(
                      auth.isAuthenticated ? (auth.user?.name.isNotEmpty == true ? auth.user!.name[0].toUpperCase() : 'T') : '?',
                      style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.primaryMaroon),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: auth.isAuthenticated
                        ? Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Flexible(
                                    child: Text(
                                      auth.user?.name.isNotEmpty == true ? auth.user!.name : 'Teffe\'s Patron',
                                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  GestureDetector(
                                    onTap: () => _showEditProfileDialog(context, auth),
                                    child: const Icon(Icons.edit_outlined, size: 16, color: AppColors.primaryMaroon),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 2),
                              Text(
                                auth.user?.phone ?? '+91 98765 43210',
                                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                              ),
                              if (auth.user?.email != null)
                                Text(
                                  auth.user!.email!,
                                  style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                                ),
                            ],
                          )
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Welcome to Teffe\'s', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                              const SizedBox(height: 2),
                              const Text('Log in with your phone number for orders', style: TextStyle(fontSize: 11.5, color: AppColors.textSecondary)),
                              const SizedBox(height: 6),
                              GestureDetector(
                                onTap: () {
                                  Navigator.of(context).push(
                                    SmoothPageRoute(page: const LoginScreen()),
                                  );
                                },
                                child: const Text(
                                  'Login / Register with OTP →',
                                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12, color: AppColors.primaryMaroon),
                                ),
                              ),
                            ],
                          ),
                  ),
                  if (auth.isAuthenticated)
                    OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        side: const BorderSide(color: AppColors.primaryMaroon),
                      ),
                      onPressed: () => _showEditProfileDialog(context, auth),
                      child: const Text('Edit', style: TextStyle(color: AppColors.primaryMaroon, fontWeight: FontWeight.bold, fontSize: 11.5)),
                    ),
                ],
              ),
            ),
            const SizedBox(height: AppDimensions.spaceMd),

            // When Not Logged In: Show Member Privileges & Login CTA Card
            if (!auth.isAuthenticated) ...[
              Container(
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
                          decoration: const BoxDecoration(
                            color: AppColors.primaryLight,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.stars_rounded, color: AppColors.primaryMaroon, size: 22),
                        ),
                        const SizedBox(width: 12),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                "Unlock Teffe's Patron Privileges",
                                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                              ),
                              SizedBox(height: 2),
                              Text(
                                "Login to access Teffe's Cash Wallet, saved delivery addresses & orders",
                                style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    const Divider(height: 1, color: AppColors.borderHairline),
                    const SizedBox(height: 12),
                    _buildGuestBenefitRow(
                      icon: Icons.account_balance_wallet_outlined,
                      title: "Teffe's Cash Wallet",
                      subtitle: "Instant 1-click payment & cashback rewards",
                    ),
                    const SizedBox(height: 10),
                    _buildGuestBenefitRow(
                      icon: Icons.location_on_outlined,
                      title: "Saved Delivery Addresses",
                      subtitle: "Save home, kitchen & office locations for 90-min delivery",
                    ),
                    const SizedBox(height: 10),
                    _buildGuestBenefitRow(
                      icon: Icons.receipt_long_outlined,
                      title: "Live Butchery Order Tracking",
                      subtitle: "Track butchery cutting progress & GPS delivery in real-time",
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primaryMaroon,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: AppDimensions.roundedMd),
                        ),
                        icon: const Icon(Icons.login_rounded, color: Colors.white, size: 16),
                        label: const Text(
                          'Login / Register with OTP',
                          style: TextStyle(fontWeight: FontWeight.w800, color: Colors.white, fontSize: 13),
                        ),
                        onPressed: () {
                          Navigator.of(context).push(
                            SmoothPageRoute(page: const LoginScreen()),
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppDimensions.spaceMd),
            ],

            // 2. Teffe's Cash Wallet Card with "+ Add Money" Razorpay Flow (Only visible when Logged In)
            if (auth.isAuthenticated) ...[
              Container(
                padding: const EdgeInsets.all(AppDimensions.spaceMd),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF91000A), Color(0xFFB70B01)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: AppDimensions.roundedLg,
                  boxShadow: AppDimensions.cardShadow,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          "TEFFE'S CASH WALLET",
                          style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.5),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: Colors.white24,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            auth.user?.loyaltyTier ?? 'Gold Tier',
                            style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          CurrencyFormatter.format(auth.user?.walletBalance ?? 0),
                          style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w900),
                        ),
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white,
                            foregroundColor: AppColors.primaryMaroon,
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            shape: RoundedRectangleBorder(borderRadius: AppDimensions.roundedMd),
                          ),
                          icon: const Icon(Icons.add_circle_outline_rounded, size: 16),
                          label: const Text('+ Add Money', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
                          onPressed: () => _showAddMoneySheet(context, auth),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Instant 1-click checkout with Razorpay wallet auto-topup',
                      style: TextStyle(color: Colors.white70, fontSize: 11),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppDimensions.spaceMd),
            ],

            // 3. Active Current Live Order Section (if any order is active)
            if (auth.activeOrder != null) ...[
              Container(
                padding: const EdgeInsets.all(AppDimensions.spaceMd),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: AppDimensions.roundedLg,
                  border: Border.all(color: Colors.amber.shade400, width: 1.5),
                  boxShadow: AppDimensions.cardShadow,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: const BoxDecoration(
                                color: Colors.green,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 6),
                            const Text(
                              'CURRENT LIVE ORDER',
                              style: TextStyle(fontWeight: FontWeight.w900, fontSize: 11.5, color: Color(0xFF78350F), letterSpacing: 0.5),
                            ),
                          ],
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: Colors.amber.shade100,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            auth.activeOrder!.status,
                            style: TextStyle(color: Colors.amber.shade900, fontWeight: FontWeight.w800, fontSize: 10.5),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Order #${auth.activeOrder!.orderId}',
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      auth.activeOrder!.items.map((i) => "${i['quantity'] ?? 1}x ${i['name']} (${i['weight'] ?? ''})").join(', '),
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        const Icon(Icons.two_wheeler_rounded, size: 14, color: AppColors.deliveryAmber),
                        const SizedBox(width: 4),
                        Builder(
                          builder: (context) {
                            final order = auth.activeOrder!;
                            String etaLabel = '';
                            if (order.status == 'Out for Delivery') {
                              final mins = order.remainingTransitMinutes ?? 12;
                              etaLabel = mins <= 5 ? 'Out for Delivery • Arriving in ~5 min' : 'Out for Delivery • Arriving in $mins min';
                            } else if (order.targetDeliveryTime != null && order.targetDeliveryTime!.isNotEmpty) {
                              try {
                                final dt = DateTime.parse(order.targetDeliveryTime!).toLocal();
                                final hour = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
                                final min = dt.minute.toString().padLeft(2, '0');
                                final ampm = dt.hour >= 12 ? 'PM' : 'AM';
                                etaLabel = 'Preparing cuts • Arriving by $hour:$min $ampm';
                              } catch (_) {
                                etaLabel = '${order.status} • Preparing fresh cuts';
                              }
                            } else {
                              etaLabel = '${order.status} • Preparing fresh cuts';
                            }
                            return Text(
                              etaLabel,
                              style: const TextStyle(fontSize: 11.5, color: Color(0xFF78350F), fontWeight: FontWeight.bold),
                            );
                          },
                        ),
                      ],
                    ),
                    if (auth.activeOrder!.deliveryOtp != null && auth.activeOrder!.deliveryOtp!.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: Colors.amber.shade400),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.pin_rounded, size: 14, color: AppColors.deliveryAmber),
                            const SizedBox(width: 4),
                            Text(
                              'Doorstep OTP: ${auth.activeOrder!.deliveryOtp}',
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFF78350F), letterSpacing: 1),
                            ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primaryMaroon,
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          shape: RoundedRectangleBorder(borderRadius: AppDimensions.roundedMd),
                        ),
                        icon: const Icon(Icons.navigation_rounded, size: 16, color: Colors.white),
                        label: const Text('Track Live Delivery on Map →', style: TextStyle(fontWeight: FontWeight.w800, color: Colors.white, fontSize: 12.5)),
                        onPressed: () {
                          Navigator.of(context).push(
                            SmoothPageRoute(page: OrderTrackingScreen(orderId: auth.activeOrder!.orderId)),
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppDimensions.spaceMd),
            ],

            // 4. Recent Butchery Orders History Section
            if (auth.myOrders.isNotEmpty) ...[
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
                        const Text('Order History', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                        Text('${auth.myOrders.length} orders total', style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    ...auth.myOrders.map((ord) {
                      final isLive = ord.isActive;
                      return Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: isLive ? Colors.amber.shade50.withOpacity(0.5) : AppColors.surfaceSubtle,
                          borderRadius: AppDimensions.roundedMd,
                          border: Border.all(color: isLive ? Colors.amber.shade300 : AppColors.borderHairline),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  ord.orderId,
                                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: AppColors.primaryMaroon),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2.5),
                                  decoration: BoxDecoration(
                                    color: isLive ? Colors.amber.shade100 : AppColors.hygieneLight,
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        isLive ? Icons.two_wheeler_rounded : Icons.check_circle_rounded,
                                        size: 12,
                                        color: isLive ? Colors.amber.shade900 : AppColors.hygieneDark,
                                      ),
                                      const SizedBox(width: 4),
                                      Text(
                                        ord.status,
                                        style: TextStyle(
                                          color: isLive ? Colors.amber.shade900 : AppColors.hygieneDark,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 10.5,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(
                              ord.items.map((i) => "${i['quantity']}x ${i['name']} (${i['weight'] ?? ''})").join('\n'),
                              style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary, height: 1.3),
                            ),
                            const SizedBox(height: 8),
                            const Divider(height: 1, color: AppColors.borderHairline),
                            const SizedBox(height: 8),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(ord.placedAt, style: const TextStyle(fontSize: 10.5, color: AppColors.textMuted)),
                                    if (ord.paymentMethod != null)
                                      Text(ord.paymentMethod!, style: const TextStyle(fontSize: 10, color: AppColors.textMuted)),
                                  ],
                                ),
                                Row(
                                  children: [
                                    Text(
                                      CurrencyFormatter.format(ord.amount),
                                      style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: AppColors.textPrimary),
                                    ),
                                    const SizedBox(width: 8),
                                    if (isLive)
                                      ElevatedButton.icon(
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: AppColors.primaryMaroon,
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                          minimumSize: Size.zero,
                                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                        ),
                                        icon: const Icon(Icons.navigation_rounded, size: 12, color: Colors.white),
                                        label: const Text('Track Live →', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white)),
                                        onPressed: () {
                                          Navigator.of(context).push(
                                            SmoothPageRoute(page: OrderTrackingScreen(orderId: ord.orderId)),
                                          );
                                        },
                                      )
                                    else
                                      TextButton.icon(
                                        style: TextButton.styleFrom(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                          minimumSize: Size.zero,
                                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                        ),
                                        icon: const Icon(Icons.receipt_long_rounded, size: 14, color: AppColors.textSecondary),
                                        label: const Text('View Receipt', style: TextStyle(fontSize: 11.5, color: AppColors.textSecondary, fontWeight: FontWeight.bold)),
                                        onPressed: () => _showOrderReceiptModal(context, ord),
                                      ),
                                  ],
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    }),
                  ],
                ),
              ),
              const SizedBox(height: AppDimensions.spaceMd),
            ],

            // 5. Saved Addresses Section with Edit & Delete Options (Only visible when Logged In)
            if (auth.isAuthenticated) ...[
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
                        const Text('Saved Delivery Addresses', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5)),
                        GestureDetector(
                          onTap: () => _showAddAddressDialog(context, location),
                          child: const Text('+ Add New', style: TextStyle(fontSize: 11.5, color: AppColors.primaryMaroon, fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    ...location.savedAddresses.map((addr) {
                      final isDefault = addr.isDefault;
                      return Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceSubtle,
                          borderRadius: AppDimensions.roundedMd,
                          border: Border.all(color: isDefault ? AppColors.primaryMaroon : AppColors.borderHairline),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              addr.tag.toLowerCase() == 'home' ? Icons.home_rounded : Icons.business_rounded,
                              size: 20,
                              color: isDefault ? AppColors.primaryMaroon : AppColors.textSecondary,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Text(addr.tag, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5)),
                                      if (isDefault) ...[
                                        const SizedBox(width: 6),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                          decoration: BoxDecoration(
                                            color: AppColors.primaryLight,
                                            borderRadius: BorderRadius.circular(4),
                                          ),
                                          child: const Text('Default', style: TextStyle(color: AppColors.primaryMaroon, fontSize: 9.5, fontWeight: FontWeight.bold)),
                                        ),
                                      ],
                                    ],
                                  ),
                                  const SizedBox(height: 2),
                                  Text(addr.fullAddress, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                                ],
                              ),
                            ),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(
                                  icon: const Icon(Icons.edit_outlined, size: 17, color: AppColors.primaryMaroon),
                                  tooltip: 'Edit Address',
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(),
                                  onPressed: () => _showEditAddressDialog(context, location, addr),
                                ),
                                const SizedBox(width: 8),
                                IconButton(
                                  icon: Icon(Icons.delete_outline_rounded, size: 17, color: Colors.red.shade400),
                                  tooltip: 'Delete Address',
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(),
                                  onPressed: () async {
                                    await location.deleteAddress(addr.id);
                                    if (context.mounted) {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(content: Text('Address removed.')),
                                      );
                                    }
                                  },
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    }),
                  ],
                ),
              ),
              const SizedBox(height: AppDimensions.spaceMd),
            ],

            // 6. Butchery Hub Support
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
                  const Text('Customer Support & Assistance', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5)),
                  const SizedBox(height: 6),
                  const Text('Need assistance with your cut or express delivery?', style: TextStyle(fontSize: 11.5, color: AppColors.textSecondary)),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          icon: const Icon(Icons.phone_rounded, size: 16),
                          label: const Text('Call Butchery Hub'),
                          onPressed: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Calling Kishore Ganj Hub at +91 94311 88204...')),
                            );
                          },
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF25D366)),
                          icon: const Icon(Icons.chat_rounded, size: 16, color: Colors.white),
                          label: const Text('WhatsApp Us', style: TextStyle(color: Colors.white)),
                          onPressed: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Opening WhatsApp with Teffe\'s Butchery Support...')),
                            );
                          },
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppDimensions.spaceXl),

            // 7. Logout Button
            if (auth.isAuthenticated)
              SizedBox(
                width: double.infinity,
                child: TextButton.icon(
                  icon: const Icon(Icons.logout_rounded, color: Colors.red),
                  label: const Text('Log Out', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
                  onPressed: () => auth.logout(),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildGuestBenefitRow({
    required IconData icon,
    required String title,
    required String subtitle,
  }) {
    return Row(
      children: [
        Icon(icon, size: 18, color: AppColors.primaryMaroon),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
              ),
              Text(
                subtitle,
                style: const TextStyle(fontSize: 10.5, color: AppColors.textSecondary),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
