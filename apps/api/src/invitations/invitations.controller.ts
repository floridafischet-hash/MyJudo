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

interface InvitationRequest {
  user: AuthenticatedUser;
}

@Controller('invitations')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@RequirePermissions('users.invite')
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post()
  create(@Req() request: InvitationRequest, @Body() dto: CreateInvitationDto) {
    return this.invitations.create(request.user, dto);
  }

  @Post(':id/revoke')
  @HttpCode(204)
  revoke(
    @Req() request: InvitationRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    return this.invitations.revoke(request.user, id);
  }
}
