import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:myjudo_client/src/calendar/calendar_models.dart';
import 'package:myjudo_client/src/calendar/calendar_page.dart';
import 'package:myjudo_client/src/calendar/calendar_repository.dart';

void main() {
  testWidgets('shows permitted events and recurring training times', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: CalendarPage(
            accessToken: 'token',
            permissions: const {'calendar.view'},
            repository: _FakeCalendarRepository(),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Vereinsfest'), findsOneWidget);
    expect(find.text('Verein'), findsOneWidget);
    await tester.tap(find.text('Trainingszeiten'));
    await tester.pumpAndSettle();
    expect(find.text('Kindertraining'), findsOneWidget);
    expect(find.textContaining('Dienstag, 17:30–19:00'), findsOneWidget);
  });
}

class _FakeCalendarRepository extends CalendarRepository {
  _FakeCalendarRepository() : super(accessToken: 'token');

  @override
  Future<List<ClubCalendar>> listCalendars() async => const [
    ClubCalendar(id: 'club', name: 'Verein', type: 'club', editable: false),
  ];

  @override
  Future<List<CalendarEvent>> listEvents(DateTime from, DateTime to) async => [
    CalendarEvent(
      id: 'event',
      calendarId: 'club',
      title: 'Vereinsfest',
      startsAt: DateTime.now().add(const Duration(days: 1)),
      endsAt: DateTime.now().add(const Duration(days: 1, hours: 2)),
      allDay: false,
      location: 'Dojo',
      status: 'scheduled',
      source: 'club',
    ),
  ];

  @override
  Future<List<TrainingSession>> listTrainings() async => const [
    TrainingSession(
      id: 'training',
      name: 'Kindertraining',
      weekday: 2,
      startsAt: '17:30',
      endsAt: '19:00',
      hall: 'Halle 1',
      location: 'Musterstraße 1',
      ageGroup: 'U13',
      trainingGroup: 'Kinder',
    ),
  ];

  @override
  void dispose() {}
}
