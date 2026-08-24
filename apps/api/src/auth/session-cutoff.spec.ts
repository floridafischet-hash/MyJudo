import { nextBerlinSessionCutoff } from './auth.service';

describe('nextBerlinSessionCutoff', () => {
  it('uses 23:00 Berlin summer time on the same day before cutoff', () => {
    expect(nextBerlinSessionCutoff(new Date('2026-08-11T13:00:00Z')).toISOString()).toBe(
      '2026-08-11T21:00:00.000Z',
    );
  });

  it('uses the following day after the Berlin cutoff', () => {
    expect(nextBerlinSessionCutoff(new Date('2026-08-11T21:30:00Z')).toISOString()).toBe(
      '2026-08-12T21:00:00.000Z',
    );
  });

  it('respects Berlin winter time', () => {
    expect(nextBerlinSessionCutoff(new Date('2026-12-11T13:00:00Z')).toISOString()).toBe(
      '2026-12-11T22:00:00.000Z',
    );
  });
});
