class BannerModel {
  final String id;
  final String title;
  final String image;
  final String? link;
  final int order;
  final bool isActive;

  BannerModel({
    required this.id,
    required this.title,
    required this.image,
    this.link,
    this.order = 0,
    this.isActive = true,
  });

  factory BannerModel.fromJson(Map<String, dynamic> json) {
    return BannerModel(
      id: (json['_id'] ?? json['id'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      image: (json['image'] ?? '').toString(),
      link: json['link']?.toString(),
      order: json['order'] is int
          ? json['order'] as int
          : int.tryParse(json['order']?.toString() ?? '0') ?? 0,
      isActive: json['isActive'] == null ? true : (json['isActive'] as bool),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'title': title,
      'image': image,
      'link': link,
      'order': order,
      'isActive': isActive,
    };
  }
}
