class ProductModel {
  final String id;
  final String name;
  final double price;
  final double originalPrice;
  final String image;
  final String netWeight;
  final String? grossWeight;
  final String category;
  final String categoryLabel;
  final String? subCategory;
  final String? cutType;
  final String? serves;
  final String? pieces;
  final String temperatureTag;
  final double rating;
  final int reviewsCount;
  final String? badge;
  final String? badgeType; // e.g. "antibiotic", "bestseller", "cut-fresh"
  final bool inStock;
  final String description;

  ProductModel({
    required this.id,
    required this.name,
    required this.price,
    required this.originalPrice,
    required this.image,
    required this.netWeight,
    this.grossWeight,
    required this.category,
    required this.categoryLabel,
    this.subCategory,
    this.cutType,
    this.serves,
    this.pieces,
    this.temperatureTag = '100% Fresh Cut',
    this.rating = 4.8,
    this.reviewsCount = 120,
    this.badge,
    this.badgeType,
    this.inStock = true,
    this.description = '',
  });

  factory ProductModel.fromJson(Map<String, dynamic> json) {
    return ProductModel(
      id: json['id'] ?? json['_id'] ?? '',
      name: json['name'] ?? '',
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      originalPrice: (json['originalPrice'] as num?)?.toDouble() ?? (json['price'] as num?)?.toDouble() ?? 0.0,
      image: json['image'] ?? '',
      netWeight: json['netWeight'] ?? '500g',
      grossWeight: json['grossWeight'],
      category: json['category'] ?? 'chicken',
      categoryLabel: json['categoryLabel'] ?? (json['category'] != null ? '${json['category'][0].toUpperCase()}${json['category'].substring(1)}' : 'Chicken'),
      subCategory: json['subCategory'],
      cutType: json['cutType'],
      serves: json['serves'],
      pieces: json['pieces'],
      temperatureTag: json['temperatureTag'] ?? '100% Fresh Cut',
      rating: (json['rating'] as num?)?.toDouble() ?? 4.8,
      reviewsCount: (json['reviewsCount'] ?? json['ratingCount'] as num?)?.toInt() ?? 120,
      badge: json['badge'],
      badgeType: json['badgeType'],
      inStock: json['inStock'] ?? true,
      description: json['description'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'price': price,
      'originalPrice': originalPrice,
      'image': image,
      'netWeight': netWeight,
      'grossWeight': grossWeight,
      'category': category,
      'categoryLabel': categoryLabel,
      'subCategory': subCategory,
      'cutType': cutType,
      'serves': serves,
      'pieces': pieces,
      'temperatureTag': temperatureTag,
      'rating': rating,
      'reviewsCount': reviewsCount,
      'badge': badge,
      'badgeType': badgeType,
      'inStock': inStock,
      'description': description,
    };
  }
}
