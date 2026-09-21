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
  });

  factory StoreModel.fromJson(Map<String, dynamic> json, [int index = 0]) {
    final dist = json['distance'] != null && json['distance'].toString().isNotEmpty
        ? json['distance'].toString()
        : '${(0.8 + index * 0.8).toStringAsFixed(1)} km away';

    return StoreModel(
      storeId: (json['storeId'] ?? json['id'] ?? 'S00${index + 1}').toString(),
      name: (json['name'] ?? "TeFFe's Butchery Hub").toString(),
      address: (json['address'] ?? 'Kishore Ganj, Harmu Road, Ranchi').toString(),
      city: (json['city'] ?? 'Ranchi').toString(),
      phone: (json['phone'] ?? '').toString(),
      status: (json['status'] ?? 'Active').toString(),
      pickupEnabled: json['pickupEnabled'] ?? true,
      deliveryEnabled: json['deliveryEnabled'] ?? true,
      timings: (json['timings'] ?? '08:00 AM - 08:00 PM').toString(),
      distance: dist,
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
    };
  }
}
