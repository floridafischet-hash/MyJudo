import 'dart:typed_data';

import 'package:dio/dio.dart';
import '../config/app_config.dart';
import 'training_models.dart';

class TrainingApiException implements Exception {
  const TrainingApiException(this.message);
  final String message;
  @override
  String toString() => message;
}

class TrainingRepository {
  TrainingRepository({required String accessToken, Dio? dio})
    : _dio =
          dio ??
          Dio(
            BaseOptions(
              baseUrl: AppConfig.apiBaseUrl,
              headers: {'Authorization': 'Bearer $accessToken'},
              connectTimeout: const Duration(seconds: 10),
              receiveTimeout: const Duration(seconds: 15),
            ),
          );
  final Dio _dio;
  Future<List<TrainingSession>> sessions() =>
      _list('/training/sessions', TrainingSession.fromJson);
  Future<void> vote(String id, String status) => _request(
    'PUT',
    '/training/sessions/$id/attendance',
    data: {'status': status},
  );
  Future<List<TrainingGroup>> groups() =>
      _list('/training/admin/groups', TrainingGroup.fromJson);
  Future<List<TrainingUser>> users() =>
      _list('/training/admin/users', TrainingUser.fromJson);
  Future<List<TrainingScheduleModel>> schedules() =>
      _list('/training/admin/schedules', TrainingScheduleModel.fromJson);
  Future<List<TrainingSession>> adminSessions() =>
      _list('/training/admin/sessions', TrainingSession.fromJson);
  Future<void> saveGroup({
    String? id,
    required String name,
    String? description,
    int? minimumAge,
    int? maximumAge,
    required bool active,
    String? color,
  }) => _request(
    id == null ? 'POST' : 'PUT',
    id == null ? '/training/admin/groups' : '/training/admin/groups/$id',
    data: {
      'name': name,
      'description': description,
      'minimumAge': minimumAge,
      'maximumAge': maximumAge,
      'active': active,
      'color': color,
    },
  );
  Future<void> createGroup(String name) => _request(
    'POST',
    '/training/admin/groups',
    data: {'name': name, 'active': true},
  );
  Future<void> updateGroup(TrainingGroup group, String name) => _request(
    'PUT',
    '/training/admin/groups/${group.id}',
    data: {'name': name, 'active': group.active},
  );
  Future<void> deleteGroup(String id) =>
      _request('DELETE', '/training/admin/groups/$id');
  Future<void> uploadGroupAvatar(
    String groupId,
    Uint8List bytes,
    String filename,
  ) async {
    final data = FormData.fromMap({
      'avatar': MultipartFile.fromBytes(bytes, filename: filename),
    });
    await _dio.post('/training/admin/groups/$groupId/avatar', data: data);
  }

  Future<void> deleteGroupAvatar(String groupId) =>
      _request('DELETE', '/training/admin/groups/$groupId/avatar');
  Future<void> replaceUserGroups(String userId, List<String> ids) => _request(
    'PUT',
    '/training/admin/users/$userId/groups',
    data: {'groupIds': ids},
  );
  Future<void> saveSchedule({
    String? id,
    required String name,
    required int weekday,
    required String startTime,
    required String endTime,
    required List<String> groupIds,
  }) => _request(
    id == null ? 'POST' : 'PUT',
    id == null ? '/training/admin/schedules' : '/training/admin/schedules/$id',
    data: {
      'name': name,
      'weekday': weekday,
      'startTime': startTime,
      'endTime': endTime,
      'groupIds': groupIds,
      'active': true,
    },
  );
  Future<void> setScheduleActive(String id, bool active) => _request(
    'PATCH',
    '/training/admin/schedules/$id/active',
    data: {'active': active},
  );
  Future<void> deleteSchedule(String id) =>
      _request('DELETE', '/training/admin/schedules/$id');
  Future<Map<String, dynamic>> attendance(String id) async {
    final r = await _dio.get<Map<String, dynamic>>(
      '/training/admin/sessions/$id/attendance',
    );
    return r.data ?? {};
  }

  Future<void> saveSession({
    String? id,
    required String scheduleId,
    required DateTime startsAt,
    required DateTime endsAt,
    required bool cancelled,
  }) => _request(
    id == null ? 'POST' : 'PUT',
    id == null ? '/training/admin/sessions' : '/training/admin/sessions/$id',
    data: {
      if (id == null) 'trainingScheduleId': scheduleId,
      'startsAt': startsAt.toUtc().toIso8601String(),
      'endsAt': endsAt.toUtc().toIso8601String(),
      'cancelled': cancelled,
    },
  );
  Future<void> setSessionCancelled(String id, bool cancelled) => _request(
    'PATCH',
    '/training/admin/sessions/$id/cancelled',
    data: {'cancelled': cancelled},
  );
  Future<void> deleteSession(String id) =>
      _request('DELETE', '/training/admin/sessions/$id');

  Future<List<T>> _list<T>(
    String path,
    T Function(Map<String, dynamic>) parse,
  ) async {
    try {
      final r = await _dio.get<List<dynamic>>(path);
      return (r.data ?? const [])
          .map((e) => parse(Map<String, dynamic>.from(e as Map)))
          .toList();
    } on DioException catch (e) {
      throw TrainingApiException(_message(e));
    }
  }

  Future<void> _request(
    String method,
    String path, {
    Map<String, dynamic>? data,
  }) async {
    try {
      await _dio.request<void>(
        path,
        data: data,
        options: Options(method: method),
      );
    } on DioException catch (e) {
      throw TrainingApiException(_message(e));
    }
  }

  String _message(DioException e) {
    final d = e.response?.data;
    if (d is Map && d['message'] != null) return d['message'].toString();
    return 'Die Trainingsdaten konnten nicht gespeichert werden.';
  }
}
