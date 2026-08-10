import 'package:dio/dio.dart';

import '../config/app_config.dart';
import 'calendar_models.dart';

class CalendarRepository {
  CalendarRepository({required String accessToken, Dio? dio})
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

  Future<List<ClubCalendar>> listCalendars() =>
      _list('/calendars', ClubCalendar.fromJson);

  Future<List<CalendarEvent>> listEvents(DateTime from, DateTime to) => _list(
    '/calendar-events',
    CalendarEvent.fromJson,
    query: {
      'from': from.toUtc().toIso8601String(),
      'to': to.toUtc().toIso8601String(),
    },
  );

  Future<List<TrainingSession>> listTrainings() =>
      _list('/training-sessions', TrainingSession.fromJson);

  Future<CalendarEvent> createEvent({
    required String calendarId,
    required String title,
    required DateTime startsAt,
    required DateTime endsAt,
    String? location,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/calendars/$calendarId/events',
        data: {
          'title': title,
          'startsAt': startsAt.toUtc().toIso8601String(),
          'endsAt': endsAt.toUtc().toIso8601String(),
          'allDay': false,
          'location': location,
        },
      );
      return CalendarEvent.fromJson(response.data ?? const {});
    } on DioException catch (error) {
      throw Exception(_message(error));
    }
  }

  Future<TrainingSession> createTraining(Map<String, dynamic> data) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/training-sessions',
        data: data,
      );
      return TrainingSession.fromJson(response.data ?? const {});
    } on DioException catch (error) {
      throw Exception(_message(error));
    }
  }

  Future<List<T>> _list<T>(
    String path,
    T Function(Map<String, dynamic>) fromJson, {
    Map<String, dynamic>? query,
  }) async {
    try {
      final response = await _dio.get<List<dynamic>>(
        path,
        queryParameters: query,
      );
      return (response.data ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(fromJson)
          .toList();
    } on DioException catch (error) {
      throw Exception(_message(error));
    }
  }

  void dispose() {
    if (_ownsDio) _dio.close();
  }
}

String _message(DioException error) {
  final body = error.response?.data;
  if (body is Map<String, dynamic> && body['message'] is String) {
    return body['message'] as String;
  }
  return 'Kalender und Training konnten nicht geladen werden.';
}
