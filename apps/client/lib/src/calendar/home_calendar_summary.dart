import 'package:flutter/material.dart';
import 'calendar_repository.dart';
import '../training/training_models.dart';
import '../training/training_repository.dart';

class HomeCalendarSummary extends StatefulWidget {
  const HomeCalendarSummary({
    super.key,
    required this.token,
    this.showActivity = true,
    this.showUpcoming = true,
    this.maxUpcoming = 5,
  });
  final String token;
  final bool showActivity;
  final bool showUpcoming;
  final int maxUpcoming;
  @override
  State<HomeCalendarSummary> createState() => _HomeCalendarSummaryState();
}

class _HomeCalendarSummaryState extends State<HomeCalendarSummary> {
  late final CalendarRepository repo = CalendarRepository(token: widget.token);
  late final TrainingRepository trainingRepo = TrainingRepository(
    accessToken: widget.token,
  );
  List<CalendarEventModel> events = [];
  List<TrainingSession> trainings = [];
  List<Map<String, dynamic>> activity = [];
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final now = DateTime.now();
      final values = await Future.wait([
        repo.list(now, now.add(const Duration(days: 3650))),
        repo.activity(),
        trainingRepo.sessions(),
      ]);
      if (mounted) {
        setState(() {
          events = (values[0] as List<CalendarEventModel>).take(5).toList();
          activity = values[1] as List<Map<String, dynamic>>;
          trainings = (values[2] as List<TrainingSession>)
              .where(
                (session) =>
                    session.startsAt.isAfter(now) && !session.cancelled,
              )
              .toList();
        });
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      if (widget.showActivity)
        _box(
          context,
          'Was wurde zuletzt verändert?',
          activity.isEmpty
              ? [const Text('Noch keine relevanten Änderungen.')]
              : activity
                    .take(8)
                    .map(
                      (a) => ListTile(
                        contentPadding: const EdgeInsets.symmetric(vertical: 5),
                        leading: const Icon(
                          Icons.history,
                          color: Color(0xFF0B4F8A),
                          size: 27,
                        ),
                        title: Text(
                          _label(a),
                          style: const TextStyle(
                            fontSize: 16,
                            height: 1.35,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        subtitle: Text(
                          _date(
                            DateTime.parse(a['createdAt'].toString()).toLocal(),
                          ),
                          style: const TextStyle(fontSize: 14, height: 1.4),
                        ),
                      ),
                    )
                    .toList(),
        ),
      if (widget.showActivity && widget.showUpcoming)
        const SizedBox(height: 18),
      if (widget.showUpcoming)
        _box(
          context,
          'Kommende Termine',
          _upcoming().isEmpty
              ? [const Text('Keine kommenden Termine.')]
              : _upcoming()
                    .map(
                      (entry) => ListTile(
                        contentPadding: const EdgeInsets.symmetric(vertical: 5),
                        leading: Icon(
                          entry.training
                              ? Icons.sports_martial_arts_outlined
                              : Icons.event_outlined,
                          color: Color(0xFF0B4F8A),
                          size: 27,
                        ),
                        title: Text(
                          entry.title,
                          style: const TextStyle(
                            fontSize: 16,
                            height: 1.35,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        subtitle: Text(
                          '${_date(entry.startsAt)} · ${_time(entry.startsAt)}',
                          style: const TextStyle(fontSize: 14, height: 1.4),
                        ),
                      ),
                    )
                    .toList(),
        ),
    ],
  );
  Widget _box(BuildContext c, String title, List<Widget> children) {
    final dark = Theme.of(c).brightness == Brightness.dark;
    return Card(
      elevation: 2,
      color: dark ? const Color(0xFF151C22) : Colors.white,
      surfaceTintColor: const Color(0xFFE8F4FC),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(
          color: dark ? const Color(0xFF24445C) : const Color(0xFFD5E8F5),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: Theme.of(c).textTheme.titleLarge?.copyWith(
                fontSize: 24,
                fontWeight: FontWeight.w800,
                color: dark ? const Color(0xFF70C7F4) : const Color(0xFF082D4B),
              ),
            ),
            const SizedBox(height: 14),
            ...children,
          ],
        ),
      ),
    );
  }

  List<_UpcomingEntry> _upcoming() {
    final all = <_UpcomingEntry>[
      ...events.map(
        (event) => _UpcomingEntry(event.title, event.startsAt, false),
      ),
      ...trainings.map(
        (training) => _UpcomingEntry(
          training.name.isEmpty ? 'Training' : training.name,
          training.startsAt,
          true,
        ),
      ),
    ]..sort((a, b) => a.startsAt.compareTo(b.startsAt));
    return all.take(widget.maxUpcoming).toList();
  }

  String _label(Map<String, dynamic> a) {
    final who = a['actorName'] ?? 'System',
        meta = a['metadata'] is Map
            ? Map<String, dynamic>.from(a['metadata'] as Map)
            : <String, dynamic>{},
        name = meta['title'] ?? meta['name'] ?? a['entityType'];
    final action = a['action'].toString();
    if (action.contains('deleted')) return '$who hat „$name“ gelöscht.';
    if (action.contains('created')) return '$who hat „$name“ erstellt.';
    if (action.contains('updated')) return '$who hat „$name“ geändert.';
    return '$who: ${action.replaceAll('.', ' ')}';
  }
}

String _date(DateTime d) =>
    '${d.day.toString().padLeft(2, '0')}.${d.month.toString().padLeft(2, '0')}.${d.year}';
String _time(DateTime d) =>
    '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';

class _UpcomingEntry {
  const _UpcomingEntry(this.title, this.startsAt, this.training);
  final String title;
  final DateTime startsAt;
  final bool training;
}
