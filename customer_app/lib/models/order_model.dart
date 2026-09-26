class OrderRiderModel {
  final String? name;
  final String? phone;
  final String? vehicle;
  final String? rating;
  final String? eta;
  final double? lat;
  final double? lng;

  OrderRiderModel({
    this.name,
    this.phone,
    this.vehicle,
    this.rating,
    this.eta,
    this.lat,
    this.lng,
  });

  factory OrderRiderModel.fromJson(Map<String, dynamic> json) {
    return OrderRiderModel(
      name: json['name'],
      phone: json['phone'],
      vehicle: json['vehicle'] ?? json['vehicleNumber'],
      rating: json['rating'] ?? '4.9 ★',
      eta: json['eta']?.toString(),
      lat: (json['lat'] as num?)?.toDouble(),
      lng: (json['lng'] as num?)?.toDouble(),
    );
  }
}

class OrderModel {
  final String id;
  final String orderId;
  final String status;
  final double amount;
  final String placedAt;
  final List<dynamic> items;
  final OrderRiderModel? rider;
  final String? returnStatus;
  final String? returnReason;
  final String? deliveryAddress;
  final double? deliveryLat;
  final double? deliveryLng;
  final double? storeLat;
  final double? storeLng;
  final String? paymentMethod;
  final String? paymentStatus;
  final String? storeName;
  final String fulfillmentType;
  final bool pickupMode;
  final String? deliveryOtp;
  final String? targetDeliveryTime;
  final int? prepTimeMinutes;
  final int? remainingTransitMinutes;
  final String? etaStage;

  bool get isActive {
    final s = status.toLowerCase();
    return s != 'delivered' && s != 'cancelled' && s != 'returned';
  }

  bool get isPickup =>
      pickupMode ||
      fulfillmentType == 'pickup' ||
      (deliveryAddress?.toLowerCase().contains('pickup') ?? false);

  OrderModel({
    required this.id,
    required this.orderId,
    required this.status,
    required this.amount,
    required this.placedAt,
    required this.items,
    this.rider,
    this.returnStatus,
    this.returnReason,
    this.deliveryAddress,
    this.deliveryLat,
    this.deliveryLng,
    this.storeLat,
    this.storeLng,
    this.paymentMethod,
    this.paymentStatus,
    this.storeName = 'Kishore Ganj Hub',
    this.fulfillmentType = 'delivery',
    this.pickupMode = false,
    this.deliveryOtp,
    this.targetDeliveryTime,
    this.prepTimeMinutes,
    this.remainingTransitMinutes,
    this.etaStage,
  });

  factory OrderModel.fromJson(Map<String, dynamic> json) {
    final bool isPickup = json['pickupMode'] == true ||
        json['fulfillmentType'] == 'pickup' ||
        (json['deliverySlot']?.toString().toLowerCase().contains('pickup') ?? false) ||
        (json['deliveryAddress']?.toString().toLowerCase().contains('pickup') ?? false);

    double? dLat;
    double? dLng;
    if (json['deliveryAddress'] is Map) {
      dLat = (json['deliveryAddress']['latitude'] ?? json['deliveryAddress']['lat'])?.toDouble();
      dLng = (json['deliveryAddress']['longitude'] ?? json['deliveryAddress']['lng'])?.toDouble();
    } else if (json['customer'] is Map) {
      dLat = (json['customer']['lat'] ?? json['customer']['latitude'])?.toDouble();
      dLng = (json['customer']['lng'] ?? json['customer']['longitude'])?.toDouble();
    }

    double? sLat;
    double? sLng;
    if (json['store'] is Map) {
      sLat = (json['store']['latitude'] ?? json['store']['lat'])?.toDouble();
      sLng = (json['store']['longitude'] ?? json['store']['lng'])?.toDouble();
    } else if (json['storeLocation'] is Map) {
      sLat = (json['storeLocation']['lat'] ?? json['storeLocation']['latitude'])?.toDouble();
      sLng = (json['storeLocation']['lng'] ?? json['storeLocation']['longitude'])?.toDouble();
    }

    return OrderModel(
      id: json['_id'] ?? json['id'] ?? '',
      orderId: json['orderId'] ?? json['id'] ?? '',
      status: json['status'] ?? 'Pending',
      amount: (json['totalAmount'] as num?)?.toDouble() ?? (json['amount'] as num?)?.toDouble() ?? 0.0,
      placedAt: json['createdAt'] ?? json['placedAt'] ?? 'Recently',
      items: json['items'] is List ? json['items'] : [],
      rider: json['rider'] is Map<String, dynamic> ? OrderRiderModel.fromJson(json['rider']) : null,
      returnStatus: json['returnStatus'],
      returnReason: json['returnReason'],
      deliveryAddress: json['customer']?['address'] ?? json['deliveryAddress']?['line1'] ?? json['shippingAddress'] ?? 'Ranchi',
      deliveryLat: dLat,
      deliveryLng: dLng,
      storeLat: sLat,
      storeLng: sLng,
      paymentMethod: json['paymentMethod'] ?? (isPickup ? 'Pay at Store Counter' : 'COD'),
      paymentStatus: json['paymentStatus'] ?? 'Pending',
      storeName: json['storeName'] ?? 'Kishore Ganj Hub',
      fulfillmentType: isPickup ? 'pickup' : (json['fulfillmentType'] ?? 'delivery'),
      pickupMode: isPickup,
      deliveryOtp: json['deliveryOtp']?.toString(),
      targetDeliveryTime: json['targetDeliveryTime']?.toString() ?? json['etaDetails']?['targetClockTime']?.toString(),
      prepTimeMinutes: (json['prepTimeMinutes'] as num?)?.toInt(),
      remainingTransitMinutes: (json['remainingTransitMinutes'] as num?)?.toInt() ?? (json['etaDetails']?['minutesRemaining'] as num?)?.toInt(),
      etaStage: json['etaStage']?.toString() ?? json['etaDetails']?['stage']?.toString(),
    );
  }
}
