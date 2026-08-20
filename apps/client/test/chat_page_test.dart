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

  testWidgets('searches an approved user and opens a direct chat', (
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
    await tester.tap(find.text('Neue Direktnachricht'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextField, 'Freigegebene Person suchen'),
      'Stefan',
    );
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Stefan Test'));
    await tester.pumpAndSettle();

    expect(repository.directorySearch, 'Stefan');
    expect(repository.directParticipantId, 'stefan-id');
    expect(find.text('Stefan Test'), findsNWidgets(2));
  });
}

class _FakeChatRepository extends ChatRepository {
  _FakeChatRepository() : super(accessToken: 'test-token');

  String? sentText;
  int markedRead = 0;
  String? directorySearch;
  String? directParticipantId;

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
    if (directParticipantId != null)
      const ChatSummary(
        id: 'direct-chat',
        type: ChatType.direct,
        title: 'Stefan Test',
        unreadCount: 0,
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
  Future<DirectoryPage> searchUsers(String search) async {
    directorySearch = search;
    return const DirectoryPage(
      items: [DirectoryUser(id: 'stefan-id', displayName: 'Stefan Test')],
      total: 1,
    );
  }

  @override
  Future<ChatSummary> createDirect(String participantUserId) async {
    directParticipantId = participantUserId;
    return const ChatSummary(
      id: 'direct-chat',
      type: ChatType.direct,
      title: 'Stefan Test',
      unreadCount: 0,
    );
  }

  @override
  Future<ChatMessage> send(
    String chatId,
    String text, {
    String? replyToId,
  }) async {
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
