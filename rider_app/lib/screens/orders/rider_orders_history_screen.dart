import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../core/utils/currency_formatter.dart';
import '../../models/rider_order_model.dart';
import '../../providers/rider_orders_provider.dart';
import 'rider_order_details_screen.dart';

class RiderOrdersHistoryScreen extends StatefulWidget {
  const RiderOrdersHistoryScreen({super.key});

  @override
  State<RiderOrdersHistoryScreen> createState() => _RiderOrdersHistoryScreenState();
}

class _RiderOrdersHistoryScreenState extends State<RiderOrdersHistoryScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<RiderOrdersProvider>().fetchOrders();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Color _getStatusColor(String status) {
    switch (status.toUpperCase()) {
      case 'DELIVERED':
        return AppColors.dutyOnline;
      case 'OUT_FOR_DELIVERY':
      case 'PICKED_UP':
      case 'ACCEPTED':
        return AppColors.deliveryAmber;
      case 'CANCELLED':
        return AppColors.error;
      default:
        return AppColors.primaryMaroon;
    }
  }

  @override
  Widget build(BuildContext context) {
    final ordersProvider = context.watch<RiderOrdersProvider>();
    final allOrders = ordersProvider.orders;

    final activeOrders = allOrders.where((o) => o.status.toUpperCase() != 'DELIVERED' && o.status.toUpperCase() != 'CANCELLED').toList();
    final completedOrders = allOrders.where((o) => o.status.toUpperCase() == 'DELIVERED').toList();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text(
          'Deliveries',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
        ),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.textPrimary,
        elevation: 0.5,
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.primaryMaroon,
          unselectedLabelColor: AppColors.textSecondary,
          indicatorColor: AppColors.primaryMaroon,
          indicatorWeight: 3,
          labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
          tabs: [
            Tab(text: 'All (${allOrders.length})'),
            Tab(text: 'Active (${activeOrders.length})'),
            Tab(text: 'Completed (${completedOrders.length})'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildOrdersList(allOrders, ordersProvider),
          _buildOrdersList(activeOrders, ordersProvider),
          _buildOrdersList(completedOrders, ordersProvider),
        ],
      ),
    );
  }

  Widget _buildOrdersList(List<RiderOrder> orders, RiderOrdersProvider provider) {
    if (orders.isEmpty) {
      return RefreshIndicator(
        color: AppColors.primaryMaroon,
        onRefresh: () => provider.fetchOrders(),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            SizedBox(height: MediaQuery.of(context).size.height * 0.25),
            const Center(
              child: Icon(Icons.inbox_rounded, size: 54, color: AppColors.textMuted),
            ),
            const SizedBox(height: 12),
            const Center(
              child: Text(
                'No deliveries found in this tab',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: AppColors.primaryMaroon,
      onRefresh: () => provider.fetchOrders(),
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: orders.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (ctx, index) {
          final order = orders[index];
          final statusColor = _getStatusColor(order.status);

          return InkWell(
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => RiderOrderDetailsScreen(order: order)),
              );
            },
            borderRadius: AppDimensions.roundedLg,
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: AppDimensions.roundedLg,
                border: Border.all(color: AppColors.borderHairline),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Order #${order.orderNumber}',
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: statusColor.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          order.status.replaceAll('_', ' ').toUpperCase(),
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: statusColor,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${order.customerName} • ${order.customerAddress}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 10),
                  const Divider(color: AppColors.borderHairline, height: 1),
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '${order.items.length} meat item${order.items.length > 1 ? 's' : ''}',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      Row(
                        children: [
                          const Text(
                            'Payout: ',
                            style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                          ),
                          Text(
                            CurrencyFormatter.format(order.riderEarning),
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                              color: AppColors.dutyOnline,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
