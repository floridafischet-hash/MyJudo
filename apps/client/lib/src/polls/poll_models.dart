enum PollType {
  attendance,
  choice;

  String get apiValue => name;
  String get label => this == attendance ? 'Teilnahme' : 'Abstimmung';
}

class PollOption {
  const PollOption({
    required this.id,
    required this.label,
    required this.position,
    required this.voteCount,
  });

  factory PollOption.fromJson(Map<String, dynamic> json) => PollOption(
    id: json['id'] as String,
    label: json['label'] as String,
    position: json['position'] as int,
    voteCount: json['voteCount'] as int?,
  );

  final String id;
  final String label;
  final int position;
  final int? voteCount;
}

class PollSummary {
  const PollSummary({
    required this.id,
    required this.type,
    required this.title,
    required this.description,
    required this.startsAt,
    required this.endsAt,
    required this.state,
    required this.canViewResults,
    required this.totalVotes,
    required this.selectedOptionId,
    required this.options,
  });

  factory PollSummary.fromJson(Map<String, dynamic> json) => PollSummary(
    id: json['id'] as String,
    type: (json['type'] as String) == 'attendance'
        ? PollType.attendance
        : PollType.choice,
    title: json['title'] as String,
    description: json['description'] as String?,
    startsAt: DateTime.parse(json['startsAt'] as String).toLocal(),
    endsAt: DateTime.parse(json['endsAt'] as String).toLocal(),
    state: json['state'] as String,
    canViewResults: json['canViewResults'] as bool,
    totalVotes: json['totalVotes'] as int?,
    selectedOptionId: json['selectedOptionId'] as String?,
    options: (json['options'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(PollOption.fromJson)
        .toList(),
  );

  final String id;
  final PollType type;
  final String title;
  final String? description;
  final DateTime startsAt;
  final DateTime endsAt;
  final String state;
  final bool canViewResults;
  final int? totalVotes;
  final String? selectedOptionId;
  final List<PollOption> options;
}

class CreatePollInput {
  const CreatePollInput({
    required this.type,
    required this.title,
    required this.description,
    required this.startsAt,
    required this.endsAt,
    required this.resultsVisibleToParticipants,
    required this.requiredPermission,
    required this.options,
  });

  final PollType type;
  final String title;
  final String? description;
  final DateTime startsAt;
  final DateTime endsAt;
  final bool resultsVisibleToParticipants;
  final String? requiredPermission;
  final List<String>? options;

  Map<String, dynamic> toJson() => {
    'type': type.apiValue,
    'title': title,
    'description': description,
    'startsAt': startsAt.toUtc().toIso8601String(),
    'endsAt': endsAt.toUtc().toIso8601String(),
    'resultsVisibleToParticipants': resultsVisibleToParticipants,
    'requiredPermission': requiredPermission,
    'options': options,
  };
}
