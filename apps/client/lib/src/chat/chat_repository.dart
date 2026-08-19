import 'package:dio/dio.dart';

import '../config/app_config.dart';
import '../training/training_models.dart';
import 'chat_models.dart';

class ChatApiException implements Exception {
  const ChatApiException(this.message);
  final String message;

  @override
  String toString() => message;
}

class ChatRepository {
  ChatRepository({required String accessToken, Dio? dio})
    : _dio =
          dio ??
          Dio(
            BaseOptions(
              baseUrl: AppConfig.apiBaseUrl,
              headers: {'Authorization': 'Bearer $accessToken'},
              connectTimeout: const Duration(seconds: 10),
              receiveTimeout: const Duration(seconds: 15),
            ),
          ),
      _ownsDio = dio == null;

  final Dio _dio;
  final bool _ownsDio;

  Future<List<ChatSummary>> listChats() async {
    try {
      final response = await _dio.get<List<dynamic>>('/chats');
      return (response.data ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(ChatSummary.fromJson)
          .toList();
    } on DioException catch (error) {
      throw ChatApiException(_messageFor(error));
    }
  }

  Future<DirectoryPage> searchUsers(String search) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/users/directory',
        queryParameters: {'search': search.trim(), 'pageSize': 20},
      );
      return DirectoryPage.fromJson(response.data ?? const {});
    } on DioException catch (error) {
      throw ChatApiException(_messageFor(error));
    }
  }

  Future<ChatSummary> createDirect(String participantUserId) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/chats/direct',
        data: {'participantUserId': participantUserId},
      );
      return ChatSummary.fromJson(response.data ?? const {});
    } on DioException catch (error) {
      throw ChatApiException(_messageFor(error));
    }
  }

  Future<MessagePage> listMessages(String chatId, {String? before}) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/chats/$chatId/messages',
        queryParameters: {'before': before, 'limit': 50},
      );
      return MessagePage.fromJson(response.data ?? const {});
    } on DioException catch (error) {
      throw ChatApiException(_messageFor(error));
    }
  }

  Future<ChatMessage> send(String chatId, String text, {String? replyToId}) async {
    try {
      final data = <String, dynamic>{'text': text.trim()};
      if (replyToId != null) data['replyToId'] = replyToId;
      final response = await _dio.post<Map<String, dynamic>>(
        '/chats/$chatId/messages',
        data: data,
      );
      return ChatMessage.fromJson(response.data ?? const {});
    } on DioException catch (error) {
      throw ChatApiException(_messageFor(error));
    }
  }

  Future<void> deleteMessage(String chatId, String messageId) async {
    try {
      await _dio.delete<void>('/chats/$chatId/messages/$messageId');
    } on DioException catch (error) {
      throw ChatApiException(_messageFor(error));
    }
  }

  Future<ChatMessage> editMessage(String chatId, String messageId, String text) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        '/chats/$chatId/messages/$messageId',
        data: {'text': text.trim()},
      );
      return ChatMessage.fromJson(response.data ?? const {});
    } on DioException catch (error) {
      throw ChatApiException(_messageFor(error));
    }
  }

  Future<void> markRead(String chatId) async {
    try {
      await _dio.post<void>('/chats/$chatId/read');
    } on DioException catch (error) {
      throw ChatApiException(_messageFor(error));
    }
  }

  Future<List<ChatSummary>> listAdminChats() async {
    try {
      final response = await _dio.get<List<dynamic>>('/chats/admin');
      return (response.data ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(ChatSummary.fromJson)
          .toList();
    } on DioException catch (error) {
      throw ChatApiException(_messageFor(error));
    }
  }

  Future<List<TrainingGroup>> listAdminGroups() async {
    try {
      final response = await _dio.get<List<dynamic>>('/chats/admin/groups');
      return (response.data ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(TrainingGroup.fromJson)
          .toList();
    } on DioException catch (error) {
      throw ChatApiException(_messageFor(error));
    }
  }

  Future<ChatSummary> saveManagedChat({
    String? id,
    required String title,
    required String description,
    required String icon,
    required List<String> groupIds,
    required bool archived,
    required bool active,
  }) async {
    try {
      final data = {
        'title': title,
        'description': description,
        'icon': icon,
        'groupIds': groupIds,
        'archived': archived,
        'active': active,
      };
      final response = id == null
          ? await _dio.post<Map<String, dynamic>>('/chats/admin', data: data)
          : await _dio.put<Map<String, dynamic>>('/chats/admin/$id', data: data);
      return ChatSummary.fromJson(response.data ?? const {});
    } on DioException catch (error) {
      throw ChatApiException(_messageFor(error));
    }
  }

  Future<void> deleteManagedChat(String id) async {
    try {
      await _dio.delete<void>('/chats/admin/$id');
    } on DioException catch (error) {
      throw ChatApiException(_messageFor(error));
    }
  }

  void dispose() {
    if (_ownsDio) _dio.close();
  }
}

String _messageFor(DioException error) => switch (error.response?.statusCode) {
  403 || 404 => 'Dieser Chat ist nicht mehr verfügbar.',
  _ => 'Die Kommunikation konnte nicht geladen werden.',
};
