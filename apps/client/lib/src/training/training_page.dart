import 'package:flutter/material.dart';
import 'training_models.dart';
import 'training_repository.dart';
import '../calendar/calendar_panel.dart';
import '../common/avatar.dart';
import '../common/color_palette.dart';

const _blue = Color(0xFF0B4F8A),
    _navy = Color(0xFF082D4B),
    _lightBlue = Color(0xFFE8F4FC);

class TrainingPage extends StatefulWidget {
  const TrainingPage({
    super.key,
    required this.accessToken,
    required this.canManage,
    this.embedded = false,
    this.showCalendar = false,
    this.calendarOnly = false,
  });
  final String accessToken;
  final bool canManage;
  final bool embedded;
  final bool showCalendar;
  final bool calendarOnly;
  @override
  State<TrainingPage> createState() => _TrainingPageState();
}

class _TrainingPageState extends State<TrainingPage> {
  late final TrainingRepository repo;
  int _selectedSection = 0;
  bool loading = true;
  String? error;
  List<TrainingSession> sessions = [];
  List<TrainingSession> managedSessions = [];
  List<TrainingGroup> groups = [];
  List<TrainingUser> users = [];
  List<TrainingScheduleModel> schedules = [];
  @override
  void initState() {
    super.initState();
    repo = TrainingRepository(accessToken: widget.accessToken);
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final s = await repo.sessions();
      List<TrainingGroup> g = [];
      List<TrainingUser> u = [];
      List<TrainingScheduleModel> sc = [];
      List<TrainingSession> ms = [];
      if (widget.canManage) {
        g = await repo.groups();
        u = await repo.users();
        sc = await repo.schedules();
        ms = await repo.adminSessions();
      }
      if (mounted) {
        setState(() {
          sessions = s;
          groups = g;
          users = u;
          schedules = sc;
          managedSessions = ms;
          error = null;
          loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          error = e.toString();
          loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    if (error != null) return _Error(message: error!, retry: _load);
    final personal = _PersonalSessions(
      token: widget.accessToken,
      canManage: widget.canManage,
      sessions: sessions,
      onVote: _vote,
      onAttendance: widget.canManage ? _showAttendance : null,
      embedded: widget.embedded,
      showCalendar: widget.showCalendar,
      calendarOnly: widget.calendarOnly,
      groups: groups,
      users: users,
    );
    if (!widget.canManage) return personal;
    if (widget.embedded) {
      final sections = <(String, Widget)>[
        ('Meine Termine', personal),
        (
          'Trainingszeiten',
          _Schedules(
            items: schedules,
            groups: groups,
            onAdd: () => _scheduleDialog(),
            onEdit: _scheduleDialog,
            onToggle: _toggleSchedule,
            onDelete: _deleteSchedule,
            embedded: true,
          ),
        ),
        (
          'Termine verwalten',
          _AdminSessions(
            items: managedSessions,
            onAdd: () => _sessionDialog(),
            onEdit: _sessionDialog,
            onToggle: _toggleSession,
            onDelete: _deleteSession,
            onAttendance: _showAttendance,
            embedded: true,
          ),
        ),
        (
          'Gruppen',
          _Groups(
            items: groups,
            onAdd: () => _groupDialog(),
            onEdit: _groupDialog,
            onDelete: _deleteGroup,
            accessToken: widget.accessToken,
            embedded: true,
          ),
        ),
        (
          'Benutzer',
          _Users(
            items: users,
            groups: groups,
            onEdit: _userGroupsDialog,
            embedded: true,
          ),
        ),
      ];
      final selected = sections[_selectedSection];
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _SectionNavigation(
            items: sections.map((section) => section.$1).toList(),
            selectedIndex: _selectedSection,
            onSelected: (index) => setState(() => _selectedSection = index),
          ),
          _section(context, selected.$1),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 180),
            switchInCurve: Curves.easeOut,
            switchOutCurve: Curves.easeIn,
            child: KeyedSubtree(
              key: ValueKey(_selectedSection),
              child: selected.$2,
            ),
          ),
        ],
      );
    }
    return DefaultTabController(
      length: 5,
      child: Column(
        children: [
          const TabBar(
            isScrollable: true,
            tabs: [
              Tab(text: 'Meine Termine'),
              Tab(text: 'Trainingszeiten'),
              Tab(text: 'Termine verwalten'),
              Tab(text: 'Gruppen'),
              Tab(text: 'Benutzer'),
            ],
          ),
          const SizedBox(height: 16),
          Expanded(
            child: TabBarView(
              children: [
                personal,
                _Schedules(
                  items: schedules,
                  groups: groups,
                  onAdd: () => _scheduleDialog(),
                  onEdit: _scheduleDialog,
                  onToggle: _toggleSchedule,
                  onDelete: _deleteSchedule,
                ),
                _AdminSessions(
                  items: managedSessions,
                  onAdd: () => _sessionDialog(),
                  onEdit: _sessionDialog,
                  onToggle: _toggleSession,
                  onDelete: _deleteSession,
                  onAttendance: _showAttendance,
                ),
                _Groups(
                  items: groups,
                  onAdd: () => _groupDialog(),
                  onEdit: _groupDialog,
                  onDelete: _deleteGroup,
                  accessToken: widget.accessToken,
                ),
                _Users(items: users, groups: groups, onEdit: _userGroupsDialog),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _section(BuildContext context, String title, {Key? key}) => Padding(
    key: key,
    padding: const EdgeInsets.only(top: 30, bottom: 12),
    child: Text(
      title,
      style: Theme.of(context).textTheme.titleLarge?.copyWith(
        fontWeight: FontWeight.w800,
        color: _navy,
      ),
    ),
  );

  Future<void> _vote(TrainingSession s, String status) async {
    try {
      await repo.vote(s.id, status);
      await _load();
    } catch (e) {
      _snack(e.toString());
    }
  }

  Future<void> _groupDialog([TrainingGroup? group]) async {
    final result = await showDialog<_GroupInput>(
      context: context,
      builder: (_) => _GroupDialog(
        item: group,
        accessToken: widget.accessToken,
        repo: repo,
        onAvatarChanged: _load,
      ),
    );
    if (result == null) return;
    try {
      await repo.saveGroup(
        id: group?.id,
        name: result.name,
        description: result.description,
        minimumAge: result.minimumAge,
        maximumAge: result.maximumAge,
        active: result.active,
        color: result.color,
      );
      await _load();
    } catch (e) {
      _snack(e.toString());
    }
  }

  Future<void> _deleteGroup(TrainingGroup g) async {
    if (!await _confirm('Gruppe „${g.name}“ wirklich löschen?')) return;
    try {
      await repo.deleteGroup(g.id);
      await _load();
    } catch (e) {
      _snack(e.toString());
    }
  }

  Future<void> _userGroupsDialog(TrainingUser user) async {
    final selected = user.groups.map((g) => g.id).toSet();
    final result = await showDialog<Set<String>>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          title: Text('Gruppen – ${user.name}'),
          content: SizedBox(
            width: 420,
            child: ListView(
              shrinkWrap: true,
              children: [
                CheckboxListTile(
                  value: selected.length == groups.length,
                  tristate:
                      selected.isNotEmpty && selected.length != groups.length,
                  title: const Text(
                    'Alle Gruppen auswählen',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  onChanged: (value) => setLocal(() {
                    selected.clear();
                    if (value == true) selected.addAll(groups.map((g) => g.id));
                  }),
                ),
                const Divider(),
                ...groups.map(
                  (g) => CheckboxListTile(
                    value: selected.contains(g.id),
                    title: Text(g.name),
                    onChanged: (v) => setLocal(
                      () => v == true
                          ? selected.add(g.id)
                          : selected.remove(g.id),
                    ),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Abbrechen'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, selected),
              child: const Text('Speichern'),
            ),
          ],
        ),
      ),
    );
    if (result == null) return;
    try {
      await repo.replaceUserGroups(user.id, result.toList());
      await _load();
    } catch (e) {
      _snack(e.toString());
    }
  }

  Future<void> _scheduleDialog([TrainingScheduleModel? item]) async {
    final result = await showDialog<_ScheduleInput>(
      context: context,
      builder: (_) => _ScheduleDialog(item: item, groups: groups),
    );
    if (result == null) return;
    try {
      await repo.saveSchedule(
        id: item?.id,
        name: result.name,
        weekday: result.weekday,
        startTime: result.start,
        endTime: result.end,
        groupIds: result.groups,
      );
      await _load();
    } catch (e) {
      _snack(e.toString());
    }
  }

  Future<void> _toggleSchedule(TrainingScheduleModel s, bool active) async {
    try {
      await repo.setScheduleActive(s.id, active);
      await _load();
    } catch (e) {
      _snack(e.toString());
    }
  }

  Future<void> _deleteSchedule(TrainingScheduleModel s) async {
    if (!await _confirm('Trainingszeit „${s.name}“ wirklich löschen?')) return;
    try {
      await repo.deleteSchedule(s.id);
      await _load();
    } catch (e) {
      _snack(e.toString());
    }
  }

  Future<void> _sessionDialog([TrainingSession? item]) async {
    final result = await showDialog<_SessionInput>(
      context: context,
      builder: (_) => _SessionDialog(item: item, schedules: schedules),
    );
    if (result == null) return;
    try {
      await repo.saveSession(
        id: item?.id,
        scheduleId: result.scheduleId,
        startsAt: result.startsAt,
        endsAt: result.endsAt,
        cancelled: result.cancelled,
      );
      await _load();
    } catch (e) {
      _snack(e.toString());
    }
  }

  Future<void> _toggleSession(TrainingSession s, bool cancelled) async {
    try {
      await repo.setSessionCancelled(s.id, cancelled);
      await _load();
    } catch (e) {
      _snack(e.toString());
    }
  }

  Future<void> _deleteSession(TrainingSession s) async {
    if (!await _confirm('Termin am ${_date(s.startsAt)} wirklich löschen?')) {
      return;
    }
    try {
      await repo.deleteSession(s.id);
      await _load();
    } catch (e) {
      _snack(e.toString());
    }
  }

  Future<void> _showAttendance(TrainingSession s) async {
    try {
      final data = await repo.attendance(s.id);
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text('Anwesenheit – ${s.name}'),
          content: SizedBox(
            width: 560,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 8,
                  children: [
                    Chip(label: Text('Gesamt ${data['total']}')),
                    Chip(label: Text('JA ${data['yes']}')),
                    Chip(label: Text('NEIN ${data['no']}')),
                    Chip(label: Text('Offen ${data['unanswered']}')),
                  ],
                ),
                const Divider(),
                Flexible(
                  child: ListView(
                    shrinkWrap: true,
                    children: (data['items'] as List? ?? const []).map((x) {
                      final m = Map<String, dynamic>.from(x as Map);
                      return ListTile(
                        dense: true,
                        title: Text('${m['firstName']} ${m['lastName']}'),
                        trailing: Text(
                          m['status'] == 'yes'
                              ? 'JA'
                              : m['status'] == 'no'
                              ? 'NEIN'
                              : 'Noch keine Antwort',
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            FilledButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Schließen'),
            ),
          ],
        ),
      );
    } catch (e) {
      _snack(e.toString());
    }
  }

  Future<bool> _confirm(String text) async =>
      await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Bitte bestätigen'),
          content: Text(text),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Abbrechen'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Löschen'),
            ),
          ],
        ),
      ) ??
      false;
  void _snack(String text) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
    }
  }
}

class _PersonalSessions extends StatelessWidget {
  const _PersonalSessions({
    required this.token,
    required this.canManage,
    required this.sessions,
    required this.onVote,
    required this.groups,
    required this.users,
    this.onAttendance,
    this.embedded = false,
    this.showCalendar = false,
    this.calendarOnly = false,
  });
  final List<TrainingSession> sessions;
  final String token;
  final bool canManage;
  final Future<void> Function(TrainingSession, String) onVote;
  final Future<void> Function(TrainingSession)? onAttendance;
  final bool embedded;
  final bool showCalendar;
  final bool calendarOnly;
  final List<TrainingGroup> groups;
  final List<TrainingUser> users;
  @override
  Widget build(BuildContext context) {
    if (sessions.isEmpty) {
      const empty = _Empty(
        icon: Icons.event_busy_outlined,
        text:
            'Für deine Gruppen sind aktuell keine kommenden Trainings eingetragen.',
      );
      if (!showCalendar) return empty;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CalendarPanel(
            token: token,
            sessions: sessions,
            canManage: canManage,
            onVote: onVote,
            groups: groups,
            users: users,
          ),
          if (!calendarOnly) ...[const SizedBox(height: 28), empty],
        ],
      );
    }
    final days = groupTrainingSessionsByDay(sessions);
    final list = ListView.separated(
      shrinkWrap: embedded,
      physics: embedded ? const NeverScrollableScrollPhysics() : null,
      itemCount: days.length,
      separatorBuilder: (_, _) => const SizedBox(height: 14),
      itemBuilder: (ctx, i) {
        final day = days[i];
        return TrainingDayPanel(
          key: Key('training-day-${day.date.toIso8601String()}'),
          day: day,
          onVote: onVote,
          onAttendance: onAttendance,
        );
      },
    );
    if (!showCalendar) return list;
    if (calendarOnly) {
      return CalendarPanel(
        token: token,
        sessions: sessions,
        canManage: canManage,
        onVote: onVote,
        calendarOnly: true,
        groups: groups,
        users: users,
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CalendarPanel(
          token: token,
          sessions: sessions,
          canManage: canManage,
          onVote: onVote,
          groups: groups,
          users: users,
        ),
        const SizedBox(height: 28),
        Text(
          'Deine nächsten Termine',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 12),
        list,
      ],
    );
  }
}

