class AuthSession {
  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresIn,
    required this.permissions,
    required this.username,
    this.firstName,
    this.displayName,
  });

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
}
