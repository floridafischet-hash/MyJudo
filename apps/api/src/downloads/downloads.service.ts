import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { unzipSync } from 'fflate';
import { DataSource, In } from 'typeorm';
import { AuthenticatedUser } from '../auth/auth.types';
import { AuditLog } from '../audit/audit-log.entity';
import { Role } from '../rbac/role.entity';
import { Group } from '../training/group.entity';
import { User } from '../users/user.entity';
import { DownloadGroup, DownloadRole, DownloadUser } from './download-access.entity';
import { Download } from './download.entity';
import { ManageDownloadDto } from './dto/manage-download.dto';
const downloadTypes: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
@Injectable()
export class DownloadsService {
  private readonly root: string;
  constructor(
    private readonly db: DataSource,
    config: ConfigService,
  ) {
    this.root = config.get<string>('DOWNLOAD_STORAGE_PATH') ?? '/app/data/downloads';
  }
  async list(actor: AuthenticatedUser, admin = false): Promise<Download[]> {
    const parameters = admin ? [actor.organizationId] : [actor.organizationId, actor.id];
    return await this.db.query(
      `SELECT d.*${admin ? `,COALESCE((SELECT jsonb_agg(x."groupId") FROM download_groups x WHERE x."downloadId"=d.id),'[]') AS "groupIds",COALESCE((SELECT jsonb_agg(x."roleId") FROM download_roles x WHERE x."downloadId"=d.id),'[]') AS "roleIds",COALESCE((SELECT jsonb_agg(x."userId") FROM download_users x WHERE x."downloadId"=d.id),'[]') AS "userIds"` : ''} FROM downloads d WHERE d."organizationId"=$1 AND d."deletedAt" IS NULL ${admin ? '' : `AND d.active=true AND (d."availableToAll"=true OR EXISTS(SELECT 1 FROM download_users x WHERE x."downloadId"=d.id AND x."userId"=$2) OR EXISTS(SELECT 1 FROM download_groups x JOIN user_groups ug ON ug."groupId"=x."groupId" WHERE x."downloadId"=d.id AND ug."userId"=$2) OR EXISTS(SELECT 1 FROM download_roles x JOIN user_roles ur ON ur."roleId"=x."roleId" WHERE x."downloadId"=d.id AND ur."userId"=$2))`} ORDER BY d.category,d.title`,
      parameters,
    );
  }
  async options(actor: AuthenticatedUser) {
    const [groups, roles, users] = await Promise.all([
      this.db.getRepository(Group).find({
        where: { organizationId: actor.organizationId, active: true },
        select: { id: true, name: true },
        order: { name: 'ASC' },
      }),
      this.db.getRepository(Role).find({
        where: { organizationId: actor.organizationId },
        select: { id: true, name: true },
        order: { name: 'ASC' },
      }),
      this.db.getRepository(User).find({
        where: { organizationId: actor.organizationId },
        select: { id: true, firstName: true, lastName: true, email: true },
        order: { lastName: 'ASC', firstName: 'ASC' },
      }),
    ]);
    return {
      groups,
      roles,
      users: users.map((user) => ({
        id: user.id,
        name: `${user.firstName} ${user.lastName}`.trim() || user.email,
      })),
    };
  }
  async save(
    actor: AuthenticatedUser,
    id: string | null,
    dto: ManageDownloadDto,
    file?: Express.Multer.File,
  ) {
    const detectedMime = file ? detectDownload(file.buffer, file.originalname) : null;
    if (file && !detectedMime)
      throw new ForbiddenException(
        'Dieser Dateityp ist nicht erlaubt oder der Dateiinhalt ist ungültig.',
      );
    if (!id && !file) throw new NotFoundException('Datei fehlt.');
    return this.db.transaction(async (m) => {
      for (const [entity, ids] of [
        [Group, dto.groupIds],
        [Role, dto.roleIds],
        [User, dto.userIds],
      ] as const) {
        if (
          ids.length &&
          (await m
            .getRepository(entity)
            .countBy({ id: In(ids), organizationId: actor.organizationId })) !== ids.length
        )
          throw new NotFoundException('Freigabeziel wurde nicht gefunden.');
      }
      let d = id
        ? await m.getRepository(Download).findOneBy({ id, organizationId: actor.organizationId })
        : null;
      if (id && !d) throw new NotFoundException();
      if (!d)
        d = m
          .getRepository(Download)
          .create({ organizationId: actor.organizationId, uploadedBy: actor.id });
      const old = d.storedName;
      Object.assign(d, {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        category: dto.category,
        availableToAll: dto.availableToAll,
        active: dto.active,
      });
      if (file) {
        await mkdir(this.root, { recursive: true });
        d.originalName = file.originalname.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 255);
        d.storedName = `${randomUUID()}${extname(d.originalName).toLowerCase()}`;
        d.mimeType = detectedMime!;
        d.size = file.size;
        await writeFile(join(this.root, d.storedName), file.buffer);
      }
      d = await m.getRepository(Download).save(d);
      for (const e of [DownloadGroup, DownloadRole, DownloadUser])
        await m.getRepository(e).delete({ downloadId: d.id });
      if (dto.groupIds.length)
        await m
          .getRepository(DownloadGroup)
          .insert(dto.groupIds.map((groupId) => ({ downloadId: d.id, groupId })));
      if (dto.roleIds.length)
        await m
          .getRepository(DownloadRole)
          .insert(dto.roleIds.map((roleId) => ({ downloadId: d.id, roleId })));
      if (dto.userIds.length)
        await m
          .getRepository(DownloadUser)
          .insert(dto.userIds.map((userId) => ({ downloadId: d.id, userId })));
      if (file && old) await unlink(join(this.root, old)).catch(() => {});
      await m.getRepository(AuditLog).save({
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        action: id ? 'download.updated' : 'download.uploaded',
        entityType: 'download',
        entityId: d.id,
        outcome: 'success',
        metadata: { title: d.title, fileName: d.originalName },
      });
      return d;
    });
  }
  async file(actor: AuthenticatedUser, id: string) {
    const visible = await this.list(actor);
    const d = visible.find((candidate) => candidate.id === id);
    if (!d) throw new ForbiddenException('Kein Zugriff auf diese Datei.');
    return { download: d, buffer: await readFile(join(this.root, d.storedName)) };
  }
  async remove(actor: AuthenticatedUser, id: string) {
    const d = await this.db
      .getRepository(Download)
      .findOneBy({ id, organizationId: actor.organizationId });
    if (!d) throw new NotFoundException();
    await this.db.transaction(async (manager) => {
      await manager.getRepository(Download).softRemove(d);
      await manager.getRepository(AuditLog).save({
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        action: 'download.deleted',
        entityType: 'download',
        entityId: d.id,
        outcome: 'success',
        metadata: { title: d.title, fileName: d.originalName },
      });
    });
    await unlink(join(this.root, d.storedName)).catch(() => {});
  }
}

export function detectDownload(buffer: Buffer, originalName: string): string | null {
  const extension = extname(originalName).toLowerCase().replace('.', '');
  const expected = downloadTypes[extension];
  if (!expected || buffer.length < 4) return null;
  if (extension === 'pdf') return buffer.subarray(0, 5).toString() === '%PDF-' ? expected : null;
  if (extension === 'png')
    return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ? expected
      : null;
  if (extension === 'jpg' || extension === 'jpeg')
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff ? expected : null;
  if (extension === 'docx' || extension === 'xlsx') {
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) return null;
    try {
      const files = Object.keys(unzipSync(buffer));
      const marker = extension === 'docx' ? 'word/document.xml' : 'xl/workbook.xml';
      return files.includes('[Content_Types].xml') && files.includes(marker) ? expected : null;
    } catch {
      return null;
    }
  }
  return null;
}
