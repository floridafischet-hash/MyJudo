import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../config/app_config.dart';

class _ChecklistDraft {
  _ChecklistDraft() : title = TextEditingController();
  final TextEditingController title;
  final List<TextEditingController> items = [TextEditingController()];
  void dispose() {
    title.dispose();
    for (final item in items) {
      item.dispose();
    }
  }
}

class ProjectsPage extends StatefulWidget {
  const ProjectsPage({
    required this.accessToken,
    required this.canCreate,
    super.key,
  });
  final String accessToken;
  final bool canCreate;
  @override
  State<ProjectsPage> createState() => _ProjectsPageState();
}

class _ProjectsPageState extends State<ProjectsPage> {
  late final Dio api = Dio(
    BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      headers: {'Authorization': 'Bearer ${widget.accessToken}'},
    ),
  );
  List<dynamic> projects = [];
  List<dynamic> completedProjects = [];
  Map<String, dynamic>? selected;
  bool showCompleted = false;
  bool loading = true;
  Timer? _orderSaveTimer;
  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _orderSaveTimer?.cancel();
    api.close();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        api.get<List<dynamic>>('/projects'),
        api.get<List<dynamic>>(
          '/projects',
          queryParameters: {'status': 'completed'},
        ),
      ]);
      if (mounted) {
        setState(() {
          projects = results[0].data ?? [];
          completedProjects = results[1].data ?? [];
          loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _open(String id) async {
    final r = await api.get<dynamic>('/projects/$id');
    if (mounted) {
      setState(() => selected = Map<String, dynamic>.from(r.data as Map));
    }
  }

  void _reorderProjects(int oldIndex, int newIndex) {
    setState(() => projects = reorderedList(projects, oldIndex, newIndex));
    _scheduleOrderSave();
  }

  void _moveProject(int index, int delta) {
    final newIndex = index + delta;
    if (newIndex < 0 || newIndex >= projects.length) return;
    setState(() => projects = reorderedList(projects, index, newIndex));
    _scheduleOrderSave();
  }

  // Several drags/moves in quick succession only persist once, shortly
  // after the last one settles - not on every intermediate step.
  void _scheduleOrderSave() {
    _orderSaveTimer?.cancel();
    _orderSaveTimer = Timer(const Duration(milliseconds: 500), _saveOrder);
  }

  Future<void> _saveOrder() async {
    final order = projects.map((raw) => (raw as Map)['id'] as String).toList();
    try {
      await api.put('/projects/order', data: {'order': order});
    } catch (_) {
      // A transient failure to persist shouldn't disrupt the current view;
      // the order simply reverts to the last saved state on next reload.
    }
  }

  Future<void> _resetOrder() async {
    _orderSaveTimer?.cancel();
    try {
      await api.post('/projects/order/reset');
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Reihenfolge wurde zurückgesetzt.')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Reihenfolge konnte nicht zurückgesetzt werden.'),
          ),
        );
      }
    }
  }

  Future<void> _create() async {
    final title = TextEditingController(),
        description = TextEditingController(),
        category = TextEditingController();
    final checklists = <_ChecklistDraft>[];
    final directory = await api.get<dynamic>(
      '/users/directory',
      queryParameters: {'pageSize': 50},
    );
    final users = ((directory.data as Map)['items'] as List? ?? [])
        .map((value) => Map<String, dynamic>.from(value as Map))
        .toList();
    if (!mounted) return;
    final memberRoles = <String, String>{};
    var status = 'active';
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => StatefulBuilder(
        builder: (c, setDialog) => AlertDialog(
          title: const Text('Neues Projekt'),
          content: SizedBox(
            width: 720,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: title,
                    decoration: const InputDecoration(labelText: 'Titel'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: description,
                    decoration: const InputDecoration(
                      labelText: 'Beschreibung',
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: category,
                          decoration: const InputDecoration(
                            labelText: 'Kategorie (optional)',
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: status,
                          decoration: const InputDecoration(
                            labelText: 'Status',
                          ),
                          items: const [
                            DropdownMenuItem(
                              value: 'active',
                              child: Text('Aktiv'),
                            ),
                            DropdownMenuItem(
                              value: 'completed',
                              child: Text('Abgeschlossen'),
                            ),
                            DropdownMenuItem(
                              value: 'archived',
                              child: Text('Archiviert'),
                            ),
                          ],
                          onChanged: (value) =>
                              setDialog(() => status = value!),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 22),
                  Row(
                    children: [
                      const Expanded(
                        child: Text(
                          'Checklisten und erste Aufgaben',
                          style: TextStyle(fontWeight: FontWeight.w800),
                        ),
                      ),
                      TextButton.icon(
                        onPressed: () =>
                            setDialog(() => checklists.add(_ChecklistDraft())),
                        icon: const Icon(Icons.add),
                        label: const Text('Checkliste'),
                      ),
                    ],
                  ),
                  if (checklists.isEmpty)
                    const Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        'Optional: Du kannst erste Checklisten direkt anlegen und später erweitern.',
                      ),
                    ),
                  ...checklists.asMap().entries.map((entry) {
                    final checklistIndex = entry.key;
                    final checklist = entry.value;
                    return Card(
                      margin: const EdgeInsets.only(top: 10),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: TextField(
                                    controller: checklist.title,
                                    decoration: const InputDecoration(
                                      labelText: 'Titel der Checkliste',
                                    ),
                                  ),
                                ),
                                IconButton(
                                  tooltip: 'Checkliste entfernen',
                                  onPressed: () => setDialog(() {
                                    checklists
                                        .removeAt(checklistIndex)
                                        .dispose();
                                  }),
                                  icon: const Icon(Icons.delete_outline),
                                ),
                              ],
                            ),
                            ...checklist.items.asMap().entries.map((itemEntry) {
                              final itemIndex = itemEntry.key;
                              return Padding(
                                padding: const EdgeInsets.only(top: 8),
                                child: Row(
                                  children: [
                                    const Icon(
                                      Icons.check_box_outline_blank,
                                      size: 20,
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: TextField(
                                        controller: itemEntry.value,
                                        decoration: InputDecoration(
                                          labelText: 'Aufgabe ${itemIndex + 1}',
                                        ),
                                      ),
                                    ),
                                    IconButton(
                                      tooltip: 'Aufgabe entfernen',
                                      onPressed: checklist.items.length == 1
                                          ? null
                                          : () => setDialog(() {
                                              checklist.items
                                                  .removeAt(itemIndex)
                                                  .dispose();
                                            }),
                                      icon: const Icon(
                                        Icons.remove_circle_outline,
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            }),
                            Align(
                              alignment: Alignment.centerLeft,
                              child: TextButton.icon(
                                onPressed: () => setDialog(
                                  () => checklist.items.add(
                                    TextEditingController(),
                                  ),
                                ),
                                icon: const Icon(Icons.add),
                                label: const Text('Aufgabe hinzufügen'),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
                  const SizedBox(height: 16),
                  const Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Teilnehmer und Zugriff',
                      style: TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ),
                  ...users.map(
                    (user) => CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      value: memberRoles.containsKey(user['id']),
                      title: Text(user['displayName'] as String),
                      subtitle: memberRoles.containsKey(user['id'])
                          ? DropdownButton<String>(
                              value: memberRoles[user['id']],
                              items: const [
                                DropdownMenuItem(
                                  value: 'read',
                                  child: Text('Lesen'),
                                ),
                                DropdownMenuItem(
                                  value: 'edit',
                                  child: Text('Bearbeiten'),
                                ),
                                DropdownMenuItem(
                                  value: 'admin',
                                  child: Text('Admin'),
                                ),
                              ],
                              onChanged: (value) => setDialog(
                                () =>
                                    memberRoles[user['id'] as String] = value!,
                              ),
                            )
                          : null,
                      onChanged: (value) => setDialog(() {
                        if (value == true) {
                          memberRoles[user['id'] as String] = 'read';
                        } else {
                          memberRoles.remove(user['id']);
                        }
                      }),
                    ),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(c, false),
              child: const Text('Abbrechen'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(c, true),
              child: const Text('Erstellen'),
            ),
          ],
        ),
      ),
    );
    if (ok == true && title.text.trim().isNotEmpty) {
      final response = await api.post<dynamic>(
        '/projects',
        data: {
          'title': title.text.trim(),
          'description': description.text.trim(),
          'category': category.text.trim(),
          'status': status,
          'members': memberRoles.entries
              .map((entry) => {'userId': entry.key, 'access': entry.value})
              .toList(),
          'initialChecklists': checklists
              .where((checklist) => checklist.title.text.trim().isNotEmpty)
              .map(
                (checklist) => {
                  'title': checklist.title.text.trim(),
                  'items': checklist.items
                      .map((item) => item.text.trim())
                      .where((item) => item.isNotEmpty)
                      .toList(),
                },
              )
              .toList(),
        },
      );
      await _load();
      if (mounted) await _open((response.data as Map)['id'] as String);
    }
    title.dispose();
    description.dispose();
    category.dispose();
    for (final checklist in checklists) {
      checklist.dispose();
    }
  }

  Future<void> _editProject() async {
    final project = selected;
    if (project == null || project['access'] != 'admin') return;
    final title = TextEditingController(text: project['title'] as String);
    final description = TextEditingController(
      text: project['description'] as String? ?? '',
    );
    final category = TextEditingController(
      text: project['category'] as String? ?? '',
    );
    var status = project['status'] as String? ?? 'active';
    final memberRoles = <String, String>{
      for (final raw in project['members'] as List? ?? const [])
        (raw as Map)['userId'] as String: raw['access'] as String,
    };
    final directory = await api.get<dynamic>(
      '/users/directory',
      queryParameters: {'pageSize': 50},
    );
    final users = ((directory.data as Map)['items'] as List? ?? [])
        .map((value) => Map<String, dynamic>.from(value as Map))
        .toList();
    for (final raw in project['members'] as List? ?? const []) {
      final member = Map<String, dynamic>.from(raw as Map);
      if (!users.any((user) => user['id'] == member['userId'])) {
        users.add({
          'id': member['userId'],
          'displayName': member['name'] ?? 'Projektmitglied',
        });
      }
    }
    if (!mounted) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => StatefulBuilder(
        builder: (c, setDialog) => AlertDialog(
          title: const Text('Projekt bearbeiten'),
          content: SizedBox(
            width: 540,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: title,
                    decoration: const InputDecoration(labelText: 'Titel'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: description,
                    decoration: const InputDecoration(
                      labelText: 'Beschreibung',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: category,
                    decoration: const InputDecoration(labelText: 'Kategorie'),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: status,
                    decoration: const InputDecoration(labelText: 'Status'),
                    items: const [
                      DropdownMenuItem(value: 'active', child: Text('Aktiv')),
                      DropdownMenuItem(
                        value: 'completed',
                        child: Text('Abgeschlossen'),
                      ),
                      DropdownMenuItem(
                        value: 'archived',
                        child: Text('Archiviert'),
                      ),
                    ],
                    onChanged: (value) => setDialog(() => status = value!),
                  ),
                  const SizedBox(height: 16),
                  const Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Teilnehmer und Zugriff',
                      style: TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ),
                  ...users.map((user) {
                    final isCreator = user['id'] == project['createdBy'];
                    return CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      value: memberRoles.containsKey(user['id']),
                      title: Text(
                        '${user['displayName']}${isCreator ? ' (Projektersteller)' : ''}',
                      ),
                      subtitle: memberRoles.containsKey(user['id'])
                          ? DropdownButton<String>(
                              value: memberRoles[user['id']],
                              items: const [
                                DropdownMenuItem(
                                  value: 'read',
                                  child: Text('Lesen'),
                                ),
                                DropdownMenuItem(
                                  value: 'edit',
                                  child: Text('Bearbeiten'),
                                ),
                                DropdownMenuItem(
                                  value: 'admin',
                                  child: Text('Admin'),
                                ),
                              ],
                              onChanged: isCreator
                                  ? null
                                  : (value) => setDialog(
                                      () => memberRoles[user['id'] as String] =
                                          value!,
                                    ),
                            )
                          : null,
                      onChanged: isCreator
                          ? null
                          : (value) => setDialog(() {
                              if (value == true) {
                                memberRoles[user['id'] as String] = 'read';
                              } else {
                                memberRoles.remove(user['id']);
                              }
                            }),
                    );
                  }),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(c, false),
              child: const Text('Abbrechen'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(c, true),
              child: const Text('Speichern'),
            ),
          ],
        ),
      ),
    );
    if (ok == true && title.text.trim().isNotEmpty) {
      try {
        await api.put(
          '/projects/${project['id']}',
          data: {
            'title': title.text.trim(),
            'description': description.text.trim(),
            'category': category.text.trim(),
            'status': status,
            'members': memberRoles.entries
                .map((entry) => {'userId': entry.key, 'access': entry.value})
                .toList(),
          },
        );
        await _open(project['id'] as String);
        await _load();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Teilnehmer und Rechte gespeichert.')),
          );
        }
      } on DioException catch (error) {
        final data = error.response?.data;
        final message = data is Map && data['message'] != null
            ? data['message'].toString()
            : 'Die Änderungen konnten nicht gespeichert werden.';
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(message), backgroundColor: Colors.red),
          );
        }
      }
    }
  }

  Future<void> _addChecklist() async {
    final p = selected;
    if (p == null) return;
    final title = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Checkliste erstellen'),
        content: TextField(
          controller: title,
          decoration: const InputDecoration(labelText: 'Titel'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text('Abbrechen'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(c, true),
            child: const Text('Erstellen'),
          ),
        ],
      ),
    );
    if (ok == true && title.text.trim().isNotEmpty) {
      await api.post(
        '/projects/${p['id']}/cards',
        data: {'type': 'checklist', 'title': title.text.trim()},
      );
      await _open(p['id'] as String);
    }
  }

  Future<void> _deleteProject() async {
    final p = selected;
    if (p == null) return;
    final ok =
        await showDialog<bool>(
          context: context,
          builder: (c) => AlertDialog(
            title: const Text('Projekt wirklich löschen?'),
            content: Text(
              'Das Projekt „${p['title']}“ und die dazugehörigen Inhalte werden entfernt.',
            ),
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
    if (!ok) return;
    await api.delete('/projects/${p['id']}');
    if (mounted) setState(() => selected = null);
    await _load();
  }

  Future<void> _deleteCard(Map<String, dynamic> card) async {
    final p = selected;
    if (p == null) return;
    final ok =
        await showDialog<bool>(
          context: context,
          builder: (c) => AlertDialog(
            title: const Text('Eintrag wirklich löschen?'),
            content: Text(
              '„${card['title']}“ und enthaltene Punkte werden entfernt.',
            ),
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
    if (!ok) return;
    await api.delete('/projects/${p['id']}/cards/${card['id']}');
    await _open(p['id'] as String);
  }

  Future<void> _addNote() async {
    final project = selected;
    if (project == null) return;
    final title = TextEditingController(text: 'Gemeinsame Notiz');
    final content = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Notiz erstellen'),
        content: SizedBox(
          width: 560,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: title,
                decoration: const InputDecoration(labelText: 'Titel'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: content,
                minLines: 5,
                maxLines: 12,
                decoration: const InputDecoration(
                  labelText: 'Notiz',
                  hintText: 'Hier können alle Projektmitglieder schreiben …',
                  alignLabelWithHint: true,
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text('Abbrechen'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(c, true),
            child: const Text('Erstellen'),
          ),
        ],
      ),
    );
    if (ok == true && title.text.trim().isNotEmpty) {
      await api.post(
        '/projects/${project['id']}/cards',
        data: {
          'type': 'note',
          'title': title.text.trim(),
          'content': content.text.trim(),
        },
      );
      await _open(project['id'] as String);
    }
    title.dispose();
    content.dispose();
  }

  Future<void> _editNote(Map<String, dynamic> card) async {
    final title = TextEditingController(text: card['title'] as String? ?? '');
    final content = TextEditingController(
      text: card['content'] as String? ?? '',
    );
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Notiz bearbeiten'),
        content: SizedBox(
          width: 560,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: title,
                decoration: const InputDecoration(labelText: 'Titel'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: content,
                minLines: 5,
                maxLines: 12,
                decoration: const InputDecoration(
                  labelText: 'Notiz',
                  alignLabelWithHint: true,
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text('Abbrechen'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(c, true),
            child: const Text('Speichern'),
          ),
        ],
      ),
    );
    if (ok == true && title.text.trim().isNotEmpty) {
      await api.put(
        '/projects/${selected!['id']}/cards/${card['id']}',
        data: {'title': title.text.trim(), 'content': content.text.trim()},
      );
      await _open(selected!['id'] as String);
    }
    title.dispose();
    content.dispose();
  }

  Future<void> _addItem(Map<String, dynamic> card) async {
    final text = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Checklistenpunkt'),
        content: TextField(
          controller: text,
          decoration: const InputDecoration(labelText: 'Aufgabe'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text('Abbrechen'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(c, true),
            child: const Text('Hinzufügen'),
          ),
        ],
      ),
    );
    if (ok == true && text.text.trim().isNotEmpty) {
      await api.post(
        '/projects/${selected!['id']}/cards/${card['id']}/items',
        data: {'text': text.text.trim()},
      );
      await _open(selected!['id'] as String);
    }
  }

  Future<void> _toggle(
    Map<String, dynamic> card,
    Map<String, dynamic> item,
  ) async {
    await api.patch(
      '/projects/${selected!['id']}/cards/${card['id']}/items/${item['id']}/toggle',
    );
    await _open(selected!['id'] as String);
  }

  Future<void> _editItem(
    Map<String, dynamic> card,
    Map<String, dynamic> item,
  ) async {
    final text = TextEditingController(text: item['text'] as String);
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Punkt bearbeiten'),
        content: TextField(controller: text),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text('Abbrechen'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(c, true),
            child: const Text('Speichern'),
          ),
        ],
      ),
    );
    if (ok == true && text.text.trim().isNotEmpty) {
      await api.put(
        '/projects/${selected!['id']}/cards/${card['id']}/items/${item['id']}',
        data: {'text': text.text.trim()},
      );
      await _open(selected!['id'] as String);
    }
  }

  Future<void> _deleteItem(
    Map<String, dynamic> card,
    Map<String, dynamic> item,
  ) async {
    await api.delete(
      '/projects/${selected!['id']}/cards/${card['id']}/items/${item['id']}',
    );
    await _open(selected!['id'] as String);
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    if (selected != null) return _detail(context);
    if (showCompleted) return _completedView(context);
    final palette = _ProjectPalette.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            if (projects.length > 1)
              TextButton.icon(
                onPressed: _resetOrder,
                icon: const Icon(Icons.restart_alt),
                label: const Text('Reihenfolge zurücksetzen'),
              ),
            const Spacer(),
            if (widget.canCreate)
              FilledButton.icon(
                onPressed: _create,
                icon: const Icon(Icons.add),
                label: const Text('Projekt erstellen'),
              ),
          ],
        ),
        const SizedBox(height: 16),
        if (projects.isEmpty)
          const Card(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Text('Du bist aktuell keinem Projekt zugeordnet.'),
            ),
          )
        else
          ReorderableListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            buildDefaultDragHandles: false,
            itemCount: projects.length,
            onReorderItem: _reorderProjects,
            itemBuilder: (context, index) {
              final p = Map<String, dynamic>.from(projects[index] as Map);
              return _ProjectTile(
                key: ValueKey(p['id']),
                project: p,
                palette: palette,
                index: index,
                lastIndex: projects.length - 1,
                onOpen: () => _open(p['id'] as String),
                onMove: (delta) => _moveProject(index, delta),
              );
            },
          ),
        const SizedBox(height: 20),
        Align(
          alignment: Alignment.bottomRight,
          child: FilledButton.tonalIcon(
            onPressed: () => setState(() => showCompleted = true),
            style: FilledButton.styleFrom(
              backgroundColor: palette.background,
              foregroundColor: palette.accent,
              side: BorderSide(color: palette.border),
            ),
            icon: const Icon(Icons.inventory_2_outlined),
            label: Text(
              completedProjects.isEmpty
                  ? 'Abgeschlossene Projekte'
                  : 'Abgeschlossene Projekte (${completedProjects.length})',
            ),
          ),
        ),
      ],
    );
  }

  Widget _completedView(BuildContext context) {
    final palette = _ProjectPalette.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            onPressed: () => setState(() => showCompleted = false),
            icon: const Icon(Icons.arrow_back),
            label: const Text('Aktive Projekte'),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Abgeschlossene Projekte',
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: 16),
        if (completedProjects.isEmpty)
          const Card(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Text('Es gibt noch keine abgeschlossenen Projekte.'),
            ),
          ),
        ...completedProjects.map((raw) {
          final p = Map<String, dynamic>.from(raw as Map);
          final members = p['members'] as String?;
          return Card(
            margin: const EdgeInsets.only(bottom: 12),
            color: palette.background,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
              side: BorderSide(color: palette.border, width: 1.4),
            ),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.task_alt, color: palette.accent),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          p['title'] as String,
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                      ),
                      _statusBadge(p['status'] as String, palette),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Abgeschlossen am: ${_formatDate(p['completedAt'] as String?)}',
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Verantwortlich: ${members == null || members.isEmpty ? 'Keine zugewiesen' : members}',
                  ),
                  const SizedBox(height: 14),
                  Wrap(
                    spacing: 10,
                    children: [
                      OutlinedButton.icon(
                        onPressed: () => _open(p['id'] as String),
                        icon: const Icon(Icons.open_in_new),
                        label: const Text('Öffnen'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        }),
      ],
    );
  }

  Widget _detail(BuildContext context) {
    final p = selected!, editable = p['access'] != 'read';
    final cards = (p['cards'] as List? ?? []).map(
      (x) => Map<String, dynamic>.from(x as Map),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            onPressed: () => setState(() => selected = null),
            icon: const Icon(Icons.arrow_back),
            label: const Text('Alle Projekte'),
          ),
        ),
        Text(
          p['title'] as String,
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        Text(p['description'] as String? ?? ''),
        if (p['access'] == 'admin') ...[
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerLeft,
            child: Wrap(
              spacing: 10,
              children: [
                OutlinedButton.icon(
                  onPressed: _editProject,
                  icon: const Icon(Icons.edit_outlined),
                  label: const Text(
                    'Projekt, Teilnehmer und Rechte bearbeiten',
                  ),
                ),
                OutlinedButton.icon(
                  onPressed: _deleteProject,
                  icon: const Icon(Icons.delete_outline),
                  label: const Text('Projekt löschen'),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 16),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            if (editable)
              FilledButton.icon(
                onPressed: _addChecklist,
                icon: const Icon(Icons.checklist),
                label: const Text('Checkliste erstellen'),
              ),
            OutlinedButton.icon(
              onPressed: _addNote,
              icon: const Icon(Icons.note_add_outlined),
              label: const Text('Notiz erstellen'),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Wrap(
          spacing: 16,
          runSpacing: 16,
          children: cards
              .map(
                (card) => SizedBox(
                  width: 360,
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(18),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            card['title'] as String,
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          if (p['access'] == 'admin')
                            Align(
                              alignment: Alignment.centerRight,
                              child: IconButton(
                                tooltip: 'Eintrag löschen',
                                onPressed: () => _deleteCard(card),
                                icon: const Icon(Icons.delete_outline),
                              ),
                            ),
                          if (card['type'] == 'note') ...[
                            const SizedBox(height: 10),
                            SelectableText(
                              (card['content'] as String?)?.trim().isNotEmpty ==
                                      true
                                  ? card['content'] as String
                                  : 'Noch kein Text vorhanden.',
                            ),
                            const SizedBox(height: 10),
                            TextButton.icon(
                              onPressed: () => _editNote(card),
                              icon: const Icon(Icons.edit_note),
                              label: const Text('Notiz bearbeiten'),
                            ),
                          ],
                          if (card['type'] == 'checklist')
                            ...(card['items'] as List? ?? []).map((raw) {
                              final item = Map<String, dynamic>.from(
                                raw as Map,
                              );
                              return CheckboxListTile(
                                contentPadding: EdgeInsets.zero,
                                value: item['completed'] as bool? ?? false,
                                title: Text(item['text'] as String),
                                secondary: editable
                                    ? PopupMenuButton<String>(
                                        onSelected: (value) => value == 'edit'
                                            ? _editItem(card, item)
                                            : _deleteItem(card, item),
                                        itemBuilder: (_) => const [
                                          PopupMenuItem(
                                            value: 'edit',
                                            child: Text('Bearbeiten'),
                                          ),
                                          PopupMenuItem(
                                            value: 'delete',
                                            child: Text('Löschen'),
                                          ),
                                        ],
                                      )
                                    : null,
                                onChanged: editable
                                    ? (_) => _toggle(card, item)
                                    : null,
                              );
                            }),
                          if (editable && card['type'] == 'checklist')
                            TextButton.icon(
                              onPressed: () => _addItem(card),
                              icon: const Icon(Icons.add),
                              label: const Text('Punkt hinzufügen'),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
              )
              .toList(),
        ),
        const SizedBox(height: 24),
        Text('Aktivitäten', style: Theme.of(context).textTheme.titleLarge),
        ...(p['activities'] as List? ?? []).map(
          (a) => ListTile(
            dense: true,
            leading: const Icon(Icons.history),
            title: Text((a as Map)['description'] as String),
          ),
        ),
      ],
    );
  }
}

// One draggable row in the active project list. The default reorder handle
// (mouse drag on desktop/web, long-press-drag on touch) is provided by
// ReorderableListView itself; the up/down buttons are a keyboard- and
// screen-reader-operable alternative to dragging (see requirement to keep
// reordering accessible without a pointer).
class _ProjectTile extends StatelessWidget {
  const _ProjectTile({
    required super.key,
    required this.project,
    required this.palette,
    required this.index,
    required this.lastIndex,
    required this.onOpen,
    required this.onMove,
  });

  final Map<String, dynamic> project;
  final _ProjectPalette palette;
  final int index;
  final int lastIndex;
  final VoidCallback onOpen;
  final void Function(int delta) onMove;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: Card(
      color: palette.background,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: palette.border, width: 1.4),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onOpen,
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.dashboard_customize_outlined, color: palette.accent),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      project['title'] as String,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    Text(
                      project['description'] as String? ?? 'Keine Beschreibung',
                    ),
                    const SizedBox(height: 10),
                    _statusBadge(project['status'] as String, palette),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    tooltip: 'Nach oben verschieben',
                    onPressed: index == 0 ? null : () => onMove(-1),
                    icon: const Icon(Icons.keyboard_arrow_up),
                  ),
                  IconButton(
                    tooltip: 'Nach unten verschieben',
                    onPressed: index == lastIndex ? null : () => onMove(1),
                    icon: const Icon(Icons.keyboard_arrow_down),
                  ),
                ],
              ),
              ReorderableDragStartListener(
                index: index,
                child: Padding(
                  padding: const EdgeInsets.only(left: 4, top: 8),
                  child: Icon(Icons.drag_handle, color: palette.accent),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

// Pure list move used by both drag-and-drop (onReorderItem, newIndex already
// adjusted for the removed item) and the up/down buttons, kept separate from
// State so it can be unit tested without pumping a widget tree.
List<T> reorderedList<T>(List<T> list, int oldIndex, int newIndex) {
  final copy = [...list];
  final moved = copy.removeAt(oldIndex);
  copy.insert(newIndex, moved);
  return copy;
}

Widget _statusBadge(String status, _ProjectPalette palette) => Container(
  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
  decoration: BoxDecoration(
    color: palette.badgeBackground,
    borderRadius: BorderRadius.circular(10),
  ),
  child: Text(
    _statusLabel(status),
    style: TextStyle(
      color: palette.badgeForeground,
      fontWeight: FontWeight.w700,
      fontSize: 13,
    ),
  ),
);

String _statusLabel(String status) =>
    {
      'active': 'Aktiv',
      'completed': 'Abgeschlossen',
      'archived': 'Archiviert',
    }[status] ??
    status;

String _formatDate(String? iso) {
  if (iso == null) return '–';
  final date = DateTime.tryParse(iso);
  if (date == null) return '–';
  return '${date.day.toString().padLeft(2, '0')}.'
      '${date.month.toString().padLeft(2, '0')}.'
      '${date.year}';
}

// The blue highlight for project cards, tuned separately for light and dark
// mode so the cards stay clearly distinguishable from the page background
// and readable in both, matching MyJudo's existing blue accent palette
// (see app.dart's ColorScheme / HomeCalendarSummary's card styling).
class _ProjectPalette {
  const _ProjectPalette({
    required this.background,
    required this.border,
    required this.accent,
    required this.badgeBackground,
    required this.badgeForeground,
  });

  final Color background;
  final Color border;
  final Color accent;
  final Color badgeBackground;
  final Color badgeForeground;

  static _ProjectPalette of(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return dark
        ? const _ProjectPalette(
            background: Color(0xFF15334C),
            border: Color(0xFF2E6690),
            accent: Color(0xFF7CC4F2),
            badgeBackground: Color(0xFF9FD3F5),
            badgeForeground: Color(0xFF06253B),
          )
        : const _ProjectPalette(
            background: Color(0xFFD7EAF9),
            border: Color(0xFF7FB8E0),
            accent: Color(0xFF0B4F8A),
            badgeBackground: Colors.white,
            badgeForeground: Color(0xFF0B4F8A),
          );
  }
}
