import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { RbacModule } from '../rbac/rbac.module';
@Module({ imports: [RbacModule], controllers: [ProjectsController], providers: [ProjectsService] })
export class ProjectsModule {}
