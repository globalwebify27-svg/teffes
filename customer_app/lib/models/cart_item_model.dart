import 'product_model.dart';

class CartItemModel {
  final ProductModel product;
  int quantity;
  String selectedWeight;

  CartItemModel({
    required this.product,
    this.quantity = 1,
    required this.selectedWeight,
  });

  double get totalPrice => product.price * quantity;

  factory CartItemModel.fromJson(Map<String, dynamic> json) {
    Map<String, dynamic> prodMap = {};
    if (json['product'] is Map) {
      prodMap = Map<String, dynamic>.from(json['product'] as Map);
    } else {
      prodMap = {
        'id': json['productId'] ?? json['id'] ?? '',
        'name': json['name'] ?? '',
        'price': json['price'] ?? 0.0,
        'image': json['image'] ?? '',
        'netWeight': json['netWeight'] ?? json['selectedWeight'] ?? '500g',
      };
    }
    return CartItemModel(
      product: ProductModel.fromJson(prodMap),
      quantity: (json['quantity'] as num?)?.toInt() ?? 1,
      selectedWeight: (json['selectedWeight'] ?? json['netWeight'] ?? '500g').toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'product': product.toJson(),
      'quantity': quantity,
      'selectedWeight': selectedWeight,
    };
  }
}
