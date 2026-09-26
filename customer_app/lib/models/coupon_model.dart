class CouponModel {
  final String id;
  final String code;
  final String discount;
  final String description;
  final String discountType; // 'percentage', 'fixed', 'free_delivery'
  final double discountValue;
  final double minOrder;
  final double minOrderAmount;
  final double? maxDiscountAmount;
  final String validFrom;
  final String validTill;
  final bool firstOrderOnly;
  final int? usageLimit;
  final int usageCount;
  final int used;
  final String status;
  final bool isActive;
  final bool isSuperOffer;

  const CouponModel({
    required this.id,
    required this.code,
    required this.discount,
    this.description = '',
    this.discountType = 'percentage',
    this.discountValue = 20.0,
    this.minOrder = 299.0,
    this.minOrderAmount = 299.0,
    this.maxDiscountAmount,
    this.validFrom = '',
    this.validTill = '31 Dec 2026',
    this.firstOrderOnly = false,
    this.usageLimit,
    this.usageCount = 0,
    this.used = 0,
    this.status = 'Active',
    this.isActive = true,
    this.isSuperOffer = false,
  });

  factory CouponModel.fromJson(Map<String, dynamic> json) {
    final minOrd = (json['minOrderAmount'] as num?)?.toDouble() ??
        (json['minOrder'] as num?)?.toDouble() ??
        0.0;
    final usedCount = (json['usageCount'] as num?)?.toInt() ??
        (json['used'] as num?)?.toInt() ??
        0;

    return CouponModel(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      code: (json['code'] ?? '').toString(),
      discount: (json['description'] ?? json['discount'] ?? '').toString(),
      description: (json['description'] ?? json['discount'] ?? '').toString(),
      discountType: (json['discountType'] ?? 'percentage').toString(),
      discountValue: (json['discountValue'] as num?)?.toDouble() ?? 20.0,
      minOrder: minOrd,
      minOrderAmount: minOrd,
      maxDiscountAmount: (json['maxDiscountAmount'] as num?)?.toDouble(),
      validFrom: (json['validFrom'] ?? '').toString(),
      validTill: (json['validTill'] ?? '31 Dec 2026').toString(),
      firstOrderOnly: json['firstOrderOnly'] == true,
      usageLimit: (json['usageLimit'] as num?)?.toInt(),
      usageCount: usedCount,
      used: usedCount,
      status: (json['status'] ?? 'Active').toString(),
      isActive: json['isActive'] != false && json['status'] != 'Paused',
      isSuperOffer: json['isSuperOffer'] == true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'code': code,
      'discount': discount,
      'description': description,
      'discountType': discountType,
      'discountValue': discountValue,
      'minOrder': minOrder,
      'minOrderAmount': minOrderAmount,
      'maxDiscountAmount': maxDiscountAmount,
      'validFrom': validFrom,
      'validTill': validTill,
      'firstOrderOnly': firstOrderOnly,
      'usageLimit': usageLimit,
      'usageCount': usageCount,
      'used': used,
      'status': status,
      'isActive': isActive,
      'isSuperOffer': isSuperOffer,
    };
  }
}
