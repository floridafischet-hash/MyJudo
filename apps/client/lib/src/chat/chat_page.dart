import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'chat_models.dart';
import 'chat_repository.dart';
import 'direct_chat_dialog.dart';

IconData chatIcon(String? icon) => switch (icon) {
  'forum' => Icons.forum_outlined,
  'campaign' => Icons.campaign_outlined,
  'sports' => Icons.sports_outlined,
  'school' => Icons.school_outlined,
  'shield' => Icons.shield_outlined,
  _ => Icons.group_outlined,
};

class ChatPage extends StatefulWidget {
  const ChatPage({
    required this.accessToken,
    required this.currentUserId,
    this.canDeleteAll = false,
    this.repository,
    super.key,
  });

  final String accessToken;
  final String currentUserId;
  final bool canDeleteAll;
  final ChatRepository? repository;

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  late final ChatRepository _repository =
      widget.repository ?? ChatRepository(accessToken: widget.accessToken);
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  Timer? _refreshTimer;
  List<ChatSummary> _chats = const [];
  List<ChatMessage> _messages = const [];
  ChatSummary? _selected;
  String? _nextBefore;
  String? _error;
  bool _loadingChats = true;
  bool _loadingMessages = false;
  bool _sending = false;
  ChatMessage? _replyingTo;

  @override
  void initState() {
    super.initState();
    unawaited(_loadChats());
    _refreshTimer = Timer.periodic(
      const Duration(seconds: 15),
      (_) => unawaited(_pollUpdates()),
    );
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _messageController.dispose();
    _scrollController.dispose();
    if (widget.repository == null) {
      _repository.dispose();
    }
    super.dispose();
  }

  Future<void> _loadChats({bool silent = false}) async {
    if (!silent) setState(() => _loadingChats = true);
    try {
      final chats = await _repository.listChats();
      if (!mounted) return;
      final selectedId = _selected?.id;
      setState(() {
        _chats = chats;
        _selected = selectedId == null
            ? (chats.isEmpty ? null : chats.first)
            : chats.where((chat) => chat.id == selectedId).firstOrNull;
        _error = null;
      });
      if (selectedId == null && _selected != null) {
        await _loadMessages(_selected!);
      }
    } on ChatApiException catch (error) {
      if (mounted && !silent) setState(() => _error = error.message);
    } finally {
      if (mounted && !silent) setState(() => _loadingChats = false);
    }
  }

  // Polls only new messages since the last known message — no full list replace.
  Future<void> _pollUpdates() async {
    try {
      final chats = await _repository.listChats();
      if (!mounted) return;
      final selectedId = _selected?.id;
      setState(() {
        _chats = chats;
        _selected = selectedId == null
            ? null
            : chats.where((chat) => chat.id == selectedId).firstOrNull;
      });
      final selected = _selected;
      if (selected == null || _messages.isEmpty) return;
      // Fetch latest page and merge new messages without replacing the list.
      final page = await _repository.listMessages(selected.id);
      if (!mounted || _selected?.id != selected.id) return;
      final existingIds = _messages.map((m) => m.id).toSet();
      final incoming = page.items;
      // Update edited messages and append genuinely new ones.
      final updated = _messages.map((m) {
        final replacement = incoming.where((i) => i.id == m.id).firstOrNull;
        return replacement ?? m;
      }).toList();
      final newMessages = incoming.where((m) => !existingIds.contains(m.id)).toList();
      if (newMessages.isNotEmpty || updated != _messages) {
        setState(() => _messages = [...updated, ...newMessages]);
        if (newMessages.isNotEmpty) _scrollToBottom();
      }
    } on ChatApiException {
      // silent — don't show poll errors to the user
    }
  }

