import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditLog } from '../audit/audit-log.entity';
import { AuthenticatedUser } from '../auth/auth.types';
import { Role } from '../rbac/role.entity';
import { UserRole } from '../rbac/user-role.entity';
import { User } from './user.entity';
import { UserStatus } from './user-status.enum';
import { ListUserDirectoryDto } from './dto/list-user-directory.dto';

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
  ) {}

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
