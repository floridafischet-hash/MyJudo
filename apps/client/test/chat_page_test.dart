import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:myjudo_client/src/chat/chat_models.dart';
import 'package:myjudo_client/src/chat/chat_page.dart';
import 'package:myjudo_client/src/chat/chat_repository.dart';

void main() {
  testWidgets('loads a permitted chat and sends a persisted message', (
    tester,
  ) async {
    final repository = _FakeChatRepository();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 1000,
            height: 700,
            child: ChatPage(
              accessToken: 'test-token',
              currentUserId: 'current-user',
              repository: repository,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Allgemein'), findsWidgets);
    // The latest message appears in the chat preview and the conversation.
    expect(find.text('Willkommen'), findsNWidgets(2));
    await tester.enterText(find.byType(TextField), 'Neue Nachricht');
    await tester.tap(find.byTooltip('Senden'));
    await tester.pumpAndSettle();

    expect(repository.sentText, 'Neue Nachricht');
    expect(find.text('Neue Nachricht'), findsOneWidget);
    expect(repository.markedRead, 1);
  });
}

class _FakeChatRepository extends ChatRepository {
  _FakeChatRepository() : super(accessToken: 'test-token');

  String? sentText;
  int markedRead = 0;

  @override
  Future<List<ChatSummary>> listChats() async => [
    ChatSummary(
      id: 'chat-1',
      type: ChatType.group,
      title: 'Allgemein',
      unreadCount: 1,
      lastMessage: ChatMessage(
        id: 'message-1',
        senderId: 'other-user',
        senderName: 'Andere Person',
        text: 'Willkommen',
        createdAt: DateTime.utc(2026, 8, 10, 10),
      ),
    ),
  ];

  @override
  Future<MessagePage> listMessages(String chatId, {String? before}) async =>
      MessagePage(
        items: [
          ChatMessage(
            id: 'message-1',
            senderId: 'other-user',
            senderName: 'Andere Person',
            text: 'Willkommen',
            createdAt: DateTime.utc(2026, 8, 10, 10),
          ),
        ],
        nextBefore: null,
      );

  @override
  Future<void> markRead(String chatId) async {
    markedRead += 1;
  }

  @override
  Future<ChatMessage> send(String chatId, String text) async {
    sentText = text;
    return ChatMessage(
      id: 'message-2',
      senderId: 'current-user',
      senderName: 'Ich',
      text: text,
      createdAt: DateTime.utc(2026, 8, 10, 10, 1),
    );
  }
}
