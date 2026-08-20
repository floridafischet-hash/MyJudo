import 'dart:async';

import 'package:dio/dio.dart';
import 'package:emoji_picker_flutter/emoji_picker_flutter.dart';
import 'package:flutter/foundation.dart' as foundation;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import '../config/app_config.dart';
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
  late ChatRepository _repository;
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
  bool _emojiPickerVisible = false;
  final _imagePicker = ImagePicker();

  @override
  void initState() {
    super.initState();
    _repository = widget.repository ?? ChatRepository(accessToken: widget.accessToken);
    unawaited(_loadChats());
    _refreshTimer = Timer.periodic(
      const Duration(seconds: 15),
      (_) => unawaited(_pollUpdates()),
    );
  }

  @override
  void didUpdateWidget(covariant ChatPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.repository == null && widget.accessToken != oldWidget.accessToken) {
      _repository.dispose();
      _repository = ChatRepository(accessToken: widget.accessToken);
      unawaited(_loadChats());
    }
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
      final page = await _repository.listMessages(selected.id);
      if (!mounted || _selected?.id != selected.id) return;
      final existingIds = _messages.map((m) => m.id).toSet();
      final incoming = page.items;
      final updated = _messages.map((m) {
        final replacement = incoming.where((i) => i.id == m.id).firstOrNull;
        return replacement ?? m;
      }).toList();
      final newMessages = incoming.where((m) => !existingIds.contains(m.id)).toList();
      if (newMessages.isNotEmpty || updated != _messages) {
        setState(() => _messages = [...newMessages, ...updated]);
        if (newMessages.isNotEmpty) _scrollToBottom();
      }
    } on ChatApiException {
      // silent
    }
  }

  Future<void> _loadMessages(ChatSummary chat) async {
    setState(() {
      _selected = chat;
      _loadingMessages = true;
      _nextBefore = null;
      _error = null;
      _replyingTo = null;
      _emojiPickerVisible = false;
    });
    try {
      final page = await _repository.listMessages(chat.id);
      if (!mounted || _selected?.id != chat.id) return;
      setState(() {
        _messages = page.items;
        _nextBefore = page.nextBefore;
      });
      _scrollToBottom();
      unawaited(_loadChats(silent: true));
      unawaited(_repository.markRead(chat.id).catchError((_) {}));
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
        _messages = [..._messages, ...page.items];
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
        _messages = [message, ..._messages];
        _replyingTo = null;
        _emojiPickerVisible = false;
      });
      _scrollToBottom();
      unawaited(_loadChats(silent: true));
    } on ChatApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _pickAndSendImage() async {
    final selected = _selected;
    if (selected == null || _sending) return;
    final picked = await _imagePicker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 85,
      maxWidth: 1920,
      maxHeight: 1920,
    );
    if (picked == null || !mounted) return;
    final bytes = await picked.readAsBytes();
    final caption = _messageController.text.trim();
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      final message = await _repository.sendImage(
        selected.id,
        bytes,
        picked.name,
        text: caption.isNotEmpty ? caption : null,
        replyToId: _replyingTo?.id,
      );
      if (!mounted) return;
      _messageController.clear();
      setState(() {
        _messages = [message, ..._messages];
        _replyingTo = null;
        _emojiPickerVisible = false;
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
            if (isOwn && message.imageUrl == null)
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
        _scrollController.jumpTo(0);
      }
    });
  }

  void _toggleEmojiPicker() {
    setState(() => _emojiPickerVisible = !_emojiPickerVisible);
    if (_emojiPickerVisible) {
      FocusScope.of(context).unfocus();
    }
  }

  void _onEmojiSelected(Category? category, Emoji emoji) {
    final controller = _messageController;
    final text = controller.text;
    final selection = controller.selection;
    final newText = text.replaceRange(
      selection.start < 0 ? text.length : selection.start,
      selection.end < 0 ? text.length : selection.end,
      emoji.emoji,
    );
    controller.value = TextEditingValue(
      text: newText,
      selection: TextSelection.collapsed(
        offset: (selection.start < 0 ? text.length : selection.start) + emoji.emoji.length,
      ),
    );
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
          return _buildConversationView();
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
                  : _buildConversationView(),
            ),
          ],
        );
      },
    );
  }

  Widget _buildConversationView() {
    final chat = _selected!;
    return Column(
      children: [
        // Header
        ListTile(
          leading: MediaQuery.of(context).size.width < 720
              ? IconButton(
                  onPressed: () => setState(() => _selected = null),
                  icon: const Icon(Icons.arrow_back),
                )
              : Icon(
                  chat.type == ChatType.group
                      ? Icons.group_outlined
                      : Icons.person_outline,
                ),
          title: Text(chat.title, style: Theme.of(context).textTheme.titleLarge),
        ),
        const Divider(height: 1),
        if (_error != null)
          MaterialBanner(
            content: Text(_error!),
            actions: [TextButton(onPressed: () {}, child: const Text('OK'))],
          ),
        // Message list
        Expanded(
          child: _loadingMessages && _messages.isEmpty
              ? const Center(child: CircularProgressIndicator())
              : _messages.isEmpty
              ? const Center(child: Text('Noch keine Nachrichten.'))
              : ListView.builder(
                  controller: _scrollController,
                  reverse: true,
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 16),
                  itemCount: _messages.length + (_nextBefore != null ? 1 : 0),
                  itemBuilder: (context, index) {
                    if (index == _messages.length) {
                      return Center(
                        child: TextButton(
                          onPressed: _loadingMessages ? null : _loadOlder,
                          child: const Text('Ältere Nachrichten laden'),
                        ),
                      );
                    }
                    final message = _messages[index];
                    final own = message.senderId == widget.currentUserId;
                    return _SwipeableMessage(
                      key: ValueKey(message.id),
                      onSwipe: () => setState(() => _replyingTo = message),
                      child: _MessageBubble(
                        message: message,
                        own: own,
                        accessToken: widget.accessToken,
                        onLongPress: () => _showMessageActions(message),
                      ),
                    );
                  },
                ),
        ),
        const Divider(height: 1),
        // Reply banner
        if (_replyingTo != null)
          _ReplyBanner(
            message: _replyingTo!,
            onCancel: () => setState(() => _replyingTo = null),
          ),
        // Input bar
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              // Emoji button
              IconButton(
                onPressed: _toggleEmojiPicker,
                icon: Icon(
                  _emojiPickerVisible
                      ? Icons.keyboard_outlined
                      : Icons.emoji_emotions_outlined,
                ),
                tooltip: 'Emoji',
              ),
              // Text field
              Expanded(
                child: TextField(
                  controller: _messageController,
                  enabled: !_sending,
                  maxLength: 4000,
                  minLines: 1,
                  maxLines: 4,
                  textInputAction: TextInputAction.newline,
                  onTap: () {
                    if (_emojiPickerVisible) {
                      setState(() => _emojiPickerVisible = false);
                    }
                  },
                  decoration: const InputDecoration(
                    hintText: 'Nachricht',
                    counterText: '',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.all(Radius.circular(24)),
                    ),
                    contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  ),
                ),
              ),
              // Image button
              IconButton(
                onPressed: _sending ? null : _pickAndSendImage,
                icon: const Icon(Icons.photo_outlined),
                tooltip: 'Bild senden',
              ),
              // Send button
              ValueListenableBuilder<TextEditingValue>(
                valueListenable: _messageController,
                builder: (context, value, child) {
                  final hasText = value.text.trim().isNotEmpty;
                  return IconButton.filled(
                    tooltip: 'Senden',
                    onPressed: (!_sending && hasText) ? _send : null,
                    icon: _sending
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.send),
                  );
                },
              ),
            ],
          ),
        ),
        // Emoji picker
        if (_emojiPickerVisible)
          SizedBox(
            height: 280,
            child: EmojiPicker(
              onEmojiSelected: _onEmojiSelected,
              config: Config(
                height: 280,
                emojiViewConfig: EmojiViewConfig(
                  emojiSizeMax: 28 * (foundation.defaultTargetPlatform == TargetPlatform.iOS ? 1.2 : 1.0),
                ),
                bottomActionBarConfig: const BottomActionBarConfig(enabled: false),
              ),
            ),
          ),
      ],
    );
  }
}