class TrainingDay {
  const TrainingDay(this.date, this.sessions);
  final DateTime date;
  final List<TrainingSession> sessions;
}

List<TrainingDay> groupTrainingSessionsByDay(List<TrainingSession> sessions) {
  final grouped = <DateTime, List<TrainingSession>>{};
  for (final session in sessions) {
    final day = DateTime(
      session.startsAt.year,
      session.startsAt.month,
      session.startsAt.day,
    );
    grouped.putIfAbsent(day, () => []).add(session);
  }
  return grouped.entries.map((entry) {
    entry.value.sort((a, b) => a.startsAt.compareTo(b.startsAt));
    return TrainingDay(entry.key, entry.value);
  }).toList()..sort((a, b) => a.date.compareTo(b.date));
}

class TrainingDayPanel extends StatelessWidget {
  const TrainingDayPanel({
    required this.day,
    required this.onVote,
    this.onAttendance,
    super.key,
  });
  final TrainingDay day;
  final Future<void> Function(TrainingSession, String) onVote;
  final Future<void> Function(TrainingSession)? onAttendance;

  @override
  Widget build(BuildContext context) {
    final darkMode = Theme.of(context).brightness == Brightness.dark;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _date(day.date).toUpperCase(),
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w900,
                color: darkMode ? const Color(0xFF8BCBF2) : _navy,
                fontSize: 17,
                letterSpacing: .2,
              ),
            ),
            const SizedBox(height: 10),
            LayoutBuilder(
              builder: (context, constraints) {
                final desktop = constraints.maxWidth >= 700;
                final width = desktop
                    ? ((constraints.maxWidth - 12) / 2).clamp(280.0, 520.0)
                    : constraints.maxWidth;
                return Wrap(
                  spacing: 12,
                  runSpacing: 10,
                  children: day.sessions
                      .map(
                        (session) => SizedBox(
                          width: width,
                          child: _CompactTraining(
                            session: session,
                            onVote: onVote,
                            onAttendance: onAttendance,
                          ),
                        ),
                      )
                      .toList(),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _CompactTraining extends StatelessWidget {
  const _CompactTraining({
    required this.session,
    required this.onVote,
    this.onAttendance,
  });
  final TrainingSession session;
  final Future<void> Function(TrainingSession, String) onVote;
  final Future<void> Function(TrainingSession)? onAttendance;
  @override
  Widget build(BuildContext context) => Container(
    key: Key('training-session-${session.id}'),
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
    decoration: BoxDecoration(
      color: const Color(0xFFF0F8FD),
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: const Color(0xFFB9D9EC)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.schedule, size: 18, color: _blue),
            const SizedBox(width: 6),
            Text(
              '${_time(session.startsAt)}–${_time(session.endsAt)} Uhr',
              style: const TextStyle(
                fontWeight: FontWeight.w900,
                fontSize: 15,
                color: _navy,
              ),
            ),
            const Spacer(),
            if (session.attendance != null)
              Icon(
                session.attendance!.status == 'yes'
                    ? Icons.check_circle
                    : Icons.cancel,
                size: 18,
                color: session.attendance!.status == 'yes'
                    ? Colors.green
                    : _blue,
              ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          session.groups.map((g) => g.name).join(' / '),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            color: Color(0xFF29475D),
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            _Vote(
              label: 'Teilnehmen',
              selected: session.attendance?.status == 'yes',
              enabled: !session.locked && !session.cancelled,
              onTap: () => onVote(session, 'yes'),
            ),
            _Vote(
              label: 'Absagen',
              selected: session.attendance?.status == 'no',
              enabled: !session.locked && !session.cancelled,
              onTap: () => onVote(session, 'no'),
            ),
            if (onAttendance != null)
              IconButton.outlined(
                tooltip: 'Anwesenheitsliste',
                visualDensity: VisualDensity.compact,
                style: IconButton.styleFrom(
                  foregroundColor: _blue,
                  side: const BorderSide(color: Color(0xFF75A9CA)),
                ),
                onPressed: () => onAttendance!(session),
                icon: const Icon(Icons.people_alt_outlined, size: 18),
              ),
          ],
        ),
        if (session.cancelled || session.locked)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              session.cancelled
                  ? 'Training abgesagt'
                  : 'Abstimmung geschlossen',
              style: const TextStyle(fontWeight: FontWeight.w700, color: _navy),
            ),
          ),
      ],
    ),
  );
}

