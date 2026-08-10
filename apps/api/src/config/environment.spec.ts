import { validateEnvironment } from './environment';

const validEnvironment = {
  DATABASE_URL: 'postgresql://localhost/myjudo',
  APP_ORIGIN: 'https://localhost:18780',
  JWT_ACCESS_SECRET: 'a-secure-test-secret-with-more-than-32-characters',
  PASSWORD_PEPPER: 'test-pepper',
};

describe('validateEnvironment', () => {
  it('normalizes defaults for a valid configuration', () => {
    expect(validateEnvironment(validEnvironment)).toMatchObject({
      PORT: 3000,
    });
  });

  it('rejects missing secrets', () => {
    expect(() => validateEnvironment({})).toThrow('Missing required environment variables');
  });
});
