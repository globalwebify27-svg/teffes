import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/constants/api_endpoints.dart';
import '../../core/constants/app_colors.dart';
import '../../core/network/api_client.dart';
import '../../core/utils/page_transitions.dart';
import '../../providers/auth_provider.dart';
import '../../screens/category/category_listing_screen.dart';

class PromotionalPopupDialog {
  static bool _sessionShown = false;

  /// Checks server for active promotional popup and presents if eligible
  static Future<void> checkAndShow(BuildContext context) async {
    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final isLoggedIn = auth.isAuthenticated;
      final tier = auth.user?.loyaltyTier ?? 'Bronze';

      final api = ApiClient();
      final res = await api.get(
        '${ApiEndpoints.activePopups}?tier=${Uri.encodeComponent(tier)}&isLoggedIn=$isLoggedIn',
      );

      if (res.data == null || res.data['success'] != true || res.data['popups'] is! List) {
        return;
      }

      final List popups = res.data['popups'];
      if (popups.isEmpty) return;

      final prefs = await SharedPreferences.getInstance();
      final todayStr = DateTime.now().toIso8601String().split('T').first;

      Map<String, dynamic>? eligiblePopup;

      for (final raw in popups) {
        if (raw is! Map<String, dynamic>) continue;
        final id = (raw['_id'] ?? raw['id'])?.toString();
        if (id == null || id.isEmpty) continue;

        final frequency = (raw['frequency'] ?? 'ONCE_PER_DAY').toString().toUpperCase();

        if (frequency == 'ONCE_PER_DAY') {
          final dismissedDate = prefs.getString('teffes_popup_dismissed_$id');
          if (dismissedDate == todayStr) {
            continue; // Already seen today
          }
        } else if (frequency == 'ONCE_PER_SESSION') {
          if (_sessionShown) {
            continue; // Already seen this app session
          }
        }

        eligiblePopup = raw;
        break;
      }

      if (eligiblePopup == null || !context.mounted) return;

      _sessionShown = true;
      final popupId = (eligiblePopup['_id'] ?? eligiblePopup['id'])?.toString() ?? '';

      await showDialog(
        context: context,
        barrierDismissible: true,
        barrierColor: Colors.black.withOpacity(0.65),
        builder: (ctx) => _PopupContent(
          popup: eligiblePopup!,
          onDismiss: (dontShowAgainToday) async {
            if (popupId.isNotEmpty && dontShowAgainToday) {
              await prefs.setString('teffes_popup_dismissed_$popupId', todayStr);
            }
          },
        ),
      );
    } catch (_) {
      // Silent error: Marketing popup failure must never disrupt customer experience
    }
  }
}

class _PopupContent extends StatefulWidget {
  final Map<String, dynamic> popup;
  final Function(bool dontShowAgainToday) onDismiss;

  const _PopupContent({
    required this.popup,
    required this.onDismiss,
  });

  @override
  State<_PopupContent> createState() => _PopupContentState();
}

class _PopupContentState extends State<_PopupContent> {
  bool _dontShowAgain = true;
  bool _copied = false;

  @override
  Widget build(BuildContext context) {
    final title = widget.popup['title']?.toString() ?? 'Special Announcement';
    final subtitle = widget.popup['subtitle']?.toString();
    final message = widget.popup['message']?.toString();
    final imageUrl = widget.popup['imageUrl']?.toString();
    final couponCode = widget.popup['couponCode']?.toString();
    final ctaText = widget.popup['ctaText']?.toString() ?? 'Shop Now';
    final ctaLink = widget.popup['ctaLink']?.toString();

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 420),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.35),
              blurRadius: 28,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Top Header with Title and Close (X)
                Stack(
                  children: [
                    if (imageUrl != null && imageUrl.isNotEmpty)
                      AspectRatio(
                        aspectRatio: 16 / 9,
                        child: Image.network(
                          imageUrl,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                        ),
                      ),
                    Positioned(
                      top: 8,
                      right: 8,
                      child: Material(
                        color: Colors.black.withOpacity(0.5),
                        shape: const CircleBorder(),
                        child: InkWell(
                          customBorder: const CircleBorder(),
                          onTap: () {
                            widget.onDismiss(_dontShowAgain);
                            Navigator.of(context).pop();
                          },
                          child: const Padding(
                            padding: EdgeInsets.all(6),
                            child: Icon(Icons.close_rounded, size: 20, color: Colors.white),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),

                // Body content
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                          letterSpacing: -0.3,
                        ),
                      ),
                      if (subtitle != null && subtitle.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          subtitle,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.primaryMaroon,
                          ),
                        ),
                      ],
                      if (message != null && message.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Text(
                          message,
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppColors.textSecondary,
                            height: 1.4,
                          ),
                        ),
                      ],

                      // Coupon Code Pill (if present)
                      if (couponCode != null && couponCode.isNotEmpty) ...[
                        const SizedBox(height: 14),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF3C7),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFFF59E0B)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.local_offer_outlined, size: 18, color: Color(0xFFB45309)),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Use Code: $couponCode',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 13,
                                    color: Color(0xFF92400E),
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ),
                              InkWell(
                                onTap: () {
                                  Clipboard.setData(ClipboardData(text: couponCode));
                                  setState(() => _copied = true);
                                  Future.delayed(const Duration(seconds: 2), () {
                                    if (mounted) setState(() => _copied = false);
                                  });
                                },
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        _copied ? Icons.check_circle_rounded : Icons.copy_rounded,
                                        size: 15,
                                        color: _copied ? const Color(0xFF16A34A) : const Color(0xFFB45309),
                                      ),
                                      const SizedBox(width: 4),
                                      Text(
                                        _copied ? 'Copied' : 'Copy',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                          color: _copied ? const Color(0xFF16A34A) : const Color(0xFFB45309),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],

                      const SizedBox(height: 16),

                      // CTA Button
                      SizedBox(
                        width: double.infinity,
                        height: 46,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primaryMaroon,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            elevation: 0,
                          ),
                          onPressed: () async {
                            widget.onDismiss(_dontShowAgain);
                            Navigator.of(context).pop();

                            if (ctaLink != null && ctaLink.isNotEmpty) {
                              if (ctaLink.startsWith('http')) {
                                final uri = Uri.tryParse(ctaLink);
                                if (uri != null) {
                                  await launchUrl(uri, mode: LaunchMode.externalApplication);
                                }
                              } else {
                                Navigator.of(context).push(
                                  SmoothPageRoute(page: const CategoryListingScreen()),
                                );
                              }
                            } else {
                              Navigator.of(context).push(
                                SmoothPageRoute(page: const CategoryListingScreen()),
                              );
                            }
                          },
                          child: Text(
                            ctaText,
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                        ),
                      ),

                      const SizedBox(height: 10),

                      // Don't show again today checkbox
                      GestureDetector(
                        onTap: () => setState(() => _dontShowAgain = !_dontShowAgain),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            SizedBox(
                              width: 20,
                              height: 20,
                              child: Checkbox(
                                value: _dontShowAgain,
                                activeColor: AppColors.primaryMaroon,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                                onChanged: (val) => setState(() => _dontShowAgain = val ?? true),
                              ),
                            ),
                            const SizedBox(width: 8),
                            const Text(
                              "Don't show again today",
                              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                            ),
                          ],
                        ),
                      ),
                    ],
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
