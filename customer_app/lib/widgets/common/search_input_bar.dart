import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';

class SearchInputBar extends StatelessWidget {
  final TextEditingController? controller;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onTap;
  final String hintText;
  final bool readOnly;

  const SearchInputBar({
    super.key,
    this.controller,
    this.onChanged,
    this.onTap,
    this.hintText = 'Type product name to search',
    this.readOnly = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppDimensions.spaceMd, vertical: AppDimensions.spaceXs),
      child: Container(
        height: 48,
        decoration: BoxDecoration(
          color: AppColors.surfaceInput,
          borderRadius: AppDimensions.roundedMd,
          border: Border.all(color: AppColors.borderHairline.withOpacity(0.8)),
        ),
        child: TextField(
          controller: controller,
          readOnly: readOnly,
          onTap: onTap,
          onChanged: onChanged,
          textAlignVertical: TextAlignVertical.center,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w500,
              ),
          decoration: InputDecoration(
            isDense: true,
            hintText: hintText,
            hintStyle: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppColors.textMuted,
                  fontSize: 13,
                ),
            prefixIcon: const Icon(
              Icons.search_rounded,
              size: 20,
              color: AppColors.textMuted,
            ),
            suffixIcon: controller != null && controller!.text.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.clear_rounded, size: 18, color: AppColors.textMuted),
                    onPressed: () {
                      controller!.clear();
                      onChanged?.call('');
                    },
                  )
                : null,
            border: InputBorder.none,
            enabledBorder: InputBorder.none,
            focusedBorder: InputBorder.none,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          ),
        ),
      ),
    );
  }
}
