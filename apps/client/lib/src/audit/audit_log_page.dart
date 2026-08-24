import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../config/app_config.dart';

class AuditLogPage extends StatefulWidget {
  const AuditLogPage({required this.accessToken, super.key});
  final String accessToken;

  @override
  State<AuditLogPage> createState() => _AuditLogPageState();
}

class _AuditLogPageState extends State<AuditLogPage> {
  late final Dio _dio = Dio(
    BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      headers: {'Authorization': 'Bearer ${widget.accessToken}'},
    ),
  );
  final _search = TextEditingController();
  List<_AuditEntry> _items = const [];
  bool _loading = true;
  String? _error;
  String? _area;
  String? _action;
  String? _actorUserId;
  DateTime? _from;
  DateTime? _until;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    _dio.close();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final response = await _dio.get<dynamic>(
        '/audit-logs',
        queryParameters: {
          if (_search.text.trim().isNotEmpty) 'search': _search.text.trim(),
          if (_area != null) 'area': _area,
          if (_action != null) 'action': _action,
          if (_actorUserId != null) 'actorUserId': _actorUserId,
          if (_from != null) 'from': _from!.toUtc().toIso8601String(),
          if (_until != null)
            'until': DateTime(
              _until!.year,
              _until!.month,
              _until!.day + 1,
            ).toUtc().toIso8601String(),
          'limit': 250,
        },
      );
      final values = (response.data as List<dynamic>)
          .whereType<Map>()
          .map((row) => _AuditEntry.fromJson(Map<String, dynamic>.from(row)))
          .toList();
      if (mounted) setState(() => _items = values);
    } on Object {
      if (mounted) setState(() => _error = 'Die Systemlogs konnten nicht geladen werden.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _date(bool start) async {
    final value = await showDatePicker(
      context: context,
      initialDate: (start ? _from : _until) ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime(2200),
    );
    if (value == null) return;
    setState(() => start ? _from = value : _until = value);
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final areas = _items.map((item) => item.area).toSet().toList()..sort();
    final actions = _items.map((item) => item.action).toSet().toList()..sort();
    final actors = <String, String>{
      for (final item in _items)
        if (item.actorUserId != null) item.actorUserId!: item.actorName,
    };
    return Card(
      key: const Key('audit-log-section'),
      child: Padding(
        padding: const EdgeInsets.all(22),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Logs', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 6),
            const Text(
              'Manipulationsarme Systemhistorie. Einträge können weder bearbeitet noch gelöscht werden.',
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                SizedBox(
                  width: 260,
                  child: TextField(
                    controller: _search,
                    onSubmitted: (_) => _load(),
                    decoration: InputDecoration(
                      labelText: 'Logs durchsuchen',
                      suffixIcon: IconButton(onPressed: _load, icon: const Icon(Icons.search)),
                    ),
                  ),
                ),
                _filter('Bereich', _area, areas, (value) { setState(() => _area = value); _load(); }),
                _filter('Aktion', _action, actions, (value) { setState(() => _action = value); _load(); }),
                _filter(
                  'Benutzer',
                  _actorUserId,
                  actors.keys.toList(),
                  (value) { setState(() => _actorUserId = value); _load(); },
                  labels: actors,
                ),
                OutlinedButton.icon(
                  onPressed: () => _date(true),
                  icon: const Icon(Icons.date_range),
                  label: Text(_from == null ? 'Von' : _dateText(_from!)),
                ),
                OutlinedButton.icon(
                  onPressed: () => _date(false),
                  icon: const Icon(Icons.event),
                  label: Text(_until == null ? 'Bis' : _dateText(_until!)),
                ),
                if (_area != null || _action != null || _actorUserId != null || _from != null || _until != null || _search.text.isNotEmpty)
                  TextButton(
                    onPressed: () {
                      setState(() { _area = null; _action = null; _actorUserId = null; _from = null; _until = null; _search.clear(); });
                      _load();
                    },
                    child: const Text('Filter zurücksetzen'),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            if (_loading)
              const LinearProgressIndicator()
            else if (_error != null)
              Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error))
            else if (_items.isEmpty)
              const Text('Keine passenden Log-Einträge vorhanden.')
            else
              ..._items.map(
                (item) => ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.history),
                  title: Text('${_actionLabel(item.action)} · ${item.actorName}'),
                  subtitle: Text(
                    '${_dateTime(item.createdAt)} · ${_areaLabel(item.area)}${item.description == null ? '' : '\n${item.description}'}${item.entityId == null ? '' : '\nReferenz: ${item.entityId}'}',
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _filter(
    String label,
    String? value,
    List<String> values,
    ValueChanged<String?> changed, {
    Map<String, String> labels = const {},
  }) => SizedBox(
    width: 190,
    child: DropdownButtonFormField<String>(
      initialValue: values.contains(value) ? value : null,
      decoration: InputDecoration(labelText: label),
      items: [
        const DropdownMenuItem(value: null, child: Text('Alle')),
        ...values.map((item) => DropdownMenuItem(value: item, child: Text(labels[item] ?? item))),
      ],
      onChanged: changed,
    ),
  );
}

class _AuditEntry {
  const _AuditEntry({required this.id, required this.createdAt, required this.actorName, required this.action, required this.area, this.actorUserId, this.entityId, this.description});
  factory _AuditEntry.fromJson(Map<String, dynamic> json) {
    final metadata = json['metadata'] is Map ? Map<String, dynamic>.from(json['metadata'] as Map) : const <String, dynamic>{};
    final description = metadata['description'] ?? metadata['title'] ?? metadata['name'] ?? metadata['fileName'];
    return _AuditEntry(id: json['id'] as String, createdAt: DateTime.parse(json['createdAt'] as String).toLocal(), actorName: json['actorName'] as String? ?? 'System', actorUserId: json['actorUserId'] as String?, action: json['action'] as String, area: json['entityType'] as String, entityId: json['entityId'] as String?, description: description?.toString());
  }
  final String id, actorName, action, area;
  final String? actorUserId, entityId, description;
  final DateTime createdAt;
}

String _dateText(DateTime value) => '${value.day.toString().padLeft(2, '0')}.${value.month.toString().padLeft(2, '0')}.${value.year}';
String _dateTime(DateTime value) => '${_dateText(value)} – ${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';
String _actionLabel(String value) => value.split('.').map((part) => part.isEmpty ? part : '${part[0].toUpperCase()}${part.substring(1)}').join(' ');
String _areaLabel(String value) => value.replaceAll('_', ' ');
