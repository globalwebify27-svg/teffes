import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../providers/rider_orders_provider.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  late Future<List<Map<String, dynamic>>> _notificationsFuture;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  void _loadNotifications() {
    _notificationsFuture = context.read<RiderOrdersProvider>().fetchNotifications();
  }

  String _formatRelativeTime(dynamic dateVal) {
    if (dateVal == null) return 'Recently';
    final dt = dateVal is DateTime ? dateVal : DateTime.tryParse(dateVal.toString());
    if (dt == null) return 'Recently';
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes} mins ago';
    if (diff.inHours < 24) return '${diff.inHours} hours ago';
    return '${dt.day}/${dt.month}/${dt.year}';
  }

  IconData _getIconForType(String? type) {
    switch (type) {
      case 'DELIVERY_PAYOUT':
        return Icons.account_balance_wallet_rounded;
      case 'ORDER_ASSIGNMENT':
        return Icons.moped_rounded;
      case 'SAFETY_REMINDER':
        return Icons.verified_user_rounded;
      case 'HUB_ALERT':
      default:
        return Icons.storefront_rounded;
    }
  }

  Color _getColorForType(String? type) {
    switch (type) {
      case 'DELIVERY_PAYOUT':
        return AppColors.dutyOnline;
      case 'ORDER_ASSIGNMENT':
        return AppColors.primaryMaroon;
      case 'SAFETY_REMINDER':
        return AppColors.deliveryAmber;
      case 'HUB_ALERT':
      default:
        return AppColors.primaryMaroon;
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<RiderOrdersProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text(
          'Notifications',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
        ),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.textPrimary,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: RefreshIndicator(
        color: AppColors.primaryMaroon,
        onRefresh: () async {
          setState(() {
            _loadNotifications();
          });
        },
        child: FutureBuilder<List<Map<String, dynamic>>>(
          future: _notificationsFuture,
          builder: (ctx, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(
                child: CircularProgressIndicator(color: AppColors.primaryMaroon),
              );
            }

            final notifications = snapshot.data ?? [];
            if (notifications.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  SizedBox(height: MediaQuery.of(context).size.height * 0.3),
                  const Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.notifications_off_outlined, size: 48, color: AppColors.textMuted),
                        SizedBox(height: 12),
                        Text(
                          'No notifications yet',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'Your delivery alerts and store updates will appear here.',
                          style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                ],
              );
            }

            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: notifications.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (ctx, index) {
                final item = notifications[index];
                final type = item['type']?.toString();
                final isRead = item['isRead'] == true;
                final id = item['_id']?.toString() ?? item['id']?.toString() ?? '';

                return InkWell(
                  onTap: () {
                    if (!isRead && id.isNotEmpty) {
                      provider.markNotificationRead(id);
                      setState(() {
                        item['isRead'] = true;
                      });
                    }
                  },
                  borderRadius: AppDimensions.roundedLg,
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: isRead ? Colors.white : const Color(0xFFFFF9F9),
                      borderRadius: AppDimensions.roundedLg,
                      border: Border.all(
                        color: isRead ? AppColors.borderHairline : AppColors.primaryMaroon.withOpacity(0.3),
                        width: isRead ? 1.0 : 1.4,
                      ),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: _getColorForType(type).withOpacity(0.12),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(_getIconForType(type), color: _getColorForType(type), size: 22),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      item['title'] ?? 'Notification',
                                      style: TextStyle(
                                        fontSize: 14,
                                        fontWeight: isRead ? FontWeight.w700 : FontWeight.w900,
                                        color: AppColors.textPrimary,
                                      ),
                                    ),
                                  ),
                                  if (!isRead)
                                    Container(
                                      width: 8,
                                      height: 8,
                                      decoration: const BoxDecoration(
                                        color: AppColors.primaryMaroon,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(
                                item['body'] ?? '',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.textSecondary,
                                  height: 1.35,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                _formatRelativeTime(item['createdAt']),
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.textMuted,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
