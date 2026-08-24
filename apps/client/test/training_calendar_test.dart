import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:myjudo_client/src/training/training_calendar.dart';
import 'package:myjudo_client/src/training/training_models.dart';

void main() {
  final trainingDay = DateTime(2026, 8, 18, 18, 30);
  final session = TrainingSession(
    id: 'session-silberruecken',
    scheduleId: 'schedule-1',
    name: 'Judo Silberrücken',
    startsAt: trainingDay,
    endsAt: trainingDay.add(const Duration(hours: 2)),
    groups: const [TrainingGroup(id: 'silberruecken', name: 'Silberrücken')],
    locked: false,
    cancelled: false,
  );

  testWidgets('markiert einen berechtigten Termin und öffnet seine Details', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: TrainingCalendar(
            sessions: [session],
            initialMonth: trainingDay,
            onVote: (_, _) async {},
          ),
        ),
      ),
    );
    expect(
      tester.getSize(find.byKey(const Key('training-calendar'))).width,
      moreOrLessEquals(800),
    );
    await tester.tap(find.byKey(const Key('calendar-day-2026-08-18')));
    await tester.pumpAndSettle();
    final selected = tester.widget<DecoratedBox>(
      find
          .descendant(
            of: find.byKey(const Key('calendar-day-2026-08-18')),
            matching: find.byType(DecoratedBox),
          )
          .first,
    );
    expect(
      (selected.decoration as BoxDecoration).color,
      const Color(0xFF082D4B),
    );
    expect(find.text('Judo Silberrücken'), findsOneWidget);
    expect(find.text('Gruppe: Silberrücken'), findsOneWidget);
    expect(find.text('Status: Noch keine Antwort'), findsOneWidget);
  });

  testWidgets('nutzt auf Desktop die doppelte Kalenderbreite', (tester) async {
    await tester.binding.setSurfaceSize(const Size(1400, 1000));
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: TrainingCalendar(
            sessions: [session],
            initialMonth: trainingDay,
            onVote: (_, _) async {},
          ),
        ),
      ),
    );
    expect(
      tester.getSize(find.byKey(const Key('training-calendar'))).width,
      moreOrLessEquals(1120),
    );
    expect(tester.takeException(), isNull);
    await tester.binding.setSurfaceSize(null);
  });

  testWidgets('verwendet für Teilnehmen die bestehende Abstimmungsaktion', (
    tester,
  ) async {
    TrainingSession? votedSession;
    String? votedStatus;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: TrainingCalendar(
            sessions: [session],
            initialMonth: trainingDay,
            onVote: (value, status) async {
              votedSession = value;
              votedStatus = status;
            },
          ),
        ),
      ),
    );
    await tester.tap(find.byKey(const Key('calendar-day-2026-08-18')));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Teilnehmen'));
    await tester.pumpAndSettle();
    expect(votedSession?.id, session.id);
    expect(votedStatus, 'yes');
  });

  testWidgets('navigiert zum vorherigen und nächsten Monat', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: TrainingCalendar(
            sessions: const [],
            initialMonth: trainingDay,
            onVote: (_, _) async {},
          ),
        ),
      ),
    );
    expect(find.text('August 2026'), findsOneWidget);
    await tester.tap(find.byKey(const Key('calendar-next-month')));
    await tester.pump();
    expect(find.text('September 2026'), findsOneWidget);
    await tester.tap(find.byKey(const Key('calendar-previous-month')));
    await tester.pump();
    expect(find.text('August 2026'), findsOneWidget);
  });

  testWidgets(
    'zeigt nach einem Gruppenwechsel nur die neu gelieferten Termine',
    (tester) async {
      final pandas = TrainingSession(
        id: 'session-pandas',
        scheduleId: 'schedule-2',
        name: 'Judo Pandas',
        startsAt: trainingDay.add(const Duration(days: 1)),
        endsAt: trainingDay.add(const Duration(days: 1, hours: 1)),
        groups: const [TrainingGroup(id: 'pandas', name: 'Pandas')],
        locked: false,
        cancelled: false,
      );
      Widget calendar(List<TrainingSession> sessions) => MaterialApp(
        home: Scaffold(
          body: TrainingCalendar(
            sessions: sessions,
            initialMonth: trainingDay,
            onVote: (_, _) async {},
          ),
        ),
      );
      await tester.pumpWidget(calendar([session]));
      await tester.pumpWidget(calendar([pandas]));
      await tester.tap(find.byKey(const Key('calendar-day-2026-08-19')));
      await tester.pumpAndSettle();
      expect(find.text('Judo Pandas'), findsOneWidget);
      expect(find.text('Judo Silberrücken'), findsNothing);
    },
  );
}
