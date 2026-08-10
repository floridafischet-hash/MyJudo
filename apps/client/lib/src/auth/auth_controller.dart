import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'auth_repository.dart';
import 'auth_session.dart';

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(),
);

final authControllerProvider =
    AsyncNotifierProvider<AuthController, AuthSession?>(AuthController.new);

class AuthController extends AsyncNotifier<AuthSession?> {
  @override
  Future<AuthSession?> build() => ref.read(authRepositoryProvider).restore();

  Future<void> login() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(authRepositoryProvider).login(),
    );
  }

  Future<void> logout() async {
    final session = state.value;
    if (session != null) {
      await ref.read(authRepositoryProvider).logout(session.refreshToken);
    } else {
      await ref.read(authRepositoryProvider).clearLocalSession();
    }
    state = const AsyncData(null);
  }
}
