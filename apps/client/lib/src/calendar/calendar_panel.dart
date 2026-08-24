import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../common/color_palette.dart';
import '../training/training_models.dart';
import '../training/training_calendar.dart' show fullDate, monthTitle, sameDay;
import 'calendar_repository.dart';
import '../downloads/download_file.dart';

const _meetingProviders = {
  'google_meet': 'Google Meet',
  'microsoft_teams': 'Microsoft Teams',
  'other': 'Anderer Anbieter',
};

String _meetingProviderLabel(String? provider) =>
    _meetingProviders[provider] ?? 'Online-Meeting';

// Opens the stored link in an external browser/app (never embedded), and
// refuses anything that isn't a well-formed https URL - defense in depth on
// top of the server-side check, in case a stale/tampered value ever reaches
// the client.
Future<void> _launchMeeting(BuildContext context, String url) async {
  final uri = Uri.tryParse(url);
  if (uri == null || uri.scheme != 'https') {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Ungültiger Meeting-Link.')));
    return;
  }
  final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
  if (!opened && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Meeting-Link konnte nicht geöffnet werden.'),
      ),
    );
  }
}

const _defaultEventColor = Color(0xFF0B4F8A);
const _defaultTrainingColor = Color(0xFF176FA5);

Color _trainingColor(TrainingSession s) =>
    s.groups.isNotEmpty && s.groups.first.color != null
    ? parseHexColor(s.groups.first.color, fallback: _defaultTrainingColor)
    : _defaultTrainingColor;
Color _eventColor(CalendarEventModel e) =>
    parseHexColor(e.color, fallback: _defaultEventColor);

class CalendarPanel extends StatefulWidget {
  const CalendarPanel({
    super.key,
    required this.token,
    required this.sessions,
    required this.canManage,
    required this.onVote,
    this.groups = const [],
    this.users = const [],
    this.calendarOnly = false,
  });
  final String token;
  final List<TrainingSession> sessions;
  final bool canManage, calendarOnly;
  final Future<void> Function(TrainingSession, String) onVote;
  final List<TrainingGroup> groups;
  final List<TrainingUser> users;
  @override
  State<CalendarPanel> createState() => _CalendarPanelState();
}

class _CalendarPanelState extends State<CalendarPanel> {
  late final CalendarRepository repo = CalendarRepository(token: widget.token);
  DateTime month = DateTime(DateTime.now().year, DateTime.now().month);
  List<CalendarEventModel> events = [];
  bool loading = false;
  String? error;
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final e = await repo.list(
        DateTime(month.year, month.month),
        DateTime(month.year, month.month + 1),
      );
      if (mounted) {
        setState(() {
          events = e;
          error = null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => error = 'Kalendertermine konnten nicht geladen werden.');
      }
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  void _move(int n) {
    setState(() => month = DateTime(month.year, month.month + n));
    _load();
  }

  Future<void> _jump() async {
    final d = await showDatePicker(
      context: context,
      initialDate: month,
      firstDate: DateTime(2000),
      lastDate: DateTime(2200),
    );
    if (d != null) {
      setState(() => month = DateTime(d.year, d.month));
      await _load();
    }
  }

  List<TrainingSession> _training(DateTime d) =>
      widget.sessions.where((s) => sameDay(s.startsAt, d)).toList();
  List<CalendarEventModel> _events(DateTime d) =>
      events.where((e) => sameDay(e.startsAt, d)).toList();
  Future<void> _day(DateTime d) async {
    final ts = _training(d), es = _events(d);
    if (ts.isEmpty && es.isEmpty && widget.canManage) {
      await _edit(null, date: d);
      return;
    }
    await showDialog(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(fullDate(d)),
        content: SizedBox(
          width: 600,
          child: ListView(
            shrinkWrap: true,
            children: [
              ...es.map(
                (e) => ListTile(
                  leading: CircleAvatar(
                    backgroundColor: _eventColor(e),
                    child: const Icon(
                      Icons.event,
                      color: Colors.white,
                      size: 18,
                    ),
                  ),
                  title: Text(e.title),
                  subtitle: Text(
                    '${_time(e.startsAt)}–${_time(e.endsAt)}${e.location == null ? '' : ' · ${e.location}'}',
                  ),
                  onTap: () => Navigator.pop(c, e),
                ),
              ),
              ...ts.map(
                (t) => ListTile(
                  leading: CircleAvatar(
                    backgroundColor: _trainingColor(t),
                    child: const Icon(
                      Icons.sports_martial_arts,
                      color: Colors.white,
                      size: 18,
                    ),
                  ),
                  title: Text(t.name),
                  subtitle: Text(
                    '${_time(t.startsAt)}–${_time(t.endsAt)} · ${t.groups.map((g) => g.name).join(' / ')}',
                  ),
                  onTap: () => Navigator.pop(c, t),
                ),
              ),
            ],
          ),
        ),
        actions: [
          if (widget.canManage)
            TextButton.icon(
              onPressed: () {
                Navigator.pop(c);
                _edit(null, date: d);
              },
              icon: const Icon(Icons.add),
              label: const Text('Termin erstellen'),
            ),
          TextButton(
            onPressed: () => Navigator.pop(c),
            child: const Text('Schließen'),
          ),
        ],
      ),
    ).then((value) {
      if (value is CalendarEventModel) _detail(value);
      if (value is TrainingSession) _trainingDetail(value);
    });
  }

