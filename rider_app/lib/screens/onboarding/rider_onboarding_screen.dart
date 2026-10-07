import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../main.dart';

class RiderOnboardingScreen extends StatefulWidget {
  const RiderOnboardingScreen({super.key});

  @override
  State<RiderOnboardingScreen> createState() => _RiderOnboardingScreenState();
}

class _RiderOnboardingScreenState extends State<RiderOnboardingScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _completeOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('has_seen_rider_onboarding', true);

    if (!mounted) return;
    Navigator.pushReplacement(
      context,
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) => const RiderRootGate(),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(opacity: animation, child: child);
        },
        transitionDuration: const Duration(milliseconds: 350),
      ),
    );
  }

  void _nextPage() {
    if (_currentPage < 1) {
      _pageController.animateToPage(
        1,
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeInOutCubic,
      );
    } else {
      _completeOnboarding();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFBF8F5),
      body: SafeArea(
        child: Column(
          children: [
            // Top Header Bar
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
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // -------------------------------------------------------------
  // Header with TeFFe Logo, RIDER OPS Pill & Skip Button
  // -------------------------------------------------------------
  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              // TeFFe Dark Maroon Circle 'T' Avatar
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: const Color(0xFF5E0B14),
                  borderRadius: BorderRadius.circular(10),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF5E0B14).withOpacity(0.25),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: const Center(
                  child: Text(
                    "T",
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.5,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Text(
                        "TeFFe",
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF5E0B14),
                          letterSpacing: -0.4,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFDE8E8),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text(
                          "RIDER OPS",
                          style: TextStyle(
                            fontSize: 9.5,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF91000A),
                            letterSpacing: 0.4,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _currentPage == 0 ? "Fleet Dispatch Network" : "Earnings & Partner Perks",
                    style: const TextStyle(
                      fontSize: 10.5,
                      color: Color(0xFF8C7373),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ],
          ),
          // Skip Button
          InkWell(
            onTap: _completeOnboarding,
            borderRadius: BorderRadius.circular(20),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFEFECE8),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Text(
                "Skip",
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF5A4D4D),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // -------------------------------------------------------------
  // Slide 1: Deliver Freshness with Guaranteed Fast Dispatch
  // -------------------------------------------------------------
  Widget _buildSlide1() {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Hero Image Card
          _buildHeroCard(
            imageUrl: 'https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=1000&q=80',
            fallbackIcon: Icons.two_wheeler_rounded,
            overlayWidget: Stack(
              children: [
                // Top-Left Badge: Hub Dispatch Active
                Positioned(
                  top: 12,
                  left: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4.5),
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
                          "Hub Dispatch Active",
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
                // Top-Right Badge: 100% Fresh Certified (USP: 100% Fresh Cuts, Never Frozen)
                Positioned(
                  top: 12,
                  right: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4.5),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.55),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.verified_rounded, color: Color(0xFF34D399), size: 12),
                        SizedBox(width: 4),
                        Text(
                          "100% Fresh Certified",
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
                // Bottom-Left Badge: Dedicated EV Fleet or Own Bike
                Positioned(
                  bottom: 12,
                  left: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.5),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.electric_scooter_rounded, color: Colors.amberAccent, size: 13),
                        SizedBox(width: 4),
                        Text(
                          "Dedicated EV Fleet or Own Bike",
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 9.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                // Bottom-Right Badge: Priority Hubs
                Positioned(
                  bottom: 12,
                  right: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFF7A0C14),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Text(
                      "Priority Hubs",
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 9.5,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.2,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 14),

          // Pagination Indicator (Dot 1 active)
          _buildPaginationDots(0),

          const SizedBox(height: 14),

          // Title
          RichText(
            textAlign: TextAlign.center,
            text: const TextSpan(
              children: [
                TextSpan(
                  text: "Deliver Freshness with\n",
                  style: TextStyle(
                    fontSize: 21,
                    height: 1.25,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF221111),
                    letterSpacing: -0.4,
                  ),
                ),
                TextSpan(
                  text: "Guaranteed Fast Dispatch",
                  style: TextStyle(
                    fontSize: 21,
                    height: 1.25,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF7A0C14),
                    letterSpacing: -0.4,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 8),

          // Subtitle
          const Text(
            "Join TeFFe's certified butchery courier fleet. Enjoy optimized cluster routes, smart thermal fresh boxes, and flexible shift hours.",
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12,
              height: 1.45,
              fontWeight: FontWeight.w500,
              color: Color(0xFF6B5858),
            ),
          ),

          const SizedBox(height: 16),

          // 3 Feature Cards
          _buildFeatureCard(
            icon: Icons.alt_route_rounded,
            iconColor: const Color(0xFFDC2626),
            iconBgColor: const Color(0xFFFEE2E2),
            title: "Hyper-Local Batch Routing",
            subtitle: "Pick up multiple orders from 1 butchery hub within a tight 5km delivery radius.",
          ),
          const SizedBox(height: 10),
          _buildFeatureCard(
            icon: Icons.inventory_2_outlined,
            iconColor: const Color(0xFF0284C7),
            iconBgColor: const Color(0xFFE0F2FE),
            title: "Insulated Fresh-Lock Boxes Provided",
            subtitle: "All riders receive certified thermal fresh bags and safety kits at no security deposit.",
          ),
          const SizedBox(height: 10),
          _buildFeatureCard(
            icon: Icons.verified_user_rounded,
            iconColor: const Color(0xFF16A34A),
            iconBgColor: const Color(0xFFDCFCE7),
            title: "Accidental Insurance & 24/7 SOS",
            subtitle: "₹5 Lakh medical & roadside coverage active from your very first shift.",
          ),

          const SizedBox(height: 22),

          // Next Button
          _buildPrimaryButton(
            title: "Next: Earnings & Payouts →",
            onPressed: _nextPage,
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  // -------------------------------------------------------------
  // Slide 2: Guaranteed Pay & Instant Daily Withdrawals
  // -------------------------------------------------------------
  Widget _buildSlide2() {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Hero Image Card with Metrics Overlay Bar
          _buildHeroCard(
            imageUrl: 'https://images.unsplash.com/photo-1616401784845-180882ba9ba8?auto=format&fit=crop&w=1000&q=80',
            fallbackIcon: Icons.account_balance_wallet_rounded,
            overlayWidget: Stack(
              children: [
                // Top-Left Badge: Instant Daily Cash-Out
                Positioned(
                  top: 12,
                  left: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4.5),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.92),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.bolt_rounded, color: Color(0xFF10B981), size: 13),
                        SizedBox(width: 4),
                        Text(
                          "Instant Daily Cash-Out",
                          style: TextStyle(
                            color: Color(0xFF065F46),
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                // Top-Right Badge: 100% Retained Tips
                Positioned(
                  top: 12,
                  right: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4.5),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF59E0B),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.monetization_on_rounded, color: Colors.white, size: 12),
                        SizedBox(width: 4),
                        Text(
                          "100% Retained Tips",
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
                // Bottom Metric Bar Overlay
                Positioned(
                  bottom: 10,
                  left: 10,
                  right: 10,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
                    decoration: BoxDecoration(
                      color: const Color(0xFF111C2C).withOpacity(0.88),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.white.withOpacity(0.12)),
                    ),
                    child: Row(
                      children: [
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              Text(
                                "AVG WEEKLY PAYOUT",
                                style: TextStyle(
                                  color: Color(0xFF94A3B8),
                                  fontSize: 7.5,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.3,
                                ),
                              ),
                              SizedBox(height: 2),
                              Text(
                                "₹8,450+",
                                style: TextStyle(
                                  color: Color(0xFFFBBF24),
                                  fontSize: 14,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          width: 1,
                          height: 24,
                          color: Colors.white.withOpacity(0.15),
                        ),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              Text(
                                "PER DROP RATE",
                                style: TextStyle(
                                  color: Color(0xFF94A3B8),
                                  fontSize: 7.5,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.3,
                                ),
                              ),
                              SizedBox(height: 2),
                              Text(
                                "₹55 – ₹95",
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          width: 1,
                          height: 24,
                          color: Colors.white.withOpacity(0.15),
                        ),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              Text(
                                "PEAK BONUS",
                                style: TextStyle(
                                  color: Color(0xFF94A3B8),
                                  fontSize: 7.5,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.3,
                                ),
                              ),
                              SizedBox(height: 2),
                              Text(
                                "+₹30/drop",
                                style: TextStyle(
                                  color: Color(0xFF34D399),
                                  fontSize: 14,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 14),

          // Pagination Indicator (Dot 2 active)
          _buildPaginationDots(1),

          const SizedBox(height: 14),

          // Title
          RichText(
            textAlign: TextAlign.center,
            text: const TextSpan(
              children: [
                TextSpan(
                  text: "Guaranteed Pay &\n",
                  style: TextStyle(
                    fontSize: 21,
                    height: 1.25,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF221111),
                    letterSpacing: -0.4,
                  ),
                ),
                TextSpan(
                  text: "Instant Daily Withdrawals",
                  style: TextStyle(
                    fontSize: 21,
                    height: 1.25,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF7A0C14),
                    letterSpacing: -0.4,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 8),

          // Subtitle
          const Text(
            "Transparent compensation with zero hidden platform cuts. Get credited for every kilometer, on-time SLA, and express customer bonus.",
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12,
              height: 1.45,
              fontWeight: FontWeight.w500,
              color: Color(0xFF6B5858),
            ),
          ),

          const SizedBox(height: 16),

          // 3 Feature Cards with Trailing Pill Badges
          _buildFeatureCard(
            icon: Icons.payments_rounded,
            iconColor: const Color(0xFFD97706),
            iconBgColor: const Color(0xFFFEF3C7),
            title: "0% Commission on Patron Tips",
            subtitle: "Every rupee tipped by customers goes directly to your wallet account.",
            trailingBadge: _buildTrailingBadge(
              text: "100% Direct",
              bgColor: const Color(0xFFFEF3C7),
              textColor: const Color(0xFFB45309),
            ),
          ),
          const SizedBox(height: 10),
          _buildFeatureCard(
            icon: Icons.timer_rounded,
            iconColor: const Color(0xFF059669),
            iconBgColor: const Color(0xFFD1FAE5),
            title: "90-Min SLA Delivery Incentives",
            subtitle: "Earn higher reward tiers for maintaining delivery punctuality and prompt dispatch.",
            trailingBadge: _buildTrailingBadge(
              text: "+₹1,490/wk",
              bgColor: const Color(0xFFDCFCE7),
              textColor: const Color(0xFF15803D),
            ),
          ),
          const SizedBox(height: 10),
          _buildFeatureCard(
            icon: Icons.account_balance_rounded,
            iconColor: const Color(0xFF7A0C14),
            iconBgColor: const Color(0xFFFEE2E2),
            title: "Instant Cash-Out to Any Bank / UPI",
            subtitle: "Withdraw funds anytime directly to HDFC, SBI, Paytm, or Google Pay.",
            trailingBadge: _buildTrailingBadge(
              text: "Zero Delay",
              bgColor: const Color(0xFFF1F5F9),
              textColor: const Color(0xFF475569),
            ),
          ),

          const SizedBox(height: 22),

          // Final CTA Button
          _buildPrimaryButton(
            title: "Start Onboarding & Verify KYC →",
            onPressed: _completeOnboarding,
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  // -------------------------------------------------------------
  // Shared Components
  // -------------------------------------------------------------
  Widget _buildHeroCard({
    required String imageUrl,
    required IconData fallbackIcon,
    required Widget overlayWidget,
  }) {
    return Container(
      height: 215,
      width: double.infinity,
      decoration: BoxDecoration(
        color: const Color(0xFFEDE8E3),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF3B1E1E).withOpacity(0.1),
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
            // Gradient scrim for badge readability
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black.withOpacity(0.25),
                    Colors.transparent,
                    Colors.black.withOpacity(0.4),
                  ],
                ),
              ),
            ),
            overlayWidget,
          ],
        ),
      ),
    );
  }

  Widget _buildFeatureCard({
    required IconData icon,
    required Color iconColor,
    required Color iconBgColor,
    required String title,
    required String subtitle,
    Widget? trailingBadge,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: iconBgColor,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: iconColor, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        title,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF221111),
                        ),
                      ),
                    ),
                    if (trailingBadge != null) trailingBadge,
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF756262),
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTrailingBadge({
    required String text,
    required Color bgColor,
    required Color textColor,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: textColor,
          fontSize: 9.5,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Widget _buildPaginationDots(int activeIndex) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(2, (index) {
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
}
