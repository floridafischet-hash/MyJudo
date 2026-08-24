import { DataSource, Repository } from 'typeorm';
import { AuthenticatedUser } from '../auth/auth.types';
import { PermissionService } from '../rbac/permission.service';
import { Group } from '../training/group.entity';
import { ChatGroup } from './chat-group.entity';
import { ChatParticipant } from './chat-participant.entity';
import { Chat, ChatType } from './chat.entity';
import { ChatService } from './chat.service';
import { Message } from './message.entity';
import { AuditLog } from '../audit/audit-log.entity';

describe('ChatService admin configuration', () => {
  const actor: AuthenticatedUser = {
    id: '00000000-0000-4000-8000-000000000001',
    organizationId: '00000000-0000-4000-8000-000000000010',
    authorizationVersion: 0,
  };
  const groupId = '00000000-0000-4000-8000-000000000020';
  const chatId = '00000000-0000-4000-8000-000000000030';
  const chatRepository = {
    findOneBy: jest.fn(),
    create: jest.fn((value: object) => ({ id: chatId, ...value })),
    save: jest.fn((value: object) => Promise.resolve(value)),
  };
  const groupRepository = { find: jest.fn() };
  const chatGroupRepository = { delete: jest.fn(), insert: jest.fn() };
  const auditRepository = { save: jest.fn() };
  const manager = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === Chat) return chatRepository;
      if (entity === Group) return groupRepository;
      if (entity === ChatGroup) return chatGroupRepository;
      if (entity === AuditLog) return auditRepository;
      throw new Error('unexpected repository');
    }),
  };
  const dataSource = {
    transaction: jest.fn((operation: (value: typeof manager) => Promise<unknown>) =>
      operation(manager),
    ),
  } as unknown as DataSource;
  const service = new ChatService(
    {} as Repository<Chat>,
    {} as Repository<ChatParticipant>,
    {} as Repository<Message>,
    dataSource,
    {} as PermissionService,
    { get: jest.fn() } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    groupRepository.find.mockResolvedValue([{ id: groupId, organizationId: actor.organizationId }]);
    (service as unknown as { toSummary: jest.Mock }).toSummary = jest.fn().mockResolvedValue({
      id: chatId,
      type: ChatType.Group,
      title: 'Vereinschat',
      description: null,
      icon: 'group',
      unreadCount: 0,
      lastMessage: null,
    });
  });

  it('creates a group-scoped chat without touching messages', async () => {
    chatRepository.findOneBy.mockResolvedValue(null);
    await service.createManaged(actor, {
      title: 'Vereinschat',
      description: 'Informationen',
      icon: 'campaign',
      groupIds: [groupId],
      archived: false,
      active: true,
    });
    expect(chatRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: actor.organizationId,
        createdBy: actor.id,
        type: ChatType.Group,
      }),
    );
    expect(chatGroupRepository.insert).toHaveBeenCalledWith([{ chatId, groupId }]);
    expect(manager.getRepository).not.toHaveBeenCalledWith(Message);
  });

  it('renames a chat and changes its icon while retaining its id', async () => {
    const existing = { id: chatId, organizationId: actor.organizationId, type: ChatType.Group };
    chatRepository.findOneBy.mockResolvedValue(existing);
    await service.updateManaged(actor, chatId, {
      title: 'Neuer Name',
      description: 'Bleibt derselbe Chat',
      icon: 'shield',
      groupIds: [groupId],
      archived: false,
      active: true,
    });
    expect(chatRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: chatId,
        title: 'Neuer Name',
        icon: 'shield',
      }),
    );
    expect(manager.getRepository).not.toHaveBeenCalledWith(Message);
  });
});
