import 'dart:typed_data';

import 'package:flutter/material.dart';
import '../common/avatar.dart';
import '../training/training_models.dart';
import 'chat_models.dart';
import 'chat_page.dart';
import 'chat_repository.dart';

class ChatAdminPage extends StatefulWidget {
  const ChatAdminPage({required this.accessToken, super.key});
  final String accessToken;
  @override
  State<ChatAdminPage> createState() => _ChatAdminPageState();
}

class _ChatAdminPageState extends State<ChatAdminPage> {
  late final ChatRepository chats = ChatRepository(
    accessToken: widget.accessToken,
  );
  List<ChatSummary> items = const [];
  List<TrainingGroup> groups = const [];
  bool loading = true;
  String? error;
  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    chats.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final values = await Future.wait([
        chats.listAdminChats(),
        chats.listAdminGroups(),
      ]);
      if (mounted) {
        setState(() {
          items = values[0] as List<ChatSummary>;
          groups = values[1] as List<TrainingGroup>;
          loading = false;
          error = null;
        });
      }
    } on Object catch (e) {
      if (mounted) {
        setState(() {
          error = e.toString();
          loading = false;
        });
      }
    }
  }

  Future<void> _edit([ChatSummary? chat]) async {
    final value = await showDialog<_ChatInput>(
      context: context,
      builder: (_) => _ChatDialog(
        chat: chat,
        groups: groups,
        accessToken: widget.accessToken,
        onUploadAvatar: (bytes, filename) async {
          await chats.uploadChatAvatar(chat!.id, bytes, filename);
          await _load();
        },
        onDeleteAvatar: () async {
          await chats.deleteChatAvatar(chat!.id);
          await _load();
        },
      ),
    );
    if (value == null) return;
    try {
      await chats.saveManagedChat(
        id: chat?.id,
        title: value.title,
        description: value.description,
        icon: value.icon,
        groupIds: value.groupIds,
        archived: value.archived,
        active: value.active,
      );
      await _load();
    } on Object catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  Future<void> _delete(ChatSummary chat) async {
    final ok =
        await showDialog<bool>(
          context: context,
          builder: (c) => AlertDialog(
            title: const Text('Chat wirklich löschen?'),
            content: Text(
              'Der Chat „${chat.title}“ wird für Benutzer entfernt. Der Vorgang wird protokolliert.',
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
    await chats.deleteManagedChat(chat.id);
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    if (error != null) return Text(error!);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(22),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Chats verwalten',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                FilledButton.icon(
                  onPressed: () => _edit(),
                  icon: const Icon(Icons.add),
                  label: const Text('Neuer Chat'),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (items.isEmpty)
              const Text('Keine administrierbaren Gruppenchats vorhanden.'),
            ...items.map(
              (chat) => ListTile(
                leading: AvatarImage(
                  url: chat.avatarUrl,
                  accessToken: widget.accessToken,
                  radius: 18,
                  fallback: CircleAvatar(
                    radius: 18,
                    child: Icon(chatIcon(chat.icon)),
                  ),
                ),
                title: Text(chat.title),
                subtitle: Text(
                  '${chat.description ?? 'Keine Beschreibung'} · ${chat.active ? 'aktiv' : 'deaktiviert'}${chat.archived ? ' · archiviert' : ''}',
                ),
                trailing: Wrap(
                  children: [
                    IconButton(
                      tooltip: 'Bearbeiten',
                      onPressed: () => _edit(chat),
                      icon: const Icon(Icons.edit_outlined),
                    ),
                    IconButton(
                      tooltip: 'Löschen',
                      onPressed: () => _delete(chat),
                      icon: const Icon(Icons.delete_outline),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ChatInput {
  const _ChatInput(
    this.title,
    this.description,
    this.icon,
    this.groupIds,
    this.archived,
    this.active,
  );
  final String title, description, icon;
  final List<String> groupIds;
  final bool archived, active;
}

class _ChatDialog extends StatefulWidget {
  const _ChatDialog({
    required this.chat,
    required this.groups,
    required this.accessToken,
    required this.onUploadAvatar,
    required this.onDeleteAvatar,
  });
  final ChatSummary? chat;
  final List<TrainingGroup> groups;
  final String accessToken;
  final Future<void> Function(Uint8List bytes, String filename) onUploadAvatar;
  final Future<void> Function() onDeleteAvatar;
  @override
  State<_ChatDialog> createState() => _ChatDialogState();
}

class _ChatDialogState extends State<_ChatDialog> {
  late final title = TextEditingController(text: widget.chat?.title);
  late final description = TextEditingController(
    text: widget.chat?.description,
  );
  late String icon = widget.chat?.icon ?? 'group';
  late Set<String> selected = widget.chat?.groupIds.toSet() ?? {};
  late bool archived = widget.chat?.archived ?? false;
  late bool active = widget.chat?.active ?? true;
  late String? avatarUrl = widget.chat?.avatarUrl;
  @override
  void dispose() {
    title.dispose();
    description.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(widget.chat == null ? 'Neuer Chat' : 'Chat bearbeiten'),
    content: SizedBox(
      width: 520,
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: title,
              decoration: const InputDecoration(labelText: 'Chatname'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: description,
              maxLength: 500,
              decoration: const InputDecoration(
                labelText: 'Kurze Beschreibung',
              ),
            ),
            DropdownButtonFormField<String>(
              initialValue: icon,
              decoration: const InputDecoration(labelText: 'Symbol'),
              items:
                  const {
                        'group': 'Gruppe',
                        'forum': 'Forum',
                        'campaign': 'Ankündigung',
                        'sports': 'Sport',
                        'school': 'Ausbildung',
                        'shield': 'Schutz',
                      }.entries
                      .map(
                        (e) => DropdownMenuItem(
                          value: e.key,
                          child: Text(e.value),
                        ),
                      )
                      .toList(),
              onChanged: (v) => setState(() => icon = v!),
            ),
            if (widget.chat != null) ...[
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Bild',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              const SizedBox(height: 8),
              AvatarPicker(
                url: avatarUrl,
                accessToken: widget.accessToken,
                radius: 28,
                fallback: CircleAvatar(radius: 28, child: Icon(chatIcon(icon))),
                onUpload: (bytes, filename) async {
                  await widget.onUploadAvatar(bytes, filename);
                  if (mounted) {
                    setState(() => avatarUrl = '/api/v1/chats/${widget.chat!.id}/avatar');
                  }
                },
                onDelete: () async {
                  await widget.onDeleteAvatar();
                  if (mounted) setState(() => avatarUrl = null);
                },
              ),
            ],
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Berechtigte Gruppen',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            ...widget.groups.map(
              (group) => CheckboxListTile(
                value: selected.contains(group.id),
                title: Text(group.name),
                onChanged: (v) => setState(
                  () => v == true
                      ? selected.add(group.id)
                      : selected.remove(group.id),
                ),
              ),
            ),
            SwitchListTile(
              title: const Text('Aktiv'),
              value: active,
              onChanged: (v) => setState(() => active = v),
            ),
            SwitchListTile(
              title: const Text('Archiviert'),
              value: archived,
              onChanged: (v) => setState(() => archived = v),
            ),
          ],
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Abbrechen'),
      ),
      FilledButton(
        onPressed: title.text.trim().isEmpty
            ? null
            : () => Navigator.pop(
                context,
                _ChatInput(
                  title.text.trim(),
                  description.text.trim(),
                  icon,
                  selected.toList(),
                  archived,
                  active,
                ),
              ),
        child: const Text('Speichern'),
      ),
    ],
  );
}