class _Vote extends StatelessWidget {
  const _Vote({
    required this.label,
    required this.selected,
    required this.enabled,
    required this.onTap,
  });
  final String label;
  final bool selected, enabled;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => selected
      ? FilledButton.icon(
          onPressed: enabled ? onTap : null,
          icon: const Icon(Icons.check),
          label: Text(label),
          style: FilledButton.styleFrom(
            backgroundColor: _blue,
            foregroundColor: Colors.white,
            minimumSize: const Size(0, 36),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            visualDensity: VisualDensity.compact,
          ),
        )
      : OutlinedButton(
          style: OutlinedButton.styleFrom(
            foregroundColor: _blue,
            side: const BorderSide(color: Color(0xFF75A9CA), width: 1.2),
            minimumSize: const Size(0, 36),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            visualDensity: VisualDensity.compact,
          ),
          onPressed: enabled ? onTap : null,
          child: Text(label),
        );
}

class _SectionNavigation extends StatelessWidget {
  const _SectionNavigation({
    required this.items,
    required this.selectedIndex,
    required this.onSelected,
  });

  final List<String> items;
  final int selectedIndex;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(vertical: 12),
    decoration: const BoxDecoration(
      border: Border(bottom: BorderSide(color: Color(0xFFD4E3EE))),
    ),
    child: SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: items.indexed
            .map(
              (item) => Padding(
                padding: const EdgeInsets.only(right: 10),
                child: item.$1 == selectedIndex
                    ? FilledButton(
                        onPressed: () => onSelected(item.$1),
                        child: Text(item.$2),
                      )
                    : FilledButton.tonal(
                        onPressed: () => onSelected(item.$1),
                        child: Text(item.$2),
                      ),
              ),
            )
            .toList(),
      ),
    ),
  );
}

