class CategoryModel {
  final String key;
  final String label;
  final String image;
  final String? subtitle;
  final int itemCount;
  final List<String> subcategories;

  CategoryModel({
    required this.key,
    required this.label,
    required this.image,
    this.subtitle,
    this.itemCount = 0,
    this.subcategories = const [],
  });

  factory CategoryModel.fromJson(Map<String, dynamic> json) {
    return CategoryModel(
      key: json['slug'] ?? json['key'] ?? json['id'] ?? '',
      label: json['name'] ?? json['label'] ?? '',
      image: json['image'] ?? '',
      subtitle: json['tagline'] ?? json['subtitle'],
      itemCount: json['itemCount'] ?? 0,
      subcategories: (json['subcategories'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? ['All'],
    );
  }
}
