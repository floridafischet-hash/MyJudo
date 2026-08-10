import 'package:flutter/material.dart';

import 'poll_models.dart';
import 'poll_repository.dart';

class PollPage extends StatefulWidget {
  const PollPage({
    super.key,
    required this.accessToken,
    required this.permissions,
    this.repository,
  });

  final String accessToken;
  final Set<String> permissions;
  final PollRepository? repository;

  @override
  State<PollPage> createState() => _PollPageState();
}

class _PollPageState extends State<PollPage> {
  late final PollRepository _repository =
      widget.repository ?? PollRepository(accessToken: widget.accessToken);
  List<PollSummary> _polls = const [];
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
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final polls = await _repository.list();
      if (mounted) setState(() => _polls = polls);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _vote(PollSummary poll, String optionId) async {
    try {
      final updated = await _repository.vote(poll.id, optionId);
      if (!mounted) return;
      setState(() {
        _polls = _polls
            .map((item) => item.id == updated.id ? updated : item)
            .toList();
      });
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.toString())));
      }
    }
  }

  Future<void> _create() async {
    final input = await showDialog<CreatePollInput>(
      context: context,
      builder: (context) => CreatePollDialog(permissions: widget.permissions),
    );
    if (input == null) return;
    try {
      final poll = await _repository.create(input);
      if (mounted) setState(() => _polls = [..._polls, poll]);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.toString())));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 12, 8),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  'Umfragen',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              if (widget.permissions.contains('polls.create'))
                FilledButton.icon(
                  onPressed: _create,
                  icon: const Icon(Icons.add_chart),
                  label: const Text('Neue Umfrage'),
                ),
              IconButton(
                onPressed: _load,
                tooltip: 'Aktualisieren',
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
        ),
        Expanded(child: _body()),
      ],
    );
  }

  Widget _body() {
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
    if (_polls.isEmpty) {
      return const Center(child: Text('Keine Umfragen vorhanden.'));
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _polls.length,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (context, index) =>
          _PollCard(poll: _polls[index], onVote: _vote),
    );
  }
}

class _PollCard extends StatelessWidget {
  const _PollCard({required this.poll, required this.onVote});
  final PollSummary poll;
  final Future<void> Function(PollSummary poll, String optionId) onVote;

  @override
  Widget build(BuildContext context) {
    final open = poll.state == 'open';
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    poll.title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                Chip(label: Text(_stateLabel(poll.state))),
              ],
            ),
            if (poll.description?.isNotEmpty ?? false) ...[
              const SizedBox(height: 6),
              Text(poll.description!),
            ],
            const SizedBox(height: 12),
            RadioGroup<String>(
              groupValue: poll.selectedOptionId,
              onChanged: (value) {
                if (open && value != null) onVote(poll, value);
              },
              child: Column(
                children: poll.options
                    .map(
                      (option) => RadioListTile<String>(
                        contentPadding: EdgeInsets.zero,
                        value: option.id,
                        enabled: open,
                        title: Text(option.label),
                        secondary: poll.canViewResults
                            ? Text('${option.voteCount ?? 0}')
                            : null,
                      ),
                    )
                    .toList(),
              ),
            ),
            if (poll.canViewResults)
              Text(
                '${poll.totalVotes ?? 0} abgegebene Stimmen',
                style: Theme.of(context).textTheme.bodySmall,
              ),
          ],
        ),
      ),
    );
  }
}

String _stateLabel(String state) => switch (state) {
  'scheduled' => 'Geplant',
  'closed' => 'Beendet',
  _ => 'Offen',
};

class CreatePollDialog extends StatefulWidget {
  const CreatePollDialog({super.key, required this.permissions});
  final Set<String> permissions;

  @override
  State<CreatePollDialog> createState() => _CreatePollDialogState();
}