class _Groups extends StatelessWidget {
  const _Groups({
    required this.items,
    required this.onAdd,
    required this.onEdit,
    required this.onDelete,
    required this.accessToken,
    this.embedded = false,
  });
  final List<TrainingGroup> items;
  final VoidCallback onAdd;
  final void Function(TrainingGroup) onEdit, onDelete;
  final String accessToken;
  final bool embedded;
  @override
  Widget build(BuildContext context) => Column(
    children: [
      Align(
        alignment: Alignment.centerRight,
        child: FilledButton.icon(
          onPressed: onAdd,
          icon: const Icon(Icons.add),
          label: const Text('Gruppe erstellen'),
        ),
      ),
      const SizedBox(height: 12),
      _expand(
        embedded,
        ListView(
          shrinkWrap: embedded,
          physics: embedded ? const NeverScrollableScrollPhysics() : null,
          children: items
              .map(
                (g) => Card(
                  child: ListTile(
                    leading: AvatarImage(
                      url: g.avatarUrl,
                      accessToken: accessToken,
                      radius: 18,
                      fallback: CircleAvatar(
                        backgroundColor: parseHexColor(g.color),
                        radius: 18,
                      ),
                    ),
                    title: Text(g.name),
                    subtitle: Text(
                      [
                        g.active ? 'Aktiv' : 'Inaktiv',
                        if (g.minimumAge != null || g.maximumAge != null)
                          'Alter ${g.minimumAge ?? 0}–${g.maximumAge ?? 'offen'}',
                        if (g.description?.isNotEmpty == true) g.description!,
                      ].join(' · '),
                    ),
                    trailing: Wrap(
                      children: [
                        IconButton(
                          onPressed: () => onEdit(g),
                          icon: const Icon(Icons.edit_outlined),
                        ),
                        IconButton(
                          onPressed: () => onDelete(g),
                          icon: const Icon(Icons.delete_outline),
                        ),
                      ],
                    ),
                  ),
                ),
              )
              .toList(),
        ),
      ),
    ],
  );
}

