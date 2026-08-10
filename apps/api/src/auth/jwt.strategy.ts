import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { UserStatus } from '../users/user-status.enum';
import { AccessTokenPayload, AuthenticatedUser } from './auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      issuer: 'myjudo-api',
      audience: 'myjudo-client',
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const user = await this.users.findOneBy({ id: payload.sub, organizationId: payload.org });
    if (!user || user.status !== UserStatus.Approved || user.authorizationVersion !== payload.av) {
      throw new UnauthorizedException();
    }
    return { id: user.id, organizationId: user.organizationId, authorizationVersion: payload.av };
  }
}
