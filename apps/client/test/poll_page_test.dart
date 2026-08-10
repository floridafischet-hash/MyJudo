import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:myjudo_client/src/polls/poll_models.dart';
import 'package:myjudo_client/src/polls/poll_page.dart';
import 'package:myjudo_client/src/polls/poll_repository.dart';

void main() {
  testWidgets('changes a poll vote and refreshes live results', (tester) async {
    final repository = _FakePollRepository();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PollPage(
            accessToken: 'token',
            permissions: const {'polls.vote'},
            repository: repository,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Sommertraining'), findsOneWidget);
    expect(find.text('1 abgegebene Stimmen'), findsOneWidget);
    await tester.tap(find.text('Nein'));
    await tester.pumpAndSettle();

    expect(repository.votedOptionId, 'no');
    expect(find.text('2 abgegebene Stimmen'), findsOneWidget);
  });
}

class _FakePollRepository extends PollRepository {
  _FakePollRepository() : super(accessToken: 'token');

  String? votedOptionId;

  @override
  Future<List<PollSummary>> list() async => [
    _poll(selectedOptionId: 'yes', totalVotes: 1),
  ];

  @override
  Future<PollSummary> vote(String pollId, String optionId) async {
    votedOptionId = optionId;
    return _poll(selectedOptionId: optionId, totalVotes: 2);
  }

  @override
  void dispose() {}
}

PollSummary _poll({
  required String selectedOptionId,
  required int totalVotes,
}) => PollSummary(
  id: 'poll-1',
  type: PollType.attendance,
  title: 'Sommertraining',
  description: null,
  startsAt: DateTime.now().subtract(const Duration(minutes: 1)),
  endsAt: DateTime.now().add(const Duration(hours: 1)),
  state: 'open',
  canViewResults: true,
  totalVotes: totalVotes,
  selectedOptionId: selectedOptionId,
  options: [
    PollOption(id: 'yes', label: 'Ja', position: 0, voteCount: 1),
    PollOption(id: 'no', label: 'Nein', position: 1, voteCount: totalVotes - 1),
    const PollOption(
      id: 'maybe',
      label: 'Vielleicht',
      position: 2,
      voteCount: 0,
    ),
  ],
);
