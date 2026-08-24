import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { AuthenticatedUser } from '../auth/auth.types';
import { AttendanceStatus } from './attendance.entity';
import { Group } from './group.entity';
import { TrainingSchedule } from './training-schedule.entity';
import { TrainingService } from './training.service';

describe('TrainingService attendance authorization', () => {
  const actor: AuthenticatedUser = {
    id: 'user-1',
    organizationId: 'org-1',
    authorizationVersion: 0,
  };
  const attendanceRepository = {
    findOne: jest.fn(),
    create: jest.fn((value: object) => value),
    save: jest.fn(),
  };
  const manager = { query: jest.fn(), getRepository: jest.fn(() => attendanceRepository) };
  const dataSource = {
    transaction: jest.fn((operation: (value: typeof manager) => Promise<unknown>) =>
      operation(manager),
    ),
  } as unknown as DataSource;
  const service = new TrainingService(
    dataSource,
    {} as Repository<Group>,
    {} as Repository<TrainingSchedule>,
    {} as ConfigService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    attendanceRepository.findOne.mockResolvedValue(null);
    attendanceRepository.save.mockImplementation((value: unknown) => Promise.resolve(value));
  });

  it('rejects a manipulated vote for a session outside the current groups', async () => {
    manager.query.mockResolvedValue([]);
    await expect(
      service.vote(actor, 'foreign-session', AttendanceStatus.Yes),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(attendanceRepository.save).not.toHaveBeenCalled();
  });

  it('stores JA for an authorized future session', async () => {
    manager.query.mockResolvedValue([
      { id: 'session-1', startsAt: new Date(Date.now() + 60_000), cancelled: false },
    ]);
    await service.vote(actor, 'session-1', AttendanceStatus.Yes);
    expect(attendanceRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: actor.id,
        trainingSessionId: 'session-1',
        status: AttendanceStatus.Yes,
      }),
    );
  });

  it('stores NEIN and permits changing the answer before training starts', async () => {
    const existing = {
      id: 'attendance-1',
      userId: actor.id,
      trainingSessionId: 'session-1',
      status: AttendanceStatus.Yes,
      respondedAt: new Date(),
      createdAt: new Date(),
    };
    manager.query.mockResolvedValue([
      { id: 'session-1', startsAt: new Date(Date.now() + 60_000), cancelled: false },
    ]);
    attendanceRepository.findOne.mockResolvedValue(existing);
    await service.vote(actor, 'session-1', AttendanceStatus.No);
    expect(existing.status).toBe(AttendanceStatus.No);
    expect(attendanceRepository.save).toHaveBeenCalledWith(existing);
  });

  it('locks the answer at the exact training start', async () => {
    manager.query.mockResolvedValue([
      { id: 'session-1', startsAt: new Date(Date.now() - 1), cancelled: false },
    ]);
    await expect(service.vote(actor, 'session-1', AttendanceStatus.Yes)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(attendanceRepository.save).not.toHaveBeenCalled();
  });

  it('does not accept votes for cancelled training', async () => {
    manager.query.mockResolvedValue([
      { id: 'session-1', startsAt: new Date(Date.now() + 60_000), cancelled: true },
    ]);
    await expect(service.vote(actor, 'session-1', AttendanceStatus.Yes)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('TrainingService personal calendar visibility', () => {
  it('filters the session query by the current user group membership', async () => {
    const actor: AuthenticatedUser = {
      id: 'user-silberruecken',
      organizationId: 'org-1',
      authorizationVersion: 0,
    };
    const query = jest.fn().mockResolvedValue([
      {
        id: 'session-own-group',
        scheduleId: 'schedule-1',
        name: 'Silberrücken',
        startsAt: new Date(Date.now() + 60_000),
        endsAt: new Date(Date.now() + 120_000),
        cancelled: false,
        status: null,
        respondedAt: null,
        updatedAt: null,
        groups: [{ id: 'silberruecken', name: 'Silberrücken' }],
      },
    ]);
    const dataSource = {
      query,
      getRepository: jest.fn(() => ({
        findOneByOrFail: jest.fn().mockResolvedValue({ timezone: 'Europe/Berlin' }),
        upsert: jest.fn(),
      })),
    } as unknown as DataSource;
    const schedules = {
      find: jest.fn().mockResolvedValue([]),
    } as unknown as Repository<TrainingSchedule>;
    const service = new TrainingService(
      dataSource,
      {} as Repository<Group>,
      schedules,
      {} as ConfigService,
    );

    const result = await service.listMySessions(actor, '2026-08-01', '2026-09-01');

    const [sql, parameters] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('JOIN user_groups ug');
    expect(sql).toContain('ug."userId"=$2');
    expect(parameters[1]).toBe(actor.id);
    expect(result.map((session) => session.name)).toEqual(['Silberrücken']);
    expect(result.map((session) => session.name)).not.toContain('Pandas');
  });
});
