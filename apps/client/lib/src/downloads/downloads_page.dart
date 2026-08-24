import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import '../config/app_config.dart';
import 'download_file.dart';

class DownloadsPage extends StatefulWidget {
  const DownloadsPage({required this.token, required this.admin, super.key});
  final String token;
  final bool admin;
  @override
  State<DownloadsPage> createState() => _DownloadsPageState();
}

class _DownloadsPageState extends State<DownloadsPage> {
  late final Dio api = Dio(
    BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      headers: {'Authorization': 'Bearer ${widget.token}'},
    ),
  );
  List<dynamic> items = [];
  bool loading = true;
  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    api.close();
    super.dispose();
  }

  Future<void> load() async {
    final r = await api.get<List<dynamic>>(
      widget.admin ? '/downloads/admin/all' : '/downloads',
    );
    if (mounted) {
      setState(() {
        items = r.data ?? [];
        loading = false;
      });
    }
  }

  Future<void> download(Map<dynamic, dynamic> d) async {
    final r = await api.get<List<int>>(
      '/downloads/${d['id']}/file',
      options: Options(responseType: ResponseType.bytes),
    );
    saveDownload(r.data!, d['originalName'] as String, d['mimeType'] as String);
  }

  Future<void> preview(Map<dynamic, dynamic> d) async {
    final mime = d['mimeType'] as String;
    final isImage = mime.startsWith('image/');
    final isPdf = mime == 'application/pdf';
    if (!isImage && !isPdf) return;
    final r = await api.get<List<int>>(
      '/downloads/${d['id']}/file',
      options: Options(responseType: ResponseType.bytes),
    );
    if (!mounted) return;
    if (isImage) {
      final bytes = Uint8List.fromList(r.data!);
      await showDialog<void>(
        context: context,
        builder: (ctx) => Dialog(
          child: Stack(
            children: [
              InteractiveViewer(child: Image.memory(bytes)),
              Positioned(
                top: 8,
                right: 8,
                child: IconButton.filled(
                  onPressed: () => Navigator.pop(ctx),
                  icon: const Icon(Icons.close),
                ),
              ),
            ],
          ),
        ),
      );
    } else {
      // PDF: open blob URL in new browser tab
      final url = openBlobPreview(r.data!, mime);
      // Revoke after a short delay so the tab has time to load it
      Future.delayed(const Duration(seconds: 30), () => revokeBlobUrl(url));
    }
  }

  Future<void> upload([Map<dynamic, dynamic>? existing]) async {
    final picked = await FilePicker.pickFiles(
      withData: true,
      type: FileType.custom,
      allowedExtensions: ['pdf', 'png', 'jpg', 'jpeg', 'docx', 'xlsx'],
    );
    if (picked == null || !mounted) return;
    final title = TextEditingController(
      text: existing?['title'] as String? ?? picked.files.single.name,
    );
    final description = TextEditingController(
      text: existing?['description'] as String? ?? '',
    );
    var selectedCategory = existing?['category'] as String? ?? 'graduation';
    final optionsResponse = await api.get<dynamic>('/downloads/admin/options');
    if (!mounted) return;
    final accessOptions = Map<String, dynamic>.from(
      optionsResponse.data as Map,
    );
    var availableToAll = existing?['availableToAll'] as bool? ?? true;
    final groupIds = Set<String>.from(
      existing?['groupIds'] as List? ?? const [],
    );
    final roleIds = Set<String>.from(existing?['roleIds'] as List? ?? const []);
    final userIds = Set<String>.from(existing?['userIds'] as List? ?? const []);
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => StatefulBuilder(
        builder: (c, setDialog) => AlertDialog(
          title: Text(
            existing == null ? 'Dokument hochladen' : 'Datei ersetzen',
          ),
          content: SizedBox(
            width: 560,
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
                  DropdownButtonFormField<String>(
                    initialValue: selectedCategory,
                    decoration: const InputDecoration(labelText: 'Kategorie'),
                    items:
                        const {
                              'graduation': 'Graduierungsübersichten',
                              'club': 'Vereinsdokumente',
                              'training': 'Trainingsunterlagen',
                              'form': 'Formulare',
                              'other': 'Sonstiges',
                            }.entries
                            .map(
                              (e) => DropdownMenuItem(
                                value: e.key,
                                child: Text(e.value),
                              ),
                            )
                            .toList(),
                    onChanged: (v) => setDialog(() => selectedCategory = v!),
                  ),
                  const SizedBox(height: 12),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Für alle Benutzer freigeben'),
                    value: availableToAll,
                    onChanged: (value) =>
                        setDialog(() => availableToAll = value),
                  ),
                  if (!availableToAll) ...[
                    _AccessChoices(
                      title: 'Gruppen',
                      options: accessOptions['groups'] as List? ?? const [],
                      selected: groupIds,
                      labelKey: 'name',
                      onChanged: setDialog,
                    ),
                    _AccessChoices(
                      title: 'Rollen',
                      options: accessOptions['roles'] as List? ?? const [],
                      selected: roleIds,
                      labelKey: 'name',
                      onChanged: setDialog,
                    ),
                    _AccessChoices(
                      title: 'Einzelne Benutzer',
                      options: accessOptions['users'] as List? ?? const [],
                      selected: userIds,
                      labelKey: 'name',
                      onChanged: setDialog,
                    ),
                  ],
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
              child: const Text('Hochladen'),
            ),
          ],
        ),
      ),
    );
    if (ok == true) {
      final f = picked.files.single;
      await api.request(
        existing == null
            ? '/downloads/admin'
            : '/downloads/admin/${existing['id']}',
        data: FormData.fromMap({
          'title': title.text,
          'description': description.text,
          'category': selectedCategory,
          'availableToAll': '$availableToAll',
          'active': 'true',
          'groupIds': jsonEncode(groupIds.toList()),
          'roleIds': jsonEncode(roleIds.toList()),
          'userIds': jsonEncode(userIds.toList()),
          'file': MultipartFile.fromBytes(f.bytes!, filename: f.name),
        }),
        options: Options(method: existing == null ? 'POST' : 'PUT'),
      );
      await load();
    }
  }

  Future<void> setActive(Map<dynamic, dynamic> d, bool active) async {
    await api.put(
      '/downloads/admin/${d['id']}',
      data: FormData.fromMap({
        'title': d['title'],
        'description': d['description'] ?? '',
        'category': d['category'],
        'availableToAll': '${d['availableToAll'] ?? true}',
        'active': '$active',
        'groupIds': jsonEncode(d['groupIds'] as List? ?? const []),
        'roleIds': jsonEncode(d['roleIds'] as List? ?? const []),
        'userIds': jsonEncode(d['userIds'] as List? ?? const []),
      }),
    );
    await load();
  }

  Future<void> remove(Map<dynamic, dynamic> d) async {
    await api.delete('/downloads/admin/${d['id']}');
    await load();
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.admin)
          Align(
            alignment: Alignment.centerRight,
            child: FilledButton.icon(
              onPressed: upload,
              icon: const Icon(Icons.upload_file),
              label: const Text('Datei hochladen'),
            ),
          ),
        const SizedBox(height: 16),
        if (items.isEmpty)
          const Card(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Text('Keine freigegebenen Downloads vorhanden.'),
            ),
          ),
        ...items.map((raw) {
          final d = raw as Map<dynamic, dynamic>;
          return Card(
            child: ListTile(
              leading: const Icon(Icons.description_outlined),
              title: Text(d['title'] as String),
              subtitle: Text(
                d['description'] as String? ??
                    category(d['category'] as String),
              ),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _PreviewButton(
                    mime: d['mimeType'] as String,
                    onTap: () => preview(d),
                  ),
                  IconButton(
                    onPressed: () => download(d),
                    icon: const Icon(Icons.download),
                    tooltip: 'Herunterladen',
                  ),
                  if (widget.admin)
                    PopupMenuButton<String>(
                      onSelected: (v) {
                        if (v == 'replace') upload(d);
                        if (v == 'toggle') setActive(d, !(d['active'] as bool));
                        if (v == 'delete') remove(d);
                      },
                      itemBuilder: (_) => [
                        const PopupMenuItem(
                          value: 'replace',
                          child: Text('Datei ersetzen'),
                        ),
                        PopupMenuItem(
                          value: 'toggle',
                          child: Text(
                            (d['active'] as bool)
                                ? 'Deaktivieren'
                                : 'Aktivieren',
                          ),
                        ),
                        const PopupMenuItem(
                          value: 'delete',
                          child: Text('Löschen'),
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
}

class _AccessChoices extends StatelessWidget {
  const _AccessChoices({
    required this.title,
    required this.options,
    required this.selected,
    required this.labelKey,
    required this.onChanged,
  });

  final String title;
  final List<dynamic> options;
  final Set<String> selected;
  final String labelKey;
  final StateSetter onChanged;

  @override
  Widget build(BuildContext context) => ExpansionTile(
    tilePadding: EdgeInsets.zero,
    title: Text('$title (${selected.length})'),
    children: options.map((raw) {
      final option = Map<String, dynamic>.from(raw as Map);
      final id = option['id'] as String;
      return CheckboxListTile(
        dense: true,
        contentPadding: EdgeInsets.zero,
        value: selected.contains(id),
        title: Text(option[labelKey] as String),
        onChanged: (checked) => onChanged(() {
          checked == true ? selected.add(id) : selected.remove(id);
        }),
      );
    }).toList(),
  );
}

class _PreviewButton extends StatelessWidget {
  const _PreviewButton({required this.mime, required this.onTap});
  final String mime;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final supported = mime.startsWith('image/') || mime == 'application/pdf';
    return IconButton(
      onPressed: supported ? onTap : null,
      icon: const Icon(Icons.visibility_outlined),
      tooltip: supported ? 'Vorschau' : 'Keine Vorschau verfügbar',
    );
  }
}

String category(String value) =>
    {
      'graduation': 'Graduierungsübersichten',
      'club': 'Vereinsdokumente',
      'training': 'Trainingsunterlagen',
      'form': 'Formulare',
    }[value] ??
    'Sonstiges';
