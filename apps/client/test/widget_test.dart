import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:myjudo_client/src/app.dart';
import 'package:myjudo_client/src/auth/auth_controller.dart';

void main() {
  testWidgets('shows the real login form when no session exists', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(() => _SignedOutController()),
        ],
        child: const MyJudoApp(),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('MyJudo'), findsOneWidget);
    expect(find.text('Vereinskennung'), findsOneWidget);
    expect(find.text('E-Mail-Adresse'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Anmelden'), findsOneWidget);
  });
}

class _SignedOutController extends AuthController {
  @override
  Future<Never?> build() async => null;
}
