import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Response } from 'express';
import { DataSource, Repository } from 'typeorm';
import { AuditLog } from '../audit/audit-log.entity';
import { AuthenticatedUser } from '../auth/auth.types';
import { buildCsv, buildXlsx } from '../common/tabular-export';
import { Member } from '../members/member.entity';
import { AddExamParticipantDto } from './dto/add-exam-participant.dto';
import { CreateExamDto } from './dto/create-exam.dto';
import { ListExamsDto } from './dto/list-exams.dto';
import { UpdateExamParticipantDto } from './dto/update-exam-participant.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { ExamParticipant, ExamParticipantStatus, GradeType } from './exam-participant.entity';
import { Exam } from './exam.entity';

export interface ExamParticipantSummary {
  id: string;
  memberId: string;
  memberNumber: string;
  memberName: string;
  gradeType: GradeType;
  grade: number;
  belt: string;
  status: ExamParticipantStatus;
  notes: string | null;
}

export interface ExamSummary {
  id: string;
  title: string;
  examDate: string;
  location: string | null;
  notes: string | null;
  participants: ExamParticipantSummary[];
}

@Injectable()
export class ExamsService {
  constructor(
    @InjectRepository(Exam) private readonly exams: Repository<Exam>,
    @InjectRepository(ExamParticipant)
    private readonly participants: Repository<ExamParticipant>,
    private readonly dataSource: DataSource,
  ) {}

  async list(
    actor: AuthenticatedUser,
    query: ListExamsDto,
  ): Promise<{ items: ExamSummary[]; page: number; pageSize: number; total: number }> {
    if (query.from && query.to && query.to < query.from) {
      throw new BadRequestException('Das Enddatum muss am oder nach dem Startdatum liegen.');
    }
    const builder = this.exams
      .createQueryBuilder('exam')
      .leftJoinAndSelect('exam.participants', 'participant')
      .leftJoinAndSelect('participant.member', 'member')
      .where('exam."organizationId" = :organizationId', { organizationId: actor.organizationId })
      .andWhere('exam."deletedAt" IS NULL')
      .andWhere('participant."deletedAt" IS NULL OR participant.id IS NULL');
    if (query.from) builder.andWhere('exam."examDate" >= :from', { from: query.from });
    if (query.to) builder.andWhere('exam."examDate" <= :to', { to: query.to });
    builder
      .orderBy('exam.examDate', 'DESC')
      .addOrderBy('exam.id', 'ASC')
      .addOrderBy('member.lastName', 'ASC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);
    const [items, total] = await builder.getManyAndCount();
    return {
      items: items.map((exam) => this.examSummary(exam)),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async create(actor: AuthenticatedUser, dto: CreateExamDto): Promise<ExamSummary> {
    const exam = await this.exams.save(
      this.exams.create({
        organizationId: actor.organizationId,
        title: requiredTrimmed(dto.title, 'Der Prüfungstitel darf nicht leer sein.'),
        examDate: dto.examDate,
        location: dto.location?.trim() || null,
        notes: dto.notes?.trim() || null,
        createdBy: actor.id,
      }),
    );
    exam.participants = [];
    await this.audit(actor, 'exam.created', 'exam', exam.id, null);
    return this.examSummary(exam);
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateExamDto): Promise<ExamSummary> {
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException('Mindestens ein Feld muss geändert werden.');
    }
    const exam = await this.examWithParticipants(actor.organizationId, id);
    if (dto.title !== undefined) {
      exam.title = requiredTrimmed(dto.title, 'Der Prüfungstitel darf nicht leer sein.');
    }
    if (dto.examDate !== undefined) exam.examDate = dto.examDate;
    if (dto.location !== undefined) exam.location = dto.location.trim() || null;
    if (dto.notes !== undefined) exam.notes = dto.notes.trim() || null;
    await this.exams.save(exam);
    await this.audit(actor, 'exam.updated', 'exam', exam.id, null);
    return this.examSummary(exam);
  }

  async addParticipant(
    actor: AuthenticatedUser,
    examId: string,
    dto: AddExamParticipantDto,
  ): Promise<ExamParticipantSummary> {
    validateGrade(dto.gradeType, dto.grade);
    const exam = await this.exams.findOneBy({ id: examId, organizationId: actor.organizationId });
    if (!exam) throw new NotFoundException('Prüfung wurde nicht gefunden.');
    const member = await this.dataSource
      .getRepository(Member)
      .findOneBy({ id: dto.memberId, organizationId: actor.organizationId });
    if (!member) throw new NotFoundException('Mitglied wurde nicht gefunden.');
    const existing = await this.participants.findOneBy({ examId, memberId: member.id });
    if (existing) {
      throw new ConflictException('Das Mitglied ist bereits für diese Prüfung erfasst.');
    }
    try {
      const participant = await this.participants.save(
        this.participants.create({
          organizationId: actor.organizationId,
          examId,
          memberId: member.id,
          gradeType: dto.gradeType,
          grade: dto.grade,
          status: dto.status ?? ExamParticipantStatus.Planned,
          notes: dto.notes?.trim() || null,
          createdBy: actor.id,
        }),
      );
      participant.member = member;
      await this.audit(actor, 'exam.participant.added', 'exam_participant', participant.id, {
        examId,
        memberId: member.id,
      });
      return this.participantSummary(participant);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Das Mitglied ist bereits für diese Prüfung erfasst.');
      }
      throw error;
    }
  }

  async updateParticipant(
    actor: AuthenticatedUser,
    id: string,
    dto: UpdateExamParticipantDto,
  ): Promise<ExamParticipantSummary> {
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException('Mindestens ein Feld muss geändert werden.');
    }
    const participant = await this.participants.findOne({
      where: { id, organizationId: actor.organizationId },
      relations: { member: true },
    });
    if (!participant) throw new NotFoundException('Prüfungsteilnahme wurde nicht gefunden.');
    const gradeType = dto.gradeType ?? participant.gradeType;
    const grade = dto.grade ?? participant.grade;
    validateGrade(gradeType, grade);
    participant.gradeType = gradeType;
    participant.grade = grade;
    if (dto.status !== undefined) participant.status = dto.status;
    if (dto.notes !== undefined) participant.notes = dto.notes.trim() || null;
    await this.participants.save(participant);
    await this.audit(actor, 'exam.participant.updated', 'exam_participant', participant.id, {
      examId: participant.examId,
      status: participant.status,
    });
    return this.participantSummary(participant);
  }

