import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { AuthenticatedUser } from '../auth/auth.types';
import { PermissionGuard } from '../rbac/permission.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { AddExamParticipantDto } from './dto/add-exam-participant.dto';
import { CreateExamDto } from './dto/create-exam.dto';
import { ListExamsDto } from './dto/list-exams.dto';
import { UpdateExamParticipantDto } from './dto/update-exam-participant.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { ExamParticipantSummary, ExamsService, ExamSummary } from './exams.service';

interface ExamRequest {
  user: AuthenticatedUser;
}

@Controller()
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class ExamsController {
  constructor(private readonly exams: ExamsService) {}

  @Get('exams')
  @RequirePermissions('exams.view')
  list(
    @Req() request: ExamRequest,
    @Query() query: ListExamsDto,
  ): Promise<{ items: ExamSummary[]; page: number; pageSize: number; total: number }> {
    return this.exams.list(request.user, query);
  }

  @Get('exams/export.csv')
  @RequirePermissions('exams.export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  exportCsv(@Req() request: ExamRequest, @Res() response: Response): Promise<void> {
    return this.exams.exportCsv(request.user, response);
  }

  @Get('exams/export.xlsx')
  @RequirePermissions('exams.export')
  exportXlsx(@Req() request: ExamRequest, @Res() response: Response): Promise<void> {
    return this.exams.exportXlsx(request.user, response);
  }

  @Post('exams')
  @RequirePermissions('exams.create')
  create(@Req() request: ExamRequest, @Body() dto: CreateExamDto): Promise<ExamSummary> {
    return this.exams.create(request.user, dto);
  }

  @Patch('exams/:id')
  @RequirePermissions('exams.edit')
  update(
    @Req() request: ExamRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateExamDto,
  ): Promise<ExamSummary> {
    return this.exams.update(request.user, id, dto);
  }

  @Post('exams/:id/participants')
  @RequirePermissions('exams.edit')
  addParticipant(
    @Req() request: ExamRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AddExamParticipantDto,
  ): Promise<ExamParticipantSummary> {
    return this.exams.addParticipant(request.user, id, dto);
  }

  @Patch('exam-participants/:id')
  @RequirePermissions('exams.edit')
  updateParticipant(
    @Req() request: ExamRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateExamParticipantDto,
  ): Promise<ExamParticipantSummary> {
    return this.exams.updateParticipant(request.user, id, dto);
  }
}
