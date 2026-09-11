import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../main_shell_screen.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _completeOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('has_seen_onboarding', true);

    if (!mounted) return;
    Navigator.pushReplacement(
      context,
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) => const MainShellScreen(),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(opacity: animation, child: child);
        },
        transitionDuration: const Duration(milliseconds: 350),
      ),
    );
  }

  void _nextPage() {
    if (_currentPage < 2) {
      _pageController.animateToPage(
        _currentPage + 1,
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeInOutCubic,
      );
    } else {
      _completeOnboarding();
    }
  }

  void _previousPage() {
    if (_currentPage > 0) {
      _pageController.animateToPage(
        _currentPage - 1,
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeInOutCubic,
      );
    }
  }

  void _goToPage(int index) {
    _pageController.animateToPage(
      index,
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeInOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFBF8F5),
      body: SafeArea(
        child: Column(
          children: [
            // Top App Bar / Header
            _buildHeader(),

            // Swipable Slides
            Expanded(
              child: PageView(
                controller: _pageController,
                physics: const BouncingScrollPhysics(),
                onPageChanged: (pageIndex) {
                  setState(() {
                    _currentPage = pageIndex;
                  });
                },
                children: [
                  _buildSlide1(),
                  _buildSlide2(),
                  _buildSlide3(),
                ],
              ),
            ),

            // Persistent Bottom Tab Bar
            _buildBottomNavTabs(),
          ],
        ),
      ),
    );
  }

  // -------------------------------------------------------------
  // Header with Logo, Back / Skip button
  // -------------------------------------------------------------
  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              if (_currentPage > 0)
                IconButton(
                  onPressed: _previousPage,
                  icon: const Icon(Icons.arrow_back, color: Color(0xFF2D1515), size: 22),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                )
              else
                Container(
                  width: 32,
                  height: 32,
                  decoration: const BoxDecoration(
                    color: Color(0xFF7A0C14),
                    shape: BoxShape.circle,
                  ),
                  child: const Center(
                    child: Icon(Icons.restaurant_menu_rounded, color: Colors.white, size: 16),
                  ),
                ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    "TeFFe",
                    style: TextStyle(
                      fontSize: 19,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF5E0B14),
                      letterSpacing: -0.5,
                    ),
                  ),
                  if (_currentPage == 0)
                    const Text(
                      "Where health matters most",
                      style: TextStyle(
                        fontSize: 9.5,
                        color: Color(0xFF8C7373),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                ],
              ),
            ],
          ),
          TextButton(
            onPressed: _completeOnboarding,
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: const Text(
              "Skip",
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: Color(0xFF755E5E),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // -------------------------------------------------------------
  // Slide 1: Farm-Fresh & Hygienic Cuts
  // -------------------------------------------------------------
  Widget _buildSlide1() {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Hero Image Card
          _buildHeroCard(
            imageUrl: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=1000&q=80',
            fallbackIcon: Icons.kebab_dining_rounded,
            overlayBadges: [
              // Top-Left Badge: 100% CERTIFIED
              Positioned(
                top: 14,
                left: 14,
                child: _buildPillBadge(
                  icon: Icons.verified_rounded,
                  iconColor: const Color(0xFF047857),
                  text: '100% CERTIFIED',
                  bgColor: Colors.white.withOpacity(0.92),
                  textColor: const Color(0xFF065F46),
                ),
              ),
              // Top-Center/Right: Fresh Cuts
              Positioned(
                top: 14,
                right: 14,
                child: _buildPillBadge(
                  icon: null,
                  iconColor: Colors.transparent,
                  text: 'Fresh Cuts',
                  bgColor: Colors.black.withOpacity(0.45),
                  textColor: Colors.white,
                ),
              ),
              // Bottom-Right Badge: Never Frozen • 100% Fresh Cuts
              Positioned(
                bottom: 14,
                right: 14,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: const Color(0xFF7A0C14),
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.2),
                        blurRadius: 6,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.eco_rounded, color: Colors.amberAccent, size: 12),
                      SizedBox(width: 4),
                      Text(
                        "Never Frozen • 100% Fresh",
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 10.5,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.2,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Pagination Dots
          _buildPaginationDots(0),

          const SizedBox(height: 16),

          // Title
          const Text(
            "Farm–Fresh & Hygienic\nCuts, Sliced After You Order",
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 22,
              height: 1.25,
              fontWeight: FontWeight.w900,
              color: Color(0xFF4A000A),
              letterSpacing: -0.4,
            ),
          ),

          const SizedBox(height: 10),

          // Description
          const Text(
            "We source antibiotic-residue-free chicken, pasture-fed mutton, and pristine fresh seafood — cleaned with RO water and cut strictly on demand by master butchers.",
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12.5,
              height: 1.45,
              fontWeight: FontWeight.w500,
              color: Color(0xFF6B5858),
            ),
          ),

          const SizedBox(height: 16),

          // 3 Feature Pills
          Wrap(
            spacing: 8,
            runSpacing: 8,
            alignment: WrapAlignment.center,
            children: [
              _buildTagChip(icon: Icons.content_cut_rounded, label: "Cut to Order"),
              _buildTagChip(icon: Icons.verified_user_outlined, label: "Never Frozen (100% Fresh)"),
              _buildTagChip(icon: Icons.water_drop_outlined, label: "RO Water Cleaned"),
            ],
          ),

          const SizedBox(height: 22),

          // Next Button
          _buildPrimaryButton(
            title: "Next →",
            onPressed: _nextPage,
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }

  // -------------------------------------------------------------
  // Slide 2: 90-Minute Delivery With Farm-to-Kitchen Speed
  // -------------------------------------------------------------
  Widget _buildSlide2() {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Hero Image Card
          _buildHeroCard(
            imageUrl: 'https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=1000&q=80',
            fallbackIcon: Icons.two_wheeler_rounded,
            overlayBadges: [
              // Top-Left Badge: LIVE GPS MONITORED
              Positioned(
                top: 14,
                left: 14,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.92),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 7,
                        height: 7,
                        decoration: const BoxDecoration(
                          color: Color(0xFF10B981),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 5),
                      const Text(
                        "LIVE GPS MONITORED",
                        style: TextStyle(
                          color: Color(0xFF111C2C),
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              // Bottom-Right: Insulated Fresh-Box 90m
              Positioned(
                bottom: 14,
                right: 14,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: const Color(0xFF7A0C14),
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.2),
                        blurRadius: 6,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.inventory_2_outlined, color: Colors.white, size: 12),
                      SizedBox(width: 4),
                      Text(
                        "Insulated Fresh-Box 90m",
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 10.5,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 10),

          // 3 Metric Cards row
          Row(
            children: [
              Expanded(
                child: _buildMetricCard(label: "DISPATCH", value: "Instant Hub"),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildMetricCard(label: "PACKAGING", value: "Triple Layer"),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildMetricCard(label: "MAX TRANSIT", value: "90 Mins"),
              ),
            ],
          ),

          const SizedBox(height: 14),

          // Pagination Dots
          _buildPaginationDots(1),

          const SizedBox(height: 14),

          // Title
          const Text(
            "90–Minute Delivery With\nFreshness–First Speed",
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 22,
              height: 1.25,
              fontWeight: FontWeight.w900,
              color: Color(0xFF4A000A),
              letterSpacing: -0.4,
            ),
          ),

          const SizedBox(height: 8),

          // Description
          const Text(
            "Packed in hygienic insulated boxes with real-time GPS tracking from our local butchery hub straight to your doorstep.",
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12.5,
              height: 1.45,
              fontWeight: FontWeight.w500,
              color: Color(0xFF6B5858),
            ),
          ),

          const SizedBox(height: 14),

          // Feature Rows
          _buildFeatureCard(
            icon: Icons.bolt_rounded,
            iconColor: const Color(0xFFD97706),
            bgColor: const Color(0xFFFEF3C7),
            title: "Lightning 90-Min Dispatch",
            subtitle: "Fast, hyper-local hub delivery directly to your kitchen table.",
          ),
          const SizedBox(height: 8),
          _buildFeatureCard(
            icon: Icons.location_on_rounded,
            iconColor: const Color(0xFF2563EB),
            bgColor: const Color(0xFFDBEAFE),
            title: "Live GPS Delivery Tracking",
            subtitle: "Continuous live rider transit tracking directly inside your app.",
          ),
          const SizedBox(height: 8),
          _buildFeatureCard(
            icon: Icons.security_rounded,
            iconColor: const Color(0xFF059669),
            bgColor: const Color(0xFFD1FAE5),
            title: "Tamper-Evident Fresh Seals",
            subtitle: "Medical-grade anti-tamper security locks preserved from packing.",
          ),

          const SizedBox(height: 18),

          // Next Button
          _buildPrimaryButton(
            title: "Next →",
            onPressed: _nextPage,
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }

  // -------------------------------------------------------------
  // Slide 3: 100% Certified Quality & 60-Min Exchange
  // -------------------------------------------------------------
  Widget _buildSlide3() {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Hero Image Card
          _buildHeroCard(
            imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1000&q=80',
            fallbackIcon: Icons.military_tech_rounded,
            overlayBadges: [
              // Top-Left Badge: LAB TESTED
              Positioned(
                top: 14,
                left: 14,
                child: _buildPillBadge(
                  icon: Icons.check_circle_rounded,
                  iconColor: const Color(0xFF047857),
                  text: 'LAB TESTED',
                  bgColor: Colors.white.withOpacity(0.92),
                  textColor: const Color(0xFF065F46),
                ),
              ),
              // Top-Right Badge: 60m Window
              Positioned(
                top: 14,
                right: 14,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: const Color(0xFF7A0C14),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.timer_outlined, color: Colors.white, size: 12),
                      SizedBox(width: 4),
                      Text(
                        "60m Window",
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              // Bottom-Left Badge: Grade A Artisanal Butchery
              Positioned(
                bottom: 14,
                left: 14,
                child: _buildPillBadge(
                  icon: Icons.verified_outlined,
                  iconColor: Colors.amberAccent,
                  text: 'Grade A Artisanal Butchery',
                  bgColor: Colors.black.withOpacity(0.65),
                  textColor: Colors.white,
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Pagination Dots
          _buildPaginationDots(2),

          const SizedBox(height: 16),

          // Title
          const Text(
            "100% Certified Quality with\n60–Min No–Fuss Exchange",
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 22,
              height: 1.25,
              fontWeight: FontWeight.w900,
              color: Color(0xFF4A000A),
              letterSpacing: -0.4,
            ),
          ),

          const SizedBox(height: 10),

          // Description
          const Text(
            "Every batch is FSSAI certified and tested for zero chemicals. Not satisfied with the cut? Enjoy our instant 60-minute doorstep replacement or wallet refund guarantee.",
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12.5,
              height: 1.45,
              fontWeight: FontWeight.w500,
              color: Color(0xFF6B5858),
            ),
          ),

          const SizedBox(height: 16),

          // Feature Rows
          _buildFeatureCard(
            icon: Icons.verified_rounded,
            iconColor: const Color(0xFF7A0C14),
            bgColor: const Color(0xFFFEE2E2),
            title: "FSSAI Certified Freshness",
            subtitle: "Daily multi-point hygiene & microbiological inspection.",
          ),
          const SizedBox(height: 8),
          _buildFeatureCard(
            icon: Icons.eco_rounded,
            iconColor: const Color(0xFF059669),
            bgColor: const Color(0xFFD1FAE5),
            title: "100% Antibiotic & Hormone Free",
            subtitle: "Zero synthetic enhancers, pure natural grass & grain fed.",
          ),
          const SizedBox(height: 8),
          _buildFeatureCard(
            icon: Icons.published_with_changes_rounded,
            iconColor: const Color(0xFFD97706),
            bgColor: const Color(0xFFFEF3C7),
            title: "60–Min Instant Replacement Guarantee",
            subtitle: "Instant app doorstep swap or zero-friction wallet credit.",
          ),

          const SizedBox(height: 20),

          // Final Button
          _buildPrimaryButton(
            title: "Explore Fresh Cuts →",
            onPressed: _completeOnboarding,
          ),

          const SizedBox(height: 8),

          // Terms notice
          const Text(
            "By continuing, you agree to TeFFe's Terms & Privacy Policy",
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 10.5,
              color: Color(0xFF8C7373),
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }

  // -------------------------------------------------------------
  // Reusable Widgets
  // -------------------------------------------------------------
  Widget _buildHeroCard({
    required String imageUrl,
    required IconData fallbackIcon,
    required List<Widget> overlayBadges,
  }) {
    return Container(
      height: 210,
      width: double.infinity,
      decoration: BoxDecoration(
        color: const Color(0xFFEDE8E3),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF3B1E1E).withOpacity(0.08),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Stack(
          fit: StackFit.expand,
          children: [
            CachedNetworkImage(
              imageUrl: imageUrl,
              fit: BoxFit.cover,
              placeholder: (context, url) => Container(
                color: const Color(0xFFEDE8E3),
                child: const Center(
                  child: SizedBox(
                    width: 28,
                    height: 28,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      color: Color(0xFF7A0C14),
                    ),
                  ),
                ),
              ),
              errorWidget: (context, url, error) => Container(
                color: const Color(0xFFE5DDD5),
                child: Center(
                  child: Icon(fallbackIcon, size: 54, color: const Color(0xFF7A0C14).withOpacity(0.6)),
                ),
              ),
            ),
            // Subtle gradient darkening for badge legibility
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black.withOpacity(0.2),
                    Colors.transparent,
                    Colors.black.withOpacity(0.35),
                  ],
                ),
              ),
            ),
            ...overlayBadges,
          ],
        ),
      ),
    );
  }

  Widget _buildPillBadge({
    IconData? icon,
    required Color iconColor,
    required String text,
    required Color bgColor,
    required Color textColor,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4.5),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, color: iconColor, size: 12),
            const SizedBox(width: 4),
          ],
          Text(
            text,
            style: TextStyle(
              color: textColor,
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricCard({required String label, required String value}) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFF3ECE4),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE6DDD4)),
      ),
      child: Column(
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 9.5,
              fontWeight: FontWeight.w800,
              color: Color(0xFF8A6D6D),
              letterSpacing: 0.4,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            value,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: Color(0xFF5E0B14),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTagChip({required IconData icon, required String label}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: const Color(0xFFF3ECE4),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE4D9CE)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: const Color(0xFF7A0C14)),
          const SizedBox(width: 5),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: Color(0xFF4A1A1A),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFeatureCard({
    required IconData icon,
    required Color iconColor,
    required Color bgColor,
    required String title,
    required String subtitle,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFEDE4DC)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF4A1A1A).withOpacity(0.03),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: bgColor,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: iconColor, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF221111),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF756262),
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaginationDots(int activeIndex) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(3, (index) {
        final isActive = index == activeIndex;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          margin: const EdgeInsets.symmetric(horizontal: 3),
          width: isActive ? 22 : 6,
          height: 6,
          decoration: BoxDecoration(
            color: isActive ? const Color(0xFF7A0C14) : const Color(0xFFDDD2C8),
            borderRadius: BorderRadius.circular(3),
          ),
        );
      }),
    );
  }

  Widget _buildPrimaryButton({required String title, required VoidCallback onPressed}) {
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF7A0C14),
          foregroundColor: Colors.white,
          elevation: 2,
          shadowColor: const Color(0xFF7A0C14).withOpacity(0.4),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        child: Text(
          title,
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.3,
          ),
        ),
      ),
    );
  }

  // -------------------------------------------------------------
  // Bottom Tab Navigation Bar (Intro, Delivery, Quality)
  // -------------------------------------------------------------
  Widget _buildBottomNavTabs() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: const BoxDecoration(
        color: Color(0xFFFAF6F2),
        border: Border(
          top: BorderSide(color: Color(0xFFEFE8E0), width: 1),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildNavTabItem(index: 0, label: "Intro", icon: Icons.storefront_outlined),
          _buildNavTabItem(index: 1, label: "Delivery", icon: Icons.two_wheeler_outlined),
          _buildNavTabItem(index: 2, label: "Quality", icon: Icons.verified_outlined),
        ],
      ),
    );
  }

  Widget _buildNavTabItem({
    required int index,
    required String label,
    required IconData icon,
  }) {
    final isSelected = _currentPage == index;

    if (isSelected) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 6),
        decoration: BoxDecoration(
          color: const Color(0xFF7A0C14),
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF7A0C14).withOpacity(0.25),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: Colors.white, size: 16),
            const SizedBox(width: 6),
            Text(
              label,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 11.5,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      );
    }

    return InkWell(
      onTap: () => _goToPage(index),
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: const Color(0xFF9E8A8A), size: 18),
            const SizedBox(height: 2),
            Text(
              label,
              style: const TextStyle(
                color: Color(0xFF9E8A8A),
                fontSize: 10,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
