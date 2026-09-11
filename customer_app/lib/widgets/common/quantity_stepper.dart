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
    return InkWell(
      key: const ValueKey('add_btn'),
      onTap: onAdd,
      borderRadius: AppDimensions.roundedMd,
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: isCompact ? 12 : 16,
          vertical: isCompact ? 6 : 7,
        ),
        decoration: BoxDecoration(
          color: AppColors.primaryMaroon,
          borderRadius: AppDimensions.roundedMd,
          boxShadow: [
            BoxShadow(
              color: AppColors.primaryMaroon.withOpacity(0.2),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.add_rounded, size: 14, color: Colors.white),
            const SizedBox(width: 3),
            Text(
              'ADD',
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.4,
                  ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStepper(BuildContext context) {
    return Container(
      key: const ValueKey('stepper_btn'),
      decoration: BoxDecoration(
        color: AppColors.primaryMaroon,
        borderRadius: AppDimensions.roundedMd,
        boxShadow: [
          BoxShadow(
            color: AppColors.primaryMaroon.withOpacity(0.25),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Decrement button
          InkWell(
            onTap: onDecrement,
            borderRadius: const BorderRadius.horizontal(left: Radius.circular(AppDimensions.radiusMd)),
            child: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 8, vertical: 5),
              child: Icon(Icons.remove_rounded, size: 15, color: Colors.white),
            ),
          ),

          // Count
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Text(
              '$quantity',
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w800,
                fontSize: 13,
              ),
            ),
          ),

          // Increment button
          InkWell(
            onTap: onIncrement,
            borderRadius: const BorderRadius.horizontal(right: Radius.circular(AppDimensions.radiusMd)),
            child: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 8, vertical: 5),
              child: Icon(Icons.add_rounded, size: 15, color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }
}
