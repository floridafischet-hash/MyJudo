import 'package:flutter/material.dart';

import '../members/member.dart';

class ExamDraft {
  const ExamDraft({
    required this.title,
    required this.date,
    required this.location,
  });
  final String title;
  final DateTime date;
  final String location;
}

class ParticipantDraft {
  const ParticipantDraft({
    required this.memberId,
    required this.gradeType,
    required this.grade,
  });
  final String memberId;
  final String gradeType;
  final int grade;
}

class CreateExamDialog extends StatefulWidget {
  const CreateExamDialog({super.key});
  @override
  State<CreateExamDialog> createState() => _CreateExamDialogState();
}

class _CreateExamDialogState extends State<CreateExamDialog> {
  final _form = GlobalKey<FormState>();
  final _title = TextEditingController();
  final _location = TextEditingController();
  DateTime _date = DateTime.now();

  @override
  void dispose() {
    _title.dispose();
    _location.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Prüfung anlegen'),
    content: Form(
      key: _form,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextFormField(
            controller: _title,
            decoration: const InputDecoration(labelText: 'Bezeichnung *'),
            validator: (value) =>
                value == null || value.trim().isEmpty ? 'Bitte angeben.' : null,
          ),
          TextFormField(
            controller: _location,
            decoration: const InputDecoration(labelText: 'Ort'),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: Text('Datum: ${_formatDate(_date)}')),
              TextButton(
                onPressed: () async {
                  final date = await showDatePicker(
                    context: context,
                    initialDate: _date,
                    firstDate: DateTime(2020),
                    lastDate: DateTime(2100),
                  );
                  if (date != null) setState(() => _date = date);
                },
                child: const Text('Ändern'),
              ),
            ],
          ),
        ],
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Abbrechen'),
      ),
      FilledButton(
        onPressed: () {
          if (!_form.currentState!.validate()) return;
          Navigator.pop(
            context,
            ExamDraft(
              title: _title.text.trim(),
              date: _date,
              location: _location.text.trim(),
            ),
          );
        },
        child: const Text('Speichern'),
      ),
    ],
  );
}

class AddParticipantDialog extends StatefulWidget {
  const AddParticipantDialog({super.key, required this.members});
  final List<Member> members;
  @override
  State<AddParticipantDialog> createState() => _AddParticipantDialogState();
}

class _AddParticipantDialogState extends State<AddParticipantDialog> {
  String? _memberId;
  String _gradeType = 'kyu';
  int _grade = 8;

  @override
  Widget build(BuildContext context) {
    final maximum = _gradeType == 'kyu' ? 8 : 10;
    if (_grade > maximum) _grade = maximum;
    return AlertDialog(
      title: const Text('Teilnehmer hinzufügen'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          DropdownButtonFormField<String>(
            initialValue: _memberId,
            decoration: const InputDecoration(labelText: 'Mitglied'),
            items: widget.members
                .map(
                  (member) => DropdownMenuItem(
                    value: member.id,
                    child: Text(member.displayName),
                  ),
                )
                .toList(),
            onChanged: (value) => setState(() => _memberId = value),
          ),
          DropdownButtonFormField<String>(
            initialValue: _gradeType,
            decoration: const InputDecoration(labelText: 'Graduierung'),
            items: const [
              DropdownMenuItem(value: 'kyu', child: Text('Kyu')),
              DropdownMenuItem(value: 'dan', child: Text('Dan')),
            ],
            onChanged: (value) => setState(() => _gradeType = value ?? 'kyu'),
          ),
          DropdownButtonFormField<int>(
            key: ValueKey('$_gradeType-$_grade'),
            initialValue: _grade,
            decoration: const InputDecoration(labelText: 'Grad'),
            items: List.generate(maximum, (index) => index + 1)
                .map(
                  (grade) =>
                      DropdownMenuItem(value: grade, child: Text('$grade.')),
                )
                .toList(),
            onChanged: (value) => setState(() => _grade = value ?? 1),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Abbrechen'),
        ),
        FilledButton(
          onPressed: _memberId == null
              ? null
              : () => Navigator.pop(
                  context,
                  ParticipantDraft(
                    memberId: _memberId!,
                    gradeType: _gradeType,
                    grade: _grade,
                  ),
                ),
          child: const Text('Hinzufügen'),
        ),
      ],
    );
  }
}

String _formatDate(DateTime value) =>
    '${value.day.toString().padLeft(2, '0')}.${value.month.toString().padLeft(2, '0')}.${value.year}';
