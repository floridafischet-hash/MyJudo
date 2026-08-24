import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../config/app_config.dart';
import '../common/avatar.dart';
import '../common/color_palette.dart';

class UserManagementPage extends StatefulWidget {
  const UserManagementPage({
    required this.accessToken,
    this.embedded = false,
    super.key,
  });
  final String accessToken;
  final bool embedded;
  @override
  State<UserManagementPage> createState() => _UserManagementPageState();
}

class _UserManagementPageState extends State<UserManagementPage> {
  late final Dio api = Dio(
    BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      headers: {'Authorization': 'Bearer ${widget.accessToken}'},
    ),
  );
  List<Map<String, dynamic>> users = [], groups = [], roles = [];
  bool loading = true;
  String? error;
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final result = await Future.wait([
        api.get<List<dynamic>>('/users/admin'),
        api.get<List<dynamic>>('/training/admin/groups'),
        api.get<List<dynamic>>('/roles'),
      ]);
      if (!mounted) return;
      setState(() {
        users = _maps(result[0].data);
        groups = _maps(result[1].data);
        roles = _maps(result[2].data);
        loading = false;
      });
    } on DioException catch (e) {
      if (mounted) {
        setState(() {
          error = _message(e);
          loading = false;
        });
      }
    }
  }

  List<Map<String, dynamic>> _maps(List<dynamic>? value) =>
      (value ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
  Future<void> _uploadAvatar(
    String id,
    Uint8List bytes,
    String filename,
  ) async {
    final data = FormData.fromMap({
      'avatar': MultipartFile.fromBytes(bytes, filename: filename),
    });
    await api.post('/users/admin/$id/avatar', data: data);
    await _load();
  }

  Future<void> _deleteAvatar(String id) async {
    await api.delete('/users/admin/$id/avatar');
    await _load();
  }

  Future<void> _edit([Map<String, dynamic>? user]) async {
    final data = await showDialog<Map<String, dynamic>>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _UserDialog(
        user: user,
        groups: groups,
        roles: roles,
        accessToken: widget.accessToken,
        onUploadAvatar: _uploadAvatar,
        onDeleteAvatar: _deleteAvatar,
      ),
    );
    if (data == null) return;
    try {
      await api.request(
        '/users/admin${user == null ? '' : '/${user['id']}'}',
        data: data,
        options: Options(method: user == null ? 'POST' : 'PUT'),
      );
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Benutzer wurde gespeichert.')),
        );
      }
    } on DioException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(_message(e))));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    if (error != null) {
      return Center(
        child: FilledButton.tonal(
          onPressed: _load,
          child: Text('$error – erneut versuchen'),
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Benutzerverwaltung',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
            ),
            FilledButton.icon(
              onPressed: () => _edit(),
              icon: const Icon(Icons.person_add_alt_1),
              label: const Text('Benutzer anlegen'),
            ),
          ],
        ),
        const SizedBox(height: 16),
        ListView.builder(
          shrinkWrap: widget.embedded,
          physics: widget.embedded
              ? const NeverScrollableScrollPhysics()
              : null,
          itemCount: users.length,
          itemBuilder: (_, i) {
            final u = users[i];
            final gs = _maps(u['groups'] as List?);
            final rs = _maps(u['roles'] as List?);
            return Card(
              child: ListTile(
                leading: AvatarImage(
                  url: u['avatarStoredName'] != null
                      ? '/api/v1/users/${u['id']}/avatar'
                      : null,
                  accessToken: widget.accessToken,
                  radius: 20,
                  fallback: CircleAvatar(
                    backgroundColor: parseHexColor(u['color'] as String?),
                    child: const Icon(Icons.person, color: Colors.white),
                  ),
                ),
                title: Text('${u['firstName']} ${u['lastName']}'),
                subtitle: Text(
                  '@${u['username']} · ${u['email']}\n${gs.map((g) => g['name']).join(', ')} · ${rs.map((r) => r['name']).join(', ')} · ${u['status']}',
                ),
                isThreeLine: true,
                trailing: IconButton(
                  tooltip: 'Bearbeiten',
                  onPressed: () => _edit(u),
                  icon: const Icon(Icons.edit_outlined),
                ),
              ),
            );
          },
        ),
      ],
    );
  }

  String _message(DioException e) {
    final d = e.response?.data;
    if (d is Map && d['message'] != null) {
      return d['message'] is List
          ? (d['message'] as List).join(', ')
          : d['message'].toString();
    }
    return 'Benutzerdaten konnten nicht gespeichert werden.';
  }
}

class _UserDialog extends StatefulWidget {
  const _UserDialog({
    required this.user,
    required this.groups,
    required this.roles,
    required this.accessToken,
    required this.onUploadAvatar,
    required this.onDeleteAvatar,
  });
  final Map<String, dynamic>? user;
  final List<Map<String, dynamic>> groups, roles;
  final String accessToken;
  final Future<void> Function(String id, Uint8List bytes, String filename)
  onUploadAvatar;
  final Future<void> Function(String id) onDeleteAvatar;
  @override
  State<_UserDialog> createState() => _UserDialogState();
}

