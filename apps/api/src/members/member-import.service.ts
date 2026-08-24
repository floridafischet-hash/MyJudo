import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, IsNull, LessThan } from 'typeorm';
import { AuthenticatedUser } from '../auth/auth.types';
import { AuditLog } from '../audit/audit-log.entity';
import { MemberStatus } from './member-status.enum';
import { MemberGraduation, MemberQualification } from './member-graduation.entity';
import { MemberImportJob, MemberImportStatus } from './member-import-job.entity';
import { Member } from './member.entity';
import { ConfirmMemberImportDto, ImportDecisionAction } from './dto/member-import.dto';
import { ImportPerson, parseMemberWorkbook, splitAchievements } from './member-import.parser';

type PreviewStatus = 'new' | 'update' | 'unchanged' | 'conflict';
type PreviewRow = {
  rowId: string;
  sourceRow: number;
  status: PreviewStatus;
  memberId: string | null;
  candidates: Array<{ id: string; name: string; birthDate: string | null }>;
  data: ImportPerson;
  changes: Array<{ field: string; current: unknown; excel: unknown }>;
  warnings: string[];
};

@Injectable()
export class MemberImportService {
  constructor(private readonly db: DataSource) {}

  async analyze(actor: AuthenticatedUser, file: Express.Multer.File) {
    if (!file?.buffer?.length || !file.originalname.toLowerCase().endsWith('.xlsx'))
      throw new BadRequestException('Bitte eine XLSX-Datei auswählen.');
    const parsed = parseMemberWorkbook(file.buffer);
    const members = await this.db.getRepository(Member).find({
      where: { organizationId: actor.organizationId },
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
    const rows = parsed.rows.map((data) => this.previewRow(data, members));
    const identities = new Map<string, PreviewRow[]>();
    for (const row of rows) {
      const key = identity(row.data);
      if (key) identities.set(key, [...(identities.get(key) ?? []), row]);
    }
    for (const duplicates of identities.values()) {
      if (duplicates.length < 2) continue;
      for (const row of duplicates) {
        row.status = 'conflict';
        row.memberId = null;
        row.warnings.push('Diese Person kommt in der Importdatei mehrfach vor.');
      }
    }
    const preview = {
      format: {
        sheetNames: parsed.sheetNames,
        recognizedFields: parsed.recognizedFields,
        ignoredFields: parsed.ignoredFields,
        unknownGreenFields: parsed.unknownGreenFields,
        missingFields: parsed.missingFields,
        formatMatches: parsed.formatMatches,
        green: parsed.green,
      },
      rows,
      counts: countRows(rows),
      requiresFormatConfirmation: !parsed.formatMatches,
    };
    await this.db.getRepository(MemberImportJob).delete({
      organizationId: actor.organizationId,
      status: MemberImportStatus.Preview,
      createdAt: LessThan(new Date(Date.now() - 24 * 60 * 60 * 1000)),
    });
    const job = await this.db.getRepository(MemberImportJob).save({
      organizationId: actor.organizationId,
      actorUserId: actor.id,
      fileName: sanitize(file.originalname),
      status: MemberImportStatus.Preview,
      preview,
      summary: null,
      error: null,
      completedAt: null,
    });
    return { jobId: job.id, ...preview };
  }

  async confirm(actor: AuthenticatedUser, jobId: string, dto: ConfirmMemberImportDto) {
    // Claim the job (locked, atomic) before doing any row work so a second
    // concurrent confirm of the same job is rejected immediately. Each row is
    // then processed in its own transaction so one invalid or conflicting
    // record cannot roll back - or block - every other record in the file.
    const { rows, fileName } = await this.db.transaction(async (manager) => {
      const job = await manager.getRepository(MemberImportJob).findOne({
        where: { id: jobId, organizationId: actor.organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!job) throw new NotFoundException('Importvorschau wurde nicht gefunden.');
      if (job.status !== MemberImportStatus.Preview)
        throw new BadRequestException('Dieser Import wurde bereits abgeschlossen.');
      const preview = job.preview as unknown as { rows: PreviewRow[] };
      job.status = MemberImportStatus.Completed;
      job.preview = {};
      job.completedAt = new Date();
      await manager.getRepository(MemberImportJob).save(job);
      return { rows: preview.rows, fileName: job.fileName };
    });

    const decisions = new Map(dto.decisions.map((d) => [d.rowId, d]));
    const summary = {
      records: rows.length,
      created: 0,
      updated: 0,
      unchanged: 0,
      conflicts: 0,
      skipped: 0,
      errors: 0,
      errorDetails: [] as Array<{ sourceRow: number; message: string }>,
    };
    for (const row of rows) {
      const decision = decisions.get(row.rowId);
      if (!decision || decision.action === ImportDecisionAction.Skip) {
        summary.skipped++;
        if (row.status === 'conflict') summary.conflicts++;
        continue;
      }
      try {
        await this.db.transaction(async (manager) => {
          if (decision.action === ImportDecisionAction.Create) {
            await this.create(manager, actor, row);
            summary.created++;
            return;
          }
          const memberId = decision.memberId ?? row.memberId;
          if (!memberId)
            throw new BadRequestException(
              `Zeile ${row.sourceRow}: Mitglied für Aktualisierung fehlt.`,
            );
          const changed = await this.update(manager, actor, row, memberId);
          if (changed) summary.updated++;
          else summary.unchanged++;
        });
      } catch (error) {
        summary.errors++;
        summary.errorDetails.push({ sourceRow: row.sourceRow, message: errorMessage(error) });
      }
    }
    await this.db.getRepository(MemberImportJob).update(jobId, { summary });
    await this.db.getRepository(AuditLog).save({
      organizationId: actor.organizationId,
      actorUserId: actor.id,
      action: 'member.import.completed',
      entityType: 'import',
      entityId: jobId,
      outcome: 'success',
      metadata: { fileName, summary },
    });
    return summary;
  }

  history(actor: AuthenticatedUser) {
    return this.db.getRepository(MemberImportJob).find({
      where: { organizationId: actor.organizationId },
      select: {
        id: true,
        fileName: true,
        status: true,
        summary: true,
        createdAt: true,
        completedAt: true,
      },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  private previewRow(data: ImportPerson, members: Member[]): PreviewRow {
    const exact = members.filter(
      (m) =>
        norm(m.firstName) === norm(String(data.firstName ?? '')) &&
        norm(m.lastName) === norm(String(data.lastName ?? '')) &&
        m.birthDate === data.birthDate,
    );
    const email = data.email
      ? members.filter((m) => m.email && norm(m.email) === norm(String(data.email)))
      : [];
    const candidates = uniqueMembers([...exact, ...email]).map((m) => ({
      id: m.id,
      name: `${m.firstName} ${m.lastName}`,
      birthDate: m.birthDate,
    }));
    if (exact.length !== 1) {
      return {
        rowId: randomUUID(),
        sourceRow: data.sourceRow,
        status: exact.length > 1 || email.length ? 'conflict' : 'new',
        memberId: null,
        candidates,
        data,
        changes: [],
        warnings: data.warnings,
      };
    }
    const member = exact[0]!;
    const changes = memberChanges(member, data);
    return {
      rowId: randomUUID(),
      sourceRow: data.sourceRow,
      status: changes.length ? 'update' : 'unchanged',
      memberId: member.id,
      candidates,
      data,
      changes,
      warnings: data.warnings,
    };
  }
  private async create(m: EntityManager, actor: AuthenticatedUser, row: PreviewRow) {
    const data = row.data;
    if (!data.firstName || !data.lastName)
      throw new BadRequestException(`Zeile ${row.sourceRow}: Name fehlt.`);
    const duplicate = await m.getRepository(Member).findOneBy({
      organizationId: actor.organizationId,
      firstName: String(data.firstName),
      lastName: String(data.lastName),
      birthDate: data.birthDate ? String(data.birthDate) : IsNull(),
    });
    if (duplicate)
      throw new BadRequestException(
        `Zeile ${row.sourceRow}: Das Mitglied existiert inzwischen bereits. Bitte neu analysieren.`,
      );
    const member = await m.getRepository(Member).save({
      organizationId: actor.organizationId,
      userId: null,
      memberNumber: `IMP-${randomUUID().slice(0, 8).toUpperCase()}`,
      firstName: String(data.firstName),
      lastName: String(data.lastName),
      birthDate: data.birthDate as string | null,
      status: MemberStatus.Active,
      exitDate: null,
      createdBy: actor.id,
      ...memberFields(data),
    });
    await this.achievements(m, member.id, data);
    await this.syncGraduationSummary(m, member.id);
    return member;
  }
  private async update(m: EntityManager, actor: AuthenticatedUser, row: PreviewRow, id: string) {
    const member = await m.getRepository(Member).findOne({
      where: { id, organizationId: actor.organizationId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!member) throw new NotFoundException('Zugeordnetes Mitglied wurde nicht gefunden.');
    const changes = memberChanges(member, row.data);
    if (!changes.length) {
      await this.achievements(m, id, row.data);
      await this.syncGraduationSummary(m, id);
      return false;
    }
    Object.assign(member, memberFields(row.data), {
      firstName: row.data.firstName ?? member.firstName,
      lastName: row.data.lastName ?? member.lastName,
      birthDate: row.data.birthDate ?? member.birthDate,
    });
    await m.getRepository(Member).save(member);
    await this.achievements(m, id, row.data);
    await this.syncGraduationSummary(m, id);
    return true;
  }
  // Stores each newly-seen belt/Dan once per member. The entry matching the
  // row's current grade is stamped with the import's exam date so the
  // history - not a separately typed-in field - can drive lastGraduationDate
  // and graduationsThisYear (see syncGraduationSummary).
  private async achievements(m: EntityManager, memberId: string, data: ImportPerson) {
    const parts = splitAchievements(data.graduations);
    const currentLabel = data.highestGraduation
      ? String(data.highestGraduation).trim().toLowerCase()
      : null;
    for (const g of parts.graduations) {
      if (await m.getRepository(MemberGraduation).findOneBy({ memberId, label: g.label })) continue;
      const achievedOn =
        currentLabel && g.label.trim().toLowerCase() === currentLabel
          ? ((data.lastGraduationDate as string | null) ?? null)
          : null;
      await m.getRepository(MemberGraduation).save({ memberId, ...g, achievedOn });
    }
    for (const q of parts.qualifications)
      if (
        !(await m
          .getRepository(MemberQualification)
          .findOneBy({ memberId, label: q.label, reference: q.reference ?? IsNull() }))
      )
        await m.getRepository(MemberQualification).save({ memberId, ...q });
  }
  // Recomputes the member's cached lastGraduationDate/graduationsThisYear from
  // dated graduation history entries, so those two fields can never drift
  // from the history they summarize. Falls back to whatever the import row
  // already set (see memberFields) while no dated entry exists yet, which
  // keeps organizations whose export format carries no history unaffected.
  private async syncGraduationSummary(m: EntityManager, memberId: string) {
    const entries = await m.getRepository(MemberGraduation).findBy({ memberId });
    const dated = entries.map((e) => e.achievedOn).filter((d): d is string => !!d);
    if (!dated.length) return;
    const lastGraduationDate = dated.reduce((max, d) => (d > max ? d : max));
    const currentYear = `${new Date().getUTCFullYear()}`;
    const graduationsThisYear = dated.filter((d) => d.startsWith(currentYear)).length;
    await m
      .getRepository(Member)
      .update({ id: memberId }, { lastGraduationDate, graduationsThisYear });
  }
}

const fields = [
  'firstName',
  'lastName',
  'birthDate',
  'gender',
  'email',
  'phone',
  'street',
  'postalCode',
  'city',
  'country',
  'nationality',
  'highestGraduation',
  'lastGraduationDate',
  'graduationsThisYear',
] as const;
function memberFields(d: ImportPerson) {
  return Object.fromEntries(fields.slice(3).map((f) => [f, d[f] ?? null]));
}
function memberChanges(m: Member, d: ImportPerson) {
  return fields.flatMap((f) =>
    d[f] !== null && String(m[f] ?? '') !== String(d[f])
      ? [{ field: f, current: m[f] ?? null, excel: d[f] }]
      : [],
  );
}
function countRows(rows: PreviewRow[]) {
  return {
    new: rows.filter((r) => r.status === 'new').length,
    update: rows.filter((r) => r.status === 'update').length,
    unchanged: rows.filter((r) => r.status === 'unchanged').length,
    conflict: rows.filter((r) => r.status === 'conflict').length,
    skipped: 0,
  };
}
function norm(v: string) {
  return v
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}
function uniqueMembers(v: Member[]) {
  return [...new Map(v.map((x) => [x.id, x])).values()];
}
function sanitize(v: string) {
  return v.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 255);
}
function identity(data: ImportPerson) {
  return data.firstName && data.lastName && data.birthDate
    ? `${norm(String(data.firstName))}|${norm(String(data.lastName))}|${data.birthDate}`
    : null;
}
function errorMessage(error: unknown): string {
  if (error instanceof BadRequestException || error instanceof NotFoundException) {
    const response = error.getResponse();
    if (typeof response === 'string') return response;
    if (response && typeof response === 'object' && 'message' in response) {
      const message = response.message;
      return Array.isArray(message) ? message.join(' ') : String(message);
    }
  }
  return 'Diese Zeile konnte nicht importiert werden.';
}
