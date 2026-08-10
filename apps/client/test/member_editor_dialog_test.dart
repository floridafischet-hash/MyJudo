import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:myjudo_client/src/members/member.dart';
import 'package:myjudo_client/src/members/member_editor_dialog.dart';
import 'package:myjudo_client/src/members/member_repository.dart';

void main() {
  testWidgets('creates a member with validated fields', (tester) async {
    final repository = _FakeMemberRepository();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MemberEditorDialog(
            repository: repository,
            canEdit: true,
            canChangeStatus: true,
          ),
        ),
      ),
    );

    await tester.tap(find.widgetWithText(FilledButton, 'Speichern'));
    await tester.pump();
    expect(find.text('Dieses Feld ist erforderlich.'), findsNWidgets(3));

    await tester.enterText(
      find.widgetWithText(TextFormField, 'Mitgliedsnummer *'),
      '  4711  ',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Vorname *'),
      '  Anna  ',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Nachname *'),
      '  Beispiel  ',
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Speichern'));
    await tester.pumpAndSettle();

    expect(repository.createdNumber, '4711');
    expect(repository.createdFirstName, 'Anna');
    expect(repository.createdLastName, 'Beispiel');
  });

  testWidgets('requires an exit date for a scheduled exit', (tester) async {
    final repository = _FakeMemberRepository();
    const member = Member(
      id: '00000000-0000-4000-8000-000000000001',
      memberNumber: '4711',
      firstName: 'Anna',
      lastName: 'Beispiel',
      status: MemberStatus.active,
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MemberEditorDialog(
            repository: repository,
            member: member,
            canEdit: false,
            canChangeStatus: true,
          ),
        ),
      ),
    );

    await tester.tap(find.text('Aktiv'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Austritt vorgemerkt').last);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Speichern'));
    await tester.pump();

    expect(
      find.text('Für den vorgemerkten Austritt ist ein Datum erforderlich.'),
      findsOneWidget,
    );
    expect(repository.statusUpdates, 0);
  });
}

class _FakeMemberRepository extends MemberRepository {
  _FakeMemberRepository() : super(accessToken: 'test-token');

  String? createdNumber;
  String? createdFirstName;
  String? createdLastName;
  int statusUpdates = 0;

  @override
  Future<Member> create({
    required String memberNumber,
    required String firstName,
    required String lastName,
    DateTime? birthDate,
  }) async {
    createdNumber = memberNumber.trim();
    createdFirstName = firstName.trim();
    createdLastName = lastName.trim();
    return Member(
      id: '00000000-0000-4000-8000-000000000002',
      memberNumber: createdNumber!,
      firstName: createdFirstName!,
      lastName: createdLastName!,
      status: MemberStatus.active,
      birthDate: birthDate,
    );
  }

  @override
  Future<Member> updateStatus(
    String id, {
    required MemberStatus status,
    DateTime? exitDate,
  }) async {
    statusUpdates += 1;
    return Member(
      id: id,
      memberNumber: '4711',
      firstName: 'Anna',
      lastName: 'Beispiel',
      status: status,
      exitDate: exitDate,
    );
  }
}
