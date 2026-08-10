class ExamParticipant {
  const ExamParticipant({
    required this.id,
    required this.memberId,
    required this.memberName,
    required this.memberNumber,
    required this.gradeType,
    required this.grade,
    required this.belt,
    required this.status,
  });

  factory ExamParticipant.fromJson(Map<String, dynamic> json) =>
      ExamParticipant(
        id: json['id'] as String,
        memberId: json['memberId'] as String,
        memberName: json['memberName'] as String,
        memberNumber: json['memberNumber'] as String,
        gradeType: json['gradeType'] as String,
        grade: json['grade'] as int,
        belt: json['belt'] as String,
        status: json['status'] as String,
      );

  final String id;
  final String memberId;
  final String memberName;
  final String memberNumber;
  final String gradeType;
  final int grade;
  final String belt;
  final String status;
}

class BeltExam {
  const BeltExam({
    required this.id,
    required this.title,
    required this.examDate,
    required this.location,
    required this.participants,
  });

  factory BeltExam.fromJson(Map<String, dynamic> json) => BeltExam(
    id: json['id'] as String,
    title: json['title'] as String,
    examDate: DateTime.parse(json['examDate'] as String),
    location: json['location'] as String?,
    participants: (json['participants'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(ExamParticipant.fromJson)
        .toList(),
  );

  final String id;
  final String title;
  final DateTime examDate;
  final String? location;
  final List<ExamParticipant> participants;
}
