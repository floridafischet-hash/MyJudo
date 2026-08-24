import { ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthenticatedUser } from '../auth/auth.types';
import { ProjectStatus } from './project.entity';
import { ProjectsService } from './projects.service';

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
    const db = { query } as unknown as DataSource;
    await new ProjectsService(db).list(actor);
    expect(query.mock.calls[0][0] as string).toContain(`p.status <> 'completed'`);
    expect(query.mock.calls[0][1]).toEqual([actor.organizationId, actor.id]);
  });

  it('filters to a single status when explicitly requested', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const db = { query } as unknown as DataSource;
    await new ProjectsService(db).list(actor, ProjectStatus.Completed);
    expect(query.mock.calls[0][0] as string).toContain('p.status = $3');
    expect(query.mock.calls[0][1]).toEqual([actor.organizationId, actor.id, 'completed']);
  });
});
