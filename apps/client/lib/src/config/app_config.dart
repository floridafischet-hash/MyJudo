class AppConfig {
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://127.0.0.1:18779/api/v1',
  );

  static const keycloakUrl = String.fromEnvironment(
    'KEYCLOAK_URL',
    defaultValue: 'http://127.0.0.1:8080/keycloak',
  );
  static const keycloakRealm = String.fromEnvironment(
    'KEYCLOAK_REALM',
    defaultValue: 'myjudo',
  );
  static const keycloakClientId = String.fromEnvironment(
    'KEYCLOAK_CLIENT_ID',
    defaultValue: 'myjudo-client',
  );

  static String get _realmUrl => '$keycloakUrl/realms/$keycloakRealm';
  static String get keycloakAuthorizationEndpoint =>
      '$_realmUrl/protocol/openid-connect/auth';
  static String get keycloakTokenEndpoint =>
      '$_realmUrl/protocol/openid-connect/token';
  static String get keycloakLogoutEndpoint =>
      '$_realmUrl/protocol/openid-connect/logout';

  static Uri apiUri(String path) => Uri.parse('$apiBaseUrl/$path');
}
