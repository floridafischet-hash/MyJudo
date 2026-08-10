import 'dart:async';

import 'package:flutter/material.dart';

import 'member.dart';
import 'member_editor_dialog.dart';
import 'member_repository.dart';

class MemberListPage extends StatefulWidget {
  const MemberListPage({
    required this.accessToken,
    required this.permissions,
    this.repository,
    super.key,
  });

  final String accessToken;
  final Set<String> permissions;
  final MemberRepository? repository;

  @override
  State<MemberListPage> createState() => _MemberListPageState();
}

class _MemberListPageState extends State<MemberListPage> {
  static const _pageSize = 25;
  final _search = TextEditingController();
  Timer? _debounce;
  MemberStatus? _status;
  int _page = 1;
  late final MemberRepository _repository =
      widget.repository ?? MemberRepository(accessToken: widget.accessToken);
  late Future<MemberPageResult> _members = _load();

  bool get _canCreate => widget.permissions.contains('members.create');
  bool get _canEdit => widget.permissions.contains('members.edit');
  bool get _canChangeStatus =>
      widget.permissions.contains('members.status.change');

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    if (widget.repository == null) _repository.dispose();
    super.dispose();
  }

  Future<MemberPageResult> _load() => _repository.list(
    page: _page,
    pageSize: _pageSize,
    search: _search.text,
    status: _status,
  );

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

  Future<void> _openEditor([Member? member]) async {
    Member? detailed = member;
    if (member != null) {
      try {
        detailed = await _repository.detail(member.id);
      } on MemberApiException catch (error) {
        if (!mounted) return;
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
        return;
      }
    }
    if (!mounted) return;
    final saved = await showDialog<Member>(
      context: context,
      barrierDismissible: false,
      builder: (_) => MemberEditorDialog(
        repository: _repository,
        member: detailed,
        canEdit: _canEdit,
        canChangeStatus: _canChangeStatus,
      ),
    );
    if (saved != null && mounted) {
      _reload();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            member == null
                ? 'Mitglied wurde angelegt.'
                : 'Mitglied wurde gespeichert.',
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
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
                    child: DropdownButtonFormField<MemberStatus?>(
                      initialValue: _status,
                      decoration: const InputDecoration(labelText: 'Status'),
                      items: [
                        const DropdownMenuItem(
                          value: null,
                          child: Text('Alle Status'),
                        ),
                        ...MemberStatus.values.map(
                          (status) => DropdownMenuItem(
                            value: status,
                            child: Text(status.label),
                          ),
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
            if (_canCreate) ...[
              const SizedBox(width: 12),
              FilledButton.icon(
                onPressed: () => _openEditor(),
                icon: const Icon(Icons.person_add_outlined),
                label: const Text('Mitglied anlegen'),
              ),
            ],
          ],
        ),
      ),
      Expanded(
        child: FutureBuilder<MemberPageResult>(
          future: _members,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              final message = snapshot.error is MemberApiException
                  ? (snapshot.error! as MemberApiException).message
                  : 'Mitglieder konnten nicht geladen werden.';
              return Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(message),
                    const SizedBox(height: 12),
                    FilledButton.tonal(
                      onPressed: _reload,
                      child: const Text('Erneut versuchen'),
                    ),
                  ],
                ),
              );
            }
            final result = snapshot.data!;
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
                        title: Text(member.displayName),
                        subtitle: Text(
                          'Mitgliedsnummer ${member.memberNumber}',
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Chip(label: Text(member.status.label)),
                            const SizedBox(width: 4),
                            const Icon(Icons.chevron_right),
                          ],
                        ),
                        onTap: () => _openEditor(member),
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
