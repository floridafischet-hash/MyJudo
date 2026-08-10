export interface AuthenticatedUser {
  id: string;
  organizationId: string;
  authorizationVersion: number;
  identityProviderSubject: string;
  identityRoles: string[];
}

export interface AccessTokenPayload {
  sub: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  name?: string;
  email?: string;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
}
