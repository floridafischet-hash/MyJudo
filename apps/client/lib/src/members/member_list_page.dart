import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../config/app_config.dart';

class MemberListPage extends StatefulWidget {
  const MemberListPage({required this.accessToken, super.key});
  final String accessToken;

  @override
  State<MemberListPage> createState() => _MemberListPageState();
}

class _MemberListPageState extends State<MemberListPage> {
  late final Dio _dio = Dio(
    BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      headers: {'Authorization': 'Bearer ${widget.accessToken}'},
      connectTimeout: const Duration(seconds: 10),
    ),
  );
  late Future<List<Map<String, dynamic>>> _members = _load();

  Future<List<Map<String, dynamic>>> _load() async {
    final response = await _dio.get<List<dynamic>>('/members');
    return (response.data ?? const [])
        .whereType<Map<String, dynamic>>()
        .toList();
  }

  @override
  Widget build(BuildContext context) =>
      FutureBuilder<List<Map<String, dynamic>>>(
        future: _members,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: FilledButton.tonal(
                onPressed: () => setState(() => _members = _load()),
                child: const Text(
                  'Mitglieder konnten nicht geladen werden – erneut versuchen',
                ),
              ),
            );
          }
          final members = snapshot.data ?? const [];
          if (members.isEmpty) {
            return const Center(
              child: Text('Noch keine Mitglieder vorhanden.'),
            );
          }
          return ListView.separated(
            itemCount: members.length,
            separatorBuilder: (_, _) => const Divider(height: 1),
            itemBuilder: (context, index) {
              final member = members[index];
              return ListTile(
                title: Text('${member['firstName']} ${member['lastName']}'),
                subtitle: Text('Mitgliedsnummer ${member['memberNumber']}'),
                trailing: Text(_statusLabel(member['status'] as String?)),
              );
            },
          );
        },
      );
}

String _statusLabel(String? status) => switch (status) {
  'active' => 'Aktiv',
  'exit_scheduled' => 'Austritt vorgemerkt',
  'former' => 'Ehemalig',
  'suspended' => 'Gesperrt',
  'archived' => 'Archiviert',
  _ => 'Unbekannt',
};
