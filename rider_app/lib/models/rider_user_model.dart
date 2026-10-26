class RiderUserModel {
  final String id;
  final String name;
  final String email;
  final String phone;
  final String role;
  final String vehicleNumber;
  final String vehicleType;
  final double rating;
  final int ratingCount;
  final bool foodSafetyCertified;
  final String fssaiCertNumber;
  final int dailyTarget;
  final String storeId;
  final String? storeName;
  final String? storeAddress;
  final String? storeAdminName;
  final String? storeAdminPhone;
  final String riderStatus;
  final bool isOnline;

  String get assignedStore => storeName ?? 'TeFFe\'s Store ($storeId)';

  RiderUserModel({
    required this.id,
    required this.name,
    required this.email,
    required this.phone,
    this.role = 'rider',
    this.vehicleNumber = 'JH-01-BK-4920',
    this.vehicleType = 'Bike',
    this.rating = 5.0,
    this.ratingCount = 0,
    this.foodSafetyCertified = true,
    this.fssaiCertNumber = 'FSSAI-CC-2024-8839',
    this.dailyTarget = 16,
    this.storeId = 'S001',
    this.storeName,
    this.storeAddress,
    this.storeAdminName,
    this.storeAdminPhone,
    this.riderStatus = 'Available',
    this.isOnline = true,
  });

  factory RiderUserModel.fromJson(Map<String, dynamic> json) {
    final status = json['riderStatus'] ?? (json['isOnline'] == false ? 'Offline' : 'Available');
    return RiderUserModel(
      id: json['id'] ?? json['_id'] ?? '',
      name: json['name'] ?? 'Rider Partner',
      email: json['email'] ?? '',
      phone: json['phone'] ?? '',
      role: json['role'] ?? 'rider',
      vehicleNumber: json['vehicleNumber'] ?? 'JH-01-BK-4920',
      vehicleType: json['vehicleType'] ?? 'Bike',
      rating: (json['rating'] as num?)?.toDouble() ?? (json['riderRating'] as num?)?.toDouble() ?? 5.0,
      ratingCount: (json['ratingCount'] as num?)?.toInt() ?? (json['riderRatingCount'] as num?)?.toInt() ?? 0,
      foodSafetyCertified: json['foodSafetyCertified'] ?? true,
      fssaiCertNumber: json['fssaiCertNumber'] ?? 'FSSAI-CC-2024-8839',
      dailyTarget: (json['dailyTarget'] as num?)?.toInt() ?? 16,
      storeId: json['storeId'] ?? 'S001',
      storeName: json['storeName'] ?? json['store']?['name'],
      storeAddress: json['storeAddress'] ?? json['store']?['address'],
      storeAdminName: json['storeAdminName'] ?? json['store']?['adminName'],
      storeAdminPhone: json['storeAdminPhone'] ?? json['store']?['adminPhone'],
      riderStatus: status,
      isOnline: status != 'Offline',
    );
  }

  RiderUserModel copyWith({
    String? name,
    String? phone,
    String? vehicleNumber,
    String? vehicleType,
    double? rating,
    int? ratingCount,
    bool? foodSafetyCertified,
    String? fssaiCertNumber,
    int? dailyTarget,
    String? storeName,
    String? storeAddress,
    String? storeAdminName,
    String? storeAdminPhone,
    String? riderStatus,
    bool? isOnline,
  }) {
    return RiderUserModel(
      id: id,
      name: name ?? this.name,
      email: email,
      phone: phone ?? this.phone,
      role: role,
      vehicleNumber: vehicleNumber ?? this.vehicleNumber,
      vehicleType: vehicleType ?? this.vehicleType,
      rating: rating ?? this.rating,
      ratingCount: ratingCount ?? this.ratingCount,
      foodSafetyCertified: foodSafetyCertified ?? this.foodSafetyCertified,
      fssaiCertNumber: fssaiCertNumber ?? this.fssaiCertNumber,
      dailyTarget: dailyTarget ?? this.dailyTarget,
      storeId: storeId,
      storeName: storeName ?? this.storeName,
      storeAddress: storeAddress ?? this.storeAddress,
      storeAdminName: storeAdminName ?? this.storeAdminName,
      storeAdminPhone: storeAdminPhone ?? this.storeAdminPhone,
      riderStatus: riderStatus ?? this.riderStatus,
      isOnline: isOnline ?? this.isOnline,
    );
  }
}
