import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../models/coupon_model.dart';

class SuperOfferCard extends StatelessWidget {
  final CouponModel offer;
  final VoidCallback? onClaim;

  const SuperOfferCard({
    super.key,
    required this.offer,
    this.onClaim,
  });

  void _handleClaim(BuildContext context) {
    Clipboard.setData(ClipboardData(text: offer.code));
    if (onClaim != null) {
      onClaim!();
    } else {
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.check_circle_rounded, color: Colors.white, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Code "${offer.code}" copied to clipboard! Apply at checkout.',
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5),
                ),
              ),
            ],
          ),
          backgroundColor: AppColors.primaryMaroon,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          margin: const EdgeInsets.all(AppDimensions.spaceMd),
          duration: const Duration(milliseconds: 2200),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: AppDimensions.spaceMd),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF9F9),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: AppColors.primaryMaroon.withValues(alpha: 0.22),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.primaryMaroon.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () => _handleClaim(context),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Offer Tag Icon in Teffe's signature maroon theme
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: AppColors.primaryMaroon.withValues(alpha: 0.25),
                    ),
                  ),
                  child: const Center(
                    child: Icon(
                      Icons.local_offer_rounded,
                      color: AppColors.primaryMaroon,
                      size: 20,
                    ),
                  ),
                ),
                const SizedBox(width: 12),

                // Title and Description
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        offer.discount,
                        style: const TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w800,
                          color: AppColors.primaryMaroon,
                          height: 1.2,
                        ),
                      ),
                      const SizedBox(height: 4),

                      // Subtitle with code badge
                      Wrap(
                        crossAxisAlignment: WrapCrossAlignment.center,
                        spacing: 4,
                        runSpacing: 3,
                        children: [
                          Text(
                            'Apply code',
                            style: TextStyle(
                              fontSize: 11,
                              color: Colors.grey.shade700,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                            decoration: BoxDecoration(
                              color: AppColors.primaryLight,
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(
                                color: AppColors.primaryMaroon.withValues(alpha: 0.3),
                              ),
                            ),
                            child: Text(
                              offer.code,
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                fontFamily: 'monospace',
                                color: AppColors.primaryMaroon,
                              ),
                            ),
                          ),
                          Text(
                            'at checkout. ${offer.minOrder > 0 ? "Above ₹${offer.minOrder.toInt()}." : ""} Valid till ${offer.validTill}.',
                            style: TextStyle(
                              fontSize: 11,
                              color: Colors.grey.shade600,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),

                // Subtle maroon copy icon to indicate interactivity
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: AppColors.primaryMaroon.withValues(alpha: 0.25),
                    ),
                  ),
                  child: const Icon(
                    Icons.copy_rounded,
                    size: 14,
                    color: AppColors.primaryMaroon,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
