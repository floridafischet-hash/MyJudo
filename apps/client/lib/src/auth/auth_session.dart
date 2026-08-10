class AuthSession {
  const AuthSession({
    required this.userId,
    required this.accessToken,
    required this.refreshToken,
    required this.expiresIn,
    required this.permissions,
    required this.username,
    this.firstName,
    this.displayName,
  });

  final String userId;
  final String accessToken;
  final String refreshToken;
  final int expiresIn;
  final Set<String> permissions;
  final String username;
  final String? firstName;
  final String? displayName;

  String get greetingName {
    final first = firstName?.trim();
    if (first != null && first.isNotEmpty) return first;
    final display = displayName?.trim();
    if (display != null && display.isNotEmpty) return display;
    return username;
  }

  factory AuthSession.fromJson(Map<String, dynamic> json) => AuthSession(
    userId: json['userId'] as String,
    accessToken: json['accessToken'] as String,
    refreshToken: json['refreshToken'] as String,
    expiresIn: (json['expiresIn'] as num).toInt(),
    permissions: ((json['permissions'] as List<dynamic>?) ?? const [])
        .whereType<String>()
        .toSet(),
    username: json['username'] as String,
    firstName: json['firstName'] as String?,
    displayName: json['displayName'] as String?,
  );
}
