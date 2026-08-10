import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissionService } from '../rbac/permission.service';
import { User } from '../users/user.entity';
import { UserStatus } from '../users/user-status.enum';
import { AuthenticatedUser } from './auth.types';

export interface UserProfile {
  id: string;
  username: string;
  firstName: string | null;
  displayName: string | null;
  permissions: string[];
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly permissions: PermissionService,
  ) {}

  async profile(actor: AuthenticatedUser): Promise<UserProfile> {
    const user = await this.users.findOneBy({
      id: actor.id,
      organizationId: actor.organizationId,
      identityProviderSubject: actor.identityProviderSubject,
    });
    if (!user || user.status !== UserStatus.Approved) {
      throw new UnauthorizedException('Das Benutzerkonto ist noch nicht freigeschaltet.');
    }
    const username = user.email.split('@')[0] ?? user.email;
    const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || null;
    return {
      id: user.id,
      username,
      firstName: user.firstName.trim() || null,
      displayName,
      permissions: await this.permissions.listForUser(user.id, user.organizationId),
    };
  }
}