class _GroupInput {
  const _GroupInput(
    this.name,
    this.description,
    this.minimumAge,
    this.maximumAge,
    this.active,
    this.color,
  );
  final String name, description;
  final int? minimumAge, maximumAge;
  final bool active;
  final String color;
}

class _GroupDialog extends StatefulWidget {
  const _GroupDialog({
    this.item,
    required this.accessToken,
    required this.repo,
    required this.onAvatarChanged,
  });
  final TrainingGroup? item;
  final String accessToken;
  final TrainingRepository repo;
  final VoidCallback onAvatarChanged;
  @override
  State<_GroupDialog> createState() => _GroupDialogState();
}

class _GroupDialogState extends State<_GroupDialog> {
  late final TextEditingController name, description, minimumAge, maximumAge;
  late bool active;
  late String color;
  late TrainingGroup? item = widget.item;
  void _setHasAvatar(bool hasAvatar) {
    if (!mounted || item == null) return;
    setState(
      () => item = TrainingGroup(
        id: item!.id,
        name: item!.name,
        active: item!.active,
        description: item!.description,
        minimumAge: item!.minimumAge,
        maximumAge: item!.maximumAge,
        color: item!.color,
        hasAvatar: hasAvatar,
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    final g = widget.item;
    name = TextEditingController(text: g?.name ?? '');
    description = TextEditingController(text: g?.description ?? '');
    minimumAge = TextEditingController(text: g?.minimumAge?.toString() ?? '');
    maximumAge = TextEditingController(text: g?.maximumAge?.toString() ?? '');
    active = g?.active ?? true;
    color = g?.color ?? kCalendarColorPalette.first;
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(widget.item == null ? 'Gruppe erstellen' : 'Gruppe bearbeiten'),
    content: SizedBox(
      width: 480,
      child: ListView(
        shrinkWrap: true,
        children: [
          TextField(
            controller: name,
            autofocus: true,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(labelText: 'Gruppenname'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: description,
            maxLines: 3,
            decoration: const InputDecoration(labelText: 'Beschreibung'),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: minimumAge,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Mindestalter'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: maximumAge,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Höchstalter'),
                ),
              ),
            ],
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Gruppe aktiv'),
            value: active,
            onChanged: (v) => setState(() => active = v),
          ),
          const SizedBox(height: 12),
          const Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Kalenderfarbe',
              style: TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
          const SizedBox(height: 8),
          ColorSwatchPicker(
            value: color,
            onChanged: (v) => setState(() => color = v),
          ),
          if (item != null) ...[
            const SizedBox(height: 16),
            const Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Bild',
                style: TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
            const SizedBox(height: 8),
            AvatarPicker(
              url: item!.avatarUrl,
              accessToken: widget.accessToken,
              radius: 28,
              fallback: CircleAvatar(
                radius: 28,
                backgroundColor: parseHexColor(color),
              ),
              onUpload: (bytes, filename) async {
                await widget.repo.uploadGroupAvatar(item!.id, bytes, filename);
                widget.onAvatarChanged();
                _setHasAvatar(true);
              },
              onDelete: () async {
                await widget.repo.deleteGroupAvatar(item!.id);
                widget.onAvatarChanged();
                _setHasAvatar(false);
              },
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
        onPressed: name.text.trim().isEmpty
            ? null
            : () => Navigator.pop(
                context,
                _GroupInput(
                  name.text.trim(),
                  description.text.trim(),
                  int.tryParse(minimumAge.text),
                  int.tryParse(maximumAge.text),
                  active,
                  color,
                ),
              ),
        child: const Text('Speichern'),
      ),
    ],
  );
}

class _Users extends StatelessWidget {
  const _Users({
    required this.items,
    required this.groups,
    required this.onEdit,
    this.embedded = false,
  });
  final List<TrainingUser> items;
  final List<TrainingGroup> groups;
  final void Function(TrainingUser) onEdit;
  final bool embedded;
  @override
  Widget build(BuildContext context) => ListView(
    shrinkWrap: embedded,
    physics: embedded ? const NeverScrollableScrollPhysics() : null,
    children: items
        .map(
          (u) => Card(
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: _lightBlue,
                child: Text(u.name.isEmpty ? '?' : u.name[0]),
              ),
              title: Text(u.name),
              subtitle: Text(
                '${u.groups.isEmpty ? 'Keine Gruppe' : u.groups.map((g) => g.name).join(', ')} · ${u.roles.join(', ')} · ${u.status}',
              ),
              trailing: IconButton(
                tooltip: 'Gruppen ändern',
                onPressed: () => onEdit(u),
                icon: const Icon(Icons.manage_accounts_outlined),
              ),
            ),
          ),
        )
        .toList(),
  );
}

