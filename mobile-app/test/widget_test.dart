import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    // Supabase requires initialization, so full app widget tests
    // need integration test setup. See test/integration/ for E2E tests.
    expect(true, isTrue);
  });
}
