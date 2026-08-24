import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditLog } from '../audit/audit-log.entity';
import { AuthenticatedUser } from '../auth/auth.types';
import { autoColorFor } from '../common/color-palette';
import { deleteImage, readImage, resolveImageUpload, storeImage } from '../common/image-upload';
import { Role } from '../rbac/role.entity';
import { UserRole } from '../rbac/user-role.entity';
import { User } from './user.entity';
import { UserStatus } from './user-status.enum';
import { ListUserDirectoryDto } from './dto/list-user-directory.dto';
import { CreateManagedUserDto, UpdateManagedUserDto } from './dto/manage-user.dto';
import { PasswordService } from '../auth/password.service';
import { Group } from '../training/group.entity';
import { UserGroup } from '../training/user-group.entity';

export interface UserSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  createdAt: Date;
}

export interface DirectoryUser {
  id: string;
  displayName: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly passwords: PasswordService,
    private readonly config: ConfigService,
  ) {}

  private avatarRoot(): string {
    return this.config.get<string>('AVATAR_STORAGE_PATH') ?? '/app/data/avatars';
  }

  async uploadAvatar(actor: AuthenticatedUser, id: string, file: Express.Multer.File) {
    const user = await this.users.findOneBy({ id, organizationId: actor.organizationId });
    if (!user) throw new NotFoundException('Benutzer wurde nicht gefunden.');
    const { mime, extension } = resolveImageUpload(file, 5 * 1024 * 1024);
    const stored = await storeImage(this.avatarRoot(), file.buffer, extension);
    const previous = user.avatarStoredName;
    user.avatarStoredName = stored;
    user.avatarMimeType = mime;
    await this.users.save(user);
    await deleteImage(this.avatarRoot(), previous);
    return { id: user.id };
  }

  async deleteAvatar(actor: AuthenticatedUser, id: string) {
    const user = await this.users.findOneBy({ id, organizationId: actor.organizationId });
    if (!user) throw new NotFoundException('Benutzer wurde nicht gefunden.');
    const previous = user.avatarStoredName;
    user.avatarStoredName = null;
    user.avatarMimeType = null;
    await this.users.save(user);
    await deleteImage(this.avatarRoot(), previous);
  }

  async avatar(actor: AuthenticatedUser, id: string): Promise<{ mime: string; buffer: Buffer }> {
    const user = await this.users.findOneBy({ id, organizationId: actor.organizationId });
    if (!user?.avatarStoredName || !user.avatarMimeType)
      throw new NotFoundException('Bild wurde nicht gefunden.');
    return {
      mime: user.avatarMimeType,
      buffer: await readImage(this.avatarRoot(), user.avatarStoredName),
    };
  }

  async adminList(actor: AuthenticatedUser): Promise<unknown[]> {
    return await this.dataSource.query(
      `SELECT u.id, u.username, u.email, u."firstName", u."lastName", u.status, u.color, u."avatarStoredName",
       COALESCE((SELECT jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'color',g.color) ORDER BY g.name)
         FROM user_groups ug JOIN groups g ON g.id=ug."groupId" WHERE ug."userId"=u.id), '[]') groups,
       COALESCE((SELECT jsonb_agg(jsonb_build_object('id',r.id,'name',r.name) ORDER BY r.name)
         FROM user_roles ur JOIN roles r ON r.id=ur."roleId" WHERE ur."userId"=u.id), '[]') roles
       FROM users u WHERE u."organizationId"=$1 AND u."deletedAt" IS NULL
       ORDER BY u."lastName", u."firstName"`,
      [actor.organizationId],
    );
  }

  async createManaged(actor: AuthenticatedUser, dto: CreateManagedUserDto) {
    return this.dataSource.transaction(async (manager) => {
      await this.validateAssignments(manager, actor, dto.roleIds, dto.groupIds);
      const user = manager.getRepository(User).create({
        organizationId: actor.organizationId,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        username: dto.username.trim().toLowerCase(),
        email: dto.email.trim().toLowerCase(),
        passwordHash: await this.passwords.hash(dto.password),
        status: dto.status,
        approvedAt: dto.status === UserStatus.Approved ? new Date() : null,
        approvedBy: dto.status === UserStatus.Approved ? actor.id : null,
        color: dto.color ?? autoColorFor(dto.username),
      });
      let saved: User;
      try {
        saved = await manager.getRepository(User).save(user);
      } catch {
        throw new ConflictException('Benutzername oder E-Mail-Adresse ist bereits vergeben.');
      }
      await this.replaceAssignments(manager, actor, saved, dto.roleIds, dto.groupIds);
      await manager.getRepository(AuditLog).save({
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        action: 'user.created',
        entityType: 'user',
        entityId: saved.id,
        outcome: 'success',
        metadata: {
          displayName: `${saved.firstName} ${saved.lastName}`.trim(),
          roleIds: dto.roleIds,
          groupIds: dto.groupIds,
          status: saved.status,
        },
      });
      return { id: saved.id };
    });
  }

  async updateManaged(actor: AuthenticatedUser, id: string, dto: UpdateManagedUserDto) {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager
        .getRepository(User)
        .findOneBy({ id, organizationId: actor.organizationId });
      if (!user) throw new NotFoundException('Benutzer wurde nicht gefunden.');
      await this.validateAssignments(manager, actor, dto.roleIds, dto.groupIds);
      user.firstName = dto.firstName.trim();
      user.lastName = dto.lastName.trim();
      user.username = dto.username.trim().toLowerCase();
      user.email = dto.email.trim().toLowerCase();
      user.status = dto.status;
      user.color = dto.color ?? user.color ?? autoColorFor(dto.username);
      user.authorizationVersion += 1;
      if (dto.password) user.passwordHash = await this.passwords.hash(dto.password);
      try {
        await manager.getRepository(User).save(user);
      } catch {
        throw new ConflictException('Benutzername oder E-Mail-Adresse ist bereits vergeben.');
      }
      await this.replaceAssignments(manager, actor, user, dto.roleIds, dto.groupIds);
      await manager.getRepository(AuditLog).save({
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        action: 'user.updated',
        entityType: 'user',
        entityId: user.id,
        outcome: 'success',
        metadata: {
          displayName: `${user.firstName} ${user.lastName}`.trim(),
          roleIds: dto.roleIds,
          groupIds: dto.groupIds,
          status: user.status,
        },
      });
      return { id: user.id };
    });
  }

  private async validateAssignments(
    manager: import('typeorm').EntityManager,
    actor: AuthenticatedUser,
    roleIds: string[],
    groupIds: string[],
  ) {
    const roles = roleIds.length
      ? await manager
          .getRepository(Role)
          .createQueryBuilder('r')
          .where('r."organizationId"=:org AND r.id IN (:...ids)', {
            org: actor.organizationId,
            ids: roleIds,
          })
          .getCount()
      : 0;
    const groups = groupIds.length
      ? await manager
          .getRepository(Group)
          .createQueryBuilder('g')
          .where('g."organizationId"=:org AND g.id IN (:...ids)', {
            org: actor.organizationId,
            ids: groupIds,
          })
          .getCount()
      : 0;
    if (roles !== roleIds.length || groups !== groupIds.length)
      throw new NotFoundException('Rolle oder Gruppe wurde nicht gefunden.');
  }

  private async replaceAssignments(
    manager: import('typeorm').EntityManager,
    actor: AuthenticatedUser,
    user: User,
    roleIds: string[],
    groupIds: string[],
  ) {
    await manager.getRepository(UserRole).delete({ userId: user.id });
    await manager.getRepository(UserGroup).delete({ userId: user.id });
    if (roleIds.length)
      await manager
        .getRepository(UserRole)
        .insert(roleIds.map((roleId) => ({ userId: user.id, roleId, assignedBy: actor.id })));
    if (groupIds.length)
      await manager
        .getRepository(UserGroup)
        .insert(groupIds.map((groupId) => ({ userId: user.id, groupId, assignedBy: actor.id })));
  }

  async listByStatus(
    actor: AuthenticatedUser,
    status: UserStatus,
    limit: number,
  ): Promise<UserSummary[]> {
    const users = await this.users.find({
      where: { organizationId: actor.organizationId, status },
      order: { createdAt: 'ASC', id: 'ASC' },
      take: limit,
    });
    return users.map(toSummary);
  }

  async directory(
    actor: AuthenticatedUser,
    query: ListUserDirectoryDto,
  ): Promise<{ items: DirectoryUser[]; page: number; pageSize: number; total: number }> {
    const builder = this.users
      .createQueryBuilder('directory_user')
      .where('directory_user.organizationId = :organizationId', {
        organizationId: actor.organizationId,
      })
      .andWhere('directory_user.status = :status', { status: UserStatus.Approved })
      .andWhere('directory_user.id <> :actorId', { actorId: actor.id })
      .andWhere('directory_user.deletedAt IS NULL');
    if (query.search) {
      builder.andWhere(
        `(directory_user.firstName ILIKE :search OR directory_user.lastName ILIKE :search OR CONCAT(directory_user.firstName, ' ', directory_user.lastName) ILIKE :search)`,
        { search: `%${escapeLike(query.search.trim())}%` },
      );
    }
    builder
      .orderBy('directory_user.lastName', 'ASC')
      .addOrderBy('directory_user.firstName', 'ASC')
      .addOrderBy('directory_user.id', 'ASC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);
    const [users, total] = await builder.getManyAndCount();
    return {
      items: users.map((user) => ({ id: user.id, displayName: displayName(user) })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async approve(actor: AuthenticatedUser, userId: string): Promise<UserSummary> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(User);
      const user = await repository.findOne({
        where: { id: userId, organizationId: actor.organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new NotFoundException('Benutzer wurde nicht gefunden.');
      if (user.status !== UserStatus.Pending) {
        throw new ConflictException('Nur ausstehende Benutzer können freigeschaltet werden.');
      }
      user.status = UserStatus.Approved;
      user.approvedAt = new Date();
      user.approvedBy = actor.id;
      user.authorizationVersion += 1;
      const saved = await repository.save(user);
      await manager.getRepository(AuditLog).save({
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        action: 'user.approved',
        entityType: 'user',
        entityId: user.id,
        outcome: 'success',
        metadata: null,
      });
      return toSummary(saved);
    });
  }

  async assignRoles(
    actor: AuthenticatedUser,
    userId: string,
    roleIds: string[],
  ): Promise<{ userId: string; roleIds: string[] }> {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager.getRepository(User).findOne({
        where: { id: userId, organizationId: actor.organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new NotFoundException('Benutzer wurde nicht gefunden.');
      const roles = roleIds.length
        ? await manager
            .getRepository(Role)
            .createQueryBuilder('role')
            .where('role.organizationId = :organizationId', {
              organizationId: actor.organizationId,
            })
            .andWhere('role.id IN (:...roleIds)', { roleIds })
            .getMany()
        : [];
      if (roles.length !== roleIds.length) {
        throw new NotFoundException('Mindestens eine Rolle wurde nicht gefunden.');
      }
      await manager.getRepository(UserRole).delete({ userId: user.id });
      if (roles.length > 0) {
        await manager
          .getRepository(UserRole)
          .insert(
            roles.map((role) => ({ userId: user.id, roleId: role.id, assignedBy: actor.id })),
          );
      }
      user.authorizationVersion += 1;
      await manager.getRepository(User).save(user);
      const sortedRoleIds = roles.map((role) => role.id).sort();
      await manager.getRepository(AuditLog).save({
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        action: 'user.roles.replaced',
        entityType: 'user',
        entityId: user.id,
        outcome: 'success',
        metadata: { roleIds: sortedRoleIds },
      });
      return { userId: user.id, roleIds: sortedRoleIds };
    });
  }
}

function toSummary(user: User): UserSummary {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    status: user.status,
    createdAt: user.createdAt,
  };
}

function displayName(user: User): string {
  const name = `${user.firstName} ${user.lastName}`.trim();
  return name || 'Mitglied';
}

function escapeLike(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
}
