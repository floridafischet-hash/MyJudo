import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'auth_repository.dart';
import 'auth_session.dart';

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(),
);

final authControllerProvider =
    AsyncNotifierProvider<AuthController, AuthSession?>(AuthController.new);

class AuthController extends AsyncNotifier<AuthSession?> {
  Timer? _refreshTimer;

  @override
  Future<AuthSession?> build() async {
    ref.onDispose(() => _refreshTimer?.cancel());
    final session = await ref.read(authRepositoryProvider).restore();
    if (session != null) _scheduleRefresh(session);
    return session;
  }

  Future<void> login({
    required String username,
    required String password,
  }) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref
          .read(authRepositoryProvider)
          .login(username: username, password: password),
    );
    final session = state.value;
    if (session != null) _scheduleRefresh(session);
  }

  void _scheduleRefresh(AuthSession session) {
    _refreshTimer?.cancel();
    final refreshAfter = Duration(
      seconds: session.expiresIn > 90
          ? session.expiresIn - 60
          : session.expiresIn ~/ 2,
    );
    _refreshTimer = Timer(refreshAfter, _refresh);
  }

  Future<void> _refresh() async {
    final session = state.value;
    if (session == null) return;
    try {
      final refreshed = await ref
          .read(authRepositoryProvider)
          .refresh(session.refreshToken);
      state = AsyncData(refreshed);
      _scheduleRefresh(refreshed);
    } on AuthException {
      _refreshTimer = Timer(const Duration(seconds: 15), _refresh);
    }
  }

  Future<void> logout() async {
    _refreshTimer?.cancel();
    final session = state.value;
    if (session != null) {
      await ref.read(authRepositoryProvider).logout(session.refreshToken);
    } else {
      await ref.read(authRepositoryProvider).clearLocalSession();
    }
    state = const AsyncData(null);
  }
}
