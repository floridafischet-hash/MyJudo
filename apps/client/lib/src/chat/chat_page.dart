import 'dart:async';

import 'package:flutter/material.dart';

import 'chat_models.dart';
import 'chat_repository.dart';
import 'direct_chat_dialog.dart';

class ChatPage extends StatefulWidget {
  const ChatPage({
    required this.accessToken,
    required this.currentUserId,
    this.repository,
    super.key,
  });

  final String accessToken;
  final String currentUserId;
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

  @override
  void initState() {
    super.initState();
    unawaited(_loadChats());
    _refreshTimer = Timer.periodic(
      const Duration(seconds: 15),
      (_) => unawaited(_loadChats(silent: true)),
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

  Future<void> _loadMessages(ChatSummary chat) async {
    setState(() {
      _selected = chat;
      _loadingMessages = true;
      _messages = const [];
      _nextBefore = null;
      _error = null;
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
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      final message = await _repository.send(selected.id, text);
      if (!mounted) return;
      _messageController.clear();
      setState(() => _messages = [..._messages, message]);
      _scrollToBottom();
      unawaited(_loadChats(silent: true));
    } on ChatApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
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
            onBack: () => setState(() => _selected = null),
            onLoadOlder: _loadOlder,
            onSend: _send,
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
                      onLoadOlder: _loadOlder,
                      onSend: _send,
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
    required this.onLoadOlder,
    required this.onSend,
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
  final VoidCallback onLoadOlder;
  final VoidCallback onSend;
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
                  return Align(
                    alignment: own
                        ? Alignment.centerRight
                        : Alignment.centerLeft,
                    child: Card(
                      color: own
                          ? Theme.of(context).colorScheme.primaryContainer
                          : null,
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 520),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (!own)
                                Text(
                                  message.senderName,
                                  style: Theme.of(
                                    context,
                                  ).textTheme.labelMedium,
                                ),
                              Text(message.text),
                              const SizedBox(height: 4),
                              Text(
                                _time(message.createdAt),
                                style: Theme.of(context).textTheme.labelSmall,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
      ),
      const Divider(height: 1),
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
