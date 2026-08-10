class AuthSession {
  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresIn,
    required this.permissions,
  });

  final String accessToken;
  final String refreshToken;
  final int expiresIn;
  final Set<String> permissions;

  factory AuthSession.fromJson(Map<String, dynamic> json) {
    return AuthSession(
      accessToken: json['accessToken'] as String,
      refreshToken: json['refreshToken'] as String,
      expiresIn: json['expiresIn'] as int,
      permissions: ((json['permissions'] as List<dynamic>?) ?? const [])
          .whereType<String>()
          .toSet(),
    );
  }
}
