import { Repository } from 'typeorm';
import { AuthenticatedUser } from '../auth/auth.types';
import { NotificationPreference } from './notification-preference.entity';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const actor: AuthenticatedUser = {
    id: '00000000-0000-4000-8000-000000000001',
    organizationId: '00000000-0000-4000-8000-000000000010',
    authorizationVersion: 0,
  };
  let findOneBy: jest.Mock;
  let create: jest.Mock;
  let save: jest.Mock;
  let service: NotificationsService;

  beforeEach(() => {
    findOneBy = jest.fn();
    create = jest.fn((value: NotificationPreference) => value);
    save = jest.fn((value: NotificationPreference) => Promise.resolve(value));
    service = new NotificationsService({
      findOneBy,
      create,
      save,
    } as unknown as Repository<NotificationPreference>);
  });

  it('liefert datenschutzfreundliche Defaults ohne vorhandenen Datensatz', async () => {
    findOneBy.mockResolvedValue(null);
    await expect(service.get(actor)).resolves.toEqual({
      enabled: false,
      chatMessages: true,
      showMessagePreview: false,
    });
    expect(findOneBy).toHaveBeenCalledWith({
      userId: actor.id,
      organizationId: actor.organizationId,
    });
  });

  it('speichert die Aktivierung ausschließlich für den angemeldeten Benutzer', async () => {
    findOneBy.mockResolvedValue(null);
    const result = await service.update(actor, {
      enabled: true,
      chatMessages: true,
      showMessagePreview: false,
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: actor.id,
        organizationId: actor.organizationId,
        enabled: true,
      }),
    );
    expect(result.enabled).toBe(true);
  });

  it('aktualisiert einen vorhandenen Datensatz beim Deaktivieren', async () => {
    const existing = {
      enabled: true,
      chatMessages: true,
      showMessagePreview: true,
    } as NotificationPreference;
    findOneBy.mockResolvedValue(existing);
    const result = await service.update(actor, {
      enabled: false,
      chatMessages: true,
      showMessagePreview: false,
    });
    expect(create).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledWith(existing);
    expect(result).toEqual({ enabled: false, chatMessages: true, showMessagePreview: false });
  });
});
