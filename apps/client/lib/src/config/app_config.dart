class AppConfig {
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://127.0.0.1:18779/api/v1',
  );

  static Uri apiUri(String path) => Uri.parse('$apiBaseUrl/$path');
}
