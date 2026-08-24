import 'package:flutter/foundation.dart';

class AppConfig {
  static const _configuredApiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: '',
  );

  static String get apiBaseUrl => _configuredApiBaseUrl.isNotEmpty
      ? _configuredApiBaseUrl
      : kIsWeb
      ? '${Uri.base.origin}/api/v1'
      : 'http://127.0.0.1:18779/api/v1';

  static Uri apiUri(String path) => Uri.parse('$apiBaseUrl/$path');
}