class _CreatePollDialogState extends State<CreatePollDialog> {
  final _formKey = GlobalKey<FormState>();
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _options = TextEditingController();
  PollType _type = PollType.attendance;
  DateTime _startsAt = DateTime.now();
  DateTime _endsAt = DateTime.now().add(const Duration(days: 7));
  bool _showResults = false;
  String? _requiredPermission;

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _options.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final targetPermissions =
        widget.permissions
            .where(
              (permission) =>
                  permission.startsWith('chat.') &&
                  permission.endsWith('.access'),
            )
            .toList()
          ..sort();
    return AlertDialog(
      title: const Text('Neue Umfrage'),
      content: SizedBox(
        width: 520,
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<PollType>(
                  initialValue: _type,
                  decoration: const InputDecoration(labelText: 'Typ'),
                  items: PollType.values
                      .map(
                        (type) => DropdownMenuItem(
                          value: type,
                          child: Text(type.label),
                        ),
                      )
                      .toList(),
                  onChanged: (value) => setState(() => _type = value ?? _type),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _title,
                  decoration: const InputDecoration(labelText: 'Titel *'),
                  validator: (value) => value == null || value.trim().isEmpty
                      ? 'Pflichtfeld'
                      : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _description,
                  decoration: const InputDecoration(labelText: 'Beschreibung'),
                  maxLines: 3,
                ),
                if (_type == PollType.choice) ...[
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _options,
                    decoration: const InputDecoration(
                      labelText: 'Optionen (eine pro Zeile) *',
                    ),
                    minLines: 2,
                    maxLines: 6,
                    validator: (value) =>
                        (value ?? '')
                                .split('\n')
                                .where((line) => line.trim().isNotEmpty)
                                .length <
                            2
                        ? 'Mindestens zwei Optionen erforderlich'
                        : null,
                  ),
                ],
                const SizedBox(height: 12),
                _DateTimeField(
                  label: 'Beginn',
                  value: _startsAt,
                  onChanged: (value) => setState(() => _startsAt = value),
                ),
                const SizedBox(height: 8),
                _DateTimeField(
                  label: 'Ende',
                  value: _endsAt,
                  onChanged: (value) => setState(() => _endsAt = value),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String?>(
                  initialValue: _requiredPermission,
                  decoration: const InputDecoration(labelText: 'Zielgruppe'),
                  items: [
                    const DropdownMenuItem<String?>(
                      value: null,
                      child: Text('Alle Mitglieder'),
                    ),
                    ...targetPermissions.map(
                      (permission) => DropdownMenuItem<String?>(
                        value: permission,
                        child: Text(_permissionLabel(permission)),
                      ),
                    ),
                  ],
                  onChanged: (value) =>
                      setState(() => _requiredPermission = value),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Ergebnisse für Teilnehmende anzeigen'),
                  value: _showResults,
                  onChanged: (value) => setState(() => _showResults = value),
                ),
              ],
            ),
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Abbrechen'),
        ),
        FilledButton(onPressed: _submit, child: const Text('Erstellen')),
      ],
    );
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (!_endsAt.isAfter(_startsAt)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Das Ende muss nach dem Beginn liegen.')),
      );
      return;
    }
    Navigator.pop(
      context,
      CreatePollInput(
        type: _type,
        title: _title.text.trim(),
        description: _description.text.trim().isEmpty
            ? null
            : _description.text.trim(),
        startsAt: _startsAt,
        endsAt: _endsAt,
        resultsVisibleToParticipants: _showResults,
        requiredPermission: _requiredPermission,
        options: _type == PollType.choice
            ? _options.text
                  .split('\n')
                  .map((line) => line.trim())
                  .where((line) => line.isNotEmpty)
                  .toList()
            : null,
      ),
    );
  }
}

class _DateTimeField extends StatelessWidget {
  const _DateTimeField({
    required this.label,
    required this.value,
    required this.onChanged,
  });
  final String label;
  final DateTime value;
  final ValueChanged<DateTime> onChanged;

  @override
  Widget build(BuildContext context) {
    final localizations = MaterialLocalizations.of(context);
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(label),
      subtitle: Text(
        '${localizations.formatMediumDate(value)} · ${localizations.formatTimeOfDay(TimeOfDay.fromDateTime(value))}',
      ),
      trailing: const Icon(Icons.edit_calendar),
      onTap: () async {
        final date = await showDatePicker(
          context: context,
          initialDate: value,
          firstDate: DateTime.now().subtract(const Duration(days: 365)),
          lastDate: DateTime.now().add(const Duration(days: 3650)),
        );
        if (date == null || !context.mounted) return;
        final time = await showTimePicker(
          context: context,
          initialTime: TimeOfDay.fromDateTime(value),
        );
        if (time != null) {
          onChanged(
            DateTime(date.year, date.month, date.day, time.hour, time.minute),
          );
        }
      },
    );
  }
}

String _permissionLabel(String permission) => switch (permission) {
  'chat.board.access' => 'Vorstand',
  'chat.trainer.access' => 'Trainer',
  'chat.youth.access' => 'Jugendtrainer',
  'chat.clubwork.access' => 'Vereinsarbeit',
  'chat.psg.access' => 'PSG / Kinderschutz',
  _ => 'Allgemein',
};
