import 'package:flutter/foundation.dart';

class AppConfig {
  static const _configuredApiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: '',
  );

  static const _configuredKeycloakUrl = String.fromEnvironment(
    'KEYCLOAK_URL',
    defaultValue: '',
  );
  static const keycloakRealm = String.fromEnvironment(
    'KEYCLOAK_REALM',
    defaultValue: 'myjudo',
  );
  static const keycloakClientId = String.fromEnvironment(
    'KEYCLOAK_CLIENT_ID',
    defaultValue: 'myjudo-client',
  );

  static String get apiBaseUrl => _configuredApiBaseUrl.isNotEmpty
      ? _configuredApiBaseUrl
      : kIsWeb
      ? '${Uri.base.origin}/api/v1'
      : 'http://127.0.0.1:18779/api/v1';

  static String get keycloakUrl => _configuredKeycloakUrl.isNotEmpty
      ? _configuredKeycloakUrl
      : kIsWeb
      ? '${Uri.base.origin}/keycloak'
      : 'http://127.0.0.1:8080/keycloak';

  static String get _realmUrl => '$keycloakUrl/realms/$keycloakRealm';
  static String get keycloakAuthorizationEndpoint =>
      '$_realmUrl/protocol/openid-connect/auth';
  static String get keycloakTokenEndpoint =>
      '$_realmUrl/protocol/openid-connect/token';
  static String get keycloakLogoutEndpoint =>
      '$_realmUrl/protocol/openid-connect/logout';

  static Uri apiUri(String path) => Uri.parse('$apiBaseUrl/$path');
}
