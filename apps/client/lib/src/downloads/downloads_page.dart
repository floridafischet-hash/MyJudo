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
  List<Map<String, dynamic>> categories = [];
  String search = '';
  bool loading = true;
  String? loadError;
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
    if (mounted) {
      setState(() {
        loading = true;
        loadError = null;
      });
    }
    try {
      final results = await Future.wait([
        api.get<List<dynamic>>(
          widget.admin ? '/downloads/admin/all' : '/downloads',
        ),
        api.get<List<dynamic>>('/downloads/categories'),
      ]);
      if (!mounted) return;
      setState(() {
        items = results[0].data ?? [];
        categories = (results[1].data ?? [])
            .map((value) => Map<String, dynamic>.from(value as Map))
            .toList();
        loading = false;
      });
    } on DioException catch (error) {
      if (!mounted) return;
      setState(() {
        loading = false;
        loadError = _apiMessage(
          error,
          'Downloads konnten nicht geladen werden.',
        );
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
      allowedExtensions: [
        'pdf',
        'png',
        'jpg',
        'jpeg',
        'gif',
        'webp',
        'txt',
        'csv',
        'docx',
        'xlsx',
        'pptx',
      ],
    );
    if (picked == null || !mounted) return;
    final title = TextEditingController(
      text: existing?['title'] as String? ?? picked.files.single.name,
    );
    final description = TextEditingController(
      text: existing?['description'] as String? ?? '',
    );
    String? selectedCategoryId = existing?['categoryId'] as String?;
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
                  DropdownButtonFormField<String?>(
                    initialValue: selectedCategoryId,
                    decoration: const InputDecoration(labelText: 'Kategorie'),
                    items: [
                      const DropdownMenuItem<String?>(
                        value: null,
                        child: Text('Ohne Kategorie'),
                      ),
                      ...categories.map(
                        (e) => DropdownMenuItem<String?>(
                          value: e['id'] as String,
                          child: Text(e['name'] as String),
                        ),
                      ),
                    ],
                    onChanged: (v) => setDialog(() => selectedCategoryId = v),
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
          'category': existing?['category'] ?? 'other',
          'categoryId': selectedCategoryId,
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
        'categoryId': d['categoryId'],
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
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Datei löschen?'),
        content: Text('Möchtest du „${d['title']}“ wirklich löschen?'),
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
    );
    if (ok != true) return;
    await api.delete('/downloads/admin/${d['id']}');
    await load();
  }

  Future<void> createCategory() async {
    final value = TextEditingController();
    final ok = await _categoryDialog('Kategorie erstellen', value);
    if (ok == true && value.text.trim().isNotEmpty) {
      await api.post(
        '/downloads/categories',
        data: {'name': value.text.trim()},
      );
      await load();
    }
    value.dispose();
  }

  Future<void> renameCategory(Map<String, dynamic> category) async {
    final value = TextEditingController(text: category['name'] as String);
    final ok = await _categoryDialog('Kategorie umbenennen', value);
    if (ok == true && value.text.trim().isNotEmpty) {
      await api.patch(
        '/downloads/categories/${category['id']}',
        data: {'name': value.text.trim()},
      );
      await load();
    }
    value.dispose();
  }

  Future<bool?> _categoryDialog(String title, TextEditingController value) =>
      showDialog<bool>(
        context: context,
        builder: (c) => AlertDialog(
          title: Text(title),
          content: TextField(
            controller: value,
            autofocus: true,
            decoration: const InputDecoration(labelText: 'Name'),
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
  Future<void> deleteCategory(Map<String, dynamic> category) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Kategorie löschen?'),
        content: const Text(
          'Alle enthaltenen Dateien bleiben erhalten und werden nach „Ohne Kategorie“ verschoben.',
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
    );
    if (ok == true) {
      await api.delete('/downloads/categories/${category['id']}');
      await load();
    }
  }

  Future<void> move(Map<dynamic, dynamic> file) async {
    String? target = file['categoryId'] as String?;
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => StatefulBuilder(
        builder: (c, setDialog) => AlertDialog(
          title: const Text('Datei verschieben'),
          content: DropdownButtonFormField<String?>(
            initialValue: target,
            items: [
              const DropdownMenuItem<String?>(
                value: null,
                child: Text('Ohne Kategorie'),
              ),
              ...categories.map(
                (e) => DropdownMenuItem<String?>(
                  value: e['id'] as String,
                  child: Text(e['name'] as String),
                ),
              ),
            ],
            onChanged: (v) => setDialog(() => target = v),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(c, false),
              child: const Text('Abbrechen'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(c, true),
              child: const Text('Verschieben'),
            ),
          ],
        ),
      ),
    );
    if (ok == true) {
      await api.patch(
        '/downloads/admin/${file['id']}/category',
        data: {'categoryId': target},
      );
      await load();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    if (loadError != null) {
      return Center(
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.cloud_off_outlined, size: 40),
                const SizedBox(height: 12),
                Text(loadError!, textAlign: TextAlign.center),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: load,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Erneut versuchen'),
                ),
              ],
            ),
          ),
        ),
      );
    }
    final visible = items.where((raw) {
      final d = raw as Map;
      return '${d['title']} ${d['originalName']} ${d['description'] ?? ''}'
          .toLowerCase()
          .contains(search.toLowerCase());
    }).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: 12,
          runSpacing: 12,
          alignment: WrapAlignment.end,
          children: [
            SizedBox(
              width: 320,
              child: TextField(
                onChanged: (value) => setState(() => search = value),
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.search),
                  labelText: 'Downloads durchsuchen',
                ),
              ),
            ),
            if (widget.admin)
              OutlinedButton.icon(
                onPressed: createCategory,
                icon: const Icon(Icons.create_new_folder_outlined),
                label: const Text('Kategorie erstellen'),
              ),
            if (widget.admin)
              FilledButton.icon(
                onPressed: upload,
                icon: const Icon(Icons.upload_file),
                label: const Text('Datei hochladen'),
              ),
          ],
        ),
        const SizedBox(height: 16),
        if (items.isEmpty)
          const Card(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Text('Keine freigegebenen Downloads vorhanden.'),
            ),
          ),
        _categorySection(
          null,
          'Ohne Kategorie',
          visible.where((raw) => (raw as Map)['categoryId'] == null).toList(),
        ),
        ...categories.map(
          (folder) => _categorySection(
            folder,
            folder['name'] as String,
            visible
                .where((raw) => (raw as Map)['categoryId'] == folder['id'])
                .toList(),
          ),
        ),
      ],
    );
  }

  Widget _categorySection(
    Map<String, dynamic>? folder,
    String name,
    List<dynamic> files,
  ) => Card(
    child: ExpansionTile(
      initiallyExpanded: true,
      leading: const Icon(Icons.folder_outlined),
      title: Text('$name (${files.length})'),
      trailing: folder != null && widget.admin
          ? PopupMenuButton<String>(
              onSelected: (v) => v == 'rename'
                  ? renameCategory(folder)
                  : deleteCategory(folder),
              itemBuilder: (_) => const [
                PopupMenuItem(value: 'rename', child: Text('Umbenennen')),
                PopupMenuItem(value: 'delete', child: Text('Löschen')),
              ],
            )
          : null,
      children: files.isEmpty
          ? [const ListTile(title: Text('Keine Dateien'))]
          : files
                .map((raw) => _fileTile(raw as Map<dynamic, dynamic>))
                .toList(),
    ),
  );
  Widget _fileTile(Map<dynamic, dynamic> d) => ListTile(
    leading: const Icon(Icons.description_outlined),
    title: Text(d['title'] as String),
    subtitle: Text(
      '${d['description'] as String? ?? d['originalName']} · ${formatDownloadSize(d['size'])} · ${d['uploadedByName'] ?? ''}',
    ),
    onTap: () => preview(d),
    trailing: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _PreviewButton(mime: d['mimeType'] as String, onTap: () => preview(d)),
        IconButton(
          onPressed: () => download(d),
          icon: const Icon(Icons.download),
          tooltip: 'Herunterladen',
        ),
        if (widget.admin)
          PopupMenuButton<String>(
            onSelected: (v) {
              if (v == 'replace') upload(d);
              if (v == 'move') move(d);
              if (v == 'toggle') setActive(d, !(d['active'] as bool));
              if (v == 'delete') remove(d);
            },
            itemBuilder: (_) => [
              const PopupMenuItem(
                value: 'replace',
                child: Text('Datei ersetzen'),
              ),
              const PopupMenuItem(value: 'move', child: Text('Verschieben')),
              PopupMenuItem(
                value: 'toggle',
                child: Text(
                  (d['active'] as bool) ? 'Deaktivieren' : 'Aktivieren',
                ),
              ),
              const PopupMenuItem(value: 'delete', child: Text('Löschen')),
            ],
          ),
      ],
    ),
  );
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
String formatDownloadSize(Object? rawBytes) {
  final bytes = rawBytes is num ? rawBytes.toInt() : int.tryParse('$rawBytes');
  if (bytes == null || bytes < 0) return 'Unbekannte Größe';
  return _formatSize(bytes);
}

String _formatSize(int bytes) => bytes >= 1048576
    ? '${(bytes / 1048576).toStringAsFixed(1)} MB'
    : '${(bytes / 1024).toStringAsFixed(1)} KB';

String _apiMessage(DioException error, String fallback) {
  final data = error.response?.data;
  if (data is Map && data['message'] is String) {
    return data['message'] as String;
  }
  return fallback;
}
