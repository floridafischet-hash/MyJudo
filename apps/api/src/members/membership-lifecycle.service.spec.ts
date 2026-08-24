import { localMonthStart } from './membership-lifecycle.service';

describe('localMonthStart', () => {
  it('handles a year boundary in the organization timezone', () => {
    expect(localMonthStart(new Date('2027-01-01T00:05:00Z'), 'Europe/Berlin')).toBe('2027-01-01');
  });
  it('uses the local date rather than UTC at a month boundary', () => {
    expect(localMonthStart(new Date('2026-08-31T22:30:00Z'), 'Europe/Berlin')).toBe('2026-09-01');
  });
});
