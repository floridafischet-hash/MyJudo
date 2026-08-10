import 'package:flutter/material.dart';

import 'calendar_models.dart';
import 'calendar_repository.dart';

class CalendarPage extends StatefulWidget {
  const CalendarPage({
    super.key,
    required this.accessToken,
    required this.permissions,
    this.repository,
  });
  final String accessToken;
  final Set<String> permissions;
  final CalendarRepository? repository;

  @override
  State<CalendarPage> createState() => _CalendarPageState();
}

class _CalendarPageState extends State<CalendarPage> {
  late final CalendarRepository _repository =
      widget.repository ?? CalendarRepository(accessToken: widget.accessToken);
  List<ClubCalendar> _calendars = const [];
  List<CalendarEvent> _events = const [];
  List<TrainingSession> _trainings = const [];
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
      final now = DateTime.now();
      final results = await Future.wait([
        _repository.listCalendars(),
        _repository.listEvents(
          now.subtract(const Duration(days: 30)),
          now.add(const Duration(days: 365)),
        ),
        _repository.listTrainings(),
      ]);
      if (!mounted) return;
      setState(() {
        _calendars = results[0] as List<ClubCalendar>;
        _events = results[1] as List<CalendarEvent>;
        _trainings = results[2] as List<TrainingSession>;
      });
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
    return DefaultTabController(
      length: 2,
      child: Column(
        children: [
          Row(
            children: [
              const Expanded(
                child: TabBar(
                  tabs: [
                    Tab(icon: Icon(Icons.event_outlined), text: 'Termine'),
                    Tab(
                      icon: Icon(Icons.sports_martial_arts_outlined),
                      text: 'Trainingszeiten',
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: _load,
                tooltip: 'Aktualisieren',
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
          Expanded(
            child: TabBarView(
              children: [
                _EventList(
                  events: _events,
                  calendars: _calendars,
                  canCreate: widget.permissions.contains('calendar.create'),
                  repository: _repository,
                  onCreated: _load,
                ),
                _TrainingList(
                  trainings: _trainings,
                  canCreate: widget.permissions.contains('calendar.create'),
                  repository: _repository,
                  onCreated: _load,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _EventList extends StatelessWidget {
  const _EventList({
    required this.events,
    required this.calendars,
    required this.canCreate,
    required this.repository,
    required this.onCreated,
  });
  final List<CalendarEvent> events;
  final List<ClubCalendar> calendars;
  final bool canCreate;
  final CalendarRepository repository;
  final Future<void> Function() onCreated;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      if (canCreate)
        Align(
          alignment: Alignment.centerRight,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: FilledButton.icon(
              onPressed: () async {
                final input = await showDialog<_EventInput>(
                  context: context,
                  builder: (_) => _EventDialog(
                    calendars: calendars
                        .where((item) => item.editable)
                        .toList(),
                  ),
                );
                if (input == null) return;
                try {
                  await repository.createEvent(
                    calendarId: input.calendarId,
                    title: input.title,
                    startsAt: input.startsAt,
                    endsAt: input.endsAt,
                    location: input.location,
                  );
                  await onCreated();
                } catch (error) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(
                      context,
                    ).showSnackBar(SnackBar(content: Text(error.toString())));
                  }
                }
              },
              icon: const Icon(Icons.add),
              label: const Text('Termin'),
            ),
          ),
        ),
      Expanded(
        child: events.isEmpty
            ? const Center(child: Text('Keine Termine im gewählten Zeitraum.'))
            : ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: events.length,
                separatorBuilder: (_, _) => const Divider(),
                itemBuilder: (context, index) {
                  final event = events[index];
                  final calendar = calendars
                      .where((item) => item.id == event.calendarId)
                      .firstOrNull;
                  return ListTile(
                    leading: Icon(
                      event.source == 'njv' ? Icons.public : Icons.event,
                    ),
                    title: Text(
                      event.title,
                      style: TextStyle(
                        decoration: event.status == 'cancelled'
                            ? TextDecoration.lineThrough
                            : null,
                      ),
                    ),
                    subtitle: Text(
                      '${_dateTime(context, event.startsAt)}${event.location == null ? '' : ' · ${event.location}'}',
                    ),
                    trailing: calendar == null
                        ? null
                        : Chip(label: Text(calendar.name)),
                  );
                },
              ),
      ),
    ],
  );
}

class _TrainingList extends StatelessWidget {
  const _TrainingList({
    required this.trainings,
    required this.canCreate,
    required this.repository,
    required this.onCreated,
  });
  final List<TrainingSession> trainings;
  final bool canCreate;
  final CalendarRepository repository;
  final Future<void> Function() onCreated;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      if (canCreate)
        Align(
          alignment: Alignment.centerRight,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: FilledButton.icon(
              onPressed: () async {
                final input = await showDialog<Map<String, dynamic>>(
                  context: context,
                  builder: (_) => const _TrainingDialog(),
                );
                if (input == null) return;
                try {
                  await repository.createTraining(input);
                  await onCreated();
                } catch (error) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(
                      context,
                    ).showSnackBar(SnackBar(content: Text(error.toString())));
                  }
                }
              },
              icon: const Icon(Icons.add),
              label: const Text('Trainingszeit'),
            ),
          ),
        ),
      Expanded(
        child: trainings.isEmpty
            ? const Center(child: Text('Keine Trainingszeiten vorhanden.'))
            : ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: trainings.length,
                itemBuilder: (context, index) {
                  final item = trainings[index];
                  return Card(
                    child: ListTile(
                      leading: const Icon(Icons.sports_martial_arts),
                      title: Text(item.name),
                      subtitle: Text(
                        '${_weekdayLabel(item.weekday)}, ${item.startsAt}–${item.endsAt}\n${item.hall}, ${item.location}${item.ageGroup == null ? '' : ' · ${item.ageGroup}'}',
                      ),
                      isThreeLine: true,
                    ),
                  );
                },
              ),
      ),
    ],
  );
}

class _EventDialog extends StatefulWidget {
  const _EventDialog({required this.calendars});
  final List<ClubCalendar> calendars;
  @override
  State<_EventDialog> createState() => _EventDialogState();
}

class _EventDialogState extends State<_EventDialog> {
  final _title = TextEditingController();
  final _location = TextEditingController();
  late String? _calendarId = widget.calendars.firstOrNull?.id;
  DateTime _startsAt = DateTime.now().add(const Duration(hours: 1));
  DateTime _endsAt = DateTime.now().add(const Duration(hours: 2));
  @override
  void dispose() {
    _title.dispose();
    _location.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Termin erstellen'),
    content: SizedBox(
      width: 460,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          DropdownButtonFormField<String>(
            initialValue: _calendarId,
            decoration: const InputDecoration(labelText: 'Kalender'),
            items: widget.calendars
                .map(
                  (item) =>
                      DropdownMenuItem(value: item.id, child: Text(item.name)),
                )
                .toList(),
            onChanged: (value) => setState(() => _calendarId = value),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _title,
            decoration: const InputDecoration(labelText: 'Titel *'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _location,
            decoration: const InputDecoration(labelText: 'Ort'),
          ),
          ListTile(
            title: const Text('Beginn'),
            subtitle: Text(_dateTime(context, _startsAt)),
            onTap: () async {
              final value = await _pickDateTime(context, _startsAt);
              if (value != null) setState(() => _startsAt = value);
            },
          ),
          ListTile(
            title: const Text('Ende'),
            subtitle: Text(_dateTime(context, _endsAt)),
            onTap: () async {
              final value = await _pickDateTime(context, _endsAt);
              if (value != null) setState(() => _endsAt = value);
            },
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
        onPressed: _calendarId == null
            ? null
            : () {
                if (_title.text.trim().isEmpty || !_endsAt.isAfter(_startsAt)) {
                  return;
                }
                Navigator.pop(
                  context,
                  _EventInput(
                    calendarId: _calendarId!,
                    title: _title.text.trim(),
                    location: _location.text.trim().isEmpty
                        ? null
                        : _location.text.trim(),
                    startsAt: _startsAt,
                    endsAt: _endsAt,
                  ),
                );
              },
        child: const Text('Erstellen'),
      ),
    ],
  );
}

class _EventInput {
  const _EventInput({
    required this.calendarId,
    required this.title,
    required this.location,
    required this.startsAt,
    required this.endsAt,
  });
  final String calendarId;
  final String title;
  final String? location;
  final DateTime startsAt;
  final DateTime endsAt;
}

class _TrainingDialog extends StatefulWidget {
  const _TrainingDialog();
  @override
  State<_TrainingDialog> createState() => _TrainingDialogState();
}

class _TrainingDialogState extends State<_TrainingDialog> {
  final _name = TextEditingController();
  final _hall = TextEditingController();
  final _location = TextEditingController();
  int _weekday = 1;
  TimeOfDay _start = const TimeOfDay(hour: 17, minute: 30);
  TimeOfDay _end = const TimeOfDay(hour: 19, minute: 0);
  @override
  void dispose() {
    _name.dispose();
    _hall.dispose();
    _location.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Trainingszeit'),
    content: SizedBox(
      width: 440,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _name,
            decoration: const InputDecoration(labelText: 'Bezeichnung *'),
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<int>(
            initialValue: _weekday,
            decoration: const InputDecoration(labelText: 'Wochentag'),
            items: List.generate(
              7,
              (index) => DropdownMenuItem(
                value: index + 1,
                child: Text(_weekdayLabel(index + 1)),
              ),
            ),
            onChanged: (value) => setState(() => _weekday = value ?? 1),
          ),
          Row(
            children: [
              Expanded(
                child: ListTile(
                  title: const Text('Beginn'),
                  subtitle: Text(_start.format(context)),
                  onTap: () async {
                    final value = await showTimePicker(
                      context: context,
                      initialTime: _start,
                    );
                    if (value != null) setState(() => _start = value);
                  },
                ),
              ),
              Expanded(
                child: ListTile(
                  title: const Text('Ende'),
                  subtitle: Text(_end.format(context)),
                  onTap: () async {
                    final value = await showTimePicker(
                      context: context,
                      initialTime: _end,
                    );
                    if (value != null) setState(() => _end = value);
                  },
                ),
              ),
            ],
          ),
          TextField(
            controller: _hall,
            decoration: const InputDecoration(labelText: 'Halle *'),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _location,
            decoration: const InputDecoration(labelText: 'Ort *'),
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
          if (_name.text.trim().isEmpty ||
              _hall.text.trim().isEmpty ||
              _location.text.trim().isEmpty) {
            return;
          }
          Navigator.pop(context, {
            'name': _name.text.trim(),
            'weekday': _weekday,
            'startsAt': _time(_start),
            'endsAt': _time(_end),
            'hall': _hall.text.trim(),
            'location': _location.text.trim(),
          });
        },
        child: const Text('Erstellen'),
      ),
    ],
  );
}

String _weekdayLabel(int day) => const [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
][day - 1];
String _time(TimeOfDay value) =>
    '${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';
String _dateTime(BuildContext context, DateTime value) {
  final local = MaterialLocalizations.of(context);
  return '${local.formatMediumDate(value)} · ${local.formatTimeOfDay(TimeOfDay.fromDateTime(value))}';
}

Future<DateTime?> _pickDateTime(BuildContext context, DateTime initial) async {
  final date = await showDatePicker(
    context: context,
    initialDate: initial,
    firstDate: DateTime.now().subtract(const Duration(days: 365)),
    lastDate: DateTime.now().add(const Duration(days: 3650)),
  );
  if (date == null || !context.mounted) return null;
  final time = await showTimePicker(
    context: context,
    initialTime: TimeOfDay.fromDateTime(initial),
  );
  return time == null
      ? null
      : DateTime(date.year, date.month, date.day, time.hour, time.minute);
}
