import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:myjudo_client/src/projects/projects_page.dart';

void main() {
  // ProjectsPage builds its own Dio client from the access token, so these
  // widget tests exercise the completed-projects view's navigation and
  // empty states (network calls resolve to Flutter's test-harness 400
  // response, which the page already treats as "no data yet"). Status
  // transitions and the completed-only filtering are covered end to end
  // against a real database in apps/api/test/projects.e2e.ts.
  testWidgets('offers a button to the completed-projects view and back again', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: ProjectsPage(accessToken: 'test-token', canCreate: false),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.text('Du bist aktuell keinem Projekt zugeordnet.'),
      findsOneWidget,
    );
    expect(find.text('Abgeschlossene Projekte'), findsOneWidget);

    await tester.tap(find.text('Abgeschlossene Projekte'));
    await tester.pumpAndSettle();

    expect(
      find.text('Es gibt noch keine abgeschlossenen Projekte.'),
      findsOneWidget,
    );
    expect(find.text('Aktive Projekte'), findsOneWidget);

    await tester.tap(find.text('Aktive Projekte'));
    await tester.pumpAndSettle();

    expect(
      find.text('Du bist aktuell keinem Projekt zugeordnet.'),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });
}
