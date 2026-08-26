import 'dart:async';
import 'package:flutter/widgets.dart';
import '../chat/chat_repository.dart';
import 'browser_notifications.dart';
import 'notification_repository.dart';

bool shouldShowChatNotification({
  required bool initialized,
  required bool chatIsOpen,
  required String? previousMessageId,
  required String? currentMessageId,
  required String? senderId,
  required String currentUserId,
  required int unreadCount,
  required NotificationSettings settings,
}) =>
    initialized &&
    !chatIsOpen &&
    currentMessageId != null &&
    previousMessageId != null &&
    previousMessageId != currentMessageId &&
    settings.enabled &&
    settings.chatMessages &&
    unreadCount > 0 &&
    senderId != currentUserId;

class ChatNotificationMonitor extends StatefulWidget {
  const ChatNotificationMonitor({
    required this.accessToken,
    required this.currentUserId,
    required this.chatIsOpen,
    required this.onUnreadChanged,
    super.key,
  });
  final String accessToken;
  final String currentUserId;
  final bool chatIsOpen;
  final ValueChanged<int> onUnreadChanged;
  @override
  State<ChatNotificationMonitor> createState() =>
      _ChatNotificationMonitorState();
}

class _ChatNotificationMonitorState extends State<ChatNotificationMonitor> {
  late final ChatRepository _chats = ChatRepository(
    accessToken: widget.accessToken,
  );
  late final NotificationRepository _notifications = NotificationRepository(
    accessToken: widget.accessToken,
  );
  final Map<String, String?> _lastMessageIds = {};
  Timer? _timer;
  bool _polling = false;
  bool _initialized = false;
  @override
  void initState() {
    super.initState();
    _poll();
    _timer = Timer.periodic(const Duration(seconds: 5), (_) => _poll());
  }

  @override
  void dispose() {
    _timer?.cancel();
    _chats.dispose();
    _notifications.dispose();
    super.dispose();
  }

  Future<void> _poll() async {
    if (_polling) return;
    _polling = true;
    try {
      final settings = await _notifications.getSettings();
      final chats = await _chats.listChats();
      widget.onUnreadChanged(
        chats.fold<int>(0, (sum, chat) => sum + chat.unreadCount),
      );
      for (final chat in chats) {
        final message = chat.lastMessage;
        final previousId = _lastMessageIds[chat.id];
        _lastMessageIds[chat.id] = message?.id;
        if (!shouldShowChatNotification(
          initialized: _initialized,
          chatIsOpen: widget.chatIsOpen,
          previousMessageId: previousId,
          currentMessageId: message?.id,
          senderId: message?.senderId,
          currentUserId: widget.currentUserId,
          unreadCount: chat.unreadCount,
          settings: settings,
        )) {
          continue;
        }
        final currentMessage = message!;
        showBrowserNotification(
          title: 'Neue Nachricht von ${currentMessage.senderName}',
          body: settings.showMessagePreview
              ? currentMessage.text.isNotEmpty
                    ? currentMessage.text
                    : currentMessage.imageUrl != null
                    ? '${currentMessage.senderName} hat ein Bild gesendet.'
                    : 'Neue Nachricht'
              : 'Öffne Zenyo Kizuna, um die Nachricht zu lesen.',
        );
      }
      _initialized = true;
    } on Object {
      // Benachrichtigungsfehler dürfen bestehende App-Funktionen nie stören.
    } finally {
      _polling = false;
    }
  }

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
