import 'package:flutter_test/flutter_test.dart';
import 'package:myjudo_client/src/notifications/chat_notification_monitor.dart';
import 'package:myjudo_client/src/notifications/notification_repository.dart';

void main() {
  const enabled = NotificationSettings(
    enabled: true,
    chatMessages: true,
    showMessagePreview: false,
  );

  bool decide({String sender = 'user-b', bool open = false}) =>
      shouldShowChatNotification(
        initialized: true,
        chatIsOpen: open,
        previousMessageId: 'message-1',
        currentMessageId: 'message-2',
        senderId: sender,
        currentUserId: 'user-a',
        unreadCount: 1,
        settings: enabled,
      );

  test('neue fremde Chatnachricht erzeugt eine Benachrichtigung', () {
    expect(decide(), isTrue);
  });

  test('eigene Nachricht erzeugt keine Benachrichtigung', () {
    expect(decide(sender: 'user-a'), isFalse);
  });

  test('im geöffneten Chat wird keine Benachrichtigung erzeugt', () {
    expect(decide(open: true), isFalse);
  });

  test('deaktivierte Einstellung verhindert Benachrichtigungen', () {
    expect(
      shouldShowChatNotification(
        initialized: true,
        chatIsOpen: false,
        previousMessageId: 'message-1',
        currentMessageId: 'message-2',
        senderId: 'user-b',
        currentUserId: 'user-a',
        unreadCount: 1,
        settings: const NotificationSettings(
          enabled: false,
          chatMessages: true,
          showMessagePreview: false,
        ),
      ),
      isFalse,
    );
  });
}
