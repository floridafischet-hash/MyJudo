const REQUIRED_SECRETS = [
  'DATABASE_URL',
  'APP_ORIGIN',
  'KEYCLOAK_URL',
  'KEYCLOAK_REALM',
  'KEYCLOAK_CLIENT_ID',
  'KEYCLOAK_AUDIENCE',
];

export function validateEnvironment(environment: Record<string, unknown>): Record<string, unknown> {
  const missing = REQUIRED_SECRETS.filter((key) => {
    const value = environment[key];
    return typeof value !== 'string' || value.trim().length === 0;
  });
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  const rawPort = environment.PORT ?? '3000';
  if (typeof rawPort !== 'string' && typeof rawPort !== 'number') {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  const port = Number.parseInt(`${rawPort}`, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return { ...environment, PORT: port };
}
