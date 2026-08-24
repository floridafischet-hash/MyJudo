import 'package:dio/dio.dart';
import '../config/app_config.dart';

class CalendarEventModel {
  const CalendarEventModel({
    required this.id,
    required this.title,
    required this.startsAt,
    required this.endsAt,
    this.description,
    this.location,
    this.eventType = 'event',
    this.seriesId,
    this.reminderMinutes,
    this.recurrence = 'none',
    this.groupIds = const [],
    this.participantIds = const [],
    this.color,
    this.meetingProvider,
    this.meetingUrl,
    this.meetingNotes,
  });
  final String id, title, eventType, recurrence;
  final String? description, location, seriesId, color;
  final DateTime startsAt, endsAt;
  final int? reminderMinutes;
  final List<String> groupIds, participantIds;
  final String? meetingProvider, meetingUrl, meetingNotes;
  factory CalendarEventModel.fromJson(Map<String, dynamic> j) =>
      CalendarEventModel(
        id: j['id'].toString(),
        title: j['title'].toString(),
        description: j['description']?.toString(),
        location: j['location']?.toString(),
        eventType: j['eventType']?.toString() ?? 'event',
        startsAt: DateTime.parse(j['startsAt'].toString()).toLocal(),
        endsAt: DateTime.parse(j['endsAt'].toString()).toLocal(),
        seriesId: j['seriesId']?.toString(),
        reminderMinutes: j['reminderMinutes'] as int?,
        recurrence: j['recurrence']?.toString() ?? 'none',
        groupIds: (j['groupIds'] as List? ?? [])
            .map((x) => x.toString())
            .toList(),
        participantIds: (j['participantIds'] as List? ?? [])
            .map((x) => x.toString())
            .toList(),
        color: j['color']?.toString(),
        meetingProvider: j['meetingProvider']?.toString(),
        meetingUrl: j['meetingUrl']?.toString(),
        meetingNotes: j['meetingNotes']?.toString(),
      );
}

class CalendarRepository {
  CalendarRepository({required String token})
    : _dio = Dio(
        BaseOptions(
          baseUrl: AppConfig.apiBaseUrl,
          headers: {'Authorization': 'Bearer $token'},
          connectTimeout: const Duration(seconds: 10),
          receiveTimeout: const Duration(seconds: 15),
        ),
      );
  final Dio _dio;
  Future<List<CalendarEventModel>> list(DateTime from, DateTime until) async {
    final r = await _dio.get<List<dynamic>>(
      '/calendar/events',
      queryParameters: {
        'from': from.toUtc().toIso8601String(),
        'until': until.toUtc().toIso8601String(),
      },
    );
    return (r.data ?? [])
        .map(
          (x) =>
              CalendarEventModel.fromJson(Map<String, dynamic>.from(x as Map)),
        )
        .toList();
  }

  Future<List<Map<String, dynamic>>> activity() async {
    final r = await _dio.get<List<dynamic>>('/calendar/activity');
    return (r.data ?? [])
        .map((x) => Map<String, dynamic>.from(x as Map))
        .toList();
  }

  Future<void> save({
    String? id,
    required Map<String, dynamic> data,
    String scope = 'single',
    bool copy = false,
  }) async {
    final path = id == null
        ? '/calendar/events'
        : copy
        ? '/calendar/events/$id/copy'
        : '/calendar/events/$id';
    await _dio.request(
      path,
      data: data,
      queryParameters: id != null && !copy ? {'scope': scope} : null,
      options: Options(method: id == null || copy ? 'POST' : 'PUT'),
    );
  }

  Future<void> delete(String id, String scope) =>
      _dio.delete('/calendar/events/$id', queryParameters: {'scope': scope});
  Future<List<int>> ics(String id) async {
    final response = await _dio.get<List<int>>(
      '/calendar/events/$id/ics',
      options: Options(responseType: ResponseType.bytes),
    );
    return response.data ?? const [];
  }
}