  Future<void> _trainingDetail(TrainingSession session) async {
    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        final status = session.attendance?.status;
        return AlertDialog(
          title: Text(session.name),
          content: SizedBox(
            width: 520,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(fullDate(session.startsAt)),
                Text('${_time(session.startsAt)}–${_time(session.endsAt)} Uhr'),
                Text(
                  'Gruppe: ${session.groups.map((g) => g.name).join(' / ')}',
                ),
                const SizedBox(height: 20),
                Text(
                  'Dein Status',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 6),
                Text(
                  status == 'yes'
                      ? 'Aktueller Status: Teilnehmen'
                      : status == 'no'
                      ? 'Aktueller Status: Abgesagt'
                      : 'Aktueller Status: Noch keine Antwort',
                  key: const Key('calendar-training-status'),
                ),
                if (session.cancelled || session.locked) ...[
                  const SizedBox(height: 8),
                  Text(
                    session.cancelled
                        ? 'Dieser Termin wurde abgesagt.'
                        : 'Die Abstimmung ist seit Trainingsbeginn geschlossen.',
                  ),
                ],
              ],
            ),
          ),
          actions: [
            if (!session.cancelled && !session.locked)
              OutlinedButton.icon(
                key: const Key('calendar-training-no'),
                onPressed: () async {
                  Navigator.pop(dialogContext);
                  await widget.onVote(session, 'no');
                },
                icon: Icon(
                  status == 'no' ? Icons.check_circle : Icons.cancel_outlined,
                ),
                label: const Text('Absagen'),
              ),
            if (!session.cancelled && !session.locked)
              FilledButton.icon(
                key: const Key('calendar-training-yes'),
                onPressed: () async {
                  Navigator.pop(dialogContext);
                  await widget.onVote(session, 'yes');
                },
                icon: Icon(
                  status == 'yes' ? Icons.check_circle : Icons.how_to_reg,
                ),
                label: const Text('Teilnehmen'),
              ),
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Schließen'),
            ),
          ],
        );
      },
    );
  }

  Future<void> _detail(CalendarEventModel e) async {
    await showDialog(
      context: context,
      builder: (c) => AlertDialog(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            ColorDot(color: _eventColor(e), size: 14),
            const SizedBox(width: 10),
            Expanded(child: Text(e.title)),
          ],
        ),
        content: SizedBox(
          width: 520,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(fullDate(e.startsAt)),
              Text('${_time(e.startsAt)}–${_time(e.endsAt)} Uhr'),
              if (e.location != null) Text('Ort: ${e.location}'),
              if (e.meetingUrl != null) ...[
                const SizedBox(height: 14),
                Align(
                  alignment: Alignment.centerLeft,
                  child: FilledButton.icon(
                    onPressed: () => _launchMeeting(c, e.meetingUrl!),
                    icon: const Icon(Icons.videocam_outlined),
                    label: const Text('Am Online-Meeting teilnehmen'),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  _meetingProviderLabel(e.meetingProvider),
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                if (e.meetingNotes != null && e.meetingNotes!.isNotEmpty)
                  Text(e.meetingNotes!),
              ],
              if (e.description != null) ...[
                const SizedBox(height: 10),
                Text(e.description!),
              ],
              if (e.reminderMinutes != null)
                Text('Erinnerung: ${e.reminderMinutes} Minuten vorher'),
              if (e.seriesId != null) Text('Serientermin: ${e.recurrence}'),
            ],
          ),
        ),
        actions: [
          TextButton.icon(
            onPressed: () async {
              final bytes = await repo.ics(e.id);
              final safeName = e.title.replaceAll(
                RegExp(r'[^A-Za-z0-9_-]'),
                '_',
              );
              saveDownload(bytes, '$safeName.ics', 'text/calendar');
            },
            icon: const Icon(Icons.download),
            label: const Text('ICS'),
          ),
          if (widget.canManage)
            TextButton(
              onPressed: () {
                Navigator.pop(c);
                _edit(e, copy: true);
              },
              child: const Text('Kopieren'),
            ),
          if (widget.canManage)
            TextButton(
              onPressed: () {
                Navigator.pop(c);
                _edit(e);
              },
              child: const Text('Bearbeiten'),
            ),
          if (widget.canManage)
            TextButton(
              onPressed: () {
                Navigator.pop(c);
                _remove(e);
              },
              child: const Text('Löschen'),
            ),
          TextButton(
            onPressed: () => Navigator.pop(c),
            child: const Text('Schließen'),
          ),
        ],
      ),
    );
  }

  Future<String?> _scope(CalendarEventModel e, String verb) async =>
      e.seriesId == null
      ? 'single'
      : showDialog<String>(
          context: context,
          builder: (c) => SimpleDialog(
            title: Text('Was möchtest du $verb?'),
            children: [
              SimpleDialogOption(
                onPressed: () => Navigator.pop(c, 'single'),
                child: const Text('Nur diesen Termin'),
              ),
              SimpleDialogOption(
                onPressed: () => Navigator.pop(c, 'future'),
                child: const Text('Diesen und alle zukünftigen'),
              ),
              SimpleDialogOption(
                onPressed: () => Navigator.pop(c, 'series'),
                child: const Text('Gesamte Serie'),
              ),
            ],
          ),
        );
  Future<void> _remove(CalendarEventModel e) async {
    final scope = await _scope(e, 'löschen');
    if (scope == null || !mounted) return;
    final ok =
        await showDialog<bool>(
          context: context,
          builder: (c) => AlertDialog(
            title: const Text('Termin wirklich löschen?'),
            content: Text('„${e.title}“ wird entfernt.'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(c, false),
                child: const Text('Abbrechen'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(c, true),
                child: const Text('Löschen'),
              ),
            ],
          ),
        ) ??
        false;
    if (ok) {
      await repo.delete(e.id, scope);
      await _load();
    }
  }

  Future<void> _edit(
    CalendarEventModel? e, {
    DateTime? date,
    bool copy = false,
  }) async {
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (_) => EventDialog(
        event: e,
        date: date,
        copy: copy,
        groups: widget.groups,
        users: widget.users,
      ),
    );
    if (result == null || !mounted) return;
    final scope = e == null || copy ? 'single' : await _scope(e, 'ändern');
    if (scope == null) return;
    try {
      await repo.save(id: e?.id, data: result, scope: scope, copy: copy);
      await _load();
    } on DioException catch (x) {
      if (mounted) {
        final data = x.response?.data;
        final rawMessage = data is Map ? data['message'] : null;
        final message = rawMessage is String
            ? rawMessage
            : rawMessage is List && rawMessage.isNotEmpty
            ? rawMessage.first.toString()
            : 'Termin konnte nicht gespeichert werden.';
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(message)));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Termin konnte nicht gespeichert werden.'),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final first = DateTime(month.year, month.month).weekday,
        days = DateTime(month.year, month.month + 1, 0).day,
        cells = ((first - 1 + days + 6) ~/ 7) * 7;
    return LayoutBuilder(
      builder: (context, constraints) {
        final wide = constraints.maxWidth >= 700;
        final dark = Theme.of(context).brightness == Brightness.dark;
        return Align(
          alignment: Alignment.topLeft,
          child: SizedBox(
            width: constraints.maxWidth > 1040 ? 1040 : constraints.maxWidth,
            child: Card(
              elevation: 3,
              color: dark ? const Color(0xFF151C22) : Colors.white,
              surfaceTintColor: const Color(0xFFE8F4FC),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(22),
                side: BorderSide(
                  color: dark
                      ? const Color(0xFF4D7188)
                      : const Color(0xFFB9D8EA),
                  width: 1.4,
                ),
              ),
              child: Padding(
                padding: EdgeInsets.all(wide ? 28 : 16),
                child: Column(
                  children: [
                    Row(
                      children: [
                        IconButton(
                          onPressed: () => _move(-1),
                          icon: const Icon(Icons.chevron_left),
                        ),
                        Expanded(
                          child: InkWell(
                            onTap: _jump,
                            child: Text(
                              monthTitle(month),
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: wide ? 32 : 24,
                                fontWeight: FontWeight.w900,
                                color: dark
                                    ? const Color(0xFF70C7F4)
                                    : const Color(0xFF082D4B),
                              ),
                            ),
                          ),
                        ),
                        TextButton(
                          onPressed: () {
                            setState(
                              () => month = DateTime(
                                DateTime.now().year,
                                DateTime.now().month,
                              ),
                            );
                            _load();
                          },
                          child: const Text('Heute'),
                        ),
                        IconButton(
                          onPressed: () => _move(1),
                          icon: const Icon(Icons.chevron_right),
                        ),
                      ],
                    ),
                    if (error != null)
                      Text(error!, style: const TextStyle(color: Colors.red)),
                    if (loading) const LinearProgressIndicator(),
                    Row(
                      children: [
                        for (final x in const [
                          'Mo',
                          'Di',
                          'Mi',
                          'Do',
                          'Fr',
                          'Sa',
                          'So',
                        ])
                          Expanded(
                            child: Text(
                              x,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: wide ? 20 : 17,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF0B4F8A),
                              ),
                            ),
                          ),
                      ],
                    ),
                    GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 7,
                        childAspectRatio: wide ? 1.38 : 1.22,
                      ),
                      itemCount: cells,
                      itemBuilder: (c, i) {
                        final n = i - first + 2;
                        if (n < 1 || n > days) return const SizedBox();
                        final d = DateTime(month.year, month.month, n),
                            dayTrainings = _training(d),
                            dayEvents = _events(d),
                            today = sameDay(d, DateTime.now());
                        final highlighted =
                            dayTrainings.isNotEmpty || dayEvents.isNotEmpty;
                        final dotColors = <Color>{
                          ...dayTrainings.map(_trainingColor),
                          ...dayEvents.map(_eventColor),
                        }.toList();
                        final cellColor = highlighted
                            ? (dark
                                  ? const Color(0xFF202A32)
                                  : const Color(0xFFF0F5F9))
                            : dark
                            ? const Color(0xFF202A32)
                            : const Color(0xFFF7FAFC);
                        return Padding(
                          padding: const EdgeInsets.all(4),
                          child: InkWell(
                            onTap: () => _day(d),
                            borderRadius: BorderRadius.circular(12),
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                color: cellColor,
                                border: Border.all(
                                  color: today
                                      ? const Color(0xFF62C7F5)
                                      : dark
                                      ? const Color(0xFF344650)
                                      : const Color(0xFFE1EBF1),
                                  width: today ? 3 : 1,
                                ),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(
                                    '$n',
                                    style: TextStyle(
                                      fontSize: wide ? 24 : 19,
                                      fontWeight: FontWeight.w900,
                                      color: dark
                                          ? const Color(0xFFF4F8FB)
                                          : const Color(0xFF17212B),
                                    ),
                                  ),
                                  if (dotColors.isNotEmpty)
                                    Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.center,
                                      children: [
                                        for (final color in dotColors.take(4))
                                          Padding(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 1.5,
                                            ),
                                            child: ColorDot(
                                              color: color,
                                              size: 7,
                                            ),
                                          ),
                                        if (dotColors.length > 4)
                                          const Text(
                                            '+',
                                            style: TextStyle(
                                              fontSize: 10,
                                              fontWeight: FontWeight.w900,
                                            ),
                                          ),
                                      ],
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

class EventDialog extends StatefulWidget {
  const EventDialog({
    this.event,
    this.date,
    this.copy = false,
    this.groups = const [],
    this.users = const [],
    super.key,
  });
  final CalendarEventModel? event;
  final DateTime? date;
  final bool copy;
  final List<TrainingGroup> groups;
  final List<TrainingUser> users;
  @override
  State<EventDialog> createState() => EventDialogState();
}

class EventDialogState extends State<EventDialog> {
  late final TextEditingController title, description, location;
  late final TextEditingController meetingUrl, meetingNotes;
  late DateTime date;
  late TimeOfDay start, end;
  String recurrence = 'none';
  int? reminder;
  String? meetingProvider;
  late final Set<String> groupIds, participantIds;
  @override
  void initState() {
    super.initState();
    final e = widget.event, d = widget.date ?? e?.startsAt ?? DateTime.now();
    date = DateTime(d.year, d.month, d.day);
    start = TimeOfDay.fromDateTime(
      e?.startsAt ?? DateTime(d.year, d.month, d.day, 18),
    );
    end = TimeOfDay.fromDateTime(
      e?.endsAt ?? DateTime(d.year, d.month, d.day, 19),
    );
    title = TextEditingController(text: e?.title ?? '');
    description = TextEditingController(text: e?.description ?? '');
    location = TextEditingController(text: e?.location ?? '');
    meetingUrl = TextEditingController(text: e?.meetingUrl ?? '')
      ..addListener(_onMeetingFieldChanged);
    meetingNotes = TextEditingController(text: e?.meetingNotes ?? '');
    meetingProvider = e?.meetingProvider;
    reminder = e?.reminderMinutes;
    groupIds = {...?e?.groupIds};
    participantIds = {...?e?.participantIds};
  }

  DateTime _at(TimeOfDay t) =>
      DateTime(date.year, date.month, date.day, t.hour, t.minute);
  void _onMeetingFieldChanged() => setState(() {});
  bool get _meetingUrlValid =>
      meetingProvider == null || meetingUrl.text.trim().startsWith('https://');
  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(
      widget.copy
          ? 'Termin kopieren'
          : widget.event == null
          ? 'Termin erstellen'
          : 'Termin bearbeiten',
    ),
    content: SizedBox(
      width: 600,
      child: ListView(
        shrinkWrap: true,
        children: [
          TextField(
            controller: title,
            decoration: const InputDecoration(labelText: 'Titel'),
          ),
          TextField(
            controller: description,
            maxLines: 3,
            decoration: const InputDecoration(labelText: 'Beschreibung'),
          ),
          TextField(
            controller: location,
            decoration: const InputDecoration(labelText: 'Ort'),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String?>(
            initialValue: meetingProvider,
            decoration: const InputDecoration(labelText: 'Online-Meeting'),
            items: const [
              DropdownMenuItem(value: null, child: Text('Kein Online-Meeting')),
              DropdownMenuItem(
                value: 'google_meet',
                child: Text('Google Meet'),
              ),
              DropdownMenuItem(
                value: 'microsoft_teams',
                child: Text('Microsoft Teams'),
              ),
              DropdownMenuItem(value: 'other', child: Text('Anderer Anbieter')),
            ],
            onChanged: (v) => setState(() => meetingProvider = v),
          ),
          if (meetingProvider != null) ...[
            const SizedBox(height: 12),
            TextField(
              controller: meetingUrl,
              decoration: InputDecoration(
                labelText: 'Meeting-Link (https://…)',
                hintText: 'https://meet.google.com/…',
                errorText:
                    meetingUrl.text.trim().isNotEmpty && !_meetingUrlValid
                    ? 'Nur https-Links sind erlaubt.'
                    : null,
              ),
              keyboardType: TextInputType.url,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: meetingNotes,
              decoration: const InputDecoration(
                labelText: 'Hinweise zum Meeting (optional)',
                hintText: 'z. B. Zugangscode, Beitrittshinweise',
              ),
            ),
          ],
          ListTile(
            title: Text(fullDate(date)),
            trailing: const Icon(Icons.calendar_month),
            onTap: () async {
              final d = await showDatePicker(
                context: context,
                initialDate: date,
                firstDate: DateTime(2000),
                lastDate: DateTime(2200),
              );
              if (d != null) setState(() => date = d);
            },
          ),
          Row(
            children: [
              Expanded(
                child: ListTile(
                  title: Text('Start ${start.format(context)}'),
                  onTap: () async {
                    final t = await showTimePicker(
                      context: context,
                      initialTime: start,
                    );
                    if (t != null) setState(() => start = t);
                  },
                ),
              ),
              Expanded(
                child: ListTile(
                  title: Text('Ende ${end.format(context)}'),
                  onTap: () async {
                    final t = await showTimePicker(
                      context: context,
                      initialTime: end,
                    );
                    if (t != null) setState(() => end = t);
                  },
                ),
              ),
            ],
          ),
          DropdownButtonFormField<int?>(
            initialValue: reminder,
            decoration: const InputDecoration(labelText: 'Erinnerung'),
            items: const [
              DropdownMenuItem(value: null, child: Text('Keine')),
              DropdownMenuItem(value: 15, child: Text('15 Minuten vorher')),
              DropdownMenuItem(value: 30, child: Text('30 Minuten vorher')),
              DropdownMenuItem(value: 60, child: Text('1 Stunde vorher')),
              DropdownMenuItem(value: 1440, child: Text('1 Tag vorher')),
            ],
            onChanged: (v) => setState(() => reminder = v),
          ),
          if (widget.event == null && !widget.copy)
            DropdownButtonFormField<String>(
              initialValue: recurrence,
              decoration: const InputDecoration(labelText: 'Wiederholung'),
              items: const [
                DropdownMenuItem(value: 'none', child: Text('Keine')),
                DropdownMenuItem(value: 'daily', child: Text('Täglich')),
                DropdownMenuItem(value: 'weekly', child: Text('Wöchentlich')),
                DropdownMenuItem(
                  value: 'biweekly',
                  child: Text('Alle zwei Wochen'),
                ),
                DropdownMenuItem(value: 'monthly', child: Text('Monatlich')),
                DropdownMenuItem(value: 'yearly', child: Text('Jährlich')),
              ],
              onChanged: (v) => setState(() => recurrence = v ?? 'none'),
            ),
          if (widget.groups.isNotEmpty) ...[
            const SizedBox(height: 12),
            const Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Gruppen',
                style: TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
            ...widget.groups.map(
              (g) => CheckboxListTile(
                dense: true,
                value: groupIds.contains(g.id),
                secondary: ColorDot(color: parseHexColor(g.color), size: 14),
                title: Text(g.name),
                onChanged: (v) => setState(
                  () => v == true ? groupIds.add(g.id) : groupIds.remove(g.id),
                ),
              ),
            ),
          ],
          if (widget.users.isNotEmpty) ...[
            const SizedBox(height: 12),
            const Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Einzelne Teilnehmer',
                style: TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
            ...widget.users.map(
              (u) => CheckboxListTile(
                dense: true,
                value: participantIds.contains(u.id),
                secondary: ColorDot(color: parseHexColor(u.color), size: 14),
                title: Text(u.name),
                onChanged: (v) => setState(
                  () => v == true
                      ? participantIds.add(u.id)
                      : participantIds.remove(u.id),
                ),
              ),
            ),
          ],
        ],
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Abbrechen'),
      ),
      FilledButton(
        onPressed: title.text.trim().isEmpty || !_meetingUrlValid
            ? null
            : () => Navigator.pop(context, {
                'title': title.text.trim(),
                'description': description.text.trim(),
                'location': location.text.trim(),
                'eventType': 'event',
                'startsAt': _at(start).toUtc().toIso8601String(),
                'endsAt': _at(end).toUtc().toIso8601String(),
                'reminderMinutes': reminder,
                'groupIds': groupIds.toList(),
                'participantIds': participantIds.toList(),
                'recurrence': recurrence,
                if (recurrence != 'none') 'recurrenceCount': 20,
                'meetingProvider': meetingProvider,
                'meetingUrl': meetingProvider == null
                    ? null
                    : meetingUrl.text.trim(),
                'meetingNotes':
                    meetingProvider == null || meetingNotes.text.trim().isEmpty
                    ? null
                    : meetingNotes.text.trim(),
              }),
        child: const Text('Speichern'),
      ),
    ],
  );
}

String _time(DateTime d) =>
    '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
