class AddressModel {
  final String id;
  final String tag;
  final String line1;
  final String? line2;
  final String city;
  final String pincode;
  final String? landmark;
  final double? latitude;
  final double? longitude;
  final bool isDefault;

  AddressModel({
    required this.id,
    required this.tag,
    required this.line1,
    this.line2,
    this.city = 'Ranchi',
    this.pincode = '834001',
    this.landmark,
    this.latitude,
    this.longitude,
    this.isDefault = false,
  });

  String get fullAddress {
    final parts = <String>[];
    if (line1.isNotEmpty) parts.add(line1);
    if (line2 != null && line2!.isNotEmpty) parts.add(line2!);
    if (landmark != null && landmark!.isNotEmpty) parts.add('($landmark)');
    if (city.isNotEmpty) parts.add(city);
    if (pincode.isNotEmpty) parts.add(pincode);
    return parts.join(', ');
  }

  factory AddressModel.fromJson(Map<String, dynamic> json) {
    return AddressModel(
      id: json['_id'] ?? json['id'] ?? '',
      tag: json['tag'] ?? 'Home',
      line1: json['line1'] ?? '',
      line2: json['line2'],
      city: json['city'] ?? 'Ranchi',
      pincode: json['pincode'] ?? '834001',
      landmark: json['landmark'],
      latitude: (json['latitude'] as num?)?.toDouble() ?? (json['lat'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble() ?? (json['lng'] as num?)?.toDouble(),
      isDefault: json['isDefault'] ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'tag': tag,
      'line1': line1,
      'line2': line2,
      'city': city,
      'pincode': pincode,
      'landmark': landmark,
      'latitude': latitude,
      'longitude': longitude,
      'isDefault': isDefault,
    };
  }
}

class UserModel {
  final String id;
  final String name;
  final String phone;
  final String? email;
  final String role;
  final double walletBalance;
  final String loyaltyTier;
  final double totalSpent;
  final List<AddressModel> addresses;

  UserModel({
    required this.id,
    required this.name,
    required this.phone,
    this.email,
    this.role = 'customer',
    this.walletBalance = 0.0,
    this.loyaltyTier = 'Bronze',
    this.totalSpent = 0.0,
    this.addresses = const [],
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    var rawAddrs = json['addresses'];
    List<AddressModel> parsedAddrs = [];
    if (rawAddrs is List) {
      parsedAddrs = rawAddrs.map((a) => AddressModel.fromJson(a as Map<String, dynamic>)).toList();
    }

    return UserModel(
      id: json['_id'] ?? json['id'] ?? '',
      name: json['name'] ?? '',
      phone: json['phone'] ?? '',
      email: json['email'],
      role: json['role'] ?? 'customer',
      walletBalance: (json['walletBalance'] as num?)?.toDouble() ?? 0.0,
      loyaltyTier: json['loyaltyTier'] ?? 'Bronze',
      totalSpent: (json['totalSpent'] as num?)?.toDouble() ?? 0.0,
      addresses: parsedAddrs,
    );
  }

  UserModel copyWith({
    String? id,
    String? name,
    String? phone,
    String? email,
    String? role,
    double? walletBalance,
    String? loyaltyTier,
    double? totalSpent,
    List<AddressModel>? addresses,
  }) {
    return UserModel(
      id: id ?? this.id,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      role: role ?? this.role,
      walletBalance: walletBalance ?? this.walletBalance,
      loyaltyTier: loyaltyTier ?? this.loyaltyTier,
      totalSpent: totalSpent ?? this.totalSpent,
      addresses: addresses ?? this.addresses,
    );
  }
}