class _UserDialogState extends State<_UserDialog> {
  late bool hasAvatar = widget.user?['avatarStoredName'] != null;
  String? get _avatarUrl =>
      hasAvatar ? '/api/v1/users/${widget.user!['id']}/avatar' : null;
  late final first = TextEditingController(
        text: widget.user?['firstName']?.toString() ?? '',
      ),
      last = TextEditingController(
        text: widget.user?['lastName']?.toString() ?? '',
      ),
      username = TextEditingController(
        text: widget.user?['username']?.toString() ?? '',
      ),
      email = TextEditingController(
        text: widget.user?['email']?.toString() ?? '',
      ),
      password = TextEditingController();
  late String status = widget.user?['status']?.toString() ?? 'approved';
  late String color =
      widget.user?['color']?.toString() ?? kCalendarColorPalette.first;
  late final Set<String> selectedGroups = _ids(widget.user?['groups']);
  late final Set<String> selectedRoles = _ids(widget.user?['roles']);
  Set<String> _ids(dynamic list) =>
      (list as List? ?? []).map((e) => (e as Map)['id'].toString()).toSet();
  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(
      widget.user == null ? 'Benutzer anlegen' : 'Benutzer bearbeiten',
    ),
    content: SizedBox(
      width: 560,
      child: ListView(
        shrinkWrap: true,
        children: [
          Row(
            children: [
              Expanded(child: _field(first, 'Vorname')),
              const SizedBox(width: 10),
              Expanded(child: _field(last, 'Nachname')),
            ],
          ),
          const SizedBox(height: 10),
          _field(username, 'Benutzername'),
          const SizedBox(height: 10),
          _field(email, 'E-Mail-Adresse', type: TextInputType.emailAddress),
          const SizedBox(height: 10),
          _field(
            password,
            widget.user == null
                ? 'Initialpasswort'
                : 'Neues Passwort (optional)',
            secret: true,
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            initialValue: status,
            decoration: const InputDecoration(labelText: 'Status'),
            items: const [
              DropdownMenuItem(value: 'approved', child: Text('Aktiv')),
              DropdownMenuItem(value: 'pending', child: Text('Ausstehend')),
              DropdownMenuItem(value: 'suspended', child: Text('Gesperrt')),
              DropdownMenuItem(value: 'archived', child: Text('Archiviert')),
            ],
            onChanged: (v) => setState(() => status = v!),
          ),
          const SizedBox(height: 14),
          const Text(
            'Kalenderfarbe',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          ColorSwatchPicker(
            value: color,
            onChanged: (v) => setState(() => color = v),
          ),
          if (widget.user != null) ...[
            const SizedBox(height: 14),
            const Text('Bild', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            AvatarPicker(
              url: _avatarUrl,
              accessToken: widget.accessToken,
              radius: 28,
              fallback: CircleAvatar(
                radius: 28,
                backgroundColor: parseHexColor(color),
              ),
              onUpload: (bytes, filename) async {
                await widget.onUploadAvatar(
                  widget.user!['id'].toString(),
                  bytes,
                  filename,
                );
                if (mounted) setState(() => hasAvatar = true);
              },
              onDelete: () async {
                await widget.onDeleteAvatar(widget.user!['id'].toString());
                if (mounted) setState(() => hasAvatar = false);
              },
            ),
          ],
          const SizedBox(height: 14),
          const Text(
            'Rolle / Berechtigungen',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          ...widget.roles.map(
            (r) => CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              value: selectedRoles.contains(r['id']),
              title: Text(r['name'].toString()),
              onChanged: (v) => setState(
                () => v == true
                    ? selectedRoles.add(r['id'])
                    : selectedRoles.remove(r['id']),
              ),
            ),
          ),
          const Text('Gruppen', style: TextStyle(fontWeight: FontWeight.bold)),
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            tristate:
                selectedGroups.isNotEmpty &&
                selectedGroups.length != widget.groups.length,
            value: selectedGroups.length == widget.groups.length,
            title: const Text(
              'Alle Gruppen auswählen',
              style: TextStyle(fontWeight: FontWeight.w800),
            ),
            onChanged: (value) => setState(() {
              selectedGroups.clear();
              if (value == true) {
                selectedGroups.addAll(
                  widget.groups.map((g) => g['id'].toString()),
                );
              }
            }),
          ),
          ...widget.groups.map(
            (g) => CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              value: selectedGroups.contains(g['id']),
              title: Text(g['name'].toString()),
              onChanged: (v) => setState(
                () => v == true
                    ? selectedGroups.add(g['id'])
                    : selectedGroups.remove(g['id']),
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
        onPressed: _valid
            ? () => Navigator.pop(context, {
                'firstName': first.text.trim(),
                'lastName': last.text.trim(),
                'username': username.text.trim(),
                'email': email.text.trim(),
                if (password.text.isNotEmpty) 'password': password.text,
                'status': status,
                'color': color,
                'roleIds': selectedRoles.toList(),
                'groupIds': selectedGroups.toList()..sort(),
              })
            : null,
        child: const Text('Speichern'),
      ),
    ],
  );
  Widget _field(
    TextEditingController c,
    String label, {
    bool secret = false,
    TextInputType? type,
  }) => TextField(
    controller: c,
    obscureText: secret,
    keyboardType: type,
    onChanged: (_) => setState(() {}),
    style: const TextStyle(color: Colors.black),
    decoration: InputDecoration(labelText: label),
  );
  bool get _valid =>
      first.text.trim().isNotEmpty &&
      last.text.trim().isNotEmpty &&
      username.text.trim().length >= 3 &&
      email.text.contains('@') &&
      (widget.user != null || password.text.isNotEmpty) &&
      selectedRoles.isNotEmpty;
}
