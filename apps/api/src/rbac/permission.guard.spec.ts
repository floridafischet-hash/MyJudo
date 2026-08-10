import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';
import { PermissionService } from './permission.service';

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
  const permissions = { hasAll: jest.fn() } as unknown as PermissionService;
  const guard = new PermissionGuard(reflector, permissions);

  beforeEach(() => jest.clearAllMocks());

  it('rejects an unauthenticated request for protected permissions', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['members.export']);
    await expect(guard.canActivate(contextWithUser())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a user without all required permissions', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['chat.psg.access']);
    jest.spyOn(permissions, 'hasAll').mockResolvedValue(false);
    await expect(
      guard.canActivate(
        contextWithUser({ id: 'user', organizationId: 'org', authorizationVersion: 0 }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a user only after the server-side permission lookup succeeds', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['members.view']);
    jest.spyOn(permissions, 'hasAll').mockResolvedValue(true);
    await expect(
      guard.canActivate(
        contextWithUser({ id: 'user', organizationId: 'org', authorizationVersion: 0 }),
      ),
    ).resolves.toBe(true);
  });
});
