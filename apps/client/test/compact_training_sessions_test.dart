import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:myjudo_client/src/training/training_models.dart';
import 'package:myjudo_client/src/training/training_page.dart';

TrainingSession session(String id, int hour, String group) => TrainingSession(
  id: id,
  scheduleId: 'schedule-$id',
  name: 'Training $id',
  startsAt: DateTime(2026, 8, 14, hour),
  endsAt: DateTime(2026, 8, 14, hour + 1),
  groups: [TrainingGroup(id: group, name: group)],
  locked: false,
  cancelled: false,
);

void main() {
  test('groups one, two and three sessions into one day', () {
    for (final count in [1, 2, 3]) {
      final result = groupTrainingSessionsByDay(
        List.generate(count, (i) => session('$i', 16 + i, 'Gruppe $i')),
      );
      expect(result, hasLength(1));
      expect(result.single.sessions, hasLength(count));
    }
  });

  testWidgets('keeps votes independent and fits a phone width', (tester) async {
    final votes = <String, String>{};
    final day = TrainingDay(DateTime(2026, 8, 14), [
      session('one', 16, 'Pandas'),
      session('two', 17, 'Silberrücken'),
    ]);
    await tester.binding.setSurfaceSize(const Size(390, 844));
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: TrainingDayPanel(
              day: day,
              onVote: (value, status) async => votes[value.id] = status,
            ),
          ),
        ),
      ),
    );
    await tester.tap(
      find.descendant(
        of: find.byKey(const Key('training-session-one')),
        matching: find.text('Teilnehmen'),
      ),
    );
    await tester.tap(
      find.descendant(
        of: find.byKey(const Key('training-session-two')),
        matching: find.text('Absagen'),
      ),
    );
    expect(votes, {'one': 'yes', 'two': 'no'});
    expect(tester.takeException(), isNull);
    await tester.binding.setSurfaceSize(null);
  });

  testWidgets('uses desktop width for two compact sessions', (tester) async {
    await tester.binding.setSurfaceSize(const Size(1200, 800));
    final day = TrainingDay(DateTime(2026, 8, 14), [
      session('one', 16, 'Pandas'),
      session('two', 17, 'Silberrücken'),
    ]);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: TrainingDayPanel(day: day, onVote: (_, _) async {}),
        ),
      ),
    );
    final first = tester.getRect(find.byKey(const Key('training-session-one')));
    final second = tester.getRect(
      find.byKey(const Key('training-session-two')),
    );
    expect(first.top, second.top);
    expect(tester.takeException(), isNull);
    await tester.binding.setSurfaceSize(null);
  });
}
