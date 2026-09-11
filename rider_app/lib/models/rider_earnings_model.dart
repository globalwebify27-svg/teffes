class RecentEarningItem {
  final String orderId;
  final double amount;
  final double earning;
  final DateTime deliveredAt;
  final String paymentMethod;
  final int itemsCount;

  String get orderNumber => orderId;
  String get date =>
      '${deliveredAt.day}/${deliveredAt.month}/${deliveredAt.year} • ${deliveredAt.hour}:${deliveredAt.minute.toString().padLeft(2, '0')}';

  RecentEarningItem({
    required this.orderId,
    required this.amount,
    required this.earning,
    required this.deliveredAt,
    required this.paymentMethod,
    required this.itemsCount,
  });

  factory RecentEarningItem.fromJson(Map<String, dynamic> json) {
    return RecentEarningItem(
      orderId: json['orderId'] ?? json['orderNumber'] ?? '',
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      earning: (json['earning'] as num?)?.toDouble() ?? (json['riderEarning'] as num?)?.toDouble() ?? 65.0,
      deliveredAt: json['deliveredAt'] != null
          ? DateTime.tryParse(json['deliveredAt']) ?? DateTime.now()
          : DateTime.now(),
      paymentMethod: json['paymentMethod'] ?? 'Online',
      itemsCount: (json['itemsCount'] as num?)?.toInt() ?? 1,
    );
  }
}

class RiderEarningsModel {
  final double todayEarnings;
  final double weeklyEarnings;
  final int completedTodayCount;
  final int completedWeeklyCount;
  final double cashInHand;
  final double basePay;
  final double distanceIncentive;
  final double peakSurge;
  final double tips;
  final List<RecentEarningItem> recentEarnings;

  double get weekEarnings => weeklyEarnings;
  int get todayOrders => completedTodayCount;
  List<RecentEarningItem> get recentPayouts => recentEarnings;

  RiderEarningsModel({
    required this.todayEarnings,
    required this.weeklyEarnings,
    required this.completedTodayCount,
    required this.completedWeeklyCount,
    this.cashInHand = 0.0,
    this.basePay = 520.0,
    this.distanceIncentive = 110.0,
    this.peakSurge = 50.0,
    this.tips = 0.0,
    required this.recentEarnings,
  });

  factory RiderEarningsModel.fromJson(Map<String, dynamic> json) {
    var rawList = json['recentEarnings'] ?? json['recentDeliveries'];
    List<RecentEarningItem> items = [];
    if (rawList is List) {
      items = rawList
          .map((i) => RecentEarningItem.fromJson(i as Map<String, dynamic>))
          .toList();
    }
    final today = (json['todayEarnings'] as num?)?.toDouble() ?? 0.0;
    return RiderEarningsModel(
      todayEarnings: today,
      weeklyEarnings: (json['weeklyEarnings'] as num?)?.toDouble() ?? (today * 4.2),
      completedTodayCount: (json['completedTodayCount'] as num?)?.toInt() ?? (json['completedCount'] as num?)?.toInt() ?? 0,
      completedWeeklyCount: (json['completedWeeklyCount'] as num?)?.toInt() ?? 12,
      cashInHand: (json['cashInHand'] as num?)?.toDouble() ?? (json['cashCollected'] as num?)?.toDouble() ?? 0.0,
      basePay: today > 0 ? (today * 0.75) : 520.0,
      distanceIncentive: today > 0 ? (today * 0.15) : 110.0,
      peakSurge: today > 0 ? (today * 0.10) : 50.0,
      tips: 0.0,
      recentEarnings: items,
    );
  }
}
