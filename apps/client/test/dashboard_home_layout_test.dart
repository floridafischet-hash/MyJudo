import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:myjudo_client/src/app.dart';
import 'package:myjudo_client/src/auth/auth_controller.dart';
import 'package:myjudo_client/src/auth/auth_session.dart';

void main() {
  testWidgets('shows only the project board on the home page', (tester) async {
    _setScreenSize(tester, const Size(1400, 900));
    await tester.pumpWidget(_signedInApp());
    await tester.pumpAndSettle();

    expect(find.text('Pinnwand'), findsOneWidget);
    expect(find.text('Kalender'), findsNothing);
    expect(find.text('Kommende Termine'), findsNothing);
    expect(find.text('Meine Termine'), findsNothing);
    expect(find.text('Trainingszeiten'), findsNothing);
    expect(find.text('Termine verwalten'), findsNothing);
    expect(find.text('Gruppen'), findsNothing);
    expect(find.text('Benutzer'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  for (final size in [
    const Size(375, 812), // narrow phone
    const Size(390, 844), // common phone
    const Size(768, 1024), // tablet portrait
    const Size(900, 900), // desktop-rail breakpoint
    const Size(999, 900), // just below the projects/upcoming split
    const Size(1000, 900), // just at the projects/upcoming split
    const Size(1200, 900), // extended-rail breakpoint
    const Size(1440, 900), // wide desktop
  ]) {
    testWidgets('renders the home tab without overflow at $size', (
      tester,
    ) async {
      _setScreenSize(tester, size);
      await tester.pumpWidget(_signedInApp());
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  }
}

void _setScreenSize(WidgetTester tester, Size size) {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

Widget _signedInApp() => ProviderScope(
  overrides: [
    authControllerProvider.overrideWith(
      () => _SignedInController(
        const AuthSession(
          userId: '00000000-0000-4000-8000-000000000001',
          accessToken: 'test-token',
          refreshToken: 'test-refresh',
          expiresIn: 300,
          permissions: {},
          username: 'florian',
          firstName: 'Florian',
          displayName: 'Florian Fischer',
        ),
      ),
    ),
  ],
  child: const MyJudoApp(),
);

class _SignedInController extends AuthController {
  _SignedInController(this.session);
  final AuthSession session;

  @override
  Future<AuthSession?> build() async => session;
}
