import 'package:flutter_test/flutter_test.dart';

import 'package:fitwise_mobile/main.dart';

void main() {
  testWidgets('shows setup instructions without Supabase configuration',
      (tester) async {
    await tester.pumpWidget(const FitWiseApp());

    expect(find.text('Connect FitWise'), findsOneWidget);
    expect(
      find.textContaining(
          'Configure SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY'),
      findsOneWidget,
    );
  });
}
