import { Body, Controller, Headers, HttpCode, HttpStatus, Ip, Post } from '@nestjs/common';
import { AuthService, TokenPair } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { UserStatus } from '../users/user-status.enum';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60 * 60 * 1000 } })
  register(@Body() dto: RegisterDto): Promise<{ id: string; status: UserStatus }> {
    return this.auth.register(dto);
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60 * 1000 } })
  @HttpCode(HttpStatus.OK)
  login(
    @Body() dto: LoginDto,
    @Headers('user-agent') userAgent: string | undefined,
    @Ip() ipAddress: string,
  ): Promise<TokenPair> {
    return this.auth.login(dto, { userAgent, ipAddress });
  }

  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 60 * 1000 } })
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto): Promise<TokenPair> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 20, ttl: 60 * 1000 } })
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }
}
