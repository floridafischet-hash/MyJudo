import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';

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
    : _dio =
          dio ?? Dio(BaseOptions(connectTimeout: const Duration(seconds: 10))),
      _storage = storage ?? const FlutterSecureStorage();

  static const _refreshKey = 'myjudo.keycloak.refresh-token';
  final Dio _dio;
  final FlutterSecureStorage _storage;

  Future<AuthSession?> restore() async {
    if (kIsWeb) return null;
    final refreshToken = await _storage.read(key: _refreshKey);
    if (refreshToken == null) return null;
    try {
      return await _refresh(refreshToken);
    } catch (_) {
      await clearLocalSession();
      return null;
    }
  }

  Future<AuthSession> login() async {
    final verifier = _randomUrlSafe(64);
    final state = _randomUrlSafe(32);
    final nonce = _randomUrlSafe(32);
    final challenge = base64Url
        .encode(sha256.convert(utf8.encode(verifier)).bytes)
        .replaceAll('=', '');
    final redirectUri = kIsWeb
        ? '${Uri.base.origin}/auth.html'
        : 'myjudo://auth';
    final authorizationUri = Uri.parse(AppConfig.keycloakAuthorizationEndpoint)
        .replace(
          queryParameters: {
            'client_id': AppConfig.keycloakClientId,
            'redirect_uri': redirectUri,
            'response_type': 'code',
            'scope': 'openid profile email',
            'code_challenge': challenge,
            'code_challenge_method': 'S256',
            'state': state,
            'nonce': nonce,
          },
        );
    try {
      final callback = Uri.parse(
        await FlutterWebAuth2.authenticate(
          url: authorizationUri.toString(),
          callbackUrlScheme: kIsWeb ? Uri.base.scheme : 'myjudo',
        ),
      );
      if (callback.queryParameters['state'] != state) {
        throw const AuthException(
          'Die Anmeldung konnte nicht sicher bestätigt werden.',
        );
      }
      final code = callback.queryParameters['code'];
      if (code == null || code.isEmpty) {
        throw const AuthException('Keycloak lieferte keinen Code.');
      }
      final tokens = await _tokenRequest({
        'grant_type': 'authorization_code',
        'client_id': AppConfig.keycloakClientId,
        'redirect_uri': redirectUri,
        'code': code,
        'code_verifier': verifier,
      });
      return _createSession(tokens);
    } on AuthException {
      rethrow;
    } on DioException catch (error) {
      throw AuthException(_messageFor(error));
    } catch (_) {
      throw const AuthException(
        'Die Anmeldung wurde abgebrochen oder ist fehlgeschlagen.',
      );
    }
  }

  Future<void> logout(String refreshToken) async {
    try {
      await _dio.post<void>(
        AppConfig.keycloakLogoutEndpoint,
        data: {
          'client_id': AppConfig.keycloakClientId,
          'refresh_token': refreshToken,
        },
        options: Options(contentType: Headers.formUrlEncodedContentType),
      );
    } finally {
      await clearLocalSession();
    }
  }

  Future<void> clearLocalSession() => _storage.delete(key: _refreshKey);

  Future<AuthSession> _refresh(String refreshToken) async {
    final tokens = await _tokenRequest({
      'grant_type': 'refresh_token',
      'client_id': AppConfig.keycloakClientId,
      'refresh_token': refreshToken,
    });
    return _createSession(tokens);
  }

  Future<Map<String, dynamic>> _tokenRequest(Map<String, String> data) async {
    final response = await _dio.post<Map<String, dynamic>>(
      AppConfig.keycloakTokenEndpoint,
      data: data,
      options: Options(contentType: Headers.formUrlEncodedContentType),
    );
    return response.data ??
        (throw const AuthException('Keycloak-Antwort war unvollständig.'));
  }

  Future<AuthSession> _createSession(Map<String, dynamic> tokens) async {
    final accessToken = tokens['access_token'] as String;
    final refreshToken = tokens['refresh_token'] as String;
    final profileResponse = await _dio.get<Map<String, dynamic>>(
      '${AppConfig.apiBaseUrl}/auth/me',
      options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
    );
    final profile =
        profileResponse.data ?? (throw const AuthException('Profil fehlt.'));
    if (!kIsWeb) await _storage.write(key: _refreshKey, value: refreshToken);
    return AuthSession(
      userId: profile['id'] as String,
      accessToken: accessToken,
      refreshToken: refreshToken,
      expiresIn: (tokens['expires_in'] as num).toInt(),
      permissions: ((profile['permissions'] as List<dynamic>?) ?? const [])
          .whereType<String>()
          .toSet(),
      username: profile['username'] as String,
      firstName: profile['firstName'] as String?,
      displayName: profile['displayName'] as String?,
    );
  }

  String _randomUrlSafe(int bytes) {
    final random = Random.secure();
    return base64Url
        .encode(List<int>.generate(bytes, (_) => random.nextInt(256)))
        .replaceAll('=', '');
  }

  String _messageFor(DioException error) {
    if (error.response?.statusCode == 401 ||
        error.response?.statusCode == 403) {
      return 'Dein Konto ist nicht für MyJudo freigeschaltet.';
    }
    return 'Der Anmeldedienst ist derzeit nicht erreichbar.';
  }
}
