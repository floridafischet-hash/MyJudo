import 'package:flutter/material.dart';

import 'training_models.dart';

class TrainingCalendar extends StatefulWidget {
  const TrainingCalendar({
    required this.sessions,
    required this.onVote,
    this.initialMonth,
    super.key,
  });

  final List<TrainingSession> sessions;
  final Future<void> Function(TrainingSession session, String status) onVote;
  final DateTime? initialMonth;

  @override
  State<TrainingCalendar> createState() => _TrainingCalendarState();
}

class _TrainingCalendarState extends State<TrainingCalendar> {
  late DateTime _month = _monthOnly(widget.initialMonth ?? DateTime.now());
  DateTime? _selectedDay;

  void _changeMonth(int offset) {
    setState(() => _month = DateTime(_month.year, _month.month + offset));
  }

  List<TrainingSession> _sessionsOn(DateTime day) =>
      widget.sessions
          .where((session) => _sameDay(session.startsAt, day))
          .toList()
        ..sort((a, b) => a.startsAt.compareTo(b.startsAt));

  Future<void> _openDay(DateTime day) async {
    final sessions = _sessionsOn(day);
    if (sessions.isEmpty) return;
    setState(() => _selectedDay = day);
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(_fullDate(day)),
        content: SizedBox(
          width: 520,
          child: ListView.separated(
            shrinkWrap: true,
            itemCount: sessions.length,
            separatorBuilder: (_, _) => const Divider(height: 28),
            itemBuilder: (context, index) {
              final session = sessions[index];
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    session.name,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${_time(session.startsAt)} – ${_time(session.endsAt)} Uhr',
                  ),
                  Text(
                    'Gruppe: ${session.groups.map((group) => group.name).join(' / ')}',
                  ),
                  Text('Status: ${_status(session)}'),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 10,
                    runSpacing: 8,
                    children: [
                      FilledButton.icon(
                        onPressed: session.locked || session.cancelled
                            ? null
                            : () => _vote(context, session, 'yes'),
                        icon: const Icon(Icons.check),
                        label: const Text('Teilnehmen'),
                      ),
                      OutlinedButton.icon(
                        onPressed: session.locked || session.cancelled
                            ? null
                            : () => _vote(context, session, 'no'),
                        icon: const Icon(Icons.close),
                        label: const Text('Absagen'),
                      ),
                    ],
                  ),
                ],
              );
            },
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Schließen'),
          ),
        ],
      ),
    );
  }

  Future<void> _vote(
    BuildContext dialogContext,
    TrainingSession session,
    String status,
  ) async {
    Navigator.pop(dialogContext);
    await widget.onVote(session, status);
  }

  @override
  Widget build(BuildContext context) {
    final firstWeekday = DateTime(_month.year, _month.month).weekday;
    final days = DateTime(_month.year, _month.month + 1, 0).day;
    final cellCount = ((firstWeekday - 1 + days + 6) ~/ 7) * 7;
    final today = DateTime.now();
    return LayoutBuilder(
      builder: (context, outer) {
        // Give the calendar the available desktop space again. It previously
        // topped out at 560 px, which made it look lost on wide screens.
        final calendarWidth = outer.maxWidth >= 1200 ? 1120.0 : outer.maxWidth;
        return Align(
          alignment: Alignment.centerLeft,
          child: SizedBox(
            width: calendarWidth,
            child: Card(
              key: const Key('training-calendar'),
              color: const Color(0xFFFFFFFF),
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  children: [
                    Row(
                      children: [
                        IconButton(
                          key: const Key('calendar-previous-month'),
                          tooltip: 'Vorheriger Monat',
                          onPressed: () => _changeMonth(-1),
                          icon: const Icon(Icons.chevron_left),
                        ),
                        Expanded(
                          child: Text(
                            _monthTitle(_month),
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.titleLarge
                                ?.copyWith(
                                  fontWeight: FontWeight.w900,
                                  color: const Color(0xFF082D4B),
                                  fontSize: 26,
                                ),
                          ),
                        ),
                        IconButton(
                          key: const Key('calendar-next-month'),
                          tooltip: 'Nächster Monat',
                          onPressed: () => _changeMonth(1),
                          icon: const Icon(Icons.chevron_right),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    const Row(
                      children: [
                        _Weekday('Mo'),
                        _Weekday('Di'),
                        _Weekday('Mi'),
                        _Weekday('Do'),
                        _Weekday('Fr'),
                        _Weekday('Sa'),
                        _Weekday('So'),
                      ],
                    ),
                    const SizedBox(height: 8),
                    GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 7,
                            childAspectRatio: 1.55,
                          ),
                      itemCount: cellCount,
                      itemBuilder: (context, index) {
                        final number = index - firstWeekday + 2;
                        if (number < 1 || number > days) {
                          return const SizedBox.shrink();
                        }
                        final day = DateTime(_month.year, _month.month, number);
                        final sessions = _sessionsOn(day);
                        final hasTraining = sessions.isNotEmpty;
                        final isToday = _sameDay(day, today);
                        final isSelected =
                            _selectedDay != null &&
                            _sameDay(day, _selectedDay!);
                        return Padding(
                          padding: const EdgeInsets.all(3),
                          child: InkWell(
                            key: Key(
                              'calendar-day-${day.toIso8601String().substring(0, 10)}',
                            ),
                            borderRadius: BorderRadius.circular(10),
                            onTap: hasTraining ? () => _openDay(day) : null,
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                color: isSelected
                                    ? const Color(0xFF082D4B)
                                    : hasTraining
                                    ? const Color(0xFFDCEFFA)
                                    : null,
                                borderRadius: BorderRadius.circular(8),
                                border: isToday
                                    ? Border.all(
                                        color: const Color(0xFF0B4F8A),
                                        width: 2,
                                      )
                                    : null,
                              ),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(
                                    '$number',
                                    style: TextStyle(
                                      fontWeight: hasTraining || isToday
                                          ? FontWeight.w800
                                          : null,
                                      fontSize: 20,
                                      color: isSelected
                                          ? Colors.white
                                          : const Color(0xFF071F33),
                                    ),
                                  ),
                                  if (hasTraining)
                                    Icon(
                                      Icons.circle,
                                      size: 8,
                                      color: isSelected
                                          ? Colors.white
                                          : Color(0xFF0B4F8A),
                                    ),
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _Weekday extends StatelessWidget {
  const _Weekday(this.label);
  final String label;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Text(
      label,
      textAlign: TextAlign.center,
      style: const TextStyle(
        fontWeight: FontWeight.w900,
        fontSize: 18,
        color: Color(0xFF0B4F8A),
      ),
    ),
  );
}

DateTime _monthOnly(DateTime value) => DateTime(value.year, value.month);
bool _sameDay(DateTime a, DateTime b) =>
    a.year == b.year && a.month == b.month && a.day == b.day;
String _time(DateTime value) =>
    '${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';
String _status(TrainingSession session) {
  if (session.cancelled) return 'Training abgesagt';
  return switch (session.attendance?.status) {
    'yes' => 'Teilnahme zugesagt',
    'no' => 'Abgesagt',
    _ => session.locked ? 'Abstimmung geschlossen' : 'Noch keine Antwort',
  };
}

const _months = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];
const _weekdays = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
];
String _monthTitle(DateTime value) =>
    '${_months[value.month - 1]} ${value.year}';
String _fullDate(DateTime value) =>
    '${_weekdays[value.weekday - 1]}, ${value.day}. ${_months[value.month - 1]} ${value.year}';

bool sameDay(DateTime a, DateTime b) => _sameDay(a, b);
String monthTitle(DateTime value) => _monthTitle(value);
String fullDate(DateTime value) => _fullDate(value);
