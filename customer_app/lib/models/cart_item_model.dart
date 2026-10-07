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
    return CartItemModel(
      product: ProductModel.fromJson(json['product'] as Map<String, dynamic>),
      quantity: (json['quantity'] as num?)?.toInt() ?? 1,
      selectedWeight: json['selectedWeight'] ?? '500g',
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
