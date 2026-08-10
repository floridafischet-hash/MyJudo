import 'dart:async';

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
  static const _pageSize = 25;
  final _search = TextEditingController();
  Timer? _debounce;
  String? _status;
  int _page = 1;
  late final Dio _dio = Dio(
    BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      headers: {'Authorization': 'Bearer ${widget.accessToken}'},
      connectTimeout: const Duration(seconds: 10),
    ),
  );
  late Future<_MemberPage> _members = _load();

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    _dio.close();
    super.dispose();
  }

  Future<_MemberPage> _load() async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/members',
      queryParameters: {
        'page': _page,
        'pageSize': _pageSize,
        if (_search.text.trim().isNotEmpty) 'search': _search.text.trim(),
        if (_status != null) 'status': _status,
      },
    );
    return _MemberPage.fromJson(response.data ?? const {});
  }

  void _reload({bool resetPage = false}) {
    if (resetPage) _page = 1;
    setState(() => _members = _load());
  }

  void _searchChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      if (mounted) _reload(resetPage: true);
    });
  }

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Padding(
        padding: const EdgeInsets.all(12),
        child: Wrap(
          spacing: 12,
          runSpacing: 12,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            SizedBox(
              width: 320,
              child: TextField(
                controller: _search,
                onChanged: _searchChanged,
                decoration: const InputDecoration(
                  labelText: 'Mitglieder suchen',
                  prefixIcon: Icon(Icons.search),
                  hintText: 'Name oder Mitgliedsnummer',
                ),
              ),
            ),
            SizedBox(
              width: 220,
              child: DropdownButtonFormField<String?>(
                initialValue: _status,
                decoration: const InputDecoration(labelText: 'Status'),
                items: const [
                  DropdownMenuItem(value: null, child: Text('Alle Status')),
                  DropdownMenuItem(value: 'active', child: Text('Aktiv')),
                  DropdownMenuItem(
                    value: 'exit_scheduled',
                    child: Text('Austritt vorgemerkt'),
                  ),
                  DropdownMenuItem(value: 'former', child: Text('Ehemalig')),
                  DropdownMenuItem(value: 'suspended', child: Text('Gesperrt')),
                  DropdownMenuItem(
                    value: 'archived',
                    child: Text('Archiviert'),
                  ),
                ],
                onChanged: (value) {
                  _status = value;
                  _reload(resetPage: true);
                },
              ),
            ),
          ],
        ),
      ),
      Expanded(
        child: FutureBuilder<_MemberPage>(
          future: _members,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return Center(
                child: FilledButton.tonal(
                  onPressed: _reload,
                  child: const Text(
                    'Mitglieder konnten nicht geladen werden – erneut versuchen',
                  ),
                ),
              );
            }
            final result = snapshot.data ?? const _MemberPage.empty();
            if (result.items.isEmpty) {
              return const Center(
                child: Text('Keine passenden Mitglieder gefunden.'),
              );
            }
            return Column(
              children: [
                Expanded(
                  child: ListView.separated(
                    itemCount: result.items.length,
                    separatorBuilder: (_, _) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final member = result.items[index];
                      return ListTile(
                        title: Text(
                          '${member['firstName']} ${member['lastName']}',
                        ),
                        subtitle: Text(
                          'Mitgliedsnummer ${member['memberNumber']}',
                        ),
                        trailing: Text(
                          _statusLabel(member['status'] as String?),
                        ),
                      );
                    },
                  ),
                ),
                _Pagination(
                  page: result.page,
                  pageSize: result.pageSize,
                  total: result.total,
                  onPrevious: result.page > 1
                      ? () {
                          _page -= 1;
                          _reload();
                        }
                      : null,
                  onNext: result.page * result.pageSize < result.total
                      ? () {
                          _page += 1;
                          _reload();
                        }
                      : null,
                ),
              ],
            );
          },
        ),
      ),
    ],
  );
}

class _MemberPage {
  const _MemberPage({
    required this.items,
    required this.page,
    required this.pageSize,
    required this.total,
  });
  const _MemberPage.empty()
    : items = const [],
      page = 1,
      pageSize = 25,
      total = 0;

  factory _MemberPage.fromJson(Map<String, dynamic> json) => _MemberPage(
    items: (json['items'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .toList(),
    page: json['page'] as int? ?? 1,
    pageSize: json['pageSize'] as int? ?? 25,
    total: json['total'] as int? ?? 0,
  );

  final List<Map<String, dynamic>> items;
  final int page;
  final int pageSize;
  final int total;
}

class _Pagination extends StatelessWidget {
  const _Pagination({
    required this.page,
    required this.pageSize,
    required this.total,
    required this.onPrevious,
    required this.onNext,
  });
  final int page;
  final int pageSize;
  final int total;
  final VoidCallback? onPrevious;
  final VoidCallback? onNext;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        Text('$total Mitglieder · Seite $page'),
        IconButton(
          tooltip: 'Vorherige Seite',
          onPressed: onPrevious,
          icon: const Icon(Icons.chevron_left),
        ),
        IconButton(
          tooltip: 'Nächste Seite',
          onPressed: onNext,
          icon: const Icon(Icons.chevron_right),
        ),
      ],
    ),
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
