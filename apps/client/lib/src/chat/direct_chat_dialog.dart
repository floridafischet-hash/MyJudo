import 'dart:async';

import 'package:flutter/material.dart';

import 'chat_models.dart';
import 'chat_repository.dart';

class DirectChatDialog extends StatefulWidget {
  const DirectChatDialog({required this.repository, super.key});

  final ChatRepository repository;

  @override
  State<DirectChatDialog> createState() => _DirectChatDialogState();
}

class _DirectChatDialogState extends State<DirectChatDialog> {
  final _search = TextEditingController();
  Timer? _debounce;
  List<DirectoryUser> _users = const [];
  bool _loading = false;
  String? _creatingUserId;
  String? _error;

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    if (value.trim().isEmpty) {
      setState(() {
        _users = const [];
        _loading = false;
        _error = null;
      });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 300), _load);
  }

  Future<void> _load() async {
    final query = _search.text.trim();
    if (query.isEmpty) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final page = await widget.repository.searchUsers(query);
      if (!mounted || query != _search.text.trim()) return;
      setState(() => _users = page.items);
    } on ChatApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted && query == _search.text.trim()) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _create(DirectoryUser user) async {
    setState(() {
      _creatingUserId = user.id;
      _error = null;
    });
    try {
      final chat = await widget.repository.createDirect(user.id);
      if (mounted) Navigator.of(context).pop(chat);
    } on ChatApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _creatingUserId = null);
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Neue Direktnachricht'),
    content: SizedBox(
      width: 480,
      height: 420,
      child: Column(
        children: [
          TextField(
            controller: _search,
            autofocus: true,
            onChanged: _onSearchChanged,
            decoration: const InputDecoration(
              labelText: 'Freigegebene Person suchen',
              prefixIcon: Icon(Icons.search),
            ),
          ),
          const SizedBox(height: 12),
          if (_loading) const LinearProgressIndicator(),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
          Expanded(
            child: _search.text.trim().isEmpty
                ? const Center(
                    child: Text(
                      'Gib einen Namen ein, um eine Person zu finden.',
                    ),
                  )
                : !_loading && _users.isEmpty && _error == null
                ? const Center(child: Text('Keine passende Person gefunden.'))
                : ListView.separated(
                    itemCount: _users.length,
                    separatorBuilder: (_, _) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final user = _users[index];
                      final creating = _creatingUserId == user.id;
                      return ListTile(
                        leading: const CircleAvatar(
                          child: Icon(Icons.person_outline),
                        ),
                        title: Text(user.displayName),
                        trailing: creating
                            ? const SizedBox.square(
                                dimension: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.chevron_right),
                        enabled: _creatingUserId == null,
                        onTap: () => _create(user),
                      );
                    },
                  ),
          ),
        ],
      ),
    ),
    actions: [
      TextButton(
        onPressed: _creatingUserId == null
            ? () => Navigator.of(context).pop()
            : null,
        child: const Text('Abbrechen'),
      ),
    ],
  );
}
