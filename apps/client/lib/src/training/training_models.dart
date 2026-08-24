class TrainingGroup {
  const TrainingGroup({
    required this.id,
    required this.name,
    this.active = true,
    this.description,
    this.minimumAge,
    this.maximumAge,
    this.color,
    this.hasAvatar = false,
  });
  final String id;
  final String name;
  final bool active;
  final String? description;
  final int? minimumAge, maximumAge;
  final String? color;
  final bool hasAvatar;
  String? get avatarUrl =>
      hasAvatar ? '/api/v1/training/groups/$id/avatar' : null;
  factory TrainingGroup.fromJson(Map<String, dynamic> json) => TrainingGroup(
    id: json['id'] as String,
    name: json['name'] as String,
    active: json['active'] as bool? ?? true,
    description: json['description'] as String?,
    minimumAge: (json['minimumAge'] as num?)?.toInt(),
    maximumAge: (json['maximumAge'] as num?)?.toInt(),
    color: json['color'] as String?,
    hasAvatar: json['avatarStoredName'] != null,
  );
}

class TrainingAttendance {
  const TrainingAttendance(this.status);
  final String status;
}

class TrainingSession {
  const TrainingSession({
    required this.id,
    required this.scheduleId,
    required this.name,
    required this.startsAt,
    required this.endsAt,
    required this.groups,
    required this.locked,
    required this.cancelled,
    this.attendance,
  });
  final String id;
  final String scheduleId;
  final String name;
  final DateTime startsAt;
  final DateTime endsAt;
  final List<TrainingGroup> groups;
  final bool locked;
  final bool cancelled;
  final TrainingAttendance? attendance;
  factory TrainingSession.fromJson(
    Map<String, dynamic> json,
  ) => TrainingSession(
    id: json['id'] as String,
    scheduleId: json['scheduleId'] as String,
    name: json['name'] as String,
    startsAt: DateTime.parse(json['startsAt'] as String).toLocal(),
    endsAt: DateTime.parse(json['endsAt'] as String).toLocal(),
    groups: (json['groups'] as List? ?? const [])
        .map((e) => TrainingGroup.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList(),
    locked: json['locked'] as bool? ?? false,
    cancelled: json['cancelled'] as bool? ?? false,
    attendance: json['attendance'] is Map
        ? TrainingAttendance((json['attendance'] as Map)['status'] as String)
        : null,
  );
}

class TrainingScheduleModel {
  const TrainingScheduleModel({
    required this.id,
    required this.name,
    required this.weekday,
    required this.startTime,
    required this.endTime,
    required this.active,
    required this.groups,
  });
  final String id, name, startTime, endTime;
  final int weekday;
  final bool active;
  final List<TrainingGroup> groups;
  factory TrainingScheduleModel.fromJson(Map<String, dynamic> j) =>
      TrainingScheduleModel(
        id: j['id'] as String,
        name: j['name'] as String,
        weekday: (j['weekday'] as num).toInt(),
        startTime: (j['startTime'] as String).substring(0, 5),
        endTime: (j['endTime'] as String).substring(0, 5),
        active: j['active'] as bool,
        groups: (j['groups'] as List? ?? const [])
            .map(
              (e) =>
                  TrainingGroup.fromJson(Map<String, dynamic>.from(e as Map)),
            )
            .toList(),
      );
}

class TrainingUser {
  const TrainingUser({
    required this.id,
    required this.name,
    required this.email,
    required this.status,
    required this.groups,
    required this.roles,
    this.birthDate,
    this.color,
    this.hasAvatar = false,
  });
  final String id, name, email, status;
  final String? birthDate;
  final String? color;
  final bool hasAvatar;
  final List<TrainingGroup> groups;
  final List<String> roles;
  String? get avatarUrl => hasAvatar ? '/api/v1/users/$id/avatar' : null;
  factory TrainingUser.fromJson(Map<String, dynamic> j) => TrainingUser(
    id: j['id'] as String,
    name: '${j['firstName']} ${j['lastName']}',
    email: j['email'] as String,
    status: j['status'] as String,
    birthDate: j['birthDate'] as String?,
    color: j['color'] as String?,
    hasAvatar: j['avatarStoredName'] != null,
    groups: (j['groups'] as List? ?? const [])
        .map((e) => TrainingGroup.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList(),
    roles: (j['roles'] as List? ?? const []).map((e) => e.toString()).toList(),
  );
}
