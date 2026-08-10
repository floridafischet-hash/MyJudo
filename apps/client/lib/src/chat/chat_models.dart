enum ChatType {
  group,
  direct;

  static ChatType fromApi(String value) =>
      value == 'direct' ? ChatType.direct : ChatType.group;
}

class ChatSummary {
  const ChatSummary({
    required this.id,
    required this.type,
    required this.title,
    required this.unreadCount,
    this.lastMessage,
  });

  factory ChatSummary.fromJson(Map<String, dynamic> json) => ChatSummary(
    id: json['id'] as String,
    type: ChatType.fromApi(json['type'] as String),
    title: json['title'] as String,
    unreadCount: json['unreadCount'] as int? ?? 0,
    lastMessage: json['lastMessage'] is Map<String, dynamic>
        ? ChatMessage.fromJson(json['lastMessage'] as Map<String, dynamic>)
        : null,
  );

  final String id;
  final ChatType type;
  final String title;
  final int unreadCount;
  final ChatMessage? lastMessage;
}

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.senderId,
    required this.senderName,
    required this.text,
    required this.createdAt,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
    id: json['id'] as String,
    senderId: json['senderId'] as String,
    senderName: json['senderName'] as String,
    text: json['text'] as String,
    createdAt: DateTime.parse(json['createdAt'] as String),
  );

  final String id;
  final String senderId;
  final String senderName;
  final String text;
  final DateTime createdAt;
}

class MessagePage {
  const MessagePage({required this.items, required this.nextBefore});

  factory MessagePage.fromJson(Map<String, dynamic> json) => MessagePage(
    items: (json['items'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(ChatMessage.fromJson)
        .toList(),
    nextBefore: json['nextBefore'] as String?,
  );

  final List<ChatMessage> items;
  final String? nextBefore;
}
