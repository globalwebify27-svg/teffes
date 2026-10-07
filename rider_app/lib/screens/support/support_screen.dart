import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/api_endpoints.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../core/network/api_client.dart';
import '../../providers/rider_auth_provider.dart';

class SupportScreen extends StatefulWidget {
  const SupportScreen({super.key});

  @override
  State<SupportScreen> createState() => _SupportScreenState();
}

class _SupportScreenState extends State<SupportScreen> {
  final ApiClient _api = ApiClient();
  Map<String, dynamic>? _dispatchData;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _fetchDispatchSupport();
  }

  Future<void> _fetchDispatchSupport() async {
    setState(() => _isLoading = true);
    try {
      final res = await _api.get(ApiEndpoints.riderDispatchSupport);
      if (res.data['success'] == true && res.data['dispatchSupport'] != null) {
        if (mounted) {
          setState(() {
            _dispatchData = res.data['dispatchSupport'] as Map<String, dynamic>;
          });
        }
      }
    } catch (_) {
      // Offline fallback: will read from RiderAuthProvider
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _callStoreAdmin(String adminName, String storeName, String phone) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: const BoxDecoration(
                color: AppColors.primaryLight,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.phone_in_talk_rounded, color: AppColors.primaryMaroon, size: 20),
            ),
            const SizedBox(width: 10),
            const Text('Dispatch Desk Call', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Calling Store Admin for your hub:', style: TextStyle(fontSize: 12.5, color: Colors.grey.shade600)),
            const SizedBox(height: 8),
            Text(adminName, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
            Text(storeName, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.phone, size: 16, color: AppColors.primaryMaroon),
                  const SizedBox(width: 8),
                  Text(phone, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primaryMaroon,
              foregroundColor: Colors.white,
            ),
            onPressed: () {
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('Calling Store Admin ($adminName) at $phone...'),
                  backgroundColor: AppColors.dutyOnline,
                ),
              );
            },
            icon: const Icon(Icons.call, size: 16),
            label: const Text('Call Now'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<RiderAuthProvider>();
    final rider = auth.rider;

    // Dynamically retrieve associated Store Admin details from live API or Rider Profile
    final storeName = _dispatchData?['storeName'] ?? rider?.storeName ?? 'TeFFe\'s — Kishore Ganj Hub';
    final adminName = _dispatchData?['storeAdminName'] ?? rider?.storeAdminName ?? 'Rahul Sharma';
    final adminPhone = _dispatchData?['storeAdminPhone'] ?? rider?.storeAdminPhone ?? '+91 9779687955';
    final timings = _dispatchData?['timings'] ?? '08:00 AM - 08:00 PM';

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text(
          'Ranchi Dispatch Support',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
        ),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.textPrimary,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          IconButton(
            icon: _isLoading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primaryMaroon),
                  )
                : const Icon(Icons.sync_rounded, color: AppColors.primaryMaroon),
            tooltip: 'Sync Dispatch Desk',
            onPressed: _fetchDispatchSupport,
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: AppDimensions.roundedLg,
                border: Border.all(color: AppColors.borderHairline),
              ),
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.primaryLight.withValues(alpha: 0.5),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.headset_mic_rounded, size: 40, color: AppColors.primaryMaroon),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'Need Help on Route?',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Our $storeName dispatch desk is available during all operational delivery hours ($timings).',
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
                  ),
                  const SizedBox(height: 12),
                  // Store Admin Contact Chip
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF2F2),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFFECACA)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.person_pin_rounded, size: 16, color: AppColors.primaryMaroon),
                        const SizedBox(width: 8),
                        Flexible(
                          child: Text(
                            'Store Admin: $adminName ($storeName)',
                            style: const TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w800,
                              color: AppColors.primaryMaroon,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      onPressed: () => _callStoreAdmin(adminName, storeName, adminPhone),
                      icon: const Icon(Icons.call, size: 18),
                      label: Text(
                        'Call Dispatch Desk ($adminPhone)',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                        overflow: TextOverflow.ellipsis,
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primaryMaroon,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            const Text(
              'Frequently Asked Questions',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
            ),
            const SizedBox(height: 10),
            _buildFaqItem(
              question: 'How do I collect the 4-digit Delivery OTP?',
              answer: 'Once you arrive at the customer doorstep, ask them to check their TeFFe mobile app. A 4-digit code is prominently displayed on their Order Tracking screen. Enter that code into your app to complete the handover.',
            ),
            const SizedBox(height: 10),
            _buildFaqItem(
              question: 'Customer paid online, do I collect cash?',
              answer: 'No! If the order states "Prepaid Online via Razorpay", you do not collect any cash. Simply verify the 4-digit OTP and handover the cold meat packet.',
            ),
            const SizedBox(height: 10),
            _buildFaqItem(
              question: 'When is COD cash deposited?',
              answer: 'All Cash-on-Delivery collections must be deposited at your assigned store hub ($storeName) closing counter at the end of each duty shift.',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFaqItem({required String question, required String answer}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: AppDimensions.roundedLg,
        border: Border.all(color: AppColors.borderHairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            question,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 6),
          Text(
            answer,
            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4),
          ),
        ],
      ),
    );
  }
}
