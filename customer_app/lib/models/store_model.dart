class StoreModel {
  final String storeId;
  final String name;
  final String address;
  final String city;
  final String phone;
  final String status;
  final bool pickupEnabled;
  final bool deliveryEnabled;
  final String timings;
  final String distance;
  final bool isAvailable;
  final List<String> outOfStockItems;
  final List<String> outOfStockProductIds;
  final double? distanceKm;
  final double? deliveryRadiusKm;
  final bool isWithinRadius;
  final bool isDeliverable;
  final bool isOpen;
  final String? emergencyNotice;
  final Map<String, dynamic>? todaySpecialSchedule;
  final Map<String, dynamic>? specialSchedules;
  final bool expressDeliveryEnabled;
  final double expressDeliveryFee;
  final double standardDeliveryFee;
  final double freeDeliveryThreshold;
  final bool rainSurgeEnabled;
  final double rainSurgeFee;

  const StoreModel({
    required this.storeId,
    required this.name,
    required this.address,
    this.city = 'Ranchi',
    this.phone = '',
    this.status = 'Active',
    this.pickupEnabled = true,
    this.deliveryEnabled = true,
    this.timings = '08:00 AM - 08:00 PM',
    this.distance = '',
    this.isAvailable = true,
    this.outOfStockItems = const [],
    this.outOfStockProductIds = const [],
    this.distanceKm,
    this.deliveryRadiusKm = 10.0,
    this.isWithinRadius = true,
    this.isDeliverable = true,
    this.isOpen = true,
    this.emergencyNotice,
    this.todaySpecialSchedule,
    this.specialSchedules,
    this.expressDeliveryEnabled = true,
    this.expressDeliveryFee = 50.0,
    this.standardDeliveryFee = 40.0,
    this.freeDeliveryThreshold = 399.0,
    this.rainSurgeEnabled = false,
    this.rainSurgeFee = 15.0,
  });

  bool get isClosedToday => todaySpecialSchedule != null && todaySpecialSchedule!['mode'] == 'closed';
  String? get customerScheduleNote => todaySpecialSchedule?['customerNote']?.toString();
  String? get specialCloseTime => todaySpecialSchedule?['closeTime']?.toString();
  String? get specialOpenTime => todaySpecialSchedule?['openTime']?.toString();

  bool isSpecialCutoffPassed() {
    final closeTime = specialCloseTime;
    if (closeTime == null || closeTime.isEmpty) return false;
    final parts = closeTime.split(':');
    final cH = int.tryParse(parts[0]);
    if (cH == null) return false;
    final cM = parts.length > 1 ? (int.tryParse(parts[1]) ?? 0) : 0;
    final now = DateTime.now();
    final currentMins = now.hour * 60 + now.minute;
    final closeMins = cH * 60 + cM;
    return currentMins >= closeMins;
  }

  bool isBeforeSpecialOpen() {
    final openTime = specialOpenTime;
    if (openTime == null || openTime.isEmpty) return false;
    final parts = openTime.split(':');
    final oH = int.tryParse(parts[0]);
    if (oH == null) return false;
    final oM = parts.length > 1 ? (int.tryParse(parts[1]) ?? 0) : 0;
    final now = DateTime.now();
    final currentMins = now.hour * 60 + now.minute;
    final openMins = oH * 60 + oM;
    return currentMins < openMins;
  }

  bool get isStoreOperational {
    if (!isOpen) return false;
    final s = status.toLowerCase();
    if (s == 'paused' || s == 'closed' || s == 'inactive') return false;
    return true;
  }

  factory StoreModel.fromJson(Map<String, dynamic> json, [int index = 0]) {
    final rawDist = json['distance']?.toString();
    final dist = (rawDist != null && rawDist.isNotEmpty && !rawDist.contains('9999'))
        ? rawDist
        : '';

    final isAvail = json['isAvailable'] == null ? true : (json['isAvailable'] == true);
    final outOfStockList = (json['outOfStockItems'] is List)
        ? (json['outOfStockItems'] as List).map((e) => e.toString()).toList()
        : <String>[];
    final outOfStockProdIds = (json['outOfStockProductIds'] is List)
        ? (json['outOfStockProductIds'] as List).map((e) => e.toString()).toList()
        : <String>[];
    final radius = json['deliveryRadiusKm'] != null ? (json['deliveryRadiusKm'] as num).toDouble() : 10.0;
    final distKm = json['distanceKm'] != null ? (json['distanceKm'] as num).toDouble() : null;
    final withinRadius = json['isWithinRadius'] != null
        ? (json['isWithinRadius'] == true)
        : (distKm != null ? (distKm <= radius) : true);
    final deliverable = json['isDeliverable'] == null ? withinRadius : (json['isDeliverable'] == true);

    final isOpenVal = json['isOpen'] == null ? true : (json['isOpen'] == true);
    final emergencyNoticeVal = json['emergencyNotice']?.toString();
    final todaySchedule = json['todaySpecialSchedule'] is Map
        ? Map<String, dynamic>.from(json['todaySpecialSchedule'] as Map)
        : null;
    final specialSchedules = json['specialSchedules'] is Map
        ? Map<String, dynamic>.from(json['specialSchedules'] as Map)
        : null;
    final expressEnabled = json['expressDeliveryEnabled'] == null ? true : (json['expressDeliveryEnabled'] == true);
    final expressFee = json['expressDeliveryFee'] != null ? (json['expressDeliveryFee'] as num).toDouble() : 50.0;
    final standardFee = json['standardDeliveryFee'] != null ? (json['standardDeliveryFee'] as num).toDouble() : 40.0;
    final freeThreshold = json['freeDeliveryThreshold'] != null ? (json['freeDeliveryThreshold'] as num).toDouble() : 399.0;
    final rainSurge = json['rainSurgeEnabled'] == true;
    final rainFee = json['rainSurgeFee'] != null ? (json['rainSurgeFee'] as num).toDouble() : 15.0;

    return StoreModel(
      storeId: (json['storeId'] ?? json['id'] ?? 'S00${index + 1}').toString(),
      name: (json['name'] ?? "TeFFe's Store Hub").toString(),
      address: (json['address'] ?? 'Harmu Road, Ranchi').toString(),
      city: (json['city'] ?? 'Ranchi').toString(),
      phone: (json['phone'] ?? '').toString(),
      status: (json['status'] ?? 'Active').toString(),
      pickupEnabled: json['pickupEnabled'] ?? true,
      deliveryEnabled: json['deliveryEnabled'] ?? true,
      timings: (json['timings'] ?? '08:00 AM - 08:00 PM').toString(),
      distance: dist,
      isAvailable: isAvail,
      outOfStockItems: outOfStockList,
      outOfStockProductIds: outOfStockProdIds,
      distanceKm: distKm,
      deliveryRadiusKm: radius,
      isWithinRadius: withinRadius,
      isDeliverable: deliverable,
      isOpen: isOpenVal,
      emergencyNotice: emergencyNoticeVal,
      todaySpecialSchedule: todaySchedule,
      specialSchedules: specialSchedules,
      expressDeliveryEnabled: expressEnabled,
      expressDeliveryFee: expressFee,
      standardDeliveryFee: standardFee,
      freeDeliveryThreshold: freeThreshold,
      rainSurgeEnabled: rainSurge,
      rainSurgeFee: rainFee,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'storeId': storeId,
      'name': name,
      'address': address,
      'city': city,
      'phone': phone,
      'status': status,
      'pickupEnabled': pickupEnabled,
      'deliveryEnabled': deliveryEnabled,
      'timings': timings,
      'distance': distance,
      'isAvailable': isAvailable,
      'outOfStockItems': outOfStockItems,
      if (distanceKm != null) 'distanceKm': distanceKm,
    };
  }
}
