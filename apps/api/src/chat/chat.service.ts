import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { AuthenticatedUser } from '../auth/auth.types';
import { PermissionService } from '../rbac/permission.service';
import { User } from '../users/user.entity';
import { UserStatus } from '../users/user-status.enum';
import { ChatParticipant } from './chat-participant.entity';
import { Chat, ChatType } from './chat.entity';
import { CreateDirectChatDto } from './dto/create-direct-chat.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { ListMessagesDto } from './dto/list-messages.dto';
import { Message } from './message.entity';

export interface ChatSummary {
  id: string;
  type: ChatType;
  title: string;
  unreadCount: number;
  lastMessage: MessageSummary | null;
}

export interface MessageSummary {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: Date;
  editedAt: Date | null;
  replyToId: string | null;
  replyToText: string | null;
}

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Chat) private readonly chats: Repository<Chat>,
    @InjectRepository(ChatParticipant)
    private readonly participants: Repository<ChatParticipant>,
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    private readonly dataSource: DataSource,
    private readonly permissions: PermissionService,
  ) {}

  async list(actor: AuthenticatedUser): Promise<ChatSummary[]> {
    const permissionSet = new Set(
      await this.permissions.listForUser(actor.id, actor.organizationId),
    );
    const chats = await this.chats
      .createQueryBuilder('chat')
      .leftJoin(
        ChatParticipant,
        'participant',
        'participant."chatId" = chat.id AND participant."userId" = :userId AND participant."leftAt" IS NULL',
        { userId: actor.id },
      )
      .where('chat."organizationId" = :organizationId', {
        organizationId: actor.organizationId,
      })
      .andWhere('chat."deletedAt" IS NULL')
      .andWhere(
        '(chat.type = :groupType OR (chat.type = :directType AND participant."userId" IS NOT NULL))',
        { groupType: ChatType.Group, directType: ChatType.Direct },
      )
      .orderBy('chat.title', 'ASC')
      .getMany();
    const visible = chats.filter(
      (chat) =>
        chat.type === ChatType.Direct ||
        (chat.requiredPermission !== null && permissionSet.has(chat.requiredPermission)),
    );
    return Promise.all(visible.map((chat) => this.toSummary(actor, chat)));
  }

  async createDirect(actor: AuthenticatedUser, dto: CreateDirectChatDto): Promise<ChatSummary> {
    if (dto.participantUserId === actor.id) {
      throw new BadRequestException('Ein Direktchat mit dir selbst ist nicht möglich.');
    }
    const other = await this.dataSource.getRepository(User).findOneBy({
      id: dto.participantUserId,
      organizationId: actor.organizationId,
      status: UserStatus.Approved,
    });
    if (!other) throw new NotFoundException('Benutzer wurde nicht gefunden.');
    const directKey = [actor.id, other.id].sort().join(':');
    let chat = await this.chats.findOneBy({
      organizationId: actor.organizationId,
      directKey,
    });
    if (!chat) {
      try {
        chat = await this.dataSource.transaction(async (manager) => {
          const created = await manager.getRepository(Chat).save({
            organizationId: actor.organizationId,
            type: ChatType.Direct,
            title: null,
            requiredPermission: null,
            systemKey: null,
            directKey,
            createdBy: actor.id,
          });
          await manager.getRepository(ChatParticipant).insert([
            { chatId: created.id, userId: actor.id, lastReadAt: new Date(), leftAt: null },
            { chatId: created.id, userId: other.id, lastReadAt: null, leftAt: null },
          ]);
          return created;
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        chat = await this.chats.findOneByOrFail({
          organizationId: actor.organizationId,
          directKey,
        });
      }
    }
    return this.toSummary(actor, chat);
  }

  async listMessages(
    actor: AuthenticatedUser,
    chatId: string,
    query: ListMessagesDto,
  ): Promise<{ items: MessageSummary[]; nextBefore: string | null }> {
    await this.assertAccess(actor, chatId);
    const builder = this.messages
      .createQueryBuilder('message')
      .innerJoinAndSelect('message.sender', 'sender')
      .where('message."chatId" = :chatId', { chatId })
      .andWhere('message."deletedAt" IS NULL');
    if (query.before) {
      const cursor = await this.messages.findOneBy({ id: query.before, chatId });
      if (!cursor) throw new BadRequestException('Ungültiger Nachrichten-Cursor.');
      builder.andWhere(
        '(message."createdAt" < :createdAt OR (message."createdAt" = :createdAt AND message.id < :id))',
        { createdAt: cursor.createdAt, id: cursor.id },
      );
    }
    const rows = await builder
      .orderBy('message.createdAt', 'DESC')
      .addOrderBy('message.id', 'DESC')
      .take(query.limit + 1)
      .getMany();
    const hasMore = rows.length > query.limit;
    const selected = rows.slice(0, query.limit);
    const nextBefore = hasMore ? (selected.at(-1)?.id ?? null) : null;
    return {
      items: selected.reverse().map(toMessageSummary),
      nextBefore,
    };
  }

  async send(
    actor: AuthenticatedUser,
    chatId: string,
    dto: CreateMessageDto,
  ): Promise<MessageSummary> {
    const chat = await this.assertAccess(actor, chatId);
    const text = dto.text.trim();
    if (!text) throw new BadRequestException('Die Nachricht darf nicht leer sein.');
    let replyToId: string | null = null;
    let replyToText: string | null = null;
    if (dto.replyToId) {
      const replied = await this.messages.findOne({
        where: { id: dto.replyToId, chatId },
        relations: { sender: true },
      });
      if (replied) {
        replyToId = replied.id;
        replyToText = replied.text.slice(0, 200);
      }
    }
    const message = await this.messages.save({
      chatId: chat.id,
      senderId: actor.id,
      text,
      replyToId,
      replyToText,
    });
    await this.touchParticipant(this.dataSource.manager, chat.id, actor.id, message.createdAt);
    const sender = await this.dataSource.getRepository(User).findOneByOrFail({ id: actor.id });
    message.sender = sender;
    return toMessageSummary(message);
  }

  async editMessage(
    actor: AuthenticatedUser,
    chatId: string,
    messageId: string,
    dto: EditMessageDto,
  ): Promise<MessageSummary> {
    await this.assertAccess(actor, chatId);
    const message = await this.messages.findOne({
      where: { id: messageId, chatId },
      relations: { sender: true },
    });
    if (!message) throw new NotFoundException('Nachricht wurde nicht gefunden.');
    if (message.senderId !== actor.id) throw new ForbiddenException('Nur eigene Nachrichten dürfen bearbeitet werden.');
    const text = dto.text.trim();
    if (!text) throw new BadRequestException('Die Nachricht darf nicht leer sein.');
    message.text = text;
    message.editedAt = new Date();
    const saved = await this.messages.save(message);
    saved.sender = message.sender;
    return toMessageSummary(saved);
  }

  async markRead(actor: AuthenticatedUser, chatId: string): Promise<{ readAt: Date }> {
    const chat = await this.assertAccess(actor, chatId);
    const readAt = new Date();
    await this.touchParticipant(this.dataSource.manager, chat.id, actor.id, readAt);
    return { readAt };
  }

  private async assertAccess(actor: AuthenticatedUser, chatId: string): Promise<Chat> {
    const chat = await this.chats.findOneBy({
      id: chatId,
      organizationId: actor.organizationId,
    });
    if (!chat) throw new NotFoundException('Chat wurde nicht gefunden.');
    if (chat.type === ChatType.Group) {
      const allowed =
        chat.requiredPermission !== null &&
        (await this.permissions.hasAll(actor.id, actor.organizationId, [chat.requiredPermission]));
      if (!allowed) throw new NotFoundException('Chat wurde nicht gefunden.');
      return chat;
    }
    const participant = await this.participants.findOneBy({
      chatId: chat.id,
      userId: actor.id,
      leftAt: IsNull(),
    });
    if (!participant) throw new NotFoundException('Chat wurde nicht gefunden.');
    return chat;
  }

  private async toSummary(actor: AuthenticatedUser, chat: Chat): Promise<ChatSummary> {
    const participant = await this.participants.findOneBy({
      chatId: chat.id,
      userId: actor.id,
      leftAt: IsNull(),
    });
    const unreadRows: Array<{ count: string }> = await this.dataSource.query(
      `SELECT COUNT(*)::text AS count FROM messages
       WHERE "chatId" = $1 AND "senderId" <> $2 AND "deletedAt" IS NULL
         AND "createdAt" > COALESCE($3::timestamptz, '-infinity'::timestamptz)`,
      [chat.id, actor.id, participant?.lastReadAt ?? null],
    );
    const lastMessage = await this.messages.findOne({
      where: { chatId: chat.id },
      relations: { sender: true },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    return {
      id: chat.id,
      type: chat.type,
      title:
        chat.type === ChatType.Group
          ? (chat.title ?? 'Gruppe')
          : await this.directTitle(chat.id, actor.id),
      unreadCount: Number(unreadRows[0]?.count ?? 0),
      lastMessage: lastMessage ? toMessageSummary(lastMessage) : null,
    };
  }

  private async directTitle(chatId: string, actorId: string): Promise<string> {
    const participants = await this.participants.find({
      where: { chatId, leftAt: IsNull() },
      relations: { user: true },
    });
    const other = participants.find((entry) => entry.userId !== actorId)?.user;
    return other ? displayName(other) : 'Direktnachricht';
  }

  private async touchParticipant(
    manager: EntityManager,
    chatId: string,
    userId: string,
    lastReadAt: Date,
  ): Promise<void> {
    const repository = manager.getRepository(ChatParticipant);
    const result = await repository.update({ chatId, userId }, { lastReadAt, leftAt: null });
    if (result.affected === 0) {
      await repository.insert({ chatId, userId, lastReadAt, leftAt: null });
    }
  }
}

function toMessageSummary(message: Message): MessageSummary {
  return {
    id: message.id,
    senderId: message.senderId,
    senderName: displayName(message.sender),
    text: message.text,
    createdAt: message.createdAt,
    editedAt: message.editedAt ?? null,
    replyToId: message.replyToId ?? null,
    replyToText: message.replyToText ?? null,
  };
}

function displayName(user: User): string {
  const name = `${user.firstName} ${user.lastName}`.trim();
  return name || user.email;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}
