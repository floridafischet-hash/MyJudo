import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../config/app_config.dart';
import 'auth_session.dart';

class AuthException implements Exception {
  const AuthException(this.message);
  final String message;
  @override
  String toString() => message;
}

class AuthRepository {
  AuthRepository({Dio? dio, FlutterSecureStorage? storage})
    : _dio = dio ?? Dio(BaseOptions(baseUrl: AppConfig.apiBaseUrl, connectTimeout: const Duration(seconds: 10))),
      _storage = storage ?? const FlutterSecureStorage();

  static const _refreshKey = 'myjudo.refresh-token';
  final Dio _dio;
  final FlutterSecureStorage _storage;

  Future<AuthSession?> restore() async {
    if (kIsWeb) return null;
    final refreshToken = await _storage.read(key: _refreshKey);
    if (refreshToken == null) return null;
    try {
      final response = await _dio.post<Map<String, dynamic>>('/auth/refresh', data: {'refreshToken': refreshToken});
      final session = AuthSession.fromJson(_requiredBody(response));
      await _persistRefresh(session.refreshToken);
      return session;
    } on DioException {
      await clearLocalSession();
      return null;
    }
  }

  Future<AuthSession> login({required String username, required String password}) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/login',
        data: {'username': username, 'password': password},
      );
      final session = AuthSession.fromJson(_requiredBody(response));
      await _persistRefresh(session.refreshToken);
      return session;
    } on DioException catch (error) {
      throw AuthException(_messageFor(error));
    }
  }

  Future<void> logout(String refreshToken) async {
    try {
      await _dio.post<void>('/auth/logout', data: {'refreshToken': refreshToken});
    } on DioException {
      // Local logout remains effective even when the server session expired.
    } finally {
      await clearLocalSession();
    }
  }

  Future<void> clearLocalSession() => _storage.delete(key: _refreshKey);

  Future<void> _persistRefresh(String refreshToken) async {
    if (!kIsWeb) await _storage.write(key: _refreshKey, value: refreshToken);
  }

  Map<String, dynamic> _requiredBody(Response<Map<String, dynamic>> response) =>
      response.data ?? (throw const AuthException('Die Serverantwort war unvollständig.'));

  String _messageFor(DioException error) {
    final body = error.response?.data;
    if (body is Map<String, dynamic> && body['message'] is String) return body['message'] as String;
    if (error.type == DioExceptionType.connectionTimeout || error.type == DioExceptionType.connectionError) {
      return 'Der Server ist derzeit nicht erreichbar. Bitte versuche es erneut.';
    }
    return 'Die Anmeldung konnte nicht durchgeführt werden.';
  }
}
