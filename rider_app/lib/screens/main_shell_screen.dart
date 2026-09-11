import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/rider_auth_provider.dart';
import '../../providers/rider_orders_provider.dart';
import '../../widgets/common/rider_bottom_nav_bar.dart';
import 'dashboard/rider_dashboard_screen.dart';
import 'dashboard/new_order_alert_sheet.dart';
import 'orders/rider_orders_history_screen.dart';
import 'earnings/rider_earnings_screen.dart';
import 'profile/rider_profile_screen.dart';

class MainShellScreen extends StatefulWidget {
  const MainShellScreen({super.key});

  @override
  State<MainShellScreen> createState() => _MainShellScreenState();
}

class _MainShellScreenState extends State<MainShellScreen> {
  int _currentIndex = 0;
  Timer? _assignmentPollTimer;
  String? _lastAlertOrderId;

  final List<Widget> _screens = const [
    RiderDashboardScreen(),
    RiderOrdersHistoryScreen(),
    RiderEarningsScreen(),
    RiderProfileScreen(),
  ];

  @override
  void initState() {
    super.initState();
    _startPolling();
  }

  void _startPolling() {
    _assignmentPollTimer = Timer.periodic(const Duration(seconds: 15), (_) async {
      if (!mounted) return;
      final auth = context.read<RiderAuthProvider>();
      final orders = context.read<RiderOrdersProvider>();

      if (auth.isDutyOnline && orders.activeOrder == null) {
        await orders.fetchDashboard();
        if (!mounted) return;

        if (orders.availableOrders.isNotEmpty) {
          final first = orders.availableOrders.first;
          if (_lastAlertOrderId != first.id) {
            _lastAlertOrderId = first.id;
            NewOrderAlertSheet.show(context, first);
          }
        }
      }
    });
  }

  @override
  void dispose() {
    _assignmentPollTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: RiderBottomNavBar(
        currentIndex: _currentIndex,
        onTap: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
      ),
    );
  }
}
