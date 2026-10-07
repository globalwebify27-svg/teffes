import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../core/utils/currency_formatter.dart';
import '../../models/rider_order_model.dart';
import '../../providers/rider_orders_provider.dart';
import '../main_shell_screen.dart';

class DoorstepDeliveryScreen extends StatefulWidget {
  final RiderOrder order;

  const DoorstepDeliveryScreen({super.key, required this.order});

  @override
  State<DoorstepDeliveryScreen> createState() => _DoorstepDeliveryScreenState();
}

class _DoorstepDeliveryScreenState extends State<DoorstepDeliveryScreen> {
  // 4 Square OTP Controllers and Focus Nodes
  final TextEditingController _box1 = TextEditingController();
  final TextEditingController _box2 = TextEditingController();
  final TextEditingController _box3 = TextEditingController();
  final TextEditingController _box4 = TextEditingController();

  final FocusNode _fn1 = FocusNode();
  final FocusNode _fn2 = FocusNode();
  final FocusNode _fn3 = FocusNode();
  final FocusNode _fn4 = FocusNode();

  final TextEditingController _cashReceivedController = TextEditingController();
  double _changeToReturn = 0.0;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    if (widget.order.isCod) {
      _cashReceivedController.text = widget.order.totalAmount.toStringAsFixed(0);
      _calculateChange(widget.order.totalAmount.toStringAsFixed(0));
    }
  }

  @override
  void dispose() {
    _box1.dispose();
    _box2.dispose();
    _box3.dispose();
    _box4.dispose();
    _fn1.dispose();
    _fn2.dispose();
    _fn3.dispose();
    _fn4.dispose();
    _cashReceivedController.dispose();
    super.dispose();
  }

  String get _currentOtp => '${_box1.text}${_box2.text}${_box3.text}${_box4.text}'.trim();

  void _calculateChange(String val) {
    final received = double.tryParse(val) ?? 0.0;
    setState(() {
      _changeToReturn = (received - widget.order.totalAmount).clamp(0.0, 99999.0);
    });
  }

  void _fillOtp(String code) {
    final clean = code.replaceAll(RegExp(r'\D'), '');
    if (clean.length >= 4) {
      _box1.text = clean[0];
      _box2.text = clean[1];
      _box3.text = clean[2];
      _box4.text = clean[3];
      _fn4.requestFocus();
      setState(() {});
    }
  }

  Future<void> _handleCompleteDelivery() async {
    final otp = _currentOtp;
    if (otp.length < 4) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter the 4-digit Delivery OTP from the customer.'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    double cashCollected = 0.0;
    if (widget.order.isCod) {
      final received = double.tryParse(_cashReceivedController.text) ?? 0.0;
      if (received < widget.order.totalAmount) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('COD Amount must be at least ${CurrencyFormatter.format(widget.order.totalAmount)}'),
            backgroundColor: AppColors.error,
          ),
        );
        return;
      }
      cashCollected = widget.order.totalAmount;
    }

    setState(() => _isSubmitting = true);
    final ordersProvider = context.read<RiderOrdersProvider>();
    final success = await ordersProvider.completeDelivery(
      orderId: widget.order.id,
      otp: otp,
      cashCollected: cashCollected,
    );
    setState(() => _isSubmitting = false);

    if (!mounted) return;

    if (success) {
      _showSuccessDialog();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(ordersProvider.errorMessage ?? 'OTP verification failed. Please ask customer to re-check.'),
          backgroundColor: AppColors.error,
        ),
      );
    }
  }

  void _showSuccessDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogCtx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: const BoxDecoration(
                  color: AppColors.dutyOnlineBg,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.check_circle_rounded,
                  color: AppColors.dutyOnline,
                  size: 44,
                ),
              ),
              const SizedBox(height: 18),
              const Text(
                'Delivery Completed!',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Order #${widget.order.orderNumber} successfully delivered to ${widget.order.customerName}.',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: AppColors.surfacePorcelain,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.borderHairline),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Rider Payout Credited:',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                    ),
                    Text(
                      '+ ${CurrencyFormatter.format(widget.order.riderEarning)}',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: AppColors.dutyOnline,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.of(dialogCtx).pop();
                    Navigator.of(context).pushAndRemoveUntil(
                      MaterialPageRoute(builder: (_) => const MainShellScreen()),
                      (route) => false,
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryMaroon,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text(
                    'Return to Dashboard',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildOtpSquare({
    required TextEditingController controller,
    required FocusNode focusNode,
    FocusNode? nextFocus,
    FocusNode? prevFocus,
  }) {
    final hasValue = controller.text.isNotEmpty;
    final hasFocus = focusNode.hasFocus;

    return Container(
      width: 58,
      height: 62,
      decoration: BoxDecoration(
        color: hasFocus ? Colors.white : AppColors.surfaceInput,
        borderRadius: AppDimensions.roundedLg,
        border: Border.all(
          color: hasFocus
              ? AppColors.primaryMaroon
              : (hasValue ? AppColors.textPrimary : AppColors.borderHairline),
          width: hasFocus ? 2.0 : 1.2,
        ),
        boxShadow: hasFocus
            ? [
                BoxShadow(
                  color: AppColors.primaryMaroon.withOpacity(0.15),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ]
            : null,
      ),
      child: RawKeyboardListener(
        focusNode: FocusNode(),
        onKey: (event) {
          if (event is RawKeyDownEvent &&
              event.logicalKey == LogicalKeyboardKey.backspace &&
              controller.text.isEmpty &&
              prevFocus != null) {
            prevFocus.requestFocus();
          }
        },
        child: TextField(
          controller: controller,
          focusNode: focusNode,
          keyboardType: TextInputType.number,
          textAlign: TextAlign.center,
          maxLength: 1,
          style: const TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.w900,
            color: AppColors.textPrimary,
          ),
          decoration: const InputDecoration(
            counterText: '',
            border: InputBorder.none,
            enabledBorder: InputBorder.none,
            focusedBorder: InputBorder.none,
            contentPadding: EdgeInsets.zero,
          ),
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          onChanged: (val) {
            if (val.isNotEmpty) {
              if (nextFocus != null) {
                nextFocus.requestFocus();
              } else {
                focusNode.unfocus();
              }
            } else {
              if (prevFocus != null) {
                prevFocus.requestFocus();
              }
            }
            setState(() {});
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text(
          'Doorstep Handover',
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
        ),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.textPrimary,
        elevation: 0.5,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Customer Details Card
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
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: AppColors.primaryLight.withOpacity(0.5),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.person_pin_circle_rounded,
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
                              order.customerName,
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              order.customerPhone,
                              style: const TextStyle(
                                fontSize: 13,
                                color: AppColors.textSecondary,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Divider(color: AppColors.borderHairline, height: 1),
                  const SizedBox(height: 12),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.home_work_outlined, size: 18, color: AppColors.textSecondary),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          order.customerAddress,
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppColors.textPrimary,
                            height: 1.3,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // OTP Verification Box
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: AppDimensions.roundedLg,
                border: Border.all(color: AppColors.borderHairline),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  const Text(
                    'Ask Customer for Delivery OTP',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Enter the 4-digit code displayed on customer\'s TeFFe app',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 20),

                  // 4 OTP Boxes
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      _buildOtpSquare(controller: _box1, focusNode: _fn1, nextFocus: _fn2),
                      const SizedBox(width: 12),
                      _buildOtpSquare(controller: _box2, focusNode: _fn2, nextFocus: _fn3, prevFocus: _fn1),
                      const SizedBox(width: 12),
                      _buildOtpSquare(controller: _box3, focusNode: _fn3, nextFocus: _fn4, prevFocus: _fn2),
                      const SizedBox(width: 12),
                      _buildOtpSquare(controller: _box4, focusNode: _fn4, prevFocus: _fn3),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Quick OTP Helper for Testing / Demo
                  if (order.deliveryOtp != null && order.deliveryOtp!.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: AppColors.deliveryAmberBg,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.vpn_key_rounded, size: 14, color: AppColors.deliveryAmber),
                          const SizedBox(width: 6),
                          Text(
                            'Order OTP: ${order.deliveryOtp}',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              color: AppColors.deliveryAmber,
                            ),
                          ),
                          const SizedBox(width: 10),
                          GestureDetector(
                            onTap: () => _fillOtp(order.deliveryOtp!),
                            child: const Text(
                              'Auto Fill',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                                color: AppColors.primaryMaroon,
                                decoration: TextDecoration.underline,
                              ),
                            ),
                          ),
                        ],
                      ),
                    )
                  else
                    GestureDetector(
                      onTap: () => _fillOtp('1234'),
                      child: const Text(
                        'Demo OTP: 1234 (Tap to Fill)',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primaryMaroon,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // COD Cash Collection Card
            if (order.isCod)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: AppDimensions.roundedLg,
                  border: Border.all(color: AppColors.deliveryAmber.withOpacity(0.5)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Cash on Delivery (COD)',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            color: AppColors.deliveryAmber,
                          ),
                        ),
                        Text(
                          CurrencyFormatter.format(order.totalAmount),
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Cash Received from Customer:',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: _cashReceivedController,
                      keyboardType: TextInputType.number,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      onChanged: _calculateChange,
                      decoration: InputDecoration(
                        prefixText: '₹ ',
                        filled: true,
                        fillColor: AppColors.surfaceInput,
                        border: OutlineInputBorder(
                          borderRadius: AppDimensions.roundedMd,
                          borderSide: const BorderSide(color: AppColors.borderHairline),
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Change to Return:',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                        ),
                        Text(
                          CurrencyFormatter.format(_changeToReturn),
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            color: _changeToReturn > 0 ? AppColors.dutyOnline : AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              )
            else
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.dutyOnlineBg,
                  borderRadius: AppDimensions.roundedLg,
                  border: Border.all(color: AppColors.dutyOnline.withOpacity(0.3)),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.check_circle_rounded, color: AppColors.dutyOnline, size: 20),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Prepaid via Razorpay Online. No cash collection required.',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppColors.dutyOnline,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 24),

            // Submit Button
            SizedBox(
              height: 52,
              child: ElevatedButton(
                onPressed: _isSubmitting ? null : _handleCompleteDelivery,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primaryMaroon,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: AppDimensions.roundedLg,
                  ),
                ),
                child: _isSubmitting
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.5,
                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      )
                    : const Text(
                        'Verify OTP & Complete Delivery',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
