import 'package:flutter_test/flutter_test.dart';
import 'package:rider_app/main.dart';

void main() {
  testWidgets('Rider App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const TeffesRiderApp(hasSeenOnboarding: false));
    expect(find.byType(TeffesRiderApp), findsOneWidget);
  });
}
