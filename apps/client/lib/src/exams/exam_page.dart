import 'package:flutter/material.dart';

import '../members/member_repository.dart';
import 'exam_dialogs.dart';
import 'exam_models.dart';
import 'exam_repository.dart';

class ExamPage extends StatefulWidget {
  const ExamPage({
    super.key,
    required this.accessToken,
    required this.permissions,
    this.repository,
    this.memberRepository,
  });

  final String accessToken;
  final Set<String> permissions;
  final ExamRepository? repository;
  final MemberRepository? memberRepository;

  @override
  State<ExamPage> createState() => _ExamPageState();
}

class _ExamPageState extends State<ExamPage> {
  late final ExamRepository _repository =
      widget.repository ?? ExamRepository(accessToken: widget.accessToken);
  late final MemberRepository _members =
      widget.memberRepository ??
      MemberRepository(accessToken: widget.accessToken);
  List<BeltExam> _exams = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    if (widget.repository == null) _repository.dispose();
    if (widget.memberRepository == null) _members.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final exams = await _repository.list();
      if (mounted) setState(() => _exams = exams);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_error!, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: _load,
              child: const Text('Erneut versuchen'),
            ),
          ],
        ),
      );
    }
    final canCreate = widget.permissions.contains('exams.create');
    final canEdit = widget.permissions.contains('exams.edit');
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
          child: Row(
            children: [
              const Expanded(
                child: Text(
                  'Gürtelprüfungen',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                ),
              ),
              if (canCreate)
                FilledButton.icon(
                  onPressed: _createExam,
                  icon: const Icon(Icons.add),
                  label: const Text('Prüfung'),
                ),
              IconButton(
                onPressed: _load,
                tooltip: 'Aktualisieren',
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
        ),
        Expanded(
          child: _exams.isEmpty
              ? const Center(child: Text('Noch keine Prüfungen vorhanden.'))
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(12, 4, 12, 16),
                  itemCount: _exams.length,
                  itemBuilder: (context, index) => _ExamCard(
                    exam: _exams[index],
                    canEdit: canEdit,
                    onAdd: () => _addParticipant(_exams[index]),
                    onStatus: (participant, status) =>
                        _updateStatus(participant, status),
                  ),
                ),
        ),
      ],
    );
  }

  Future<void> _createExam() async {
    final result = await showDialog<ExamDraft>(
      context: context,
      builder: (_) => const CreateExamDialog(),
    );
    if (result == null) return;
    try {
      await _repository.createExam(
        title: result.title,
        examDate: result.date,
        location: result.location,
      );
      await _load();
    } catch (error) {
      _showError(error);
    }
  }

  Future<void> _addParticipant(BeltExam exam) async {
    try {
      final page = await _members.list(page: 1, pageSize: 100);
      if (!mounted) return;
      final result = await showDialog<ParticipantDraft>(
        context: context,
        builder: (_) => AddParticipantDialog(members: page.items),
      );
      if (result == null) return;
      await _repository.addParticipant(
        examId: exam.id,
        memberId: result.memberId,
        gradeType: result.gradeType,
        grade: result.grade,
      );
      await _load();
    } catch (error) {
      _showError(error);
    }
  }

  Future<void> _updateStatus(ExamParticipant participant, String status) async {
    try {
      await _repository.updateStatus(participant.id, status);
      await _load();
    } catch (error) {
      _showError(error);
    }
  }

  void _showError(Object error) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(error.toString())));
  }
}

class _ExamCard extends StatelessWidget {
  const _ExamCard({
    required this.exam,
    required this.canEdit,
    required this.onAdd,
    required this.onStatus,
  });
  final BeltExam exam;
  final bool canEdit;
  final VoidCallback onAdd;
  final void Function(ExamParticipant participant, String status) onStatus;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ExpansionTile(
        initiallyExpanded: true,
        title: Text(
          exam.title,
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        subtitle: Text(
          '${_formatDate(exam.examDate)}${exam.location == null ? '' : ' · ${exam.location}'}',
        ),
        trailing: canEdit
            ? IconButton(
                tooltip: 'Teilnehmer hinzufügen',
                onPressed: onAdd,
                icon: const Icon(Icons.person_add_alt_1_outlined),
              )
            : null,
        children: [
          if (exam.participants.isEmpty)
            const Padding(
              padding: EdgeInsets.all(16),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text('Keine Teilnehmenden.'),
              ),
            )
          else
            ...exam.participants.map(
              (participant) => ListTile(
                title: Text(participant.memberName),
                subtitle: Text(
                  '${participant.memberNumber} · ${participant.belt}',
                ),
                trailing: canEdit
                    ? DropdownButton<String>(
                        value: participant.status,
                        onChanged: (value) {
                          if (value != null) onStatus(participant, value);
                        },
                        items: statusLabels.entries
                            .map(
                              (entry) => DropdownMenuItem(
                                value: entry.key,
                                child: Text(entry.value),
                              ),
                            )
                            .toList(),
                      )
                    : Text(
                        statusLabels[participant.status] ?? participant.status,
                      ),
              ),
            ),
        ],
      ),
    );
  }
}

const statusLabels = {
  'planned': 'Vorgemerkt',
  'registered': 'Angemeldet',
  'passed': 'Bestanden',
  'failed': 'Nicht bestanden',
  'withdrawn': 'Abgemeldet',
};

String _formatDate(DateTime value) =>
    '${value.day.toString().padLeft(2, '0')}.${value.month.toString().padLeft(2, '0')}.${value.year}';
