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
    this.description,
    this.icon,
    this.groupIds = const [],
    this.archived = false,
    this.active = true,
    this.lastMessage,
  });

  factory ChatSummary.fromJson(Map<String, dynamic> json) => ChatSummary(
    id: json['id'] as String,
    type: ChatType.fromApi(json['type'] as String),
    title: json['title'] as String,
    unreadCount: json['unreadCount'] as int? ?? 0,
    description: json['description'] as String?,
    icon: json['icon'] as String?,
    groupIds: (json['groupIds'] as List<dynamic>?)?.cast<String>() ?? const [],
    archived: json['archived'] as bool? ?? false,
    active: json['active'] as bool? ?? true,
    lastMessage: json['lastMessage'] is Map<String, dynamic>
        ? ChatMessage.fromJson(json['lastMessage'] as Map<String, dynamic>)
        : null,
  );

  final String id;
  final ChatType type;
  final String title;
  final String? description;
  final String? icon;
  final List<String> groupIds;
  final bool archived;
  final bool active;
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
    this.editedAt,
    this.replyToId,
    this.replyToText,
    this.imageUrl,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
    id: json['id'] as String,
    senderId: json['senderId'] as String,
    senderName: json['senderName'] as String,
    text: json['text'] as String,
    createdAt: DateTime.parse(json['createdAt'] as String),
    editedAt: json['editedAt'] != null
        ? DateTime.parse(json['editedAt'] as String)
        : null,
    replyToId: json['replyToId'] as String?,
    replyToText: json['replyToText'] as String?,
    imageUrl: json['imageUrl'] as String?,
  );

  final String id;
  final String senderId;
  final String senderName;
  final String text;
  final DateTime createdAt;
  final DateTime? editedAt;
  final String? replyToId;
  final String? replyToText;
  final String? imageUrl;

  bool get isEdited => editedAt != null;

  ChatMessage copyWith({String? text, DateTime? editedAt}) => ChatMessage(
    id: id,
    senderId: senderId,
    senderName: senderName,
    text: text ?? this.text,
    createdAt: createdAt,
    editedAt: editedAt ?? this.editedAt,
    replyToId: replyToId,
    replyToText: replyToText,
    imageUrl: imageUrl,
  );
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

class DirectoryUser {
  const DirectoryUser({required this.id, required this.displayName});

  factory DirectoryUser.fromJson(Map<String, dynamic> json) => DirectoryUser(
    id: json['id'] as String,
    displayName: json['displayName'] as String,
  );

  final String id;
  final String displayName;
}

class DirectoryPage {
  const DirectoryPage({required this.items, required this.total});

  factory DirectoryPage.fromJson(Map<String, dynamic> json) => DirectoryPage(
    items: (json['items'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(DirectoryUser.fromJson)
        .toList(),
    total: json['total'] as int? ?? 0,
  );

  final List<DirectoryUser> items;
  final int total;
}
