import 'package:flutter/material.dart';

class BrandWatermarkFooter extends StatelessWidget {
  final VoidCallback? onExploreAllTap;
  final String title;
  final String subtitle;
  final bool showExploreButton;

  const BrandWatermarkFooter({
    super.key,
    this.onExploreAllTap,
    this.title = "Ranchi's freshest",
    this.subtitle = "meat app",
    this.showExploreButton = true,
  });

  Widget _buildMiniCircle(String emoji, Color bgColor) {
    return Container(
      width: 24,
      height: 24,
      decoration: BoxDecoration(
        color: bgColor,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 1.5),
        boxShadow: const [
          BoxShadow(
            color: Color(0x14000000),
            blurRadius: 3,
            offset: Offset(0, 1),
          ),
        ],
      ),
      child: Center(
        child: Text(
          emoji,
          style: const TextStyle(fontSize: 11),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.only(top: 16, bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. "See all products ▸" pill button (matching Blinkit's bottom action button)
          if (showExploreButton && onExploreAllTap != null) ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: onExploreAllTap,
                  borderRadius: BorderRadius.circular(16),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE2E8F0), width: 1),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        // Overlapping category icons
                        SizedBox(
                          width: 56,
                          height: 24,
                          child: Stack(
                            clipBehavior: Clip.none,
                            children: [
                              Positioned(
                                left: 0,
                                child: _buildMiniCircle('🍗', const Color(0xFFFFEDD5)),
                              ),
                              Positioned(
                                left: 16,
                                child: _buildMiniCircle('🥩', const Color(0xFFFFE4E6)),
                              ),
                              Positioned(
                                left: 32,
                                child: _buildMiniCircle('🐟', const Color(0xFFE0F2FE)),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        const Text(
                          'See all products',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                            color: Color(0xFF1E293B),
                            letterSpacing: -0.2,
                          ),
                        ),
                        const SizedBox(width: 2),
                        const Icon(
                          Icons.arrow_right_rounded,
                          size: 20,
                          color: Color(0xFF1E293B),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 32),
          ],

          // 2. Large Watermarked Typography (Blinkit Style)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 34,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFFCAD1DC),
                    letterSpacing: -0.6,
                    height: 1.15,
                  ),
                ),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Text(
                      subtitle,
                      style: const TextStyle(
                        fontSize: 34,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFFCAD1DC),
                        letterSpacing: -0.6,
                        height: 1.15,
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Text(
                      '❤️',
                      style: TextStyle(fontSize: 26, height: 1.15),
                    ),
                  ],
                ),
                const SizedBox(height: 22),

                // 3. Subtle Hairline Divider
                const Divider(
                  height: 1,
                  thickness: 0.8,
                  color: Color(0xFFE2E8F0),
                ),
                const SizedBox(height: 16),

                // 4. Subtle brand footer label (pointed to by 'A' in the screenshot)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Opacity(
                      opacity: 0.45,
                      child: Image.asset(
                        'assets/images/teffes-logo-maroon.png',
                        height: 22,
                        fit: BoxFit.contain,
                        errorBuilder: (_, __, ___) => const Text(
                          'teffes',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF94A3B8),
                            letterSpacing: -0.5,
                          ),
                        ),
                      ),
                    ),
                    const Text(
                      'Fresh Artisanal Butchery',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFFA0AAB8),
                        letterSpacing: 0.2,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Bottom padding so it clears floating cart bar & bottom nav bar
          const SizedBox(height: 90),
        ],
      ),
    );
  }
}
