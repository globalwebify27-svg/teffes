class ReviewModel {
  final String id;
  final String productId;
  final String userName;
  final double rating;
  final String title;
  final String comment;
  final bool isVerifiedPurchase;
  final String createdAt;

  ReviewModel({
    required this.id,
    required this.productId,
    required this.userName,
    required this.rating,
    this.title = '',
    this.comment = '',
    this.isVerifiedPurchase = false,
    required this.createdAt,
  });

  factory ReviewModel.fromJson(Map<String, dynamic> json) {
    return ReviewModel(
      id: json['id'] ?? json['_id'] ?? '',
      productId: json['productId'] ?? '',
      userName: json['userName'] ?? 'Verified Customer',
      rating: (json['rating'] as num?)?.toDouble() ?? 5.0,
      title: json['title'] ?? '',
      comment: json['comment'] ?? '',
      isVerifiedPurchase: json['isVerifiedPurchase'] == true,
      createdAt: json['createdAt'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'productId': productId,
      'userName': userName,
      'rating': rating,
      'title': title,
      'comment': comment,
      'isVerifiedPurchase': isVerifiedPurchase,
      'createdAt': createdAt,
    };
  }
}
