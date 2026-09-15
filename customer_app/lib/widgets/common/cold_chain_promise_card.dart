import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';

class ColdChainPromiseCard extends StatelessWidget {
  const ColdChainPromiseCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: AppDimensions.spaceMd, vertical: AppDimensions.spaceSm),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF9F9),
        borderRadius: AppDimensions.roundedLg,
        border: Border.all(color: const Color(0xFFFDE8E8), width: 1.2),
      ),
      child: Row(
        children: [
          // Green pulse status dot
          Container(
            width: 8,
            height: 8,
            decoration: const BoxDecoration(
              color: AppColors.hygieneEmerald,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 10),

          // Main Promise text
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  "TeFFe Freshness Promise:",
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: AppColors.primaryMaroon,
                  ),
                ),
                const SizedBox(height: 1),
                Text(
                  "100% Fresh Daily Cuts, Never Frozen",
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.grey.shade700,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
