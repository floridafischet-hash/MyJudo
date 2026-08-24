import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import '../config/app_config.dart';

class MemberExcelImportPage extends StatefulWidget {
  const MemberExcelImportPage({required this.accessToken, super.key});
  final String accessToken;
  @override
  State<MemberExcelImportPage> createState() => _MemberExcelImportPageState();
}

class _MemberExcelImportPageState extends State<MemberExcelImportPage> {
  late final Dio api = Dio(
    BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      headers: {'Authorization': 'Bearer ${widget.accessToken}'},
    ),
  );
  Map<String, dynamic>? preview;
  List<dynamic> history = [];
  bool busy = false;
  String? error;
  final decisions = <String, Map<String, dynamic>>{};
  @override
  void initState() {
    super.initState();
    _history();
  }

  @override
  void dispose() {
    api.close();
    super.dispose();
  }

  Future<void> _history() async {
    try {
      final r = await api.get<List<dynamic>>('/members/import/history');
      if (mounted) setState(() => history = r.data ?? []);
    } catch (_) {}
  }

  Future<void> _analyze() async {
    final picked = await FilePicker.pickFiles(
      withData: true,
      type: FileType.custom,
      allowedExtensions: ['xlsx'],
    );
    if (picked == null || !mounted) return;
    setState(() {
      busy = true;
      error = null;
      preview = null;
      decisions.clear();
    });
    try {
      final f = picked.files.single;
      final r = await api.post<dynamic>(
        '/members/import/analyze',
        data: FormData.fromMap({
          'file': MultipartFile.fromBytes(f.bytes!, filename: f.name),
        }),
      );
      if (!mounted) return;
      final p = Map<String, dynamic>.from(r.data as Map);
      for (final raw in p['rows'] as List) {
        final row = Map<String, dynamic>.from(raw as Map);
        final status = row['status'];
        decisions[row['rowId'] as String] = {
          'rowId': row['rowId'],
          'action': status == 'new'
              ? 'create'
              : status == 'update' || status == 'unchanged'
              ? 'update'
              : 'skip',
          if (row['memberId'] != null) 'memberId': row['memberId'],
        };
      }
      setState(() => preview = p);
    } on DioException catch (e) {
      if (mounted) setState(() => error = _message(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _confirm() async {
    final p = preview;
    if (p == null) return;
    setState(() => busy = true);
    try {
      final r = await api.post<dynamic>(
        '/members/import/${p['jobId']}/confirm',
        data: {'decisions': decisions.values.toList()},
      );
      if (!mounted) return;
      final s = Map<String, dynamic>.from(r.data as Map);
      final errorCount = (s['errors'] as num?)?.toInt() ?? 0;
      setState(() => preview = null);
      await _history();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Import abgeschlossen: ${s['created']} neu, ${s['updated']} aktualisiert, '
            '${s['skipped']} übersprungen'
            '${errorCount > 0 ? ', $errorCount mit Fehler' : ''}.',
          ),
        ),
      );
      if (errorCount > 0 && mounted) {
        final details = (s['errorDetails'] as List? ?? [])
            .map((raw) => Map<String, dynamic>.from(raw as Map))
            .toList();
        await showDialog<void>(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Zeilen mit Fehlern'),
            content: SizedBox(
              width: 480,
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'Diese Zeilen wurden nicht übernommen. Alle anderen Zeilen wurden importiert.',
                    ),
                    const SizedBox(height: 12),
                    for (final detail in details)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Text(
                          'Zeile ${detail['sourceRow']}: ${detail['message']}',
                        ),
                      ),
                  ],
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Schließen'),
              ),
            ],
          ),
        );
      }
    } on DioException catch (e) {
      if (mounted) setState(() => error = _message(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Mitgliederverwaltung · Excel-Import',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          const Text(
            'Es werden ausschließlich verifizierte grüne Felder aus makrofreien XLSX-Dateien ausgewertet. Vor der Bestätigung wird nichts an Mitgliedern geändert.',
          ),
          const SizedBox(height: 16),
          Align(
            alignment: Alignment.centerLeft,
            child: FilledButton.icon(
              onPressed: busy ? null : _analyze,
              icon: const Icon(Icons.upload_file),
              label: const Text('XLSX auswählen und analysieren'),
            ),
          ),
          if (busy) ...[
            const SizedBox(height: 12),
            const LinearProgressIndicator(),
          ],
          if (error != null) ...[
            const SizedBox(height: 12),
            Text(
              error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          if (preview != null) ..._preview(context),
          const SizedBox(height: 24),
          Text(
            'Importprotokoll',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          ...history.take(10).map((raw) {
            final h = raw as Map;
            return ListTile(
              dense: true,
              leading: const Icon(Icons.history),
              title: Text(h['fileName'] as String),
              subtitle: Text('${h['status']} · ${h['createdAt']}'),
              trailing: Text(jsonEncode(h['summary'] ?? {})),
            );
          }),
        ],
      ),
    ),
  );
  List<Widget> _preview(BuildContext context) {
    final p = preview!,
        format = Map<String, dynamic>.from(p['format'] as Map),
        counts = Map<String, dynamic>.from(p['counts'] as Map);
    return [
      const Divider(height: 32),
      Text(
        format['formatMatches'] == true
            ? 'Bekanntes DokuMe-Format erkannt'
            : 'Das Format dieser Mitgliederliste weicht von der bekannten Struktur ab.',
        style: TextStyle(
          fontWeight: FontWeight.w800,
          color: format['formatMatches'] == true
              ? Colors.green.shade700
              : Colors.orange.shade800,
        ),
      ),
      const SizedBox(height: 10),
      Text(
        'Grün erkannt: ${(format['green'] as Map)['colors']} · Styles ${(format['green'] as Map)['styleIds']}',
      ),
      Text(
        'Erkannte Importfelder: ${(format['recognizedFields'] as List).join(', ')}',
      ),
      Text(
        'Ignorierte Felder: ${(format['ignoredFields'] as List).join(', ')}',
      ),
      if ((format['unknownGreenFields'] as List).isNotEmpty)
        Text(
          'Unbekannte grüne Felder: ${(format['unknownGreenFields'] as List).join(', ')}',
        ),
      if ((format['missingFields'] as List).isNotEmpty)
        Text(
          'Fehlende erwartete Felder: ${(format['missingFields'] as List).join(', ')}',
        ),
      const SizedBox(height: 14),
      Text(
        'Neu ${counts['new']} · Aktualisieren ${counts['update']} · Unverändert ${counts['unchanged']} · Konflikte ${counts['conflict']}',
        style: const TextStyle(fontWeight: FontWeight.w700),
      ),
      const SizedBox(height: 12),
      ...(p['rows'] as List).map(
        (raw) => _row(Map<String, dynamic>.from(raw as Map)),
      ),
      const SizedBox(height: 16),
      FilledButton.icon(
        onPressed: busy ? _none : _confirm,
        icon: const Icon(Icons.check),
        label: const Text('Import ausdrücklich bestätigen und durchführen'),
      ),
    ];
  }

  Widget _row(Map<String, dynamic> row) {
    final data = Map<String, dynamic>.from(row['data'] as Map),
        d = decisions[row['rowId']]!;
    final candidates = (row['candidates'] as List);
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ExpansionTile(
        title: Text('${data['firstName'] ?? ''} ${data['lastName'] ?? ''}'),
        subtitle: Text(
          '${_status(row['status'] as String)} · Geburt ${data['birthDate'] ?? '–'} · ${data['highestGraduation'] ?? 'keine Graduierung'}',
        ),
        children: [
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'E-Mail: ${data['email'] ?? '–'} · Telefon: ${data['phone'] ?? '–'}',
                ),
                Text(
                  'Adresse: ${data['street'] ?? '–'}, ${data['postalCode'] ?? ''} ${data['city'] ?? ''}, ${data['country'] ?? ''}',
                ),
                Text('Letzte Prüfung: ${data['lastGraduationDate'] ?? '–'}'),
                if ((data['graduationsThisYear'] ?? '').toString().isNotEmpty &&
                    data['graduationsThisYear'].toString() != '0')
                  Text(
                    'Prüfungen im laufenden Jahr: ${data['graduationsThisYear']}',
                  ),
                if ((data['graduations'] ?? '').toString().isNotEmpty)
                  Text('Alle Gürtel: ${data['graduations']}'),
                if ((row['warnings'] as List).isNotEmpty)
                  Text(
                    'Prüfen: ${(row['warnings'] as List).join(' ')}',
                    style: const TextStyle(color: Colors.orange),
                  ),
                ...(row['changes'] as List).map((x) {
                  final c = x as Map;
                  return Text(
                    '${c['field']}: MyJudo „${c['current'] ?? '–'}“ → Excel „${c['excel'] ?? '–'}“',
                  );
                }),
                DropdownButtonFormField<String>(
                  initialValue: d['action'] as String,
                  decoration: const InputDecoration(labelText: 'Entscheidung'),
                  items: const [
                    DropdownMenuItem(
                      value: 'create',
                      child: Text('Neues Mitglied erstellen'),
                    ),
                    DropdownMenuItem(
                      value: 'update',
                      child: Text('Bestehendes Mitglied aktualisieren'),
                    ),
                    DropdownMenuItem(
                      value: 'skip',
                      child: Text('Überspringen'),
                    ),
                  ],
                  onChanged: (v) => setState(() => d['action'] = v),
                ),
                if (d['action'] == 'update' && candidates.isNotEmpty)
                  DropdownButtonFormField<String>(
                    initialValue: d['memberId'] as String?,
                    decoration: const InputDecoration(
                      labelText: 'Bestehendem Mitglied zuordnen',
                    ),
                    items: candidates.map((x) {
                      final c = x as Map;
                      return DropdownMenuItem(
                        value: c['id'] as String,
                        child: Text(
                          '${c['name']} (${c['birthDate'] ?? 'ohne Geburtsdatum'})',
                        ),
                      );
                    }).toList(),
                    onChanged: (v) => setState(() => d['memberId'] = v),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

void _none() {}
String _status(String s) =>
    {
      'new': 'Neues Mitglied',
      'update': 'Bestehendes Mitglied – Änderungen',
      'unchanged': 'Unverändert',
      'conflict': 'Zuordnung unklar – Prüfung erforderlich',
    }[s] ??
    s;
String _message(DioException e) {
  final d = e.response?.data;
  if (d is Map && d['message'] != null) return d['message'].toString();
  return 'Die Excel-Datei konnte nicht verarbeitet werden.';
}
