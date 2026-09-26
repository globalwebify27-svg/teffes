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
                      if (!locationProvider.hasSelectedAddress && !locationProvider.isGpsDetected) ...[
                        const Icon(
                          Icons.location_on_outlined,
                          size: 18,
                          color: AppColors.primaryMaroon,
                        ),
                        const SizedBox(width: 4),
                      ],
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
      builder: (ctx) => const LocationPickerModal(),
    );
  }
}

class LocationPickerModal extends StatelessWidget {
  const LocationPickerModal({super.key});

  @override
  Widget build(BuildContext context) {
    final locationProvider = context.watch<LocationProvider>();

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppDimensions.radiusXl)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: AppDimensions.spaceLg, vertical: AppDimensions.spaceMd),
      child: SingleChildScrollView(
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
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Select Delivery Location',
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.w800,
                            fontSize: 18,
                          ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Fresh artisanal butchery delivered to your door',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppColors.textSecondary,
                            fontSize: 12,
                          ),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: AppDimensions.spaceMd),

            // 1. "Use Current Location" (GPS) Card
            Container(
              decoration: BoxDecoration(
                color: AppColors.primaryLight.withValues(alpha: 0.25),
                borderRadius: AppDimensions.roundedMd,
                border: Border.all(color: AppColors.primaryMaroon.withValues(alpha: 0.3), width: 1.2),
              ),
              child: ListTile(
                leading: Container(
                  width: 38,
                  height: 38,
                  decoration: const BoxDecoration(
                    color: AppColors.primaryMaroon,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.my_location_rounded,
                    color: Colors.white,
                    size: 20,
                  ),
                ),
                title: const Text(
                  'Use Current Location',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                    color: AppColors.primaryMaroon,
                  ),
                ),
                subtitle: Text(
                  locationProvider.isGpsDetected
                      ? 'Live GPS • ${locationProvider.activeAddressString}'
                      : 'Detect live location via device GPS',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
                ),
                trailing: locationProvider.isLoading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.primaryMaroon,
                        ),
                      )
                    : const Icon(
                        Icons.arrow_forward_ios_rounded,
                        size: 14,
                        color: AppColors.primaryMaroon,
                      ),
                onTap: () async {
                  final nav = Navigator.of(context);
                  final messenger = ScaffoldMessenger.of(context);
                  final success = await locationProvider.detectGpsLocation(userTriggered: true);
                  if (nav.canPop()) {
                    nav.pop();
                  }
                  messenger.showSnackBar(
                    SnackBar(
                      content: Text(
                        success
                            ? 'Location set to ${locationProvider.activeLabel}'
                            : 'Set to ${locationProvider.activeLabel}',
                      ),
                      behavior: SnackBarBehavior.floating,
                      duration: const Duration(seconds: 2),
                    ),
                  );
                },
              ),
            ),

            const SizedBox(height: 12),

            // 2. "+ Add New Address" Button
            SizedBox(
              width: double.infinity,
              height: 44,
              child: OutlinedButton.icon(
                onPressed: () {
                  Navigator.pop(context);
                  showAddAddressSheet(context, locationProvider);
                },
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: AppColors.primaryMaroon, width: 1.2),
                  shape: RoundedRectangleBorder(borderRadius: AppDimensions.roundedMd),
                  foregroundColor: AppColors.primaryMaroon,
                ),
                icon: const Icon(Icons.add_location_alt_rounded, size: 18),
                label: const Text(
                  'Add New Address',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                ),
              ),
            ),

            const SizedBox(height: 18),

            // 3. Saved Addresses Section
            const Text(
              'SAVED ADDRESSES',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: AppColors.textMuted,
                letterSpacing: 0.6,
              ),
            ),
            const SizedBox(height: 8),

            if (locationProvider.savedAddresses.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
                decoration: BoxDecoration(
                  color: AppColors.surfaceSubtle,
                  borderRadius: AppDimensions.roundedMd,
                  border: Border.all(color: AppColors.borderHairline),
                ),
                child: Column(
                  children: [
                    const Icon(Icons.location_off_outlined, size: 36, color: AppColors.textMuted),
                    const SizedBox(height: 8),
                    const Text(
                      'No saved addresses yet',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.textPrimary),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Save your home or office address for fast 1-tap checkout.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
                    ),
                  ],
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
                      color: isSelected ? AppColors.primaryMaroon : AppColors.borderHairline,
                      width: isSelected ? 1.5 : 1,
                    ),
                    color: isSelected ? AppColors.primaryLight.withValues(alpha: 0.2) : Colors.white,
                  ),
                  child: ListTile(
                    leading: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: isSelected ? AppColors.primaryLight : AppColors.surfaceSubtle,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        addr.tag.toLowerCase() == 'home'
                            ? Icons.home_rounded
                            : addr.tag.toLowerCase() == 'office'
                                ? Icons.business_rounded
                                : Icons.place_rounded,
                        color: isSelected ? AppColors.primaryMaroon : AppColors.textSecondary,
                        size: 20,
                      ),
                    ),
                    title: Row(
                      children: [
                        Text(
                          addr.tag,
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                            color: isSelected ? AppColors.primaryMaroon : AppColors.textPrimary,
                          ),
                        ),
                        if (addr.isDefault) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.primaryMaroon.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text(
                              'DEFAULT',
                              style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.w800,
                                color: AppColors.primaryMaroon,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    subtitle: Text(
                      addr.fullAddress,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12),
                    ),
                    trailing: isSelected
                        ? const Icon(Icons.check_circle_rounded, color: AppColors.primaryMaroon, size: 20)
                        : const Icon(Icons.radio_button_unchecked_rounded, color: AppColors.textMuted, size: 20),
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
      ),
    );
  }
}

