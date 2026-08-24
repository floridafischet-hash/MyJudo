import { Module } from '@nestjs/common';
import { RbacModule } from '../rbac/rbac.module';
import { DownloadsController } from './downloads.controller';
import { DownloadsService } from './downloads.service';
@Module({
  imports: [RbacModule],
  controllers: [DownloadsController],
  providers: [DownloadsService],
})
export class DownloadsModule {}