// ─── Swipeable message (swipe right → reply) ─────────────────────────────────

class _SwipeableMessage extends StatefulWidget {
  const _SwipeableMessage({required this.child, required this.onSwipe, super.key});
  final Widget child;
  final VoidCallback onSwipe;

  @override
  State<_SwipeableMessage> createState() => _SwipeableMessageState();
}

class _SwipeableMessageState extends State<_SwipeableMessage>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 200),
  );
  double _drag = 0;
  bool _triggered = false;

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _onHorizontalUpdate(DragUpdateDetails details) {
    if (details.delta.dx < 0) return; // only right swipe
    setState(() => _drag = (_drag + details.delta.dx).clamp(0, 72));
    if (_drag >= 60 && !_triggered) {
      _triggered = true;
      HapticFeedback.lightImpact();
    }
  }

  void _onHorizontalEnd(DragEndDetails details) {
    if (_triggered) widget.onSwipe();
    _triggered = false;
    setState(() => _drag = 0);
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onHorizontalDragUpdate: _onHorizontalUpdate,
      onHorizontalDragEnd: _onHorizontalEnd,
      child: Stack(
        children: [
          if (_drag > 8)
            Positioned(
              left: 8,
              top: 0,
              bottom: 0,
              child: Align(
                alignment: Alignment.centerLeft,
                child: Opacity(
                  opacity: (_drag / 60).clamp(0, 1),
                  child: const Icon(Icons.reply, color: Colors.grey),
                ),
              ),
            ),
          Transform.translate(
            offset: Offset(_drag, 0),
            child: widget.child,
          ),
        ],
      ),
    );
  }
}

