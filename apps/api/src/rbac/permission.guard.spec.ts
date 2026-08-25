import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';
import { PermissionService } from './permission.service';
import { REQUIRED_PERMISSIONS, SUPERUSER_REQUIRED } from './permissions.decorator';

function contextWithUser(user?: {
  id: string;
  organizationId: string;
  authorizationVersion: number;
}): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('PermissionGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
  const permissions = { hasAll: jest.fn(), hasRole: jest.fn() } as unknown as PermissionService;
  const guard = new PermissionGuard(reflector, permissions);

  beforeEach(() => jest.clearAllMocks());

  function metadata(required: string[] = [], superuserRequired = false) {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: unknown) => {
      if (key === SUPERUSER_REQUIRED) return superuserRequired;
      if (key === REQUIRED_PERMISSIONS) return required;
      return undefined;
    });
  }

  it('rejects an unauthenticated request for protected permissions', async () => {
    metadata(['members.export']);
    await expect(guard.canActivate(contextWithUser())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a user without all required permissions', async () => {
    metadata(['chat.psg.access']);
    jest.spyOn(permissions, 'hasAll').mockResolvedValue(false);
    await expect(
      guard.canActivate(
        contextWithUser({
          id: 'user',
          organizationId: 'org',
          authorizationVersion: 0,
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a user only after the server-side permission lookup succeeds', async () => {
    metadata(['members.view']);
    jest.spyOn(permissions, 'hasAll').mockResolvedValue(true);
    await expect(
      guard.canActivate(
        contextWithUser({
          id: 'user',
          organizationId: 'org',
          authorizationVersion: 0,
        }),
      ),
    ).resolves.toBe(true);
  });

  it('uses the local superuser role and never bypasses PSG', async () => {
    const user = contextWithUser({
      id: 'user',
      organizationId: 'org',
      authorizationVersion: 0,
    });
    jest.spyOn(permissions, 'hasRole').mockResolvedValue(true);
    jest.spyOn(permissions, 'hasAll').mockResolvedValue(false);
    metadata(['roles.manage']);
    await expect(guard.canActivate(user)).resolves.toBe(true);
    metadata(['chat.psg.access']);
    await expect(guard.canActivate(user)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires the local Superuser role even when a user has roles.manage', async () => {
    metadata([], true);
    jest.spyOn(permissions, 'hasRole').mockResolvedValue(false);
    const hasAll = jest.spyOn(permissions, 'hasAll').mockResolvedValue(true);
    await expect(
      guard.canActivate(
        contextWithUser({ id: 'user', organizationId: 'org', authorizationVersion: 0 }),
      ),
    ).rejects.toThrow('ausschließlich für Superuser');
    expect(hasAll).not.toHaveBeenCalled();
  });
});
