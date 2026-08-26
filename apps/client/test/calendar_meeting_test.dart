import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:myjudo_client/src/calendar/calendar_panel.dart';

Future<void> _openDialog(WidgetTester tester) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: Builder(
          builder: (context) => FilledButton(
            onPressed: () => showDialog<Map<String, dynamic>>(
              context: context,
              builder: (_) => const EventDialog(),
            ),
            child: const Text('open'),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('keeps entered values and dialog open when saving fails', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => FilledButton(
              onPressed: () => showDialog<bool>(
                context: context,
                builder: (_) =>
                    EventDialog(onSave: (_) async => throw Exception('Fehler')),
              ),
              child: const Text('open'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, 'Mein Termin');
    await tester.pump();
    final save = find.widgetWithText(FilledButton, 'Speichern');
    expect(tester.widget<FilledButton>(save).onPressed, isNotNull);
    tester.widget<FilledButton>(save).onPressed!();
    await tester.pumpAndSettle();
    expect(find.text('Mein Termin'), findsOneWidget);
    expect(find.byKey(const Key('event-form-error')), findsOneWidget);
    expect(
      find.text('Termin konnte nicht gespeichert werden.'),
      findsOneWidget,
    );
  });

  testWidgets('hides the meeting link field until a provider is chosen', (
    tester,
  ) async {
    await _openDialog(tester);
    expect(find.text('Meeting-Link (https://…)'), findsNothing);

    await tester.tap(find.text('Online-Meeting'), warnIfMissed: false);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Google Meet').last);
    await tester.pumpAndSettle();
    expect(find.text('Meeting-Link (https://…)'), findsOneWidget);
  });

  testWidgets('disables saving until the meeting link is a valid https URL', (
    tester,
  ) async {
    await _openDialog(tester);
    await tester.enterText(find.byType(TextField).first, 'Vorstandssitzung');
    await tester.tap(find.text('Online-Meeting'), warnIfMissed: false);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Google Meet').last);
    await tester.pumpAndSettle();

    expect(
      tester
          .widget<FilledButton>(find.widgetWithText(FilledButton, 'Speichern'))
          .onPressed,
      isNull,
    );

    await tester.enterText(
      find.widgetWithText(TextField, 'Meeting-Link (https://…)'),
      'http://meet.google.com/abc-defg-hij',
    );
    await tester.pump();
    expect(find.text('Nur https-Links sind erlaubt.'), findsOneWidget);
    expect(
      tester
          .widget<FilledButton>(find.widgetWithText(FilledButton, 'Speichern'))
          .onPressed,
      isNull,
    );

    await tester.enterText(
      find.widgetWithText(TextField, 'Meeting-Link (https://…)'),
      'https://meet.google.com/abc-defg-hij',
    );
    await tester.pump();
    expect(find.text('Nur https-Links sind erlaubt.'), findsNothing);
    expect(
      tester
          .widget<FilledButton>(find.widgetWithText(FilledButton, 'Speichern'))
          .onPressed,
      isNotNull,
    );
  });

  testWidgets('returns the meeting fields together when saved', (tester) async {
    late Future<Map<String, dynamic>?> pending;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => FilledButton(
              onPressed: () {
                pending = showDialog<Map<String, dynamic>>(
                  context: context,
                  builder: (_) => const EventDialog(),
                );
              },
              child: const Text('open'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField).first, 'Vorstandssitzung');
    await tester.tap(find.text('Online-Meeting'), warnIfMissed: false);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Microsoft Teams').last);
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextField, 'Meeting-Link (https://…)'),
      'https://teams.microsoft.com/l/meetup-join/xyz',
    );
    await tester.enterText(
      find.widgetWithText(TextField, 'Hinweise zum Meeting (optional)'),
      'Bitte pünktlich sein.',
    );
    await tester.pump();
    await tester.tap(find.widgetWithText(FilledButton, 'Speichern'));
    await tester.pumpAndSettle();

    final result = await pending;
    expect(result, isNotNull);
    expect(result!['meetingProvider'], 'microsoft_teams');
    expect(
      result['meetingUrl'],
      'https://teams.microsoft.com/l/meetup-join/xyz',
    );
    expect(result['meetingNotes'], 'Bitte pünktlich sein.');
  });
}
