import 'package:dio/dio.dart';

import '../config/app_config.dart';
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

  Future<MessagePage> listMessages(String chatId, {String? before}) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/chats/$chatId/messages',
        queryParameters: {'before': ?before, 'limit': 50},
      );
      return MessagePage.fromJson(response.data ?? const {});
    } on DioException catch (error) {
      throw ChatApiException(_messageFor(error));
    }
  }

  Future<ChatMessage> send(String chatId, String text) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/chats/$chatId/messages',
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

  void dispose() {
    if (_ownsDio) _dio.close();
  }
}

String _messageFor(DioException error) => switch (error.response?.statusCode) {
  403 || 404 => 'Dieser Chat ist nicht mehr verfügbar.',
  _ => 'Die Kommunikation konnte nicht geladen werden.',
};
