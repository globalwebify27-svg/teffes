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
  });

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
