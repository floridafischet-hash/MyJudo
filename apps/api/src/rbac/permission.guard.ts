import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser } from '../auth/auth.types';
import { PermissionService } from './permission.service';
import { REQUIRED_PERMISSIONS, SUPERUSER_REQUIRED } from './permissions.decorator';

interface AuthenticatedRequest {
  user?: AuthenticatedUser;
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const superuserRequired = this.reflector.getAllAndOverride<boolean>(SUPERUSER_REQUIRED, [
      context.getHandler(),
      context.getClass(),
    ]);
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!superuserRequired && (!required || required.length === 0)) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) throw new ForbiddenException();
    const localSuperuser = await this.permissions.hasRole(
      request.user.id,
      request.user.organizationId,
      'Superuser',
    );
    if (superuserRequired) {
      if (!localSuperuser) {
        throw new ForbiddenException('Diese Aktion ist ausschließlich für Superuser erlaubt.');
      }
      return true;
    }
    if (localSuperuser && !required.includes('chat.psg.access')) return true;
    if (!(await this.permissions.hasAll(request.user.id, request.user.organizationId, required))) {
      throw new ForbiddenException('Für diese Aktion fehlt die erforderliche Berechtigung.');
    }
    return true;
  }
}
