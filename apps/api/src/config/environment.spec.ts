import { validateEnvironment } from './environment';

const validEnvironment = {
  DATABASE_URL: 'postgresql://localhost/myjudo',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  PASSWORD_PEPPER: 'pepper',
  APP_ORIGIN: 'https://localhost:18780',
};

describe('validateEnvironment', () => {
  it('normalizes defaults for a valid configuration', () => {
    expect(validateEnvironment(validEnvironment)).toMatchObject({
      PORT: 3000,
      JWT_ACCESS_TTL: '15m',
    });
  });

  it('rejects missing secrets', () => {
    expect(() => validateEnvironment({})).toThrow('Missing required environment variables');
  });

  it('rejects a weak JWT secret', () => {
    expect(() => validateEnvironment({ ...validEnvironment, JWT_ACCESS_SECRET: 'short' })).toThrow(
      'at least 32 characters',
    );
  });
});
