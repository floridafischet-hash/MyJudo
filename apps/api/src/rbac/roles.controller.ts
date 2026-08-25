import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthenticatedUser } from '../auth/auth.types';
import { PermissionGuard } from './permission.guard';
import { RequireSuperuser } from './permissions.decorator';
import { Role } from './role.entity';

interface RoleRequest {
  user: AuthenticatedUser;
}

@Controller('roles')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class RolesController {
  constructor(@InjectRepository(Role) private readonly roles: Repository<Role>) {}

  @Get()
  @RequireSuperuser()
  async list(@Req() request: RoleRequest): Promise<Array<{ id: string; name: string }>> {
    const roles = await this.roles.find({
      where: { organizationId: request.user.organizationId },
      order: { name: 'ASC' },
    });
    return roles.map(({ id, name }) => ({ id, name }));
  }
}
