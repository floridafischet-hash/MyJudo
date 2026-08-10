import 'package:dio/dio.dart';

import '../config/app_config.dart';
import 'member.dart';

class MemberApiException implements Exception {
  const MemberApiException(this.message);
  final String message;

  @override
  String toString() => message;
}

class MemberRepository {
  MemberRepository({required String accessToken, Dio? dio})
    : _dio =
          dio ??
          Dio(
            BaseOptions(
              baseUrl: AppConfig.apiBaseUrl,
              headers: {'Authorization': 'Bearer $accessToken'},
              connectTimeout: const Duration(seconds: 10),
              receiveTimeout: const Duration(seconds: 15),
            ),
          ),
      _ownsDio = dio == null;

  final Dio _dio;
  final bool _ownsDio;

  Future<MemberPageResult> list({
    required int page,
    required int pageSize,
    String? search,
    MemberStatus? status,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/members',
        queryParameters: {
          'page': page,
          'pageSize': pageSize,
          if (search != null && search.trim().isNotEmpty)
            'search': search.trim(),
          if (status != null) 'status': status.apiValue,
        },
      );
      return MemberPageResult.fromJson(response.data ?? const {});
    } on DioException catch (error) {
      throw MemberApiException(_messageFor(error));
    }
  }

  Future<Member> detail(String id) => _requestMember('GET', '/members/$id');

  Future<Member> create({
    required String memberNumber,
    required String firstName,
    required String lastName,
    DateTime? birthDate,
  }) => _requestMember(
    'POST',
    '/members',
    data: {
      'memberNumber': memberNumber.trim(),
      'firstName': firstName.trim(),
      'lastName': lastName.trim(),
      if (birthDate != null) 'birthDate': apiDate(birthDate),
    },
  );

  Future<Member> update(
    String id, {
    required String memberNumber,
    required String firstName,
    required String lastName,
    DateTime? birthDate,
  }) => _requestMember(
    'PATCH',
    '/members/$id',
    data: {
      'memberNumber': memberNumber.trim(),
      'firstName': firstName.trim(),
      'lastName': lastName.trim(),
      if (birthDate != null) 'birthDate': apiDate(birthDate),
    },
  );

  Future<Member> updateStatus(
    String id, {
    required MemberStatus status,
    DateTime? exitDate,
  }) => _requestMember(
    'PATCH',
    '/members/$id/status',
    data: {
      'status': status.apiValue,
      if (exitDate != null) 'exitDate': apiDate(exitDate),
    },
  );

  Future<Member> _requestMember(
    String method,
    String path, {
    Map<String, dynamic>? data,
  }) async {
    try {
      final response = await _dio.request<Map<String, dynamic>>(
        path,
        data: data,
        options: Options(method: method),
      );
      return Member.fromJson(
        response.data ??
            (throw const MemberApiException('Die Serverantwort war leer.')),
      );
    } on MemberApiException {
      rethrow;
    } on DioException catch (error) {
      throw MemberApiException(_messageFor(error));
    }
  }

  void dispose() {
    if (_ownsDio) _dio.close();
  }
}

String _messageFor(DioException error) {
  final data = error.response?.data;
  if (data is Map<String, dynamic>) {
    final message = data['message'];
    if (message is String && message.isNotEmpty) return message;
    if (message is List && message.isNotEmpty) return message.first.toString();
  }
  return switch (error.response?.statusCode) {
    403 => 'Für diese Aktion fehlt die Berechtigung.',
    404 => 'Das Mitglied wurde nicht gefunden.',
    409 => 'Die Mitgliedsnummer ist bereits vergeben.',
    _ => 'Die Mitgliedsdaten konnten nicht gespeichert werden.',
  };
}
