import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';

class QuantityStepper extends StatelessWidget {
  final int quantity;
  final VoidCallback onAdd;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;
  final bool inStock;
  final bool isCompact;

  const QuantityStepper({
    super.key,
    required this.quantity,
    required this.onAdd,
    required this.onIncrement,
    required this.onDecrement,
    this.inStock = true,
    this.isCompact = false,
  });

  @override
  Widget build(BuildContext context) {
    if (!inStock) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: AppColors.surfaceSubtle,
          borderRadius: AppDimensions.roundedMd,
          border: Border.all(color: AppColors.borderHairline),
        ),
        child: const Text(
          'OUT OF STOCK',
          style: TextStyle(
            color: AppColors.textMuted,
            fontSize: 10,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.3,
          ),
        ),
      );
    }

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 200),
      transitionBuilder: (child, animation) => ScaleTransition(scale: animation, child: child),
      child: quantity == 0
          ? _buildAddButton(context)
          : _buildStepper(context),
    );
  }

  Widget _buildAddButton(BuildContext context) {
    final double height = isCompact ? 28 : 34;
    final double minWidth = isCompact ? 60 : 76;

    return InkWell(
      key: const ValueKey('add_btn'),
      onTap: onAdd,
      borderRadius: AppDimensions.roundedMd,
      child: Container(
        height: height,
        constraints: BoxConstraints(minWidth: minWidth),
        padding: EdgeInsets.symmetric(
          horizontal: isCompact ? 8 : 14,
        ),
        decoration: BoxDecoration(
          color: AppColors.primaryMaroon,
          borderRadius: AppDimensions.roundedMd,
          boxShadow: [
            BoxShadow(
              color: AppColors.primaryMaroon.withValues(alpha: 0.2),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.add_rounded, size: isCompact ? 13 : 14, color: Colors.white),
            const SizedBox(width: 2),
            Text(
              'ADD',
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: isCompact ? 11 : 12,
                    letterSpacing: 0.4,
                  ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStepper(BuildContext context) {
    final double height = isCompact ? 28 : 34;
    final double btnWidth = isCompact ? 20 : 26;
    final double countWidth = isCompact ? 20 : 24;

    return Container(
      key: const ValueKey('stepper_btn'),
      height: height,
      decoration: BoxDecoration(
        color: AppColors.primaryMaroon,
        borderRadius: AppDimensions.roundedMd,
        boxShadow: [
          BoxShadow(
            color: AppColors.primaryMaroon.withValues(alpha: 0.25),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Decrement button
          InkWell(
            onTap: onDecrement,
            borderRadius: const BorderRadius.horizontal(left: Radius.circular(AppDimensions.radiusMd)),
            child: SizedBox(
              width: btnWidth,
              height: height,
              child: Icon(
                Icons.remove_rounded,
                size: isCompact ? 13 : 16,
                color: Colors.white,
              ),
            ),
          ),

          // Count (fixed width so 2 digits like 16 won't widen the pill)
          SizedBox(
            width: countWidth,
            child: Text(
              '$quantity',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w800,
                fontSize: isCompact ? (quantity >= 100 ? 10 : 11.5) : 13,
              ),
            ),
          ),

          // Increment button
          InkWell(
            onTap: onIncrement,
            borderRadius: const BorderRadius.horizontal(right: Radius.circular(AppDimensions.radiusMd)),
            child: SizedBox(
              width: btnWidth,
              height: height,
              child: Icon(
                Icons.add_rounded,
                size: isCompact ? 13 : 16,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
