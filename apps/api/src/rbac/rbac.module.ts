import { Module } from '@nestjs/common';
import { PermissionGuard } from './permission.guard';
import { PermissionService } from './permission.service';

@Module({
  providers: [PermissionService, PermissionGuard],
  exports: [PermissionService, PermissionGuard],
})
export class RbacModule {}
