class ClubCalendar {
  const ClubCalendar({
    required this.id,
    required this.name,
    required this.type,
    required this.editable,
  });
  factory ClubCalendar.fromJson(Map<String, dynamic> json) => ClubCalendar(
    id: json['id'] as String,
    name: json['name'] as String,
    type: json['type'] as String,
    editable: json['editable'] as bool? ?? false,
  );
  final String id;
  final String name;
  final String type;
  final bool editable;
}

class CalendarEvent {
  const CalendarEvent({
    required this.id,
    required this.calendarId,
    required this.title,
    required this.startsAt,
    required this.endsAt,
    required this.allDay,
    required this.location,
    required this.status,
    required this.source,
  });
  factory CalendarEvent.fromJson(Map<String, dynamic> json) => CalendarEvent(
    id: json['id'] as String,
    calendarId: json['calendarId'] as String,
    title: json['title'] as String,
    startsAt: DateTime.parse(json['startsAt'] as String).toLocal(),
    endsAt: DateTime.parse(json['endsAt'] as String).toLocal(),
    allDay: json['allDay'] as bool,
    location: json['location'] as String?,
    status: json['status'] as String,
    source: json['source'] as String,
  );
  final String id;
  final String calendarId;
  final String title;
  final DateTime startsAt;
  final DateTime endsAt;
  final bool allDay;
  final String? location;
  final String status;
  final String source;
}

class TrainingSession {
  const TrainingSession({
    required this.id,
    required this.name,
    required this.weekday,
    required this.startsAt,
    required this.endsAt,
    required this.hall,
    required this.location,
    required this.ageGroup,
    required this.trainingGroup,
  });
  factory TrainingSession.fromJson(Map<String, dynamic> json) =>
      TrainingSession(
        id: json['id'] as String,
        name: json['name'] as String,
        weekday: json['weekday'] as int,
        startsAt: (json['startsAt'] as String).substring(0, 5),
        endsAt: (json['endsAt'] as String).substring(0, 5),
        hall: json['hall'] as String,
        location: json['location'] as String,
        ageGroup: json['ageGroup'] as String?,
        trainingGroup: json['trainingGroup'] as String?,
      );
  final String id;
  final String name;
  final int weekday;
  final String startsAt;
  final String endsAt;
  final String hall;
  final String location;
  final String? ageGroup;
  final String? trainingGroup;
}
