import { PERMISSIONS, STANDARD_ROLE_PERMISSIONS } from './permission.catalog';

describe('permission catalog', () => {
  it('contains no duplicate permission keys', () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
  });

  it('does not grant PSG access implicitly to board or trainer roles', () => {
    expect(STANDARD_ROLE_PERMISSIONS.Vorstand).not.toContain('chat.psg.access');
    expect(STANDARD_ROLE_PERMISSIONS.Trainer).not.toContain('chat.psg.access');
    expect(STANDARD_ROLE_PERMISSIONS.Jugendtrainer).not.toContain('chat.psg.access');
  });

  it('grants PSG access only to the explicit child-protection role', () => {
    const psgRoles = Object.entries(STANDARD_ROLE_PERMISSIONS)
      .filter(([, permissions]) => permissions.includes('chat.psg.access'))
      .map(([role]) => role);
    expect(psgRoles).toEqual(['PSG / Kinderschutz']);
  });
});