  Future<void> _loadMessages(ChatSummary chat) async {
    setState(() {
      _selected = chat;
      _loadingMessages = true;
      // Do NOT clear _messages here; keep old content visible until new arrives.
      _nextBefore = null;
      _error = null;
      _replyingTo = null;
    });
    try {
      final page = await _repository.listMessages(chat.id);
      await _repository.markRead(chat.id);
      if (!mounted || _selected?.id != chat.id) return;
      setState(() {
        _messages = page.items;
        _nextBefore = page.nextBefore;
      });
      _scrollToBottom();
      unawaited(_loadChats(silent: true));
    } on ChatApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _loadingMessages = false);
    }
  }

  Future<void> _loadOlder() async {
    final selected = _selected;
    final before = _nextBefore;
    if (selected == null || before == null || _loadingMessages) return;
    setState(() => _loadingMessages = true);
    try {
      final page = await _repository.listMessages(selected.id, before: before);
      if (!mounted || _selected?.id != selected.id) return;
      setState(() {
        _messages = [...page.items, ..._messages];
        _nextBefore = page.nextBefore;
      });
    } on ChatApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _loadingMessages = false);
    }
  }

  Future<void> _send() async {
    final selected = _selected;
    final text = _messageController.text.trim();
    if (selected == null || text.isEmpty || _sending) return;
    final replyToId = _replyingTo?.id;
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      final message = await _repository.send(selected.id, text, replyToId: replyToId);
      if (!mounted) return;
      _messageController.clear();
      setState(() {
        _messages = [..._messages, message];
        _replyingTo = null;
      });
      _scrollToBottom();
      unawaited(_loadChats(silent: true));
    } on ChatApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _deleteMessage(ChatMessage message) async {
    final selected = _selected;
    if (selected == null) return;
    try {
      await _repository.deleteMessage(selected.id, message.id);
      if (!mounted) return;
      setState(() => _messages = _messages.where((m) => m.id != message.id).toList());
    } on ChatApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  Future<void> _editMessage(ChatMessage message, String newText) async {
    final selected = _selected;
    if (selected == null) return;
    try {
      final updated = await _repository.editMessage(selected.id, message.id, newText);
      if (!mounted) return;
      setState(() {
        _messages = _messages.map((m) => m.id == updated.id ? updated : m).toList();
      });
    } on ChatApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  void _showMessageActions(ChatMessage message) {
    final isOwn = message.senderId == widget.currentUserId;
    final canDelete = isOwn || widget.canDeleteAll;
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.reply_outlined),
              title: const Text('Antworten'),
              onTap: () {
                Navigator.pop(ctx);
                setState(() => _replyingTo = message);
              },
            ),
            if (message.text.isNotEmpty)
              ListTile(
                leading: const Icon(Icons.copy_outlined),
                title: const Text('Kopieren'),
                onTap: () {
                  Navigator.pop(ctx);
                  Clipboard.setData(ClipboardData(text: message.text));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Nachricht kopiert')),
                  );
                },
              ),
            if (isOwn)
              ListTile(
                leading: const Icon(Icons.edit_outlined),
                title: const Text('Bearbeiten'),
                onTap: () {
                  Navigator.pop(ctx);
                  _showEditDialog(message);
                },
              ),
            if (canDelete)
              ListTile(
                leading: const Icon(Icons.delete_outline, color: Colors.red),
                title: const Text('Löschen', style: TextStyle(color: Colors.red)),
                onTap: () {
                  Navigator.pop(ctx);
                  unawaited(_deleteMessage(message));
                },
              ),
          ],
        ),
      ),
    );
  }

  void _showEditDialog(ChatMessage message) {
    final controller = TextEditingController(text: message.text);
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Nachricht bearbeiten'),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLines: 6,
          minLines: 2,
          maxLength: 4000,
          decoration: const InputDecoration(counterText: ''),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Abbrechen')),
          FilledButton(
            onPressed: () {
              final text = controller.text.trim();
              if (text.isNotEmpty && text != message.text) {
                unawaited(_editMessage(message, text));
              }
              Navigator.pop(ctx);
            },
            child: const Text('Speichern'),
          ),
        ],
      ),
    );
  }

  Future<void> _newDirectChat() async {
    final chat = await showDialog<ChatSummary>(
      context: context,
      barrierDismissible: false,
      builder: (_) => DirectChatDialog(repository: _repository),
    );
    if (chat == null || !mounted) return;
    await _loadChats(silent: true);
    if (mounted) await _loadMessages(chat);
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loadingChats) return const Center(child: CircularProgressIndicator());
    if (_error != null && _chats.isEmpty) {
      return _ErrorView(message: _error!, onRetry: _loadChats);
    }
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 720 && _selected != null) {
          return _Conversation(
            chat: _selected!,
            messages: _messages,
            currentUserId: widget.currentUserId,
            controller: _messageController,
            scrollController: _scrollController,
            loading: _loadingMessages,
            sending: _sending,
            canLoadOlder: _nextBefore != null,
            error: _error,
            replyingTo: _replyingTo,
            onBack: () => setState(() => _selected = null),
            onLoadOlder: _loadOlder,
            onSend: _send,
            onMessageLongPress: _showMessageActions,
            onCancelReply: () => setState(() => _replyingTo = null),
          );
        }
        if (constraints.maxWidth < 720) {
          return _ChatList(
            chats: _chats,
            onSelect: _loadMessages,
            onNewDirect: _newDirectChat,
          );
        }
        return Row(
          children: [
            SizedBox(
              width: 320,
              child: _ChatList(
                chats: _chats,
                selectedId: _selected?.id,
                onSelect: _loadMessages,
                onNewDirect: _newDirectChat,
              ),
            ),
            const VerticalDivider(width: 1),
            Expanded(
              child: _selected == null
                  ? const Center(child: Text('Chat auswählen'))
                  : _Conversation(
                      chat: _selected!,
                      messages: _messages,
                      currentUserId: widget.currentUserId,
                      controller: _messageController,
                      scrollController: _scrollController,
                      loading: _loadingMessages,
                      sending: _sending,
                      canLoadOlder: _nextBefore != null,
                      error: _error,
                      replyingTo: _replyingTo,
                      onLoadOlder: _loadOlder,
                      onSend: _send,
                      onMessageLongPress: _showMessageActions,
                      onCancelReply: () => setState(() => _replyingTo = null),
                    ),
            ),
          ],
        );
      },
    );
  }
}