class _Schedules extends StatelessWidget {
  const _Schedules({
    required this.items,
    required this.groups,
    required this.onAdd,
    required this.onEdit,
    required this.onToggle,
    required this.onDelete,
    this.embedded = false,
  });
  final List<TrainingScheduleModel> items;
  final List<TrainingGroup> groups;
  final VoidCallback onAdd;
  final void Function(TrainingScheduleModel) onEdit, onDelete;
  final void Function(TrainingScheduleModel, bool) onToggle;
  final bool embedded;
  @override
  Widget build(BuildContext context) => Column(
    children: [
      Align(
        alignment: Alignment.centerRight,
        child: FilledButton.icon(
          onPressed: onAdd,
          icon: const Icon(Icons.add),
          label: const Text('Trainingszeit erstellen'),
        ),
      ),
      const SizedBox(height: 12),
      _expand(
        embedded,
        ListView(
          shrinkWrap: embedded,
          physics: embedded ? const NeverScrollableScrollPhysics() : null,
          children: items
              .map(
                (s) => Card(
                  child: ListTile(
                    leading: Switch(
                      value: s.active,
                      onChanged: (v) => onToggle(s, v),
                    ),
                    title: Text(
                      '${_weekday(s.weekday)} · ${s.startTime} – ${s.endTime} Uhr',
                    ),
                    subtitle: Text(
                      '${s.name}\n${s.groups.map((g) => g.name).join(' / ')}',
                    ),
                    isThreeLine: true,
                    trailing: Wrap(
                      children: [
                        IconButton(
                          onPressed: () => onEdit(s),
                          icon: const Icon(Icons.edit_outlined),
                        ),
                        IconButton(
                          onPressed: () => onDelete(s),
                          icon: const Icon(Icons.delete_outline),
                        ),
                      ],
                    ),
                  ),
                ),
              )
              .toList(),
        ),
      ),
    ],
  );
}

