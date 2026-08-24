import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:myjudo_client/src/chat/chat_models.dart';
import 'package:myjudo_client/src/chat/chat_page.dart';
import 'package:myjudo_client/src/chat/chat_repository.dart';

void main() {
  test('inserts one or multiple emojis at the current cursor position', () {
    final controller = TextEditingController(text: 'Training super');
    controller.selection = const TextSelection.collapsed(offset: 8);
    insertEmoji(controller, '🥋');
    insertEmoji(controller, '👍');
    expect(controller.text, 'Training🥋👍 super');
  });
  test('parses an admin-renamed chat and its selected symbol for users', () {
    final chat = ChatSummary.fromJson({
      'id': 'chat-1',
      'type': 'group',
      'title': 'Neuer Vereinschat',
      'description': 'Aktuelle Vereinsinformationen',
      'icon': 'campaign',
      'unreadCount': 0,
    });
    expect(chat.title, 'Neuer Vereinschat');
    expect(chat.icon, 'campaign');
    expect(chat.description, 'Aktuelle Vereinsinformationen');
    expect(chatIcon(chat.icon), Icons.campaign_outlined);
  });
  test('parses nested web JSON maps without dropping persisted messages', () {
    final page = MessagePage.fromJson({
      'items': <dynamic>[
        <dynamic, dynamic>{
          'id': 'message-live',
          'senderId': 'stefan-id',
          'senderName': 'Stefan Superuser',
          'text': 'Hallo',
          'createdAt': '2026-08-11T12:39:41.037Z',
        },
      ],
      'nextBefore': null,
    });

    expect(page.items, hasLength(1));
    expect(page.items.single.text, 'Hallo');
  });

  test(
    'repository accepts web-style dynamic maps for a persisted message page',
    () async {
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) => handler.resolve(
            Response<dynamic>(
              requestOptions: options,
              statusCode: 200,
              data: <dynamic, dynamic>{
                'items': <dynamic>[
                  <dynamic, dynamic>{
                    'id': 'message-live',
                    'senderId': 'stefan-id',
                    'senderName': 'Stefan Superuser',
                    'text': 'Live-Chat-Test',
                    'createdAt': '2026-08-11T13:29:31.927Z',
                  },
                ],
                'nextBefore': null,
              },
            ),
          ),
        ),
      );
      final repository = ChatRepository(accessToken: 'test-token', dio: dio);

      final page = await repository.listMessages('chat-live');

      expect(page.items, hasLength(1));
      expect(page.items.single.text, 'Live-Chat-Test');
    },
  );

  test('first message request never sends an empty cursor', () async {
    RequestOptions? request;
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          request = options;
          handler.resolve(
            Response<dynamic>(
              requestOptions: options,
              statusCode: 200,
              data: <String, dynamic>{'items': <dynamic>[], 'nextBefore': null},
            ),
          );
        },
      ),
    );
    final repository = ChatRepository(accessToken: 'test-token', dio: dio);

    await repository.listMessages('chat-live');

    expect(request?.queryParameters, {'limit': 50});
  });

  test('full conversation is ordered oldest first and newest last', () async {
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) => handler.resolve(
          Response<dynamic>(
            requestOptions: options,
            statusCode: 200,
            data: <String, dynamic>{
              'items': <dynamic>[
                <String, dynamic>{
                  'id': 'new',
                  'senderId': 'stefan-id',
                  'senderName': 'Stefan',
                  'text': 'Neueste Nachricht',
                  'createdAt': '2026-08-11T13:30:00.000Z',
                },
                <String, dynamic>{
                  'id': 'old',
                  'senderId': 'florian-id',
                  'senderName': 'Florian',
                  'text': 'Älteste Nachricht',
                  'createdAt': '2026-08-11T12:30:00.000Z',
                },
              ],
              'nextBefore': null,
            },
          ),
        ),
      ),
    );
    final repository = ChatRepository(accessToken: 'test-token', dio: dio);

    final messages = await repository.listAllMessages('chat-live');

    expect(messages.map((message) => message.id), ['old', 'new']);
  });

  test(
    'image upload sends multipart bytes and optional text together',
    () async {
      FormData? uploaded;
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            uploaded = options.data as FormData;
            handler.resolve(
              Response<dynamic>(
                requestOptions: options,
                statusCode: 201,
                data: <String, dynamic>{
                  'id': 'image-message',
                  'senderId': 'current-user',
                  'senderName': 'Ich',
                  'text': 'Turnier 🥋',
                  'createdAt': '2026-08-12T10:00:00.000Z',
                  'imageUrl':
                      '/api/v1/chats/chat-1/messages/image-message/image',
                },
              ),
            );
          },
        ),
      );
      final repository = ChatRepository(accessToken: 'test-token', dio: dio);

      final result = await repository.sendImage(
        'chat-1',
        Uint8List.fromList(<int>[0xff, 0xd8, 0xff, 0xd9]),
        'turnier.jpg',
        text: 'Turnier 🥋',
      );

      expect(uploaded?.fields.single.key, 'text');
      expect(uploaded?.fields.single.value, 'Turnier 🥋');
      expect(uploaded?.files.single.key, 'image');
      expect(uploaded?.files.single.value.filename, 'turnier.jpg');
      expect(result.imageUrl, isNotNull);
      expect(result.text, 'Turnier 🥋');
    },
  );

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
    await tester.tap(find.text('Allgemein').first);
    await tester.pumpAndSettle();
    // The latest message appears in the chat preview and the conversation.
    expect(find.text('Willkommen'), findsNWidgets(2));
    await tester.tap(find.byKey(const Key('emoji-button')));
    await tester.pumpAndSettle();
    expect(find.text('Emoji auswählen'), findsOneWidget);
    await tester.tap(find.byKey(const Key('chat-emoji-😀')).first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Fertig'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Neue Nachricht');
    await tester.tap(find.byTooltip('Senden'));
    await tester.pumpAndSettle();

    expect(repository.sentText, 'Neue Nachricht');
    expect(find.text('Neue Nachricht'), findsOneWidget);
    expect(repository.markedRead, 1);
  });

  testWidgets('opens a chat at the newest message at the bottom', (
    tester,
  ) async {
    final repository = _ManyMessagesChatRepository();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 1000,
            height: 500,
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
    await tester.tap(find.text('Allgemein').first);
    await tester.pumpAndSettle();

    final list = find.byKey(const Key('chat-message-list'));
    final scrollable = tester.state<ScrollableState>(
      find.descendant(of: list, matching: find.byType(Scrollable)).first,
    );
    expect(scrollable.position.maxScrollExtent, greaterThan(0));
    expect(scrollable.position.pixels, 0);
    expect(find.text('Nachricht 39'), findsOneWidget);
  });

  testWidgets('Enter sends exactly once while empty Enter sends nothing', (
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
    await tester.tap(find.text('Allgemein').first);
    await tester.pumpAndSettle();
    final input = find.byKey(const Key('chat-message-input'));
    await tester.tap(input);
    await tester.enterText(input, 'Hallo per Enter');
    await tester.sendKeyEvent(LogicalKeyboardKey.enter);
    await tester.pumpAndSettle();
    expect(repository.sent, 1);
    expect(repository.sentText, 'Hallo per Enter');
    await tester.tap(input);
    await tester.enterText(input, '   \n');
    await tester.sendKeyEvent(LogicalKeyboardKey.enter);
    await tester.pump();
    expect(repository.sent, 1);
  });

  testWidgets('Shift Enter does not submit the message', (tester) async {
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
    await tester.tap(find.text('Allgemein').first);
    await tester.pumpAndSettle();
    final input = find.byKey(const Key('chat-message-input'));
    await tester.tap(input);
    await tester.enterText(input, 'Zeile eins');
    await tester.sendKeyDownEvent(LogicalKeyboardKey.shiftLeft);
    await tester.sendKeyEvent(LogicalKeyboardKey.enter);
    await tester.sendKeyUpEvent(LogicalKeyboardKey.shiftLeft);
    await tester.pump();
    expect(repository.sent, 0);
  });

  testWidgets('superuser confirms and deletes a foreign message for everyone', (
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
              canDeleteAll: true,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Allgemein').first);
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('message-menu-message-1')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Nachricht löschen'));
    await tester.pumpAndSettle();
    expect(find.text('Nachricht wirklich löschen?'), findsOneWidget);
    await tester.tap(find.widgetWithText(FilledButton, 'Löschen'));
    await tester.pumpAndSettle();
    expect(repository.deletedMessageId, 'message-1');
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
  int sent = 0;
  String? deletedMessageId;
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
  Future<void> markRead(String chatId, {String? messageId}) async {
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
    sent += 1;
    return ChatMessage(
      id: 'message-2',
      senderId: 'current-user',
      senderName: 'Ich',
      text: text,
      createdAt: DateTime.utc(2026, 8, 10, 10, 1),
    );
  }

  @override
  Future<void> deleteMessage(String chatId, String messageId) async {
    deletedMessageId = messageId;
  }
}

class _ManyMessagesChatRepository extends _FakeChatRepository {
  @override
  Future<MessagePage> listMessages(String chatId, {String? before}) async =>
      MessagePage(
        items: List.generate(
          40,
          (index) => ChatMessage(
            id: 'message-$index',
            senderId: 'other-user',
            senderName: 'Andere Person',
            text: 'Nachricht $index',
            createdAt: DateTime.utc(2026, 8, 10, 10, index),
          ),
        ).reversed.toList(),
        nextBefore: null,
      );
}
