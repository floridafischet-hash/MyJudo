import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Patch,
  Put,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AuthenticatedUser } from '../auth/auth.types';
import { PermissionGuard } from '../rbac/permission.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { DownloadCategoryDto, ManageDownloadDto, MoveDownloadDto } from './dto/manage-download.dto';
import { DownloadsService } from './downloads.service';
type R = { user: AuthenticatedUser };
const options = { limits: { fileSize: 10 * 1024 * 1024 } };
@Controller('downloads')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class DownloadsController {
  constructor(private readonly downloads: DownloadsService) {}
  @Get() list(@Req() r: R) {
    return this.downloads.list(r.user);
  }
  @Get('admin/all') @RequirePermissions('downloads.manage') admin(@Req() r: R) {
    return this.downloads.list(r.user, true);
  }
  @Get('admin/options') @RequirePermissions('downloads.manage') options(@Req() r: R) {
    return this.downloads.options(r.user);
  }
  @Get('categories') categories(@Req() r: R) {
    return this.downloads.listCategories(r.user);
  }
  @Post('categories') @RequirePermissions('downloads.manage') createCategory(
    @Req() r: R,
    @Body() dto: DownloadCategoryDto,
  ) {
    return this.downloads.createCategory(r.user, dto.name);
  }
  @Patch('categories/:id') @RequirePermissions('downloads.manage') renameCategory(
    @Req() r: R,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: DownloadCategoryDto,
  ) {
    return this.downloads.renameCategory(r.user, id, dto.name);
  }
  @Delete('categories/:id') @HttpCode(204) @RequirePermissions('downloads.manage') deleteCategory(
    @Req() r: R,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.downloads.removeCategory(r.user, id);
  }
  @Patch('admin/:id/category') @RequirePermissions('downloads.manage') move(
    @Req() r: R,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: MoveDownloadDto,
  ) {
    return this.downloads.move(r.user, id, dto.categoryId);
  }
  @Get(':id/file') async file(
    @Req() r: R,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Res() res: Response,
  ) {
    const v = await this.downloads.file(r.user, id);
    res.setHeader('Content-Type', v.download.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(v.download.originalName)}`,
    );
    res.send(v.buffer);
  }
  @Post('admin')
  @RequirePermissions('downloads.manage')
  @UseInterceptors(FileInterceptor('file', options))
  create(@Req() r: R, @Body() dto: ManageDownloadDto, @UploadedFile() file: Express.Multer.File) {
    return this.downloads.save(r.user, null, dto, file);
  }
  @Put('admin/:id')
  @RequirePermissions('downloads.manage')
  @UseInterceptors(FileInterceptor('file', options))
  update(
    @Req() r: R,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ManageDownloadDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.downloads.save(r.user, id, dto, file);
  }
  @Delete('admin/:id') @HttpCode(204) @RequirePermissions('downloads.manage') remove(
    @Req() r: R,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.downloads.remove(r.user, id);
  }
}