/// Global reusable modal sheet to Add a New Delivery Address
void showAddAddressSheet(BuildContext context, LocationProvider location) {
  String selectedTag = 'Home';
  final line1Controller = TextEditingController();
  final line2Controller = TextEditingController();
  final landmarkController = TextEditingController();
  final pincodeController = TextEditingController(text: '834001');
  bool isDefault = location.savedAddresses.isEmpty;
  bool isSaving = false;

  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) {
      return StatefulBuilder(
        builder: (context, setModalState) {
          return Container(
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(AppDimensions.radiusXl)),
            ),
            padding: EdgeInsets.only(
              left: AppDimensions.spaceLg,
              right: AppDimensions.spaceLg,
              top: AppDimensions.spaceMd,
              bottom: MediaQuery.of(ctx).viewInsets.bottom + AppDimensions.spaceLg,
            ),
            child: SingleChildScrollView(
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
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Add Delivery Address',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close_rounded),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  // Tag selection
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
                  const SizedBox(height: 14),

                  // Line 1: House / Flat / Building
                  TextField(
                    controller: line1Controller,
                    decoration: InputDecoration(
                      labelText: 'Flat / House No. / Building *',
                      hintText: 'e.g. Flat 302, Green Valley Apts',
                      filled: true,
                      fillColor: AppColors.surfaceSubtle,
                      border: OutlineInputBorder(
                        borderRadius: AppDimensions.roundedMd,
                        borderSide: const BorderSide(color: AppColors.borderHairline),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: AppDimensions.roundedMd,
                        borderSide: const BorderSide(color: AppColors.borderHairline),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),

                  // Line 2: Area / Street / Colony
                  TextField(
                    controller: line2Controller,
                    decoration: InputDecoration(
                      labelText: 'Street / Area / Colony *',
                      hintText: 'e.g. Main Road, Lalpur / Harmu',
                      filled: true,
                      fillColor: AppColors.surfaceSubtle,
                      border: OutlineInputBorder(
                        borderRadius: AppDimensions.roundedMd,
                        borderSide: const BorderSide(color: AppColors.borderHairline),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: AppDimensions.roundedMd,
                        borderSide: const BorderSide(color: AppColors.borderHairline),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),

                  // Landmark & Pincode in Row
                  Row(
                    children: [
                      Expanded(
                        flex: 3,
                        child: TextField(
                          controller: landmarkController,
                          decoration: InputDecoration(
                            labelText: 'Landmark (Optional)',
                            hintText: 'Near Ekka Chowk',
                            filled: true,
                            fillColor: AppColors.surfaceSubtle,
                            border: OutlineInputBorder(
                              borderRadius: AppDimensions.roundedMd,
                              borderSide: const BorderSide(color: AppColors.borderHairline),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: AppDimensions.roundedMd,
                              borderSide: const BorderSide(color: AppColors.borderHairline),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        flex: 2,
                        child: TextField(
                          controller: pincodeController,
                          keyboardType: TextInputType.number,
                          decoration: InputDecoration(
                            labelText: 'Pincode *',
                            hintText: '834001',
                            filled: true,
                            fillColor: AppColors.surfaceSubtle,
                            border: OutlineInputBorder(
                              borderRadius: AppDimensions.roundedMd,
                              borderSide: const BorderSide(color: AppColors.borderHairline),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: AppDimensions.roundedMd,
                              borderSide: const BorderSide(color: AppColors.borderHairline),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Default Checkbox
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Set as default delivery address', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    value: isDefault,
                    activeColor: AppColors.primaryMaroon,
                    onChanged: (val) => setModalState(() => isDefault = val ?? false),
                    controlAffinity: ListTileControlAffinity.leading,
                  ),
                  const SizedBox(height: 16),

                  // Submit Button
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      onPressed: isSaving
                          ? null
                          : () async {
                              final line1 = line1Controller.text.trim();
                              final line2 = line2Controller.text.trim();
                              final landmark = landmarkController.text.trim();
                              final pincode = pincodeController.text.trim();

                              if (line1.isEmpty) {
                                ScaffoldMessenger.of(ctx).showSnackBar(
                                  const SnackBar(content: Text('Please enter Flat / House number')),
                                );
                                return;
                              }

                              setModalState(() => isSaving = true);

                              await location.addAddress(
                                tag: selectedTag,
                                line1: line1,
                                line2: line2.isNotEmpty ? line2 : null,
                                landmark: landmark.isNotEmpty ? landmark : null,
                                city: 'Ranchi',
                                pincode: pincode.isNotEmpty ? pincode : '834001',
                                isDefault: isDefault,
                              );

                              if (ctx.mounted) {
                                Navigator.pop(ctx);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text('Delivery address saved ($selectedTag)'),
                                    behavior: SnackBarBehavior.floating,
                                  ),
                                );
                              }
                            },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primaryMaroon,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: AppDimensions.roundedMd),
                      ),
                      child: isSaving
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Text(
                              'Save & Deliver Here',
                              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                            ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      );
    },
  );
}

/// Prompt displayed on initial app open if location permission / address hasn't been set yet
Future<void> showInitialLocationPrompt(BuildContext context, LocationProvider locationProvider) async {
  return showModalBottomSheet<void>(
    context: context,
    isDismissible: true,
    enableDrag: true,
    backgroundColor: Colors.transparent,
    builder: (BuildContext ctx) {
      bool isDetecting = false;

      return StatefulBuilder(
        builder: (context, setModalState) {
          return Container(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(AppDimensions.radiusXl)),
            ),
            child: SafeArea(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Handle bar
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
                  const SizedBox(height: 20),

                  // Location Icon Badge
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      color: AppColors.primaryLight.withValues(alpha: 0.35),
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.primaryMaroon.withValues(alpha: 0.2), width: 1.5),
                    ),
                    child: const Center(
                      child: Icon(
                        Icons.location_on_rounded,
                        size: 38,
                        color: AppColors.primaryMaroon,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Title
                  Text(
                    'Set Delivery Location',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                          fontSize: 20,
                          color: AppColors.textPrimary,
                        ),
                  ),
                  const SizedBox(height: 8),

                  // Subtitle
                  Text(
                    'Enable live location to view freshly stocked chicken, mutton & fish in your area, with real-time delivery estimates.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.textSecondary,
                          fontSize: 13,
                          height: 1.4,
                        ),
                  ),
                  const SizedBox(height: 24),

                  // Primary Button: "Use Current Location"
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton.icon(
                      onPressed: isDetecting
                          ? null
                          : () async {
                              setModalState(() => isDetecting = true);
                              final success = await locationProvider.detectGpsLocation(userTriggered: true);
                              if (ctx.mounted) {
                                Navigator.pop(ctx);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(
                                      success
                                        ? 'Location set to ${locationProvider.activeLabel}'
                                        : 'Set to ${locationProvider.activeLabel}',
                                    ),
                                    behavior: SnackBarBehavior.floating,
                                    duration: const Duration(seconds: 2),
                                  ),
                                );
                              }
                            },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primaryMaroon,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: const RoundedRectangleBorder(borderRadius: AppDimensions.roundedMd),
                      ),
                      icon: isDetecting
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Icon(Icons.my_location_rounded, size: 20),
                      label: Text(
                        isDetecting ? 'Detecting Location...' : 'Use Current Location',
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Secondary Button: "Select or Add Address"
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: OutlinedButton.icon(
                      onPressed: () {
                        Navigator.pop(ctx);
                        showModalBottomSheet(
                          context: context,
                          isScrollControlled: true,
                          backgroundColor: Colors.transparent,
                          builder: (_) => const LocationPickerModal(),
                        );
                      },
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: AppColors.borderHairline, width: 1.2),
                        shape: const RoundedRectangleBorder(borderRadius: AppDimensions.roundedMd),
                        foregroundColor: AppColors.textPrimary,
                      ),
                      icon: const Icon(Icons.search_rounded, size: 20, color: AppColors.textSecondary),
                      label: const Text(
                        'Select or Add Address',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),

                  // Dismiss button
                  TextButton(
                    onPressed: () {
                      locationProvider.markPermissionPrompted();
                      Navigator.pop(ctx);
                    },
                    child: const Text(
                      'Not Now',
                      style: TextStyle(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      );
    },
  );
}

