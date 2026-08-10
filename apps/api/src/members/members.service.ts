import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditLog } from '../audit/audit-log.entity';
import { AuthenticatedUser } from '../auth/auth.types';
import { User } from '../users/user.entity';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberStatusDto } from './dto/update-member-status.dto';
import { MemberStatus } from './member-status.enum';
import { Member } from './member.entity';
import type { Response } from 'express';
import { strToU8, zipSync } from 'fflate';

@Injectable()
export class MembersService {
  constructor(
    @InjectRepository(Member) private readonly members: Repository<Member>,
    private readonly dataSource: DataSource,
  ) {}

  list(actor: AuthenticatedUser, limit: number): Promise<Member[]> {
    return this.members.find({
      where: { organizationId: actor.organizationId },
      order: { lastName: 'ASC', firstName: 'ASC', id: 'ASC' },
      take: limit,
    });
  }

  async create(actor: AuthenticatedUser, dto: CreateMemberDto): Promise<Member> {
    if (dto.userId) {
      const user = await this.dataSource
        .getRepository(User)
        .findOneBy({ id: dto.userId, organizationId: actor.organizationId });
      if (!user) throw new NotFoundException('Benutzer wurde nicht gefunden.');
    }
    try {
      const member = await this.members.save(
        this.members.create({
          organizationId: actor.organizationId,
          userId: dto.userId ?? null,
          memberNumber: dto.memberNumber.trim(),
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          birthDate: dto.birthDate ?? null,
          status: MemberStatus.Active,
          exitDate: null,
          createdBy: actor.id,
        }),
      );
      await this.dataSource.getRepository(AuditLog).save({
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        action: 'member.created',
        entityType: 'member',
        entityId: member.id,
        outcome: 'success',
        metadata: null,
      });
      return member;
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException('Die Mitgliedsnummer ist bereits vergeben.');
      throw error;
    }
  }

  async exportCsv(actor: AuthenticatedUser, response: Response): Promise<void> {
    const rows = await this.exportRows(actor.organizationId);
    const headings = ['Mitgliedsnummer', 'Vorname', 'Nachname', 'Status', 'Austrittsdatum'];
    const csv = [headings, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n');
    await this.auditExport(actor, 'csv', rows.length);
    response.setHeader('Content-Disposition', 'attachment; filename="mitglieder.csv"');
    response.send(`\uFEFF${csv}`);
  }

  async exportXlsx(actor: AuthenticatedUser, response: Response): Promise<void> {
    const rows = await this.exportRows(actor.organizationId);
    const workbook = buildXlsx([
      ['Mitgliedsnummer', 'Vorname', 'Nachname', 'Status', 'Austrittsdatum'],
      ...rows,
    ]);
    await this.auditExport(actor, 'xlsx', rows.length);
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader('Content-Disposition', 'attachment; filename="mitglieder.xlsx"');
    response.send(Buffer.from(workbook));
  }

  private async exportRows(organizationId: string): Promise<string[][]> {
    const members = await this.members.find({
      where: { organizationId },
      order: { lastName: 'ASC', firstName: 'ASC', id: 'ASC' },
    });
    return members.map((member) => [
      member.memberNumber,
      member.firstName,
      member.lastName,
      member.status,
      member.exitDate ?? '',
    ]);
  }

  private async auditExport(
    actor: AuthenticatedUser,
    format: 'csv' | 'xlsx',
    rowCount: number,
  ): Promise<void> {
    await this.dataSource.getRepository(AuditLog).save({
      organizationId: actor.organizationId,
      actorUserId: actor.id,
      action: 'members.exported',
      entityType: 'member_export',
      entityId: null,
      outcome: 'success',
      metadata: { format, rowCount },
    });
  }

  async updateStatus(
    actor: AuthenticatedUser,
    memberId: string,
    dto: UpdateMemberStatusDto,
  ): Promise<Member> {
    if (dto.status === MemberStatus.ExitScheduled && !dto.exitDate) {
      throw new BadRequestException(
        'Für einen vorgemerkten Austritt ist ein Austrittsdatum erforderlich.',
      );
    }
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Member);
      const member = await repository.findOne({
        where: { id: memberId, organizationId: actor.organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!member) throw new NotFoundException('Mitglied wurde nicht gefunden.');
      const previousStatus = member.status;
      member.status = dto.status;
      member.exitDate = dto.status === MemberStatus.ExitScheduled ? dto.exitDate! : null;
      const saved = await repository.save(member);
      await manager.getRepository(AuditLog).save({
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        action: 'member.status.changed',
        entityType: 'member',
        entityId: member.id,
        outcome: 'success',
        metadata: { previousStatus, status: member.status, exitDate: member.exitDate },
      });
      return saved;
    });
  }
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function buildXlsx(rows: string[][]): Uint8Array {
  const sheetRows = rows
    .map(
      (row, rowIndex) =>
        `<row r="${rowIndex + 1}">${row
          .map((cell, columnIndex) => {
            const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
            return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(cell)}</t></is></c>`;
          })
          .join('')}</row>`,
    )
    .join('');
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ),
    'xl/workbook.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Mitglieder" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    ),
    'xl/worksheets/sheet1.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`,
    ),
  };
  return zipSync(files, { level: 6 });
}

function columnName(index: number): string {
  let value = index + 1;
  let result = '';
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function xmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}
