export interface AuthenticatedUser {
  id: string;
  organizationId: string;
  authorizationVersion: number;
}

export interface AccessTokenPayload {
  sub: string;
  org: string;
  av: number;
}