// ─── Chat list ────────────────────────────────────────────────────────────────

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
                      chat.lastMessage?.imageUrl != null
                          ? '📷 ${chat.lastMessage!.text.isEmpty ? "Bild" : chat.lastMessage!.text}'
                          : chat.lastMessage?.text ?? 'Noch keine Nachrichten',
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

// ─── Message bubble ───────────────────────────────────────────────────────────

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    required this.message,
    required this.own,
    required this.accessToken,
    required this.onLongPress,
  });

  final ChatMessage message;
  final bool own;
  final String accessToken;
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
            constraints: BoxConstraints(
              maxWidth: MediaQuery.of(context).size.width * 0.75,
            ),
            child: Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (!own)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Text(
                        message.senderName,
                        style: Theme.of(context).textTheme.labelMedium?.copyWith(
                          color: Theme.of(context).colorScheme.primary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  if (message.replyToText != null)
                    _ReplyQuote(text: message.replyToText!),
                  if (message.imageUrl != null)
                    _ChatImage(
                      url: message.imageUrl!,
                      accessToken: accessToken,
                    ),
                  if (message.text.isNotEmpty)
                    Padding(
                      padding: message.imageUrl != null
                          ? const EdgeInsets.only(top: 6)
                          : EdgeInsets.zero,
                      child: Text(message.text),
                    ),
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

// ─── Authenticated image widget ───────────────────────────────────────────────

class _ChatImage extends StatefulWidget {
  const _ChatImage({required this.url, required this.accessToken});
  final String url;
  final String accessToken;

  @override
  State<_ChatImage> createState() => _ChatImageState();
}

class _ChatImageState extends State<_ChatImage> {
  late Future<Uint8List> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Uint8List> _load() async {
    final dio = Dio(BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      headers: {'Authorization': 'Bearer ${widget.accessToken}'},
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 30),
    ));
    try {
      // imageUrl is an absolute path like /api/v1/chats/.../image
      // baseUrl is https://host/api/v1, so we request the path relative to host
      final fullUrl = '${Uri.parse(AppConfig.apiBaseUrl).origin}${widget.url}';
      final response = await dio.get<List<int>>(
        fullUrl,
        options: Options(responseType: ResponseType.bytes),
      );
      return Uint8List.fromList(response.data ?? const []);
    } finally {
      dio.close();
    }
  }

  void _openFullscreen(Uint8List bytes) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => _FullscreenImage(bytes: bytes),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Uint8List>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return const Padding(
            padding: EdgeInsets.all(8),
            child: Icon(Icons.broken_image_outlined, size: 48),
          );
        }
        if (!snapshot.hasData) {
          return const SizedBox(
            height: 120,
            child: Center(child: CircularProgressIndicator()),
          );
        }
        final bytes = snapshot.data!;
        return GestureDetector(
          onTap: () => _openFullscreen(bytes),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: Image.memory(
              bytes,
              fit: BoxFit.cover,
              width: double.infinity,
              height: 200,
            ),
          ),
        );
      },
    );
  }
}

class _FullscreenImage extends StatelessWidget {
  const _FullscreenImage({required this.bytes});
  final Uint8List bytes;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
      ),
      body: Center(
        child: InteractiveViewer(
          child: Image.memory(bytes),
        ),
      ),
    );
  }
}

// ─── Reply quote ──────────────────────────────────────────────────────────────

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

// ─── Reply banner ─────────────────────────────────────────────────────────────

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
                  message.imageUrl != null && message.text.isEmpty
                      ? '📷 Bild'
                      : message.text,
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

// ─── Error view ───────────────────────────────────────────────────────────────

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
