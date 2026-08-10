import { validateEnvironment } from './environment';

const validEnvironment = {
  DATABASE_URL: 'postgresql://localhost/myjudo',
  APP_ORIGIN: 'https://localhost:18780',
  KEYCLOAK_URL: 'http://localhost:8080',
  KEYCLOAK_REALM: 'myjudo',
  KEYCLOAK_CLIENT_ID: 'myjudo-client',
  KEYCLOAK_AUDIENCE: 'myjudo-api',
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
