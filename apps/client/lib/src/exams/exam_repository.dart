import 'package:dio/dio.dart';

import '../config/app_config.dart';
import 'exam_models.dart';

class ExamRepository {
  ExamRepository({required String accessToken, Dio? dio})
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

  Future<List<BeltExam>> list() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/exams',
        queryParameters: {'page': 1, 'pageSize': 100},
      );
      return (response.data?['items'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(BeltExam.fromJson)
          .toList();
    } on DioException catch (error) {
      throw Exception(_message(error));
    }
  }

  Future<void> createExam({
    required String title,
    required DateTime examDate,
    String? location,
  }) => _request('/exams', 'POST', {
    'title': title.trim(),
    'examDate': _apiDate(examDate),
    'location': location?.trim(),
  });

  Future<void> addParticipant({
    required String examId,
    required String memberId,
    required String gradeType,
    required int grade,
  }) => _request('/exams/$examId/participants', 'POST', {
    'memberId': memberId,
    'gradeType': gradeType,
    'grade': grade,
  });

  Future<void> updateStatus(String participantId, String status) => _request(
    '/exam-participants/$participantId',
    'PATCH',
    {'status': status},
  );

  Future<void> _request(
    String path,
    String method,
    Map<String, dynamic> data,
  ) async {
    try {
      await _dio.request<void>(
        path,
        data: data,
        options: Options(method: method),
      );
    } on DioException catch (error) {
      throw Exception(_message(error));
    }
  }

  void dispose() {
    if (_ownsDio) _dio.close();
  }
}

String _apiDate(DateTime value) =>
    '${value.year.toString().padLeft(4, '0')}-'
    '${value.month.toString().padLeft(2, '0')}-'
    '${value.day.toString().padLeft(2, '0')}';

String _message(DioException error) {
  final body = error.response?.data;
  if (body is Map<String, dynamic>) {
    final message = body['message'];
    if (message is String) return message;
    if (message is List && message.isNotEmpty) return message.first.toString();
  }
  return 'Die Prüfungsdaten konnten nicht verarbeitet werden.';
}
