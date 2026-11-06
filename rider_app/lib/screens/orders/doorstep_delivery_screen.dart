import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
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

  // Doorstep payment state (Cash vs Dynamic UPI QR)
  String _paymentMode = 'cash'; // 'cash' | 'qr'
  bool _isQrLoading = false;
  String _upiQrData = '';
  String _qrPaymentStatus = 'pending'; // 'pending' | 'success' | 'failed'
  String? _qrTransactionId;
  String? _qrErrorMessage;
  Timer? _pollTimer;
  bool _isCheckingStatus = false;

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
    _pollTimer?.cancel();
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

  Future<void> _loadDoorstepQr() async {
    setState(() {
      _isQrLoading = true;
      _qrErrorMessage = null;
    });

    final provider = context.read<RiderOrdersProvider>();
    final data = await provider.fetchDoorstepQr(widget.order.id);
    if (!mounted) return;

    if (data != null && data['success'] == true) {
      final bool alreadyPaid = data['isPaid'] == true;
      setState(() {
        _isQrLoading = false;
        _upiQrData = data['upiUri'] ??
            'upi://pay?pa=teffes@icici&pn=Teffes%20Fresh%20Meat&am=${widget.order.totalAmount.toStringAsFixed(2)}&tr=${widget.order.orderNumber}&tn=Order%20${widget.order.orderNumber}&cu=INR';
        if (alreadyPaid) {
          _qrPaymentStatus = 'success';
          _qrTransactionId = data['transactionId'];
        } else {
          _qrPaymentStatus = 'pending';
          _startPollTimer();
        }
      });
    } else {
      setState(() {
        _isQrLoading = false;
        // Standard NPCI UPI URI fallback guaranteed to work on all UPI apps
        _upiQrData =
            'upi://pay?pa=teffes@icici&pn=Teffes%20Fresh%20Meat&am=${widget.order.totalAmount.toStringAsFixed(2)}&tr=${widget.order.orderNumber}&tn=Order%20${widget.order.orderNumber}&cu=INR';
        _qrPaymentStatus = 'pending';
        _startPollTimer();
      });
    }
  }

  void _startPollTimer() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      _checkPaymentStatus(silent: true);
    });
  }

  Future<void> _checkPaymentStatus({bool silent = false}) async {
    if (_isCheckingStatus) return;
    if (!silent) setState(() => _isCheckingStatus = true);

    final provider = context.read<RiderOrdersProvider>();
    final res = await provider.checkDoorstepPaymentStatus(widget.order.id);
    if (!mounted) return;

    if (!silent) setState(() => _isCheckingStatus = false);

    if (res != null && res['isPaid'] == true) {
      _pollTimer?.cancel();
      setState(() {
        _qrPaymentStatus = 'success';
        _qrTransactionId = res['transactionId'];
        _qrErrorMessage = null;
      });
      if (!silent) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✓ Payment Verified via UPI! Please enter customer OTP.'),
            backgroundColor: AppColors.dutyOnline,
          ),
        );
      }
    } else if (res != null && (res['paymentStatus'] == 'Failed' || res['paymentStatus'] == 'failure')) {
      setState(() {
        _qrPaymentStatus = 'failed';
        _qrErrorMessage = 'Payment Failed. Please ask customer to retry or pay with Cash.';
      });
    } else if (!silent) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Payment not detected yet. Please ensure customer completed the UPI transfer.'),
          backgroundColor: AppColors.deliveryAmber,
        ),
      );
    }
  }

  Future<void> _manualVerifyPayment() async {
    setState(() => _isCheckingStatus = true);
    final provider = context.read<RiderOrdersProvider>();

    // 1. Re-check server first
    final res = await provider.checkDoorstepPaymentStatus(widget.order.id);
    if (!mounted) return;

    if (res != null && res['isPaid'] == true) {
      _pollTimer?.cancel();
      setState(() {
        _isCheckingStatus = false;
        _qrPaymentStatus = 'success';
        _qrTransactionId = res['transactionId'];
      });
      return;
    }

    // 2. Confirm doorstep payment if customer showed successful debit screen / SMS
    final success = await provider.confirmDoorstepPayment(orderId: widget.order.id);
    if (!mounted) return;

    setState(() => _isCheckingStatus = false);
    if (success) {
      _pollTimer?.cancel();
      setState(() {
        _qrPaymentStatus = 'success';
        _qrTransactionId = 'UPI_${DateTime.now().millisecondsSinceEpoch}';
        _qrErrorMessage = null;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('✓ Doorstep UPI Payment Verified!'),
          backgroundColor: AppColors.dutyOnline,
        ),
      );
    } else {
      setState(() {
        _qrPaymentStatus = 'failed';
        _qrErrorMessage = 'Payment Failed. Please ask customer to retry or pay with Cash.';
      });
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
      if (_paymentMode == 'qr') {
        if (_qrPaymentStatus != 'success') {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Please wait for UPI QR payment confirmation or switch to Cash payment.'),
              backgroundColor: AppColors.error,
            ),
          );
          return;
        }
        cashCollected = 0.0; // ₹0 physical cash collected when customer pays via UPI QR
      } else {
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
        cashCollected = received;
      }
    }

    setState(() => _isSubmitting = true);
    final ordersProvider = context.read<RiderOrdersProvider>();
    final success = await ordersProvider.completeDelivery(
      orderId: widget.order.id,
      otp: otp,
      cashCollected: cashCollected,
      paymentMode: _paymentMode,
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
        padding: EdgeInsets.fromLTRB(16, 16, 16, 24 + MediaQuery.of(context).viewPadding.bottom),
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
                  if (order.deliveryInstruction != null && order.deliveryInstruction!.trim().isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFFBEB),
                        border: Border.all(color: const Color(0xFFFDE68A)),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.sticky_note_2_outlined, size: 16, color: Color(0xFFB45309)),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Customer Instruction: ${order.deliveryInstruction!.trim()}',
                              style: const TextStyle(
                                fontSize: 12,
                                color: Color(0xFF92400E),
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
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
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Doorstep Payment Card (COD: Cash or Dynamic UPI QR)
            if (order.isCod)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: AppDimensions.roundedLg,
                  border: Border.all(
                    color: _paymentMode == 'qr'
                        ? const Color(0xFF0284C7).withOpacity(0.5)
                        : AppColors.deliveryAmber.withOpacity(0.5),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Payment at Doorstep',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        Text(
                          CurrencyFormatter.format(order.totalAmount),
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            color: AppColors.primaryMaroon,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // Segmented Toggle between Cash and UPI QR
                    Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceInput,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: GestureDetector(
                              onTap: () {
                                _pollTimer?.cancel();
                                setState(() {
                                  _paymentMode = 'cash';
                                });
                              },
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 150),
                                padding: const EdgeInsets.symmetric(vertical: 9),
                                decoration: BoxDecoration(
                                  color: _paymentMode == 'cash' ? Colors.white : Colors.transparent,
                                  borderRadius: BorderRadius.circular(9),
                                  boxShadow: _paymentMode == 'cash'
                                      ? [
                                          BoxShadow(
                                            color: Colors.black.withOpacity(0.06),
                                            blurRadius: 4,
                                            offset: const Offset(0, 1),
                                          )
                                        ]
                                      : null,
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(
                                      Icons.payments_rounded,
                                      size: 16,
                                      color: _paymentMode == 'cash' ? AppColors.deliveryAmber : AppColors.textSecondary,
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      'Cash',
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w800,
                                        color: _paymentMode == 'cash' ? AppColors.textPrimary : AppColors.textSecondary,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          Expanded(
                            child: GestureDetector(
                              onTap: () {
                                setState(() {
                                  _paymentMode = 'qr';
                                });
                                if (_upiQrData.isEmpty) {
                                  _loadDoorstepQr();
                                } else if (_qrPaymentStatus != 'success') {
                                  _startPollTimer();
                                }
                              },
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 150),
                                padding: const EdgeInsets.symmetric(vertical: 9),
                                decoration: BoxDecoration(
                                  color: _paymentMode == 'qr' ? Colors.white : Colors.transparent,
                                  borderRadius: BorderRadius.circular(9),
                                  boxShadow: _paymentMode == 'qr'
                                      ? [
                                          BoxShadow(
                                            color: Colors.black.withOpacity(0.06),
                                            blurRadius: 4,
                                            offset: const Offset(0, 1),
                                          )
                                        ]
                                      : null,
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(
                                      Icons.qr_code_2_rounded,
                                      size: 16,
                                      color: _paymentMode == 'qr' ? const Color(0xFF0284C7) : AppColors.textSecondary,
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      'Scan UPI QR',
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w800,
                                        color: _paymentMode == 'qr' ? const Color(0xFF0284C7) : AppColors.textSecondary,
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
                    const SizedBox(height: 14),

                    // ─── TAB 1: CASH PAYMENT FLOW ───
                    if (_paymentMode == 'cash') ...[
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
                            'Change / Wallet Credit:',
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
                      if (_changeToReturn > 0)
                        Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Text(
                            'Excess amount will be credited to customer TeFFe wallet if no physical change.',
                            style: TextStyle(fontSize: 11, color: AppColors.dutyOnline.withOpacity(0.9), fontWeight: FontWeight.w600),
                          ),
                        ),
                    ],

                    // ─── TAB 2: UPI QR FLOW ───
                    if (_paymentMode == 'qr') ...[
                      if (_isQrLoading)
                        Container(
                          padding: const EdgeInsets.symmetric(vertical: 30),
                          alignment: Alignment.center,
                          child: const Column(
                            children: [
                              CircularProgressIndicator(strokeWidth: 2.5, color: Color(0xFF0284C7)),
                              SizedBox(height: 12),
                              Text(
                                'Generating TeFFe\'s Secure UPI QR...',
                                style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                        )
                      else if (_qrPaymentStatus == 'success')
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFFECFDF5),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFFA7F3D0)),
                          ),
                          child: Column(
                            children: [
                              const Icon(Icons.check_circle_rounded, color: AppColors.dutyOnline, size: 40),
                              const SizedBox(height: 8),
                              Text(
                                '✓ Payment of ${CurrencyFormatter.format(order.totalAmount)} Received!',
                                style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF065F46),
                                ),
                              ),
                              if (_qrTransactionId != null) ...[
                                const SizedBox(height: 4),
                                Text(
                                  'Ref / UTR: $_qrTransactionId',
                                  style: const TextStyle(fontSize: 11, color: Color(0xFF047857), fontWeight: FontWeight.w600),
                                ),
                              ],
                              const SizedBox(height: 8),
                              const Text(
                                'Zero physical cash needed. Enter customer OTP above and tap Complete Delivery.',
                                textAlign: TextAlign.center,
                                style: TextStyle(fontSize: 12, color: Color(0xFF065F46)),
                              ),
                            ],
                          ),
                        )
                      else ...[
                        // Error message if previous scan failed (QR STAYS VISIBLE as requested!)
                        if (_qrErrorMessage != null)
                          Container(
                            margin: const EdgeInsets.only(bottom: 12),
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFEF2F2),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: const Color(0xFFFECACA)),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Icon(Icons.error_outline_rounded, size: 16, color: Color(0xFFDC2626)),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    _qrErrorMessage!,
                                    style: const TextStyle(
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFF991B1B),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),

                        // The Dynamic QR Box
                        Center(
                          child: Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: const Color(0xFFBAE6FD)),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFF0284C7).withOpacity(0.08),
                                  blurRadius: 10,
                                  offset: const Offset(0, 3),
                                ),
                              ],
                            ),
                            child: Column(
                              children: [
                                Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Icon(Icons.verified_rounded, size: 14, color: Color(0xFF0284C7)),
                                    const SizedBox(width: 4),
                                    Text(
                                      'TeFFe\'s Official UPI QR',
                                      style: TextStyle(
                                        fontSize: 11.5,
                                        fontWeight: FontWeight.w800,
                                        color: Colors.blue.shade900,
                                        letterSpacing: 0.2,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 10),
                                if (_upiQrData.isNotEmpty)
                                  QrImageView(
                                    data: _upiQrData,
                                    version: QrVersions.auto,
                                    size: 175.0,
                                    backgroundColor: Colors.white,
                                  )
                                else
                                  const SizedBox(
                                    height: 175,
                                    width: 175,
                                    child: Center(child: CircularProgressIndicator()),
                                  ),
                                const SizedBox(height: 8),
                                Text(
                                  CurrencyFormatter.format(order.totalAmount),
                                  style: const TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w900,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                const Text(
                                  'Scan via Google Pay, PhonePe, Paytm or BHIM',
                                  style: TextStyle(fontSize: 11, color: AppColors.textSecondary, fontWeight: FontWeight.w600),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),

                        // Action / Live polling row
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: _isCheckingStatus ? null : () => _checkPaymentStatus(silent: false),
                                icon: _isCheckingStatus
                                    ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                                    : const Icon(Icons.sync_rounded, size: 16),
                                label: const Text('Check Status', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: const Color(0xFF0284C7),
                                  side: const BorderSide(color: Color(0xFFBAE6FD)),
                                  padding: const EdgeInsets.symmetric(vertical: 10),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: ElevatedButton.icon(
                                onPressed: _isCheckingStatus ? null : _manualVerifyPayment,
                                icon: const Icon(Icons.check_circle_outline_rounded, size: 16),
                                label: const Text('Customer Paid', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF0284C7),
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  padding: const EdgeInsets.symmetric(vertical: 10),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
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
                        'Prepaid Online. No cash collection required.',
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
