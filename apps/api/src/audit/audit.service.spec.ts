import { ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthenticatedUser } from '../auth/auth.types';
import { PermissionService } from '../rbac/permission.service';
import { AuditService } from './audit.service';

describe('AuditService authorization', () => {
  const actor: AuthenticatedUser = {
    id: '00000000-0000-4000-8000-000000000001',
    organizationId: '00000000-0000-4000-8000-000000000010',
    authorizationVersion: 0,
  };
  const query = jest.fn();
  const permissions = { hasRole: jest.fn() };
  const service = new AuditService(
    { query } as unknown as DataSource,
    permissions as unknown as PermissionService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('rejects normal users and admins even if they know the endpoint', async () => {
    permissions.hasRole.mockResolvedValue(false);
    await expect(service.list(actor, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(query).not.toHaveBeenCalled();
  });

  it('returns newest logs for a superuser within the current organization', async () => {
    permissions.hasRole.mockResolvedValue(true);
    query.mockResolvedValue([]);
    await service.list(actor, { area: 'project', search: 'Turnier' });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY a."createdAt" DESC'),
      expect.arrayContaining([actor.organizationId, 'project', 'Turnier', 100]),
    );
  });
});
