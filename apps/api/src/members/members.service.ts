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

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}