class _ChatList extends StatelessWidget {
  const _ChatList({
    required this.chats,
    required this.onSelect,
    required this.onNewDirect,
    this.selectedId,
  });

  final List<ChatSummary> chats;
  final String? selectedId;
  final ValueChanged<ChatSummary> onSelect;
  final VoidCallback onNewDirect;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Padding(
        padding: const EdgeInsets.all(12),
        child: SizedBox(
          width: double.infinity,
          child: FilledButton.tonalIcon(
            onPressed: onNewDirect,
            icon: const Icon(Icons.add_comment_outlined),
            label: const Text('Neue Direktnachricht'),
          ),
        ),
      ),
      Expanded(
        child: chats.isEmpty
            ? const Center(child: Text('Noch keine Chats vorhanden.'))
            : ListView.separated(
                itemCount: chats.length,
                separatorBuilder: (_, _) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final chat = chats[index];
                  return ListTile(
                    selected: selectedId == chat.id,
                    leading: Icon(
                      chat.type == ChatType.group
                          ? Icons.group_outlined
                          : Icons.person_outline,
                    ),
                    title: Text(
                      chat.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: Text(
                      chat.lastMessage?.text ?? 'Noch keine Nachrichten',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    trailing: chat.unreadCount > 0
                        ? Badge(label: Text('${chat.unreadCount}'))
                        : null,
                    onTap: () => onSelect(chat),
                  );
                },
              ),
      ),
    ],
  );
}

class _Conversation extends StatelessWidget {
  const _Conversation({
    required this.chat,
    required this.messages,
    required this.currentUserId,
    required this.controller,
    required this.scrollController,
    required this.loading,
    required this.sending,
    required this.canLoadOlder,
    required this.error,
    required this.replyingTo,
    required this.onLoadOlder,
    required this.onSend,
    required this.onMessageLongPress,
    required this.onCancelReply,
    this.onBack,
  });

