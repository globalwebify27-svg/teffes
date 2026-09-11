import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../providers/location_provider.dart';

class LocationHeader extends StatelessWidget {
  final VoidCallback? onNotificationTap;
  final VoidCallback? onLocationTap;
  final bool showNotification;

  const LocationHeader({
    super.key,
    this.onNotificationTap,
    this.onLocationTap,
    this.showNotification = true,
  });

  @override
  Widget build(BuildContext context) {
    final locationProvider = context.watch<LocationProvider>();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppDimensions.spaceMd, vertical: AppDimensions.spaceXs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Location details (Tap to change address)
          Expanded(
            child: GestureDetector(
              onTap: onLocationTap ?? () => _showLocationBottomSheet(context),
              behavior: HitTestBehavior.opaque,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        locationProvider.activeLabel,
                        style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: AppColors.textPrimary,
                            ),
                      ),
                      const SizedBox(width: 4),
                      const Icon(
                        Icons.keyboard_arrow_down_rounded,
                        size: 20,
                        color: AppColors.textPrimary,
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    locationProvider.activeAddressString,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                          fontWeight: FontWeight.w500,
                        ),
                  ),
                ],
              ),
            ),
          ),

          // Notification Bell Icon with subtle circle container
          if (showNotification)
            GestureDetector(
              onTap: onNotificationTap,
              child: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppColors.surfaceSubtle,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.borderHairline),
                ),
                child: const Icon(
                  Icons.notifications_none_rounded,
                  size: 20,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
        ],
      ),
    );
  }

  void _showLocationBottomSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => const _LocationPickerModal(),
    );
  }
}

class _LocationPickerModal extends StatelessWidget {
  const _LocationPickerModal();

  @override
  Widget build(BuildContext context) {
    final locationProvider = context.watch<LocationProvider>();

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppDimensions.radiusXl)),
      ),
      padding: const EdgeInsets.all(AppDimensions.spaceLg),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: AppDimensions.spaceMd),
          Text(
            'Select Delivery Location',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 4),
          Text(
            'Guaranteed 10-minute fresh butchery delivery',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: AppDimensions.spaceMd),
          if (locationProvider.savedAddresses.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Text(
                  'Delivering to: ${locationProvider.activeAddressString}',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ),
            )
          else
            ...locationProvider.savedAddresses.map((addr) {
              final isSelected = addr.id == locationProvider.selectedAddress?.id;
              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                decoration: BoxDecoration(
                  borderRadius: AppDimensions.roundedMd,
                  border: Border.all(
                    color: isSelected ? AppColors.primary : AppColors.borderHairline,
                    width: isSelected ? 1.5 : 1,
                  ),
                  color: isSelected ? AppColors.primaryLight.withOpacity(0.3) : Colors.white,
                ),
                child: ListTile(
                  leading: Icon(
                    addr.tag.toLowerCase() == 'home'
                        ? Icons.home_rounded
                        : addr.tag.toLowerCase() == 'office'
                            ? Icons.business_rounded
                            : Icons.place_rounded,
                    color: isSelected ? AppColors.primary : AppColors.textSecondary,
                  ),
                  title: Text(
                    addr.tag,
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: isSelected ? AppColors.primary : AppColors.textPrimary,
                    ),
                  ),
                  subtitle: Text(
                    addr.fullAddress,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12),
                  ),
                  onTap: () {
                    locationProvider.selectAddress(addr);
                    Navigator.pop(context);
                  },
                ),
              );
            }),
          const SizedBox(height: AppDimensions.spaceMd),
        ],
      ),
    );
  }
}
