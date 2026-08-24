import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthenticatedUser } from '../auth/auth.types';
import { PermissionGuard } from '../rbac/permission.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { ConfirmMemberImportDto } from './dto/member-import.dto';
import { MemberImportService } from './member-import.service';

@Controller('members/import')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@RequirePermissions('roles.manage')
export class MemberImportController {
  constructor(private readonly imports: MemberImportService) {}
  @Post('analyze')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  analyze(@Req() req: { user: AuthenticatedUser }, @UploadedFile() file: Express.Multer.File) {
    return this.imports.analyze(req.user, file);
  }
  @Post(':id/confirm')
  confirm(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ConfirmMemberImportDto,
  ) {
    return this.imports.confirm(req.user, id, dto);
  }
  @Get('history') history(@Req() req: { user: AuthenticatedUser }) {
    return this.imports.history(req.user);
  }
}
