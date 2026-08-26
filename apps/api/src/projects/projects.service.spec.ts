import { ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthenticatedUser } from '../auth/auth.types';
import { ProjectStatus } from './project.entity';
import { ProjectsService } from './projects.service';
import { PermissionService } from '../rbac/permission.service';

describe('ProjectsService permissions', () => {
  const actor: AuthenticatedUser = {
    id: 'user-1',
    organizationId: 'org-1',
    authorizationVersion: 0,
  };

  it('prevents an unauthorized user from opening a project', async () => {
    const db = { query: jest.fn().mockResolvedValue([]) } as unknown as DataSource;
    await expect(new ProjectsService(db).detail(actor, 'project-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('prevents a superuser from crossing organization boundaries by direct project id', async () => {
    const db = {
      getRepository: jest.fn().mockReturnValue({ existsBy: jest.fn().mockResolvedValue(false) }),
    } as unknown as DataSource;
    const permissions = {
      hasRole: jest.fn().mockResolvedValue(true),
    } as unknown as PermissionService;
    await expect(
      new ProjectsService(db, permissions).detail(actor, 'foreign-project'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('prevents a read-only participant from creating checklist cards', async () => {
    const db = {
      query: jest.fn().mockResolvedValue([{ access: 'read' }]),
    } as unknown as DataSource;
    await expect(
      new ProjectsService(db).addCard(actor, 'project-1', {
        type: 'checklist' as never,
        title: 'Turniervorbereitung',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a read-only project member to create a shared note', async () => {
    const save = jest.fn().mockResolvedValue({ id: 'note-1', title: 'Absprachen' });
    const db = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ access: 'read' }])
        .mockResolvedValueOnce([]),
      getRepository: jest.fn().mockReturnValue({ save }),
    } as unknown as DataSource;
    await expect(
      new ProjectsService(db).addCard(actor, 'project-1', {
        type: 'note' as never,
        title: 'Absprachen',
        content: 'Erste gemeinsame Notiz',
      }),
    ).resolves.toMatchObject({ title: 'Absprachen' });
  });

  it('excludes completed projects from the default list', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const findBy = jest.fn().mockResolvedValue([]);
    const db = {
      query,
      getRepository: jest.fn().mockReturnValue({ findBy }),
    } as unknown as DataSource;
    await new ProjectsService(db).list(actor);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain(`p.status <> 'completed'`);
    expect(params).toEqual([actor.organizationId, actor.id]);
  });

  it('filters to a single status when explicitly requested', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const db = { query } as unknown as DataSource;
    await new ProjectsService(db).list(actor, ProjectStatus.Completed);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('p.status = $3');
    expect(params).toEqual([actor.organizationId, actor.id, 'completed']);
  });

  it("sorts the active list by the caller's saved positions, appending unpositioned projects at the end", async () => {
    const query = jest.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]);
    const findBy = jest.fn().mockResolvedValue([
      { userId: actor.id, projectId: 'c', position: 0 },
      { userId: actor.id, projectId: 'a', position: 1 },
    ]);
    const db = {
      query,
      getRepository: jest.fn().mockReturnValue({ findBy }),
    } as unknown as DataSource;
    const result = await new ProjectsService(db).list(actor);
    expect(result.map((p: { id: string }) => p.id)).toEqual(['c', 'a', 'b', 'd']);
  });
});
