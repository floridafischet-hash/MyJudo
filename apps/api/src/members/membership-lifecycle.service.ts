import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource, LessThan } from 'typeorm';
import { AuditLog } from '../audit/audit-log.entity';
import { Organization } from '../organizations/organization.entity';
import { Role } from '../rbac/role.entity';
import { UserRole } from '../rbac/user-role.entity';
import { User } from '../users/user.entity';
import { MemberStatus } from './member-status.enum';
import { Member } from './member.entity';

@Injectable()
export class MembershipLifecycleService {
  constructor(private readonly dataSource: DataSource) {}

  @Cron('0 10 0 * * *', { timeZone: 'UTC' })
  async runDaily(): Promise<void> {
    await this.process(new Date());
  }

  async process(asOf: Date): Promise<number> {
    const organizations = await this.dataSource
      .getRepository(Organization)
      .findBy({ active: true });
    let transitioned = 0;
    for (const organization of organizations) {
      const monthStart = localMonthStart(asOf, organization.timezone);
      transitioned += await this.dataSource.transaction(async (manager) => {
        const lockRows = await manager.query<Array<{ locked: boolean }>>(
          `SELECT pg_try_advisory_xact_lock(hashtext($1)) AS locked`,
          [`myjudo-membership-lifecycle:${organization.id}`],
        );
        if (!lockRows[0]?.locked) return 0;
        const members = await manager.getRepository(Member).find({
          where: {
            organizationId: organization.id,
            status: MemberStatus.ExitScheduled,
            exitDate: LessThan(monthStart),
          },
        });
        const memberRole = await manager
          .getRepository(Role)
          .findOneBy({ organizationId: organization.id, name: 'Mitglied / Eltern' });
        for (const member of members) {
          member.status = MemberStatus.Former;
          await manager.getRepository(Member).save(member);
          if (member.userId) {
            if (memberRole)
              await manager
                .getRepository(UserRole)
                .delete({ userId: member.userId, roleId: memberRole.id });
            await manager
              .getRepository(User)
              .increment(
                { id: member.userId, organizationId: organization.id },
                'authorizationVersion',
                1,
              );
          }
          await manager.getRepository(AuditLog).save({
            organizationId: organization.id,
            actorUserId: null,
            action: 'member.exit.completed',
            entityType: 'member',
            entityId: member.id,
            outcome: 'success',
            metadata: { exitDate: member.exitDate, effectiveDate: monthStart },
          });
        }
        return members.length;
      });
    }
    return transitioned;
  }
}

export function localMonthStart(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  if (!year || !month) throw new Error(`Could not determine local month for ${timeZone}`);
  return `${year}-${month}-01`;
}
