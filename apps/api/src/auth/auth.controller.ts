import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedUser } from './auth.types';
import { AuthService, UserProfile } from './auth.service';

interface AuthenticatedRequest {
  user: AuthenticatedUser;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  profile(@Req() request: AuthenticatedRequest): Promise<UserProfile> {
    return this.auth.profile(request.user);
  }
}
