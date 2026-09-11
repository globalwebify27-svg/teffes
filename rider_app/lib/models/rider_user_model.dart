class RiderUserModel {
  final String id;
  final String name;
  final String email;
  final String phone;
  final String role;
  final String vehicleNumber;
  final String storeId;
  final String? storeName;
  final String? storeAdminName;
  final String? storeAdminPhone;
  final String riderStatus;
  final bool isOnline;

  String get assignedStore => storeName ?? 'TeFFe\'s — Kishore Ganj ($storeId)';

  RiderUserModel({
    required this.id,
    required this.name,
    required this.email,
    required this.phone,
    this.role = 'rider',
    this.vehicleNumber = 'JH-01-BK-4920',
    this.storeId = 'S001',
    this.storeName,
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
      storeId: json['storeId'] ?? 'S001',
      storeName: json['storeName'] ?? json['store']?['name'],
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
    String? storeName,
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
      storeId: storeId,
      storeName: storeName ?? this.storeName,
      storeAdminName: storeAdminName ?? this.storeAdminName,
      storeAdminPhone: storeAdminPhone ?? this.storeAdminPhone,
      riderStatus: riderStatus ?? this.riderStatus,
      isOnline: isOnline ?? this.isOnline,
    );
  }
}
