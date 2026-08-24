import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

@Module({ imports: [RbacModule], controllers: [AuditController], providers: [AuditService] })
export class AuditModule {}
