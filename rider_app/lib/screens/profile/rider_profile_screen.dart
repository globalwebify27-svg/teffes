import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../providers/rider_auth_provider.dart';
import '../auth/login_screen.dart';
import '../support/support_screen.dart';

class RiderProfileScreen extends StatelessWidget {
  const RiderProfileScreen({super.key});

  void _handleLogout(BuildContext context) {
    showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Sign Out of Duty?'),
        content: const Text(
          'You will be set Offline and will not receive any delivery requests until you log back in.',
          style: TextStyle(fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogCtx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.of(dialogCtx).pop();
              await context.read<RiderAuthProvider>().logout();
              if (context.mounted) {
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                  (route) => false,
                );
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
            ),
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<RiderAuthProvider>();
    final rider = auth.rider;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text(
          'Rider Profile',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
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
            // Rider Avatar and Identity Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: AppDimensions.roundedLg,
                border: Border.all(color: AppColors.borderHairline),
              ),
              child: Row(
                children: [
                  Container(
                    width: 60,
                    height: 60,
                    decoration: BoxDecoration(
                      color: AppColors.primaryLight.withOpacity(0.6),
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.primaryMaroon.withOpacity(0.3), width: 1.5),
                    ),
                    child: const Center(
                      child: Icon(Icons.person, size: 36, color: AppColors.primaryMaroon),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          rider?.name ?? 'Ravi Kumar',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          rider?.email ?? 'rider@teffes.com',
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppColors.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.dutyOnlineBg,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                'ID: ${rider?.id ?? "RIDER-001"}',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.dutyOnline,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            const Row(
                              children: [
                                Icon(Icons.star_rounded, size: 16, color: AppColors.ratingStar),
                                SizedBox(width: 2),
                                Text(
                                  '4.9 ★',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Vehicle & Store Hub Assignment Card
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
                    'DUTY ASSIGNMENTS',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textSecondary,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 12),
                  _buildProfileRow(
                    icon: Icons.two_wheeler_rounded,
                    title: 'Vehicle Registration',
                    value: rider?.vehicleNumber ?? 'JH01-EC-4821 (Honda Activa)',
                  ),
                  const Divider(color: AppColors.borderHairline, height: 16),
                  _buildProfileRow(
                    icon: Icons.storefront_rounded,
                    title: 'Assigned Dark Store Hub',
                    value: rider?.assignedStore ?? 'Store S001 - Kanke Road, Ranchi',
                  ),
                  const Divider(color: AppColors.borderHairline, height: 16),
                  _buildProfileRow(
                    icon: Icons.verified_user_rounded,
                    title: 'Food Safety Training',
                    value: 'Certified (FSSAI Cold-Chain Valid)',
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Operational Menu Options
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: AppDimensions.roundedLg,
                border: Border.all(color: AppColors.borderHairline),
              ),
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.headset_mic_rounded, color: AppColors.primaryMaroon),
                    title: const Text('Ranchi Hub Dispatch Support', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                    trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppColors.textMuted),
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const SupportScreen()),
                      );
                    },
                  ),
                  const Divider(color: AppColors.borderHairline, height: 1),
                  ListTile(
                    leading: const Icon(Icons.security_rounded, color: AppColors.primaryMaroon),
                    title: const Text('Fresh Cut Handling Guidelines', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                    trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppColors.textMuted),
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Maintain all meat packs safely inside insulated box for immediate delivery.')),
                      );
                    },
                  ),
                  const Divider(color: AppColors.borderHairline, height: 1),
                  ListTile(
                    leading: const Icon(Icons.info_outline_rounded, color: AppColors.textSecondary),
                    title: const Text('TeFFe Rider App Version', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                    trailing: const Text('v1.0.0 (Phase 1)', style: TextStyle(fontSize: 12, color: AppColors.textMuted, fontWeight: FontWeight.w700)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Logout Button
            SizedBox(
              height: 50,
              child: OutlinedButton.icon(
                onPressed: () => _handleLogout(context),
                icon: const Icon(Icons.logout_rounded, color: AppColors.error, size: 20),
                label: const Text(
                  'Sign Out of Duty',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.error,
                  ),
                ),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: AppColors.error),
                  shape: RoundedRectangleBorder(
                    borderRadius: AppDimensions.roundedMd,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileRow({
    required IconData icon,
    required String title,
    required String value,
  }) {
    return Row(
      children: [
        Icon(icon, size: 20, color: AppColors.primaryMaroon),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
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
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
