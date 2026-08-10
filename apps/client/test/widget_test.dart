import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:myjudo_client/src/app.dart';
import 'package:myjudo_client/src/auth/auth_controller.dart';
import 'package:myjudo_client/src/auth/auth_session.dart';

void main() {
  testWidgets('shows the Keycloak login when no session exists', (
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
    expect(find.textContaining('Keycloak'), findsOneWidget);
    expect(find.text('Benutzername'), findsNothing);
    expect(find.widgetWithText(FilledButton, 'Anmelden'), findsOneWidget);
  });

  for (final testCase in [
    (firstName: 'Florian', displayName: 'Florian Fischer', username: 'florian', expected: 'Hallo Florian'),
    (firstName: null, displayName: 'Stefan Beispiel', username: 'stefan', expected: 'Hallo Stefan Beispiel'),
    (firstName: null, displayName: null, username: 'ffischer', expected: 'Hallo ffischer'),
  ]) {
    testWidgets('greets the authenticated user with ${testCase.expected}', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authControllerProvider.overrideWith(
              () => _SignedInController(
                AuthSession(
                  accessToken: 'test-token',
                  refreshToken: 'test-refresh',
                  expiresIn: 300,
                  permissions: const {},
                  username: testCase.username,
                  firstName: testCase.firstName,
                  displayName: testCase.displayName,
                ),
              ),
            ),
          ],
          child: const MyJudoApp(),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text(testCase.expected), findsOneWidget);
    });
  }
}

class _SignedOutController extends AuthController {
  @override
  Future<Never?> build() async => null;
}

class _SignedInController extends AuthController {
  _SignedInController(this.session);
  final AuthSession session;

  @override
  Future<AuthSession?> build() async => session;
}
