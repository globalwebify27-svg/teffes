class ProductModel {
  final String id;
  final String name;
  final double price;
  final double originalPrice;
  final String image;
  final List<String> images;
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
  final List<String> videoURLs;

  ProductModel({
    required this.id,
    required this.name,
    required this.price,
    required this.originalPrice,
    required this.image,
    this.images = const [],
    this.videoURLs = const [],
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

  // Strictly return real database images only: no artificial fallback stock images
  List<String> get allImages {
    if (images.isNotEmpty) {
      final validImages = images.where((e) => e.trim().isNotEmpty).toList();
      if (validImages.isNotEmpty) return validImages;
    }
    if (image.trim().isNotEmpty) return [image.trim()];
    return [];
  }

  factory ProductModel.fromJson(Map<String, dynamic> json) {
    final rawImages = json['images'];
    List<String> parsedImages = [];
    if (rawImages is List) {
      parsedImages = rawImages
          .where((e) => e != null && e.toString().trim().isNotEmpty)
          .map((e) => e.toString().trim())
          .toList();
    }
    if (parsedImages.isEmpty && json['image'] != null && json['image'].toString().trim().isNotEmpty) {
      parsedImages = [json['image'].toString().trim()];
    }

    final rawVideos = json['videoURLs'] ?? json['videos'];
    List<String> parsedVideos = [];
    if (rawVideos is List) {
      parsedVideos = rawVideos
          .where((e) => e != null && e.toString().trim().isNotEmpty)
          .map((e) => e.toString().trim())
          .toList();
    }

    return ProductModel(
      id: json['id'] ?? json['_id'] ?? '',
      name: json['name'] ?? '',
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      originalPrice: (json['originalPrice'] as num?)?.toDouble() ?? (json['price'] as num?)?.toDouble() ?? 0.0,
      image: json['image'] ?? (parsedImages.isNotEmpty ? parsedImages.first : ''),
      images: parsedImages,
      videoURLs: parsedVideos,
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
      'images': images,
      'videoURLs': videoURLs,
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
