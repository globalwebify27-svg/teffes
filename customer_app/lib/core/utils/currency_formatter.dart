import 'package:intl/intl.dart';

class CurrencyFormatter {
  CurrencyFormatter._();

  static final NumberFormat _inrFormat = NumberFormat.currency(
    locale: 'en_IN',
    symbol: '₹',
    decimalDigits: 0,
  );

  static String format(num? amount) {
    if (amount == null) return '₹0';
    return _inrFormat.format(amount);
  }

  static String formatDiscount(num originalPrice, num discountPrice) {
    if (originalPrice <= discountPrice || originalPrice <= 0) return '';
    final percent = (((originalPrice - discountPrice) / originalPrice) * 100).round();
    return '$percent% OFF';
  }
}
