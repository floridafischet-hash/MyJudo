import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedUser } from '../auth/auth.types';
import { PermissionGuard } from '../rbac/permission.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { InvitationsService } from './invitations.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';

interface InvitationRequest {
  user: AuthenticatedUser;
}

@Controller('invitations')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post()
  @RequirePermissions('users.invite')
  create(@Req() request: InvitationRequest, @Body() dto: CreateInvitationDto) {
    return this.invitations.create(request.user, dto);
  }

  @Post(':id/revoke')
  @RequirePermissions('users.invite')
  @HttpCode(204)
  revoke(
    @Req() request: InvitationRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    return this.invitations.revoke(request.user, id);
  }

  @Post('accept')
  accept(
    @Req() request: InvitationRequest,
    @Body() dto: AcceptInvitationDto,
  ): Promise<{ status: string }> {
    return this.invitations.accept(request.user, dto.token);
  }
}
