import 'package:flutter_test/flutter_test.dart';
import 'package:customer_app/main.dart';

void main() {
  testWidgets('TeffesCustomerApp basic smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const TeffesCustomerApp(hasSeenOnboarding: true));
    expect(find.byType(TeffesCustomerApp), findsOneWidget);
  });
}