  final ChatSummary chat;
  final List<ChatMessage> messages;
  final String currentUserId;
  final TextEditingController controller;
  final ScrollController scrollController;
  final bool loading;
  final bool sending;
  final bool canLoadOlder;
  final String? error;
  final ChatMessage? replyingTo;
  final VoidCallback onLoadOlder;
  final VoidCallback onSend;
  final ValueChanged<ChatMessage> onMessageLongPress;
  final VoidCallback onCancelReply;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      ListTile(
        leading: onBack == null
            ? Icon(
                chat.type == ChatType.group
                    ? Icons.group_outlined
                    : Icons.person_outline,
              )
            : IconButton(onPressed: onBack, icon: const Icon(Icons.arrow_back)),
        title: Text(chat.title, style: Theme.of(context).textTheme.titleLarge),
      ),
      const Divider(height: 1),
      if (error != null)
        MaterialBanner(
          content: Text(error!),
          actions: [TextButton(onPressed: () {}, child: const Text('OK'))],
        ),
      Expanded(
        child: loading && messages.isEmpty
            ? const Center(child: CircularProgressIndicator())
            : messages.isEmpty
            ? const Center(child: Text('Noch keine Nachrichten.'))
            : ListView.builder(
                controller: scrollController,
                padding: const EdgeInsets.all(16),
                itemCount: messages.length + (canLoadOlder ? 1 : 0),
                itemBuilder: (context, index) {
                  if (canLoadOlder && index == 0) {
                    return Center(
                      child: TextButton(
                        onPressed: loading ? null : onLoadOlder,
                        child: const Text('Ältere Nachrichten laden'),
                      ),
                    );
                  }
                  final message = messages[index - (canLoadOlder ? 1 : 0)];
                  final own = message.senderId == currentUserId;
                  return _MessageBubble(
                    message: message,
                    own: own,
                    onLongPress: () => onMessageLongPress(message),
                  );
                },
              ),
      ),
      const Divider(height: 1),
      if (replyingTo != null) _ReplyBanner(message: replyingTo!, onCancel: onCancelReply),
      Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                enabled: !sending,
                maxLength: 4000,
                minLines: 1,
                maxLines: 4,
                textInputAction: TextInputAction.newline,
                decoration: const InputDecoration(
                  labelText: 'Nachricht',
                  counterText: '',
                ),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filled(
              tooltip: 'Senden',
              onPressed: sending ? null : onSend,
              icon: sending
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.send),
            ),
          ],
        ),
      ),
    ],
  );
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    required this.message,
    required this.own,
    required this.onLongPress,
  });

  final ChatMessage message;
  final bool own;
  final VoidCallback onLongPress;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: own ? Alignment.centerRight : Alignment.centerLeft,
      child: GestureDetector(
        onLongPress: onLongPress,
        child: Card(
          color: own ? Theme.of(context).colorScheme.primaryContainer : null,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (!own)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Text(
                        message.senderName,
                        style: Theme.of(context).textTheme.labelMedium,
                      ),
                    ),
                  if (message.replyToText != null)
                    _ReplyQuote(text: message.replyToText!),
                  Text(message.text),
                  const SizedBox(height: 4),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        _time(message.createdAt),
                        style: Theme.of(context).textTheme.labelSmall,
                      ),
                      if (message.isEdited) ...[
                        const SizedBox(width: 4),
                        Text(
                          'bearbeitet',
                          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            fontStyle: FontStyle.italic,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ReplyQuote extends StatelessWidget {
  const _ReplyQuote({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(8),
        border: Border(
          left: BorderSide(
            color: Theme.of(context).colorScheme.primary,
            width: 3,
          ),
        ),
      ),
      child: Text(
        text,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: Theme.of(context).textTheme.bodySmall,
      ),
    );
  }
}

class _ReplyBanner extends StatelessWidget {
  const _ReplyBanner({required this.message, required this.onCancel});
  final ChatMessage message;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          const Icon(Icons.reply, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  message.senderName,
                  style: Theme.of(context).textTheme.labelMedium,
                ),
                Text(
                  message.text,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.close, size: 18),
            onPressed: onCancel,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
          ),
        ],
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(message),
        const SizedBox(height: 12),
        FilledButton.tonal(
          onPressed: onRetry,
          child: const Text('Erneut versuchen'),
        ),
      ],
    ),
  );
}

String _time(DateTime value) {
  final local = value.toLocal();
  return '${local.day.toString().padLeft(2, '0')}.${local.month.toString().padLeft(2, '0')}. '
      '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
}
