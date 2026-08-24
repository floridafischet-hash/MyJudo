import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedUser } from '../auth/auth.types';
import { PermissionGuard } from '../rbac/permission.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import {
  ChecklistItemDto,
  CreateCardDto,
  CreateProjectDto,
  ListProjectsDto,
  UpdateCardDto,
  UpdateProjectDto,
} from './dto/project.dto';
import { ProjectsService } from './projects.service';
type R = { user: AuthenticatedUser };
@Controller('projects')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}
  @Get() list(@Req() r: R, @Query() query: ListProjectsDto) {
    return this.projects.list(r.user, query.status);
  }
  @Get(':id') detail(@Req() r: R, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.projects.detail(r.user, id);
  }
  @Post() @RequirePermissions('roles.manage') create(@Req() r: R, @Body() dto: CreateProjectDto) {
    return this.projects.create(r.user, dto);
  }
  @Put(':id') update(
    @Req() r: R,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projects.update(r.user, id, dto);
  }
  @Post(':id/cards') addCard(
    @Req() r: R,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CreateCardDto,
  ) {
    return this.projects.addCard(r.user, id, dto);
  }
  @Put(':id/cards/:cardId') updateCard(
    @Req() r: R,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('cardId', new ParseUUIDPipe({ version: '4' })) cardId: string,
    @Body() dto: UpdateCardDto,
  ) {
    return this.projects.updateCard(r.user, id, cardId, dto);
  }
  @Post(':id/cards/:cardId/items') addItem(
    @Req() r: R,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('cardId', new ParseUUIDPipe({ version: '4' })) cardId: string,
    @Body() dto: ChecklistItemDto,
  ) {
    return this.projects.addItem(r.user, id, cardId, dto);
  }
  @Put(':id/cards/:cardId/items/:itemId') updateItem(
    @Req() r: R,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('cardId', new ParseUUIDPipe({ version: '4' })) cardId: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @Body() dto: ChecklistItemDto,
  ) {
    return this.projects.updateItem(r.user, id, cardId, itemId, dto);
  }
  @Patch(':id/cards/:cardId/items/:itemId/toggle') toggle(
    @Req() r: R,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('cardId', new ParseUUIDPipe({ version: '4' })) cardId: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
  ) {
    return this.projects.toggleItem(r.user, id, cardId, itemId);
  }
  @Delete(':id/cards/:cardId/items/:itemId') @HttpCode(204) remove(
    @Req() r: R,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('cardId', new ParseUUIDPipe({ version: '4' })) cardId: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
  ) {
    return this.projects.deleteItem(r.user, id, cardId, itemId);
  }
  @Delete(':id/cards/:cardId') @HttpCode(204) removeCard(
    @Req() r: R,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('cardId', new ParseUUIDPipe({ version: '4' })) cardId: string,
  ) {
    return this.projects.deleteCard(r.user, id, cardId);
  }
  @Delete(':id') @HttpCode(204) removeProject(
    @Req() r: R,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.projects.deleteProject(r.user, id);
  }
}
