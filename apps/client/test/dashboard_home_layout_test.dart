import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:myjudo_client/src/app.dart';
import 'package:myjudo_client/src/auth/auth_controller.dart';
import 'package:myjudo_client/src/auth/auth_session.dart';

void main() {
  testWidgets(
    'places calendar left at two thirds and overview right on wide screens',
    (tester) async {
      _setScreenSize(tester, const Size(1400, 900));
      await tester.pumpWidget(_signedInApp());
      await tester.pumpAndSettle();

      final calendarColumn = tester.getRect(
        find
            .ancestor(
              of: find.text('Kalender'),
              matching: find.byType(Expanded),
            )
            .first,
      );
      final upcomingColumn = tester.getRect(
        find
            .ancestor(
              of: find.text('Kommende Termine'),
              matching: find.byType(Expanded),
            )
            .first,
      );
      final projects = tester.getRect(find.text('Pinnwand'));
      final upcoming = tester.getRect(find.text('Kommende Termine'));

      expect(calendarColumn.top, upcomingColumn.top);
      expect(calendarColumn.left, lessThan(upcomingColumn.left));
      expect(calendarColumn.width / upcomingColumn.width, closeTo(2, 0.05));
      expect(upcoming.top, lessThan(projects.top));

      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'stacks calendar, upcoming events and projects on narrow screens',
    (tester) async {
      _setScreenSize(tester, const Size(390, 844));
      await tester.pumpWidget(_signedInApp());
      await tester.pumpAndSettle();

      final calendar = tester.getRect(find.text('Kalender'));
      final upcoming = tester.getRect(find.text('Kommende Termine'));
      final projects = tester.getRect(find.text('Pinnwand'));
      expect(calendar.top, lessThan(upcoming.top));
      expect(upcoming.top, lessThan(projects.top));

      expect(tester.takeException(), isNull);
    },
  );

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
