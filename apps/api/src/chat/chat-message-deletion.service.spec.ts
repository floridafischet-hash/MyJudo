import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { AuditLog } from '../audit/audit-log.entity';
import { AuthenticatedUser } from '../auth/auth.types';
import { PermissionService } from '../rbac/permission.service';
import { ChatParticipant } from './chat-participant.entity';
import { Chat, ChatType } from './chat.entity';
import { ChatService } from './chat.service';
import { Message } from './message.entity';

describe('ChatService message deletion', () => {
  const actor: AuthenticatedUser = {
    id: '00000000-0000-4000-8000-000000000001',
    organizationId: '00000000-0000-4000-8000-000000000010',
    authorizationVersion: 0,
  };
  const messageRepository = { findOneBy: jest.fn(), softRemove: jest.fn() };
  const auditRepository = { save: jest.fn() };
  const chatRepository = { softRemove: jest.fn() };
  const manager = {
    getRepository: jest.fn((entity: unknown) =>
      entity === Message
        ? messageRepository
        : entity === AuditLog
          ? auditRepository
          : entity === Chat
            ? chatRepository
            : null,
    ),
  };
  const dataSource = {
    transaction: jest.fn((operation: (value: typeof manager) => Promise<unknown>) =>
      operation(manager),
    ),
  } as unknown as DataSource;
  const permissions = { hasRole: jest.fn() };
  const service = new ChatService(
    {} as Repository<Chat>,
    {} as Repository<ChatParticipant>,
    messageRepository as unknown as Repository<Message>,
    dataSource,
    permissions as unknown as PermissionService,
    { get: jest.fn() } as unknown as ConfigService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    (service as unknown as { assertAccess: jest.Mock }).assertAccess = jest
      .fn()
      .mockResolvedValue({ id: 'chat-1' });
  });

  it('lets a user soft-delete an own message and redacts its content', async () => {
    const message = {
      id: 'message-1',
      chatId: 'chat-1',
      senderId: actor.id,
      text: 'Privat',
      imageStoredName: null,
    };
    messageRepository.findOneBy.mockResolvedValue(message);
    permissions.hasRole.mockResolvedValue(false);
    await service.deleteMessage(actor, 'chat-1', 'message-1');
    expect(messageRepository.softRemove).toHaveBeenCalledWith(
      expect.objectContaining({ text: '', deletedBy: actor.id }),
    );
  });

  it('rejects deleting another users message for a normal user', async () => {
    messageRepository.findOneBy.mockResolvedValue({ id: 'message-2', senderId: 'other-user' });
    permissions.hasRole.mockResolvedValue(false);
    await expect(service.deleteMessage(actor, 'chat-1', 'message-2')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(messageRepository.softRemove).not.toHaveBeenCalled();
  });

  it('lets a superuser administratively delete another users message', async () => {
    messageRepository.findOneBy.mockResolvedValue({
      id: 'message-3',
      chatId: 'chat-1',
      senderId: 'other-user',
      text: 'Text',
      imageStoredName: null,
    });
    permissions.hasRole.mockResolvedValue(true);
    await service.deleteMessage(actor, 'chat-1', 'message-3');
    expect(messageRepository.softRemove).toHaveBeenCalled();
    expect(auditRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'chat.message.admin_deleted' }),
    );
  });

  it('lets a superuser delete a direct chat', async () => {
    (service as unknown as { assertAccess: jest.Mock }).assertAccess = jest
      .fn()
      .mockResolvedValue({ id: 'chat-1', type: ChatType.Direct });
    permissions.hasRole.mockResolvedValue(true);
    await service.deleteChat(actor, 'chat-1');
    expect(chatRepository.softRemove).toHaveBeenCalled();
    expect(auditRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'chat.deleted' }),
    );
  });

  it('rejects chat deletion for a normal user', async () => {
    (service as unknown as { assertAccess: jest.Mock }).assertAccess = jest
      .fn()
      .mockResolvedValue({ id: 'chat-1', type: ChatType.Direct });
    permissions.hasRole.mockResolvedValue(false);
    await expect(service.deleteChat(actor, 'chat-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(chatRepository.softRemove).not.toHaveBeenCalled();
  });

  it('routes group chats to the admin area instead of deleting', async () => {
    (service as unknown as { assertAccess: jest.Mock }).assertAccess = jest
      .fn()
      .mockResolvedValue({ id: 'chat-1', type: ChatType.Group });
    permissions.hasRole.mockResolvedValue(true);
    await expect(service.deleteChat(actor, 'chat-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(chatRepository.softRemove).not.toHaveBeenCalled();
  });
});