class _AdminSessions extends StatelessWidget {
  const _AdminSessions({
    required this.items,
    required this.onAdd,
    required this.onEdit,
    required this.onToggle,
    required this.onDelete,
    required this.onAttendance,
    this.embedded = false,
  });
  final List<TrainingSession> items;
  final VoidCallback onAdd;
  final void Function(TrainingSession) onEdit, onDelete, onAttendance;
  final void Function(TrainingSession, bool) onToggle;
  final bool embedded;
  @override
  Widget build(BuildContext context) => Column(
    children: [
      Row(
        children: [
          const Expanded(
            child: Text(
              'Alle Termine der nächsten 90 Tage',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
          FilledButton.icon(
            onPressed: onAdd,
            icon: const Icon(Icons.add),
            label: const Text('Termin anlegen'),
          ),
        ],
      ),
      const SizedBox(height: 12),
      _expand(
        embedded,
        items.isEmpty
            ? const _Empty(
                icon: Icons.event_outlined,
                text: 'Keine Termine vorhanden.',
              )
            : ListView(
                shrinkWrap: embedded,
                physics: embedded ? const NeverScrollableScrollPhysics() : null,
                children: items
                    .map(
                      (s) => Card(
                        child: ListTile(
                          leading: Icon(
                            s.cancelled
                                ? Icons.event_busy
                                : Icons.event_available,
                            color: s.cancelled ? Colors.red : _blue,
                          ),
                          title: Text(
                            '${_date(s.startsAt)} · ${_time(s.startsAt)} – ${_time(s.endsAt)} Uhr',
                          ),
                          subtitle: Text(
                            '${s.name} · ${s.groups.map((g) => g.name).join(' / ')}${s.cancelled ? '\nABGESAGT' : ''}',
                          ),
                          isThreeLine: s.cancelled,
                          trailing: Wrap(
                            children: [
                              IconButton(
                                tooltip: 'Anwesenheit',
                                onPressed: () => onAttendance(s),
                                icon: const Icon(Icons.people_alt_outlined),
                              ),
                              IconButton(
                                tooltip: s.cancelled
                                    ? 'Reaktivieren'
                                    : 'Absagen',
                                onPressed: () => onToggle(s, !s.cancelled),
                                icon: Icon(
                                  s.cancelled
                                      ? Icons.event_available
                                      : Icons.event_busy_outlined,
                                ),
                              ),
                              IconButton(
                                tooltip: 'Bearbeiten',
                                onPressed: () => onEdit(s),
                                icon: const Icon(Icons.edit_outlined),
                              ),
                              IconButton(
                                tooltip: 'Löschen',
                                onPressed: () => onDelete(s),
                                icon: const Icon(Icons.delete_outline),
                              ),
                            ],
                          ),
                        ),
                      ),
                    )
                    .toList(),
              ),
      ),
    ],
  );
}

class _SessionInput {
  const _SessionInput(
    this.scheduleId,
    this.startsAt,
    this.endsAt,
    this.cancelled,
  );
  final String scheduleId;
  final DateTime startsAt, endsAt;
  final bool cancelled;
}

class _SessionDialog extends StatefulWidget {
  const _SessionDialog({this.item, required this.schedules});
  final TrainingSession? item;
  final List<TrainingScheduleModel> schedules;
  @override
  State<_SessionDialog> createState() => _SessionDialogState();
}

class _SessionDialogState extends State<_SessionDialog> {
  late String scheduleId;
  late DateTime date;
  late final TextEditingController start, end;
  late bool cancelled;
  @override
  void initState() {
    super.initState();
    final item = widget.item;
    scheduleId =
        item?.scheduleId ??
        (widget.schedules.isEmpty ? '' : widget.schedules.first.id);
    date = item?.startsAt ?? DateTime.now().add(const Duration(days: 1));
    start = TextEditingController(
      text: item == null ? '16:00' : _time(item.startsAt),
    );
    end = TextEditingController(
      text: item == null ? '17:15' : _time(item.endsAt),
    );
    cancelled = item?.cancelled ?? false;
  }

  DateTime? _combine(String value) {
    final parts = value.split(':');
    if (parts.length != 2) return null;
    final h = int.tryParse(parts[0]), m = int.tryParse(parts[1]);
    if (h == null || m == null || h > 23 || m > 59) return null;
    return DateTime(date.year, date.month, date.day, h, m);
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(widget.item == null ? 'Termin anlegen' : 'Termin bearbeiten'),
    content: SizedBox(
      width: 500,
      child: ListView(
        shrinkWrap: true,
        children: [
          DropdownButtonFormField<String>(
            initialValue: scheduleId.isEmpty ? null : scheduleId,
            decoration: const InputDecoration(
              labelText: 'Trainingszeit / Gruppen',
            ),
            items: widget.schedules
                .map(
                  (s) => DropdownMenuItem(
                    value: s.id,
                    child: Text(
                      '${s.name} · ${s.groups.map((g) => g.name).join(' / ')}',
                    ),
                  ),
                )
                .toList(),
            onChanged: widget.item == null
                ? (v) => setState(() => scheduleId = v ?? '')
                : null,
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: date,
                firstDate: DateTime.now().subtract(const Duration(days: 365)),
                lastDate: DateTime.now().add(const Duration(days: 730)),
              );
              if (picked != null) setState(() => date = picked);
            },
            icon: const Icon(Icons.calendar_month),
            label: Text(_date(date)),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: start,
                  decoration: const InputDecoration(
                    labelText: 'Beginn (HH:MM)',
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: end,
                  decoration: const InputDecoration(labelText: 'Ende (HH:MM)'),
                ),
              ),
            ],
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Termin abgesagt'),
            value: cancelled,
            onChanged: (v) => setState(() => cancelled = v),
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
        onPressed: scheduleId.isEmpty
            ? null
            : () {
                final a = _combine(start.text.trim()),
                    b = _combine(end.text.trim());
                if (a == null || b == null || !b.isAfter(a)) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text(
                        'Bitte gültige Anfangs- und Endzeit eingeben.',
                      ),
                    ),
                  );
                  return;
                }
                Navigator.pop(
                  context,
                  _SessionInput(scheduleId, a, b, cancelled),
                );
              },
        child: const Text('Speichern'),
      ),
    ],
  );
}

