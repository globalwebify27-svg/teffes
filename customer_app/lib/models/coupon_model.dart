class CouponModel {
  final String id;
  final String code;
  final String discount;
  final String discountType; // 'percentage', 'fixed', 'free_delivery'
  final double discountValue;
  final double minOrder;
  final int used;
  final String status;
  final String validTill;
  final bool isSuperOffer;

  const CouponModel({
    required this.id,
    required this.code,
    required this.discount,
    this.discountType = 'fixed',
    this.discountValue = 50.0,
    this.minOrder = 299.0,
    this.used = 0,
    this.status = 'Active',
    this.validTill = '31 Dec 2026',
    this.isSuperOffer = false,
  });

  factory CouponModel.fromJson(Map<String, dynamic> json) {
    return CouponModel(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      code: (json['code'] ?? '').toString(),
      discount: (json['discount'] ?? '').toString(),
      discountType: (json['discountType'] ?? 'fixed').toString(),
      discountValue: (json['discountValue'] as num?)?.toDouble() ?? 50.0,
      minOrder: (json['minOrder'] as num?)?.toDouble() ?? 299.0,
      used: (json['used'] as num?)?.toInt() ?? 0,
      status: (json['status'] ?? 'Active').toString(),
      validTill: (json['validTill'] ?? '31 Dec 2026').toString(),
      isSuperOffer: json['isSuperOffer'] == true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'code': code,
      'discount': discount,
      'discountType': discountType,
      'discountValue': discountValue,
      'minOrder': minOrder,
      'used': used,
      'status': status,
      'validTill': validTill,
      'isSuperOffer': isSuperOffer,
    };
  }
}
