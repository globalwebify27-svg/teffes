class RiderOrderItemModel {
  final String name;
  final int quantity;
  final double price;
  final String netWeight;
  final String? image;

  String get unit => netWeight;

  RiderOrderItemModel({
    required this.name,
    required this.quantity,
    required this.price,
    required this.netWeight,
    this.image,
  });

  factory RiderOrderItemModel.fromJson(Map<String, dynamic> json) {
    return RiderOrderItemModel(
      name: json['name'] ?? '',
      quantity: (json['quantity'] as num?)?.toInt() ?? 1,
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      netWeight: json['netWeight'] ?? json['weight'] ?? '500g',
      image: json['image'],
    );
  }
}

class RiderOrderCustomerModel {
  final String name;
  final String phone;
  final String address;
  final double? lat;
  final double? lng;

  RiderOrderCustomerModel({
    required this.name,
    required this.phone,
    required this.address,
    this.lat,
    this.lng,
  });

  factory RiderOrderCustomerModel.fromJson(Map<String, dynamic> json) {
    return RiderOrderCustomerModel(
      name: json['name'] ?? 'Customer',
      phone: json['phone'] ?? '',
      address: json['address'] ?? 'Ranchi',
      lat: (json['lat'] as num?)?.toDouble(),
      lng: (json['lng'] as num?)?.toDouble(),
    );
  }
}

class RiderOrderModel {
  final String id;
  final String orderId;
  final String status;
  final double amount;
  final double riderEarning;
  final RiderOrderCustomerModel customer;
  final List<RiderOrderItemModel> items;
  final String deliverySlot;
  final String paymentMethod;
  final String paymentStatus;
  final String? deliveryOtp;
  final String storeName;
  final String storeAddress;
  final DateTime? createdAt;
  final DateTime? pickedUpAt;
  final DateTime? deliveredAt;
  final double? riderLat;
  final double? riderLng;

  String get orderNumber => orderId.isNotEmpty ? orderId : id;
  String get customerName => customer.name;
  String get customerPhone => customer.phone;
  String get customerAddress => customer.address;
  double? get customerLat => customer.lat;
  double? get customerLng => customer.lng;
  double get totalAmount => amount;

  bool get isCOD =>
      paymentMethod.toLowerCase().contains('cash') ||
      paymentMethod.toLowerCase().contains('cod');

  bool get isCod => isCOD;

  bool get isInTransit => status == 'Out for Delivery';
  bool get isReadyForPickup => status == 'Ready';
  bool get isDelivered => status == 'Delivered';

  RiderOrderModel({
    required this.id,
    required this.orderId,
    required this.status,
    required this.amount,
    required this.riderEarning,
    required this.customer,
    required this.items,
    this.deliverySlot = '90 Mins Express Delivery',
    this.paymentMethod = 'Cash on Delivery',
    this.paymentStatus = 'Pending',
    this.deliveryOtp,
    this.storeName = 'Kishore Ganj Artisanal Hub',
    this.storeAddress = 'Harmu Road, Kishore Ganj Chowk, Ranchi',
    this.createdAt,
    this.pickedUpAt,
    this.deliveredAt,
    this.riderLat,
    this.riderLng,
  });

  factory RiderOrderModel.fromJson(Map<String, dynamic> json) {
    var rawItems = json['items'];
    List<RiderOrderItemModel> parsedItems = [];
    if (rawItems is List) {
      parsedItems = rawItems
          .map((i) => RiderOrderItemModel.fromJson(i as Map<String, dynamic>))
          .toList();
    }

    Map<String, dynamic> custMap = {};
    if (json['customer'] is Map<String, dynamic>) {
      custMap = json['customer'];
    } else {
      custMap = {
        'name': 'Customer',
        'phone': '',
        'address': json['shippingAddress'] ?? 'Ranchi',
      };
    }

    return RiderOrderModel(
      id: json['_id'] ?? json['id'] ?? '',
      orderId: json['orderId'] ?? json['id'] ?? '',
      status: json['status'] ?? 'Pending',
      amount: (json['amount'] as num?)?.toDouble() ?? (json['totalAmount'] as num?)?.toDouble() ?? 0.0,
      riderEarning: (json['riderEarning'] as num?)?.toDouble() ?? 65.0,
      customer: RiderOrderCustomerModel.fromJson(custMap),
      items: parsedItems,
      deliverySlot: json['deliverySlot'] ?? '90 Mins Express Delivery',
      paymentMethod: json['paymentMethod'] ?? 'Cash on Delivery',
      paymentStatus: json['paymentStatus'] ?? 'Pending',
      deliveryOtp: json['deliveryOtp']?.toString(),
      storeName: json['storeName'] ?? 'Kishore Ganj Artisanal Hub',
      storeAddress: 'Harmu Road, Kishore Ganj Chowk, Ranchi',
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt']) : null,
      pickedUpAt: json['pickedUpAt'] != null ? DateTime.tryParse(json['pickedUpAt']) : null,
      deliveredAt: json['deliveredAt'] != null ? DateTime.tryParse(json['deliveredAt']) : null,
      riderLat: (json['rider']?['lat'] as num?)?.toDouble(),
      riderLng: (json['rider']?['lng'] as num?)?.toDouble(),
    );
  }
}

typedef RiderOrder = RiderOrderModel;
typedef RiderOrderItem = RiderOrderItemModel;
