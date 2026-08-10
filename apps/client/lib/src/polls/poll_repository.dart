import 'package:dio/dio.dart';

import '../config/app_config.dart';
import 'poll_models.dart';

class PollApiException implements Exception {
  const PollApiException(this.message);
  final String message;
  @override
  String toString() => message;
}

class PollRepository {
  PollRepository({required String accessToken, Dio? dio})
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

  Future<List<PollSummary>> list() async {
    try {
      final response = await _dio.get<List<dynamic>>('/polls');
      return (response.data ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(PollSummary.fromJson)
          .toList();
    } on DioException catch (error) {
      throw PollApiException(_messageFor(error));
    }
  }

  Future<PollSummary> create(CreatePollInput input) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/polls',
        data: input.toJson(),
      );
      return PollSummary.fromJson(response.data ?? const {});
    } on DioException catch (error) {
      throw PollApiException(_messageFor(error));
    }
  }

  Future<PollSummary> vote(String pollId, String optionId) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/polls/$pollId/vote',
        data: {'optionId': optionId},
      );
      return PollSummary.fromJson(response.data ?? const {});
    } on DioException catch (error) {
      throw PollApiException(_messageFor(error));
    }
  }

  void dispose() {
    if (_ownsDio) _dio.close();
  }
}

String _messageFor(DioException error) {
  final body = error.response?.data;
  if (body is Map<String, dynamic> && body['message'] is String) {
    return body['message'] as String;
  }
  return 'Die Umfragen konnten nicht geladen werden.';
}
