enum MemberStatus {
  active('active', 'Aktiv'),
  exitScheduled('exit_scheduled', 'Austritt vorgemerkt'),
  former('former', 'Ehemalig'),
  suspended('suspended', 'Gesperrt'),
  archived('archived', 'Archiviert');

  const MemberStatus(this.apiValue, this.label);

  final String apiValue;
  final String label;

  static MemberStatus fromApi(String value) => values.firstWhere(
    (status) => status.apiValue == value,
    orElse: () => MemberStatus.archived,
  );
}

class Member {
  const Member({
    required this.id,
    required this.memberNumber,
    required this.firstName,
    required this.lastName,
    required this.status,
    this.birthDate,
    this.exitDate,
  });

  factory Member.fromJson(Map<String, dynamic> json) => Member(
    id: json['id'] as String,
    memberNumber: json['memberNumber'] as String,
    firstName: json['firstName'] as String,
    lastName: json['lastName'] as String,
    status: MemberStatus.fromApi(json['status'] as String),
    birthDate: _parseDate(json['birthDate']),
    exitDate: _parseDate(json['exitDate']),
  );

  final String id;
  final String memberNumber;
  final String firstName;
  final String lastName;
  final MemberStatus status;
  final DateTime? birthDate;
  final DateTime? exitDate;

  String get displayName => '$firstName $lastName';
}

class MemberPageResult {
  const MemberPageResult({
    required this.items,
    required this.page,
    required this.pageSize,
    required this.total,
  });

  factory MemberPageResult.fromJson(Map<String, dynamic> json) =>
      MemberPageResult(
        items: (json['items'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(Member.fromJson)
            .toList(),
        page: json['page'] as int? ?? 1,
        pageSize: json['pageSize'] as int? ?? 25,
        total: json['total'] as int? ?? 0,
      );

  final List<Member> items;
  final int page;
  final int pageSize;
  final int total;
}

DateTime? _parseDate(dynamic value) {
  if (value is! String || value.isEmpty) return null;
  return DateTime.tryParse(value);
}

String apiDate(DateTime value) =>
    '${value.year.toString().padLeft(4, '0')}-'
    '${value.month.toString().padLeft(2, '0')}-'
    '${value.day.toString().padLeft(2, '0')}';
