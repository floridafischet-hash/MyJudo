import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedUser } from '../auth/auth.types';
import { PermissionGuard } from '../rbac/permission.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { AuditQuery, AuditService } from './audit.service';

@Controller('audit-logs')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@RequirePermissions('audit.view')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Req() request: { user: AuthenticatedUser }, @Query() query: AuditQuery) {
    return this.audit.list(request.user, query);
  }
}
