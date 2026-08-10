import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns a stable health response', () => {
    expect(new HealthController().health()).toEqual({ status: 'ok' });
  });
});
