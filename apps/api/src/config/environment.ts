const REQUIRED_SECRETS = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'PASSWORD_PEPPER', 'APP_ORIGIN'];

export function validateEnvironment(environment: Record<string, unknown>): Record<string, unknown> {
  const missing = REQUIRED_SECRETS.filter((key) => {
    const value = environment[key];
    return typeof value !== 'string' || value.trim().length === 0;
  });
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  const jwtSecret = String(environment.JWT_ACCESS_SECRET);
  if (jwtSecret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET must contain at least 32 characters');
  }
  const rawPort = environment.PORT ?? '3000';
  if (typeof rawPort !== 'string' && typeof rawPort !== 'number') {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  const port = Number.parseInt(`${rawPort}`, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return {
    ...environment,
    PORT: port,
    JWT_ACCESS_TTL: environment.JWT_ACCESS_TTL ?? '15m',
    NJV_ICS_URL:
      environment.NJV_ICS_URL ??
      'https://www.njv.de/judo-kaempfen/termine-ics/calendar/ics/export/1-njv-kalender/calendar.ics?no_cache=1',
    EXTERNAL_CALENDAR_SYNC_ENABLED: environment.EXTERNAL_CALENDAR_SYNC_ENABLED ?? 'false',
  };
}
