import 'package:dio/dio.dart';
import '../config/app_config.dart';

class NotificationSettings {
  const NotificationSettings({
    required this.enabled,
    required this.chatMessages,
    required this.showMessagePreview,
  });
  factory NotificationSettings.fromJson(Map<String, dynamic> json) =>
      NotificationSettings(
        enabled: json['enabled'] as bool? ?? false,
        chatMessages: json['chatMessages'] as bool? ?? true,
        showMessagePreview: json['showMessagePreview'] as bool? ?? false,
      );
  final bool enabled;
  final bool chatMessages;
  final bool showMessagePreview;
  Map<String, dynamic> toJson() => {
    'enabled': enabled,
    'chatMessages': chatMessages,
    'showMessagePreview': showMessagePreview,
  };
  NotificationSettings copyWith({
    bool? enabled,
    bool? chatMessages,
    bool? showMessagePreview,
  }) => NotificationSettings(
    enabled: enabled ?? this.enabled,
    chatMessages: chatMessages ?? this.chatMessages,
    showMessagePreview: showMessagePreview ?? this.showMessagePreview,
  );
}

class NotificationRepository {
  NotificationRepository({required String accessToken, Dio? dio})
    : _dio =
          dio ??
          Dio(
            BaseOptions(
              baseUrl: AppConfig.apiBaseUrl,
              headers: {'Authorization': 'Bearer $accessToken'},
            ),
          ),
      _ownsDio = dio == null;
  final Dio _dio;
  final bool _ownsDio;
  Future<NotificationSettings> getSettings() async {
    final response = await _dio.get<dynamic>('/notifications/settings');
    return NotificationSettings.fromJson(
      Map<String, dynamic>.from(response.data as Map),
    );
  }

  Future<NotificationSettings> updateSettings(
    NotificationSettings settings,
  ) async {
    final response = await _dio.put<dynamic>(
      '/notifications/settings',
      data: settings.toJson(),
    );
    return NotificationSettings.fromJson(
      Map<String, dynamic>.from(response.data as Map),
    );
  }

  void dispose() {
    if (_ownsDio) _dio.close();
  }
}
