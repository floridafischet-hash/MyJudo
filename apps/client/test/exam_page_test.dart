import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:myjudo_client/src/exams/exam_models.dart';
import 'package:myjudo_client/src/exams/exam_page.dart';
import 'package:myjudo_client/src/exams/exam_repository.dart';
import 'package:myjudo_client/src/members/member.dart';
import 'package:myjudo_client/src/members/member_repository.dart';

void main() {
  testWidgets('shows exam participants and persists a changed status', (
    tester,
  ) async {
    final repository = _FakeExamRepository();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ExamPage(
            accessToken: 'token',
            permissions: const {'exams.view', 'exams.create', 'exams.edit'},
            repository: repository,
            memberRepository: _FakeMemberRepository(),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Sommerprüfung'), findsOneWidget);
    expect(find.text('Erika Prüfling'), findsOneWidget);
    expect(find.text('EX-1 · 5. Kyu'), findsOneWidget);
    await tester.tap(find.text('Vorgemerkt'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Bestanden').last);
    await tester.pumpAndSettle();

    expect(repository.updatedStatus, 'passed');
  });
}

class _FakeExamRepository extends ExamRepository {
  _FakeExamRepository() : super(accessToken: 'token');
  String? updatedStatus;

  @override
  Future<List<BeltExam>> list() async => [
    BeltExam(
      id: 'exam-1',
      title: 'Sommerprüfung',
      examDate: DateTime(2026, 8, 22),
      location: 'Dojo',
      participants: const [
        ExamParticipant(
          id: 'participant-1',
          memberId: 'member-1',
          memberName: 'Erika Prüfling',
          memberNumber: 'EX-1',
          gradeType: 'kyu',
          grade: 5,
          belt: '5. Kyu',
          status: 'planned',
        ),
      ],
    ),
  ];

  @override
  Future<void> updateStatus(String participantId, String status) async {
    updatedStatus = status;
  }
}

class _FakeMemberRepository extends MemberRepository {
  _FakeMemberRepository() : super(accessToken: 'token');

  @override
  Future<MemberPageResult> list({
    required int page,
    required int pageSize,
    String? search,
    MemberStatus? status,
  }) async =>
      const MemberPageResult(items: [], page: 1, pageSize: 100, total: 0);
}
