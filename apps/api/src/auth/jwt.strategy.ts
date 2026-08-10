import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { createPublicKey, JsonWebKey as CryptoJsonWebKey } from 'node:crypto';
import { Repository } from 'typeorm';
import { AuditLog } from '../audit/audit-log.entity';
import { Organization } from '../organizations/organization.entity';
import { User } from '../users/user.entity';
import { UserStatus } from '../users/user-status.enum';
import { AccessTokenPayload, AuthenticatedUser } from './auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly clientId: string;
  private readonly organizationSlug: string;

  constructor(
    config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Organization) private readonly organizations: Repository<Organization>,
    @InjectRepository(AuditLog) private readonly audits: Repository<AuditLog>,
  ) {
    const keycloakUrl = config.getOrThrow<string>('KEYCLOAK_URL').replace(/\/$/, '');
    const realm = config.getOrThrow<string>('KEYCLOAK_REALM');
    const clientId = config.getOrThrow<string>('KEYCLOAK_CLIENT_ID');
    const issuer = `${keycloakUrl}/realms/${realm}`;
    const jwksBaseUrl = (config.get<string>('KEYCLOAK_JWKS_URL') ?? keycloakUrl).replace(/\/$/, '');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: createJwksProvider(
        `${jwksBaseUrl}/realms/${realm}/protocol/openid-connect/certs`,
      ),
      algorithms: ['RS256'],
      issuer,
      audience: config.getOrThrow<string>('KEYCLOAK_AUDIENCE'),
    });
    this.clientId = clientId;
    this.organizationSlug = config.getOrThrow<string>('INITIAL_ORGANIZATION_SLUG');
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    let user = await this.users.findOneBy({ identityProviderSubject: payload.sub });
    if (!user) user = await this.provisionPendingUser(payload);
    if (user.status === UserStatus.Suspended || user.status === UserStatus.Archived) {
      throw new UnauthorizedException();
    }
    const roles = new Set(payload.realm_access?.roles ?? []);
    for (const role of payload.resource_access?.[this.clientId]?.roles ?? []) roles.add(role);
    return {
      id: user.id,
      organizationId: user.organizationId,
      authorizationVersion: user.authorizationVersion,
      identityProviderSubject: payload.sub,
      identityRoles: [...roles],
    };
  }

  private async provisionPendingUser(payload: AccessTokenPayload): Promise<User> {
    const email = payload.email?.trim().toLocaleLowerCase('en-US');
    if (!email) throw new UnauthorizedException('Der Identitätsanbieter liefert keine E-Mail.');
    const organization = await this.organizations.findOneBy({
      slug: this.organizationSlug,
      active: true,
    });
    if (!organization) throw new UnauthorizedException();
    try {
      const user = await this.users.save({
        organizationId: organization.id,
        email,
        identityProviderSubject: payload.sub,
        firstName: payload.given_name?.trim() || payload.preferred_username?.trim() || 'Mitglied',
        lastName: payload.family_name?.trim() || '',
        status: UserStatus.Pending,
        approvedAt: null,
        approvedBy: null,
      });
      await this.audits.save({
        organizationId: organization.id,
        actorUserId: user.id,
        action: 'user.registered.keycloak',
        entityType: 'user',
        entityId: user.id,
        outcome: 'success',
        metadata: null,
      });
      return user;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const existing = await this.users.findOne({
        where: [
          { identityProviderSubject: payload.sub },
          { organizationId: organization.id, email },
        ],
      });
      if (!existing || existing.identityProviderSubject !== payload.sub) {
        throw new UnauthorizedException(
          'Das Benutzerkonto kann nicht eindeutig zugeordnet werden.',
        );
      }
      return existing;
    }
  }
}

interface JwkResponse {
  keys: Array<JsonWebKey & { kid?: string; use?: string }>;
}

function createJwksProvider(jwksUri: string) {
  const cache = new Map<string, { pem: string; expiresAt: number }>();
  let lastFetch = 0;
  return (
    _request: unknown,
    rawToken: string,
    done: (error: Error | null, secret?: string) => void,
  ): void => {
    void resolveSigningKey(rawToken)
      .then((secret) => done(null, secret))
      .catch((error: unknown) =>
        done(error instanceof Error ? error : new Error('JWKS validation failed')),
      );
  };

  async function resolveSigningKey(rawToken: string): Promise<string> {
    const encodedHeader = rawToken.split('.')[0];
    if (!encodedHeader) throw new Error('JWT header missing');
    const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8')) as {
      kid?: string;
      alg?: string;
    };
    if (!header.kid || header.alg !== 'RS256') throw new Error('Unsupported JWT header');
    const cached = cache.get(header.kid);
    if (cached && cached.expiresAt > Date.now()) return cached.pem;
    if (Date.now() - lastFetch < 1_000) throw new Error('JWKS refresh rate limited');
    lastFetch = Date.now();
    const response = await fetch(jwksUri, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error(`JWKS request failed: HTTP ${response.status}`);
    const body = (await response.json()) as JwkResponse;
    for (const key of body.keys) {
      if (!key.kid || key.use !== 'sig') continue;
      const pem = createPublicKey({ key: key as CryptoJsonWebKey, format: 'jwk' })
        .export({ type: 'spki', format: 'pem' })
        .toString();
      cache.set(key.kid, { pem, expiresAt: Date.now() + 10 * 60_000 });
    }
    const resolved = cache.get(header.kid);
    if (!resolved) throw new Error('Signing key not found');
    return resolved.pem;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}
