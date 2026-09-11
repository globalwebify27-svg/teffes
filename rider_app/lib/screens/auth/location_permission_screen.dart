import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../providers/rider_location_provider.dart';
import '../main_shell_screen.dart';

class LocationPermissionScreen extends StatefulWidget {
  const LocationPermissionScreen({super.key});

  @override
  State<LocationPermissionScreen> createState() => _LocationPermissionScreenState();
}

class _LocationPermissionScreenState extends State<LocationPermissionScreen> {
  bool _isRequesting = false;

  Future<void> _grantPermission() async {
    setState(() => _isRequesting = true);
    final locationProvider = context.read<RiderLocationProvider>();
    final granted = await locationProvider.requestPermission();
    setState(() => _isRequesting = false);

    if (!mounted) return;

    if (granted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const MainShellScreen()),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Location permission is required while on duty for order assignment and live delivery tracking.'),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              Center(
                child: Container(
                  width: 120,
                  height: 120,
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight.withOpacity(0.6),
                    shape: BoxShape.circle,
                  ),
                  child: const Center(
                    child: Icon(
                      Icons.location_on_rounded,
                      size: 64,
                      color: AppColors.primaryMaroon,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 32),
              const Text(
                'Enable GPS & Location',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'To accept meat deliveries and allow customers to track your arrival, TeFFe Rider needs background GPS location enabled while you are Online.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w400,
                  color: AppColors.textSecondary,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 32),

              // Feature benefits list
              _buildFeatureItem(
                icon: Icons.store_rounded,
                title: 'Accurate Hub Proximity',
                subtitle: 'Get notified for orders nearest to Ranchi dark store',
              ),
              const SizedBox(height: 16),
              _buildFeatureItem(
                icon: Icons.directions_bike_rounded,
                title: 'Turn-by-Turn Navigation',
                subtitle: 'Fastest doorstep meat delivery routes with live traffic',
              ),
              const SizedBox(height: 16),
              _buildFeatureItem(
                icon: Icons.verified_user_rounded,
                title: 'Safe Customer Handover',
                subtitle: 'Automatic arrival confirmation and 4-digit OTP unlock',
              ),

              const Spacer(),

              // Action button
              SizedBox(
                height: 52,
                child: ElevatedButton(
                  onPressed: _isRequesting ? null : _grantPermission,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryMaroon,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: AppDimensions.roundedLg,
                    ),
                  ),
                  child: _isRequesting
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : const Text(
                          'Allow Location & Start Duty',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFeatureItem({
    required IconData icon,
    required String title,
    required String subtitle,
  }) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: AppColors.surfaceSubtle,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, size: 22, color: AppColors.primaryMaroon),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