  async exportCsv(actor: AuthenticatedUser, response: Response): Promise<void> {
    const rows = await this.exportRows(actor.organizationId);
    await this.auditExport(actor, 'csv', rows.length);
    response.setHeader('Content-Disposition', 'attachment; filename="pruefungen.csv"');
    response.send(buildCsv([exportHeadings, ...rows]));
  }

  async exportXlsx(actor: AuthenticatedUser, response: Response): Promise<void> {
    const rows = await this.exportRows(actor.organizationId);
    await this.auditExport(actor, 'xlsx', rows.length);
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader('Content-Disposition', 'attachment; filename="pruefungen.xlsx"');
    response.send(Buffer.from(buildXlsx('Prüfungen', [exportHeadings, ...rows])));
  }

  private async examWithParticipants(organizationId: string, id: string): Promise<Exam> {
    const exam = await this.exams.findOne({
      where: { id, organizationId },
      relations: { participants: { member: true } },
    });
    if (!exam) throw new NotFoundException('Prüfung wurde nicht gefunden.');
    return exam;
  }

  private async exportRows(organizationId: string): Promise<string[][]> {
    const rows = await this.participants.find({
      where: { organizationId },
      relations: { exam: true, member: true },
      order: { exam: { examDate: 'ASC' }, member: { lastName: 'ASC', firstName: 'ASC' } },
    });
    return rows.map((row) => [
      row.exam.examDate,
      row.exam.title,
      row.member.memberNumber,
      row.member.firstName,
      row.member.lastName,
      beltLabel(row.gradeType, row.grade),
      statusLabels[row.status],
    ]);
  }

  private examSummary(exam: Exam): ExamSummary {
    return {
      id: exam.id,
      title: exam.title,
      examDate: exam.examDate,
      location: exam.location,
      notes: exam.notes,
      participants: (exam.participants ?? []).map((participant) =>
        this.participantSummary(participant),
      ),
    };
  }

  private participantSummary(participant: ExamParticipant): ExamParticipantSummary {
    return {
      id: participant.id,
      memberId: participant.memberId,
      memberNumber: participant.member.memberNumber,
      memberName: `${participant.member.firstName} ${participant.member.lastName}`.trim(),
      gradeType: participant.gradeType,
      grade: participant.grade,
      belt: beltLabel(participant.gradeType, participant.grade),
      status: participant.status,
      notes: participant.notes,
    };
  }

  private audit(
    actor: AuthenticatedUser,
    action: string,
    entityType: string,
    entityId: string | null,
    metadata: Record<string, unknown> | null,
  ): Promise<AuditLog> {
    return this.dataSource.getRepository(AuditLog).save({
      organizationId: actor.organizationId,
      actorUserId: actor.id,
      action,
      entityType,
      entityId,
      outcome: 'success',
      metadata,
    });
  }

  private auditExport(
    actor: AuthenticatedUser,
    format: string,
    rowCount: number,
  ): Promise<AuditLog> {
    return this.audit(actor, 'exams.exported', 'exam_export', null, {
      format,
      rowCount,
    });
  }
}

const exportHeadings = [
  'Prüfungsdatum',
  'Prüfung',
  'Mitgliedsnummer',
  'Vorname',
  'Nachname',
  'Gürtel',
  'Status',
];

const statusLabels: Record<ExamParticipantStatus, string> = {
  planned: 'Vorgemerkt',
  registered: 'Angemeldet',
  passed: 'Bestanden',
  failed: 'Nicht bestanden',
  withdrawn: 'Abgemeldet',
};

function validateGrade(type: GradeType, grade: number): void {
  const maximum = type === GradeType.Kyu ? 8 : 10;
  if (grade < 1 || grade > maximum) {
    throw new BadRequestException(
      type === GradeType.Kyu
        ? 'Kyu-Grade müssen zwischen 1 und 8 liegen.'
        : 'Dan-Grade müssen zwischen 1 und 10 liegen.',
    );
  }
}

function beltLabel(type: GradeType, grade: number): string {
  return `${grade}. ${type === GradeType.Kyu ? 'Kyu' : 'Dan'}`;
}

function requiredTrimmed(value: string, message: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new BadRequestException(message);
  return trimmed;
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505',
  );
}