class _ScheduleInput {
  const _ScheduleInput(
    this.name,
    this.weekday,
    this.start,
    this.end,
    this.groups,
  );
  final String name, start, end;
  final int weekday;
  final List<String> groups;
}

class _ScheduleDialog extends StatefulWidget {
  const _ScheduleDialog({this.item, required this.groups});
  final TrainingScheduleModel? item;
  final List<TrainingGroup> groups;
  @override
  State<_ScheduleDialog> createState() => _ScheduleDialogState();
}

class _ScheduleDialogState extends State<_ScheduleDialog> {
  late final TextEditingController name, start, end;
  late int weekday;
  late Set<String> selected;
  @override
  void initState() {
    super.initState();
    name = TextEditingController(text: widget.item?.name ?? 'Training');
    start = TextEditingController(text: widget.item?.startTime ?? '16:00');
    end = TextEditingController(text: widget.item?.endTime ?? '17:15');
    weekday = widget.item?.weekday ?? 1;
    selected =
        (widget.item?.groups.map((g) => g.id) ?? const Iterable<String>.empty())
            .toSet();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(
      widget.item == null
          ? 'Trainingszeit erstellen'
          : 'Trainingszeit bearbeiten',
    ),
    content: SizedBox(
      width: 480,
      child: ListView(
        shrinkWrap: true,
        children: [
          TextField(
            controller: name,
            decoration: const InputDecoration(labelText: 'Bezeichnung'),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<int>(
            initialValue: weekday,
            decoration: const InputDecoration(labelText: 'Wochentag'),
            items: List.generate(
              7,
              (i) =>
                  DropdownMenuItem(value: i + 1, child: Text(_weekday(i + 1))),
            ),
            onChanged: (v) => setState(() => weekday = v!),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: start,
                  decoration: const InputDecoration(
                    labelText: 'Beginn (HH:MM)',
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: end,
                  decoration: const InputDecoration(labelText: 'Ende (HH:MM)'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          const Text('Gruppen', style: TextStyle(fontWeight: FontWeight.bold)),
          ...widget.groups.map(
            (g) => CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              value: selected.contains(g.id),
              title: Text(g.name),
              onChanged: (v) => setState(
                () => v == true ? selected.add(g.id) : selected.remove(g.id),
              ),
            ),
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
        onPressed: selected.isEmpty
            ? null
            : () => Navigator.pop(
                context,
                _ScheduleInput(
                  name.text.trim(),
                  weekday,
                  start.text.trim(),
                  end.text.trim(),
                  selected.toList(),
                ),
              ),
        child: const Text('Speichern'),
      ),
    ],
  );
}

class _Error extends StatelessWidget {
  const _Error({required this.message, required this.retry});
  final String message;
  final VoidCallback retry;
  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(message),
        const SizedBox(height: 12),
        FilledButton(onPressed: retry, child: const Text('Erneut versuchen')),
      ],
    ),
  );
}

class _Empty extends StatelessWidget {
  const _Empty({required this.icon, required this.text});
  final IconData icon;
  final String text;
  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 48, color: _blue),
        const SizedBox(height: 12),
        Text(text, textAlign: TextAlign.center),
      ],
    ),
  );
}

Widget _expand(bool embedded, Widget child) =>
    embedded ? child : Expanded(child: child);

String _weekday(int value) => const [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
][value - 1];
String _date(DateTime d) =>
    '${_weekday(d.weekday)}, ${d.day.toString().padLeft(2, '0')}.${d.month.toString().padLeft(2, '0')}.${d.year}';
String _time(DateTime d) =>
    '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
