import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import { AuditLog } from '../audit/audit-log.entity';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  deleteImage,
  detectImageMime as detectImage,
  readImage,
  resolveImageUpload,
  storeImage,
} from '../common/image-upload';
import { PermissionService } from '../rbac/permission.service';
import { Group } from '../training/group.entity';
import { User } from '../users/user.entity';
import { UserStatus } from '../users/user-status.enum';
import { ChatGroup } from './chat-group.entity';
import { ChatParticipant } from './chat-participant.entity';
import { Chat, ChatType } from './chat.entity';
import { CreateDirectChatDto } from './dto/create-direct-chat.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { ListMessagesDto } from './dto/list-messages.dto';
import { ManageChatDto } from './dto/manage-chat.dto';
import { Message } from './message.entity';

export interface ChatSummary {
  id: string;
  type: ChatType;
  title: string;
  description: string | null;
  icon: string;
  avatarUrl: string | null;
  unreadCount: number;
  lastMessage: MessageSummary | null;
}

export interface MessageSummary {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: Date;
  imageUrl: string | null;
  audioUrl: string | null;
  audioDurationMs: number | null;
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
    private readonly config: ConfigService,
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
      .andWhere('chat.archived = false AND chat.active = true')
      .andWhere(
        '(chat.type = :groupType OR (chat.type = :directType AND participant."userId" IS NOT NULL))',
        { groupType: ChatType.Group, directType: ChatType.Direct },
      )
      .orderBy('chat.title', 'ASC')
      .getMany();
    const visible: Chat[] = [];
    for (const chat of chats) {
      if (
        chat.type === ChatType.Direct ||
        (await this.canAccessGroupChat(actor, chat, permissionSet))
      ) {
        visible.push(chat);
      }
    }
    const summaries = await Promise.all(visible.map((chat) => this.toSummary(actor, chat)));
    return summaries.sort(
      (a, b) =>
        (b.lastMessage?.createdAt.getTime() ?? 0) -
          (a.lastMessage?.createdAt.getTime() ?? 0) || a.title.localeCompare(b.title),
    );
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
      items: selected.map(toMessageSummary),
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

  async sendImage(
    actor: AuthenticatedUser,
    chatId: string,
    file: Express.Multer.File,
    rawText: string | undefined,
    rawReplyToId: string | undefined,
  ): Promise<MessageSummary> {
    const chat = await this.assertAccess(actor, chatId);
    if (!file?.buffer?.length) throw new BadRequestException('Bilddatei fehlt.');
    if (file.buffer.length > 10 * 1024 * 1024)
      throw new BadRequestException('Das Bild ist zu groß. Maximal erlaubt sind 10 MB.');
    const originalExtension = file.originalname.split('.').pop()?.toLowerCase();
    if (!originalExtension || !['jpg', 'jpeg', 'png', 'webp'].includes(originalExtension))
      throw new BadRequestException('Erlaubt sind nur JPG-, PNG- und WEBP-Bilder.');
    const mime = detectImage(file.buffer);
    if (!mime) throw new BadRequestException('Ungültige Bilddatei.');
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    const extension = extensions[mime];
    const extensionMatchesMime =
      (mime === 'image/jpeg' && ['jpg', 'jpeg'].includes(originalExtension)) ||
      originalExtension === extension;
    if (!extensionMatchesMime)
      throw new BadRequestException('Dateiendung und Bildinhalt stimmen nicht überein.');
    const text = (rawText ?? '').trim();
    if (text.length > 4000) throw new BadRequestException('Die Nachricht ist zu lang.');
    let replyToId: string | null = null;
    let replyToText: string | null = null;
    if (rawReplyToId) {
      const replied = await this.messages.findOneBy({ id: rawReplyToId, chatId });
      if (replied) {
        replyToId = replied.id;
        replyToText = replied.text.slice(0, 200) || '📷 Bild';
      }
    }
    const stored = `${randomUUID()}.${extension}`;
    const root = this.config.get<string>('CHAT_IMAGE_STORAGE_PATH') ?? '/app/data/chat-images';
    await mkdir(root, { recursive: true });
    await writeFile(join(root, stored), file.buffer);
    let message: Message;
    try {
      message = await this.messages.save({
        chatId: chat.id,
        senderId: actor.id,
        text,
        replyToId,
        replyToText,
        imageStoredName: stored,
        imageMimeType: mime,
        imageOriginalName: file.originalname.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 255),
      });
    } catch (error) {
      await unlink(join(root, stored)).catch(() => undefined);
      throw error;
    }
    await this.touchParticipant(this.dataSource.manager, chat.id, actor.id, message.createdAt);
    message.sender = await this.dataSource
      .getRepository(User)
      .findOneByOrFail({ id: actor.id });
    return toMessageSummary(message);
  }

  async image(
    actor: AuthenticatedUser,
    chatId: string,
    messageId: string,
  ): Promise<{ mime: string; buffer: Buffer }> {
    await this.assertAccess(actor, chatId);
    const message = await this.messages.findOneBy({ id: messageId, chatId });
    if (!message?.imageStoredName || !message.imageMimeType)
      throw new NotFoundException('Bild wurde nicht gefunden.');
    const root = this.config.get<string>('CHAT_IMAGE_STORAGE_PATH') ?? '/app/data/chat-images';
    return {
      mime: message.imageMimeType,
      buffer: await readFile(join(root, message.imageStoredName)),
    };
  }

  async sendVoice(
    actor: AuthenticatedUser,
    chatId: string,
    file: Express.Multer.File,
    rawDurationMs: string | undefined,
    rawReplyToId: string | undefined,
  ): Promise<MessageSummary> {
    const chat = await this.assertAccess(actor, chatId);
    if (!file?.buffer?.length) throw new BadRequestException('Audiodatei fehlt.');
    if (file.buffer.length > 25 * 1024 * 1024)
      throw new BadRequestException('Die Sprachnachricht ist zu groß. Maximal erlaubt sind 25 MB.');
    const mime = detectAudio(file.buffer);
    if (!mime) throw new BadRequestException('Ungültige oder nicht unterstützte Audiodatei.');
    const extensions: Record<string, string> = {
      'audio/webm': 'webm',
      'audio/ogg': 'ogg',
      'audio/mp4': 'm4a',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
    };
    const extension = extensions[mime];
    let durationMs: number | null = null;
    if (rawDurationMs != null && rawDurationMs !== '') {
      const parsed = Number.parseInt(rawDurationMs, 10);
      if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 30 * 60 * 1000) {
        durationMs = parsed;
      }
    }
    let replyToId: string | null = null;
    let replyToText: string | null = null;
    if (rawReplyToId) {
      const replied = await this.messages.findOneBy({ id: rawReplyToId, chatId });
      if (replied) {
        replyToId = replied.id;
        replyToText = replied.text.slice(0, 200) || '🎤 Sprachnachricht';
      }
    }
    const stored = `${randomUUID()}.${extension}`;
    const root =
      this.config.get<string>('CHAT_AUDIO_STORAGE_PATH') ?? '/app/data/chat-images/voice';
    await mkdir(root, { recursive: true });
    await writeFile(join(root, stored), file.buffer);
    let message: Message;
    try {
      message = await this.messages.save({
        chatId: chat.id,
        senderId: actor.id,
        text: '',
        replyToId,
        replyToText,
        audioStoredName: stored,
        audioMimeType: mime,
        audioDurationMs: durationMs,
      });
    } catch (error) {
      await unlink(join(root, stored)).catch(() => undefined);
      throw error;
    }
    await this.touchParticipant(this.dataSource.manager, chat.id, actor.id, message.createdAt);
    message.sender = await this.dataSource
      .getRepository(User)
      .findOneByOrFail({ id: actor.id });
    return toMessageSummary(message);
  }

  async voice(
    actor: AuthenticatedUser,
    chatId: string,
    messageId: string,
  ): Promise<{ mime: string; buffer: Buffer }> {
    await this.assertAccess(actor, chatId);
    const message = await this.messages.findOneBy({ id: messageId, chatId });
    if (!message?.audioStoredName || !message.audioMimeType)
      throw new NotFoundException('Sprachnachricht wurde nicht gefunden.');
    const root =
      this.config.get<string>('CHAT_AUDIO_STORAGE_PATH') ?? '/app/data/chat-images/voice';
    return {
      mime: message.audioMimeType,
      buffer: await readFile(join(root, message.audioStoredName)),
    };
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
    if (message.senderId !== actor.id)
      throw new ForbiddenException('Nur eigene Nachrichten dürfen bearbeitet werden.');
    const text = dto.text.trim();
    if (!text) throw new BadRequestException('Die Nachricht darf nicht leer sein.');
    message.text = text;
    message.editedAt = new Date();
    const saved = await this.messages.save(message);
    saved.sender = message.sender;
    return toMessageSummary(saved);
  }

  async markRead(
    actor: AuthenticatedUser,
    chatId: string,
    messageId?: string,
  ): Promise<{ readAt: Date }> {
    const chat = await this.assertAccess(actor, chatId);
    const visibleMessage = messageId
      ? await this.messages.findOneBy({ id: messageId, chatId: chat.id })
      : null;
    if (messageId && !visibleMessage) throw new NotFoundException('Nachricht wurde nicht gefunden.');
    const readAt = visibleMessage?.createdAt ?? new Date();
    await this.touchParticipant(this.dataSource.manager, chat.id, actor.id, readAt);
    return { readAt };
  }

  async deleteMessage(
    actor: AuthenticatedUser,
    chatId: string,
    messageId: string,
  ): Promise<void> {
    await this.assertAccess(actor, chatId);
    const message = await this.messages.findOneBy({ id: messageId, chatId });
    if (!message) throw new NotFoundException('Nachricht wurde nicht gefunden.');
    const superuser = await this.permissions.hasRole(actor.id, actor.organizationId, 'Superuser');
    if (message.senderId !== actor.id && !superuser) {
      throw new ForbiddenException('Du darfst nur eigene Nachrichten löschen.');
    }
    const storedName = message.imageStoredName;
    const storedAudioName = message.audioStoredName;
    await this.dataSource.transaction(async (manager) => {
      message.deletedBy = actor.id;
      message.text = '';
      message.imageStoredName = null;
      message.imageMimeType = null;
      message.imageOriginalName = null;
      message.audioStoredName = null;
      message.audioMimeType = null;
      message.audioDurationMs = null;
      await manager.getRepository(Message).softRemove(message);
      await manager.getRepository(AuditLog).save({
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        action:
          superuser && message.senderId !== actor.id
            ? 'chat.message.admin_deleted'
            : 'chat.message.deleted',
        entityType: 'chat_message',
        entityId: message.id,
        outcome: 'success',
        metadata: {
          chatId,
          senderId: message.senderId,
          administrative: message.senderId !== actor.id,
        },
      });
    });
    if (storedName) {
      const root =
        this.config.get<string>('CHAT_IMAGE_STORAGE_PATH') ?? '/app/data/chat-images';
      await unlink(join(root, storedName)).catch(() => undefined);
    }
    if (storedAudioName) {
      const audioRoot =
        this.config.get<string>('CHAT_AUDIO_STORAGE_PATH') ??
        '/app/data/chat-images/voice';
      await unlink(join(audioRoot, storedAudioName)).catch(() => undefined);
    }
  }

  async deleteChat(actor: AuthenticatedUser, chatId: string): Promise<void> {
    const chat = await this.assertAccess(actor, chatId);
    const superuser = await this.permissions.hasRole(
      actor.id,
      actor.organizationId,
      'Superuser',
    );
    if (!superuser) {
      throw new ForbiddenException('Nur Superuser dürfen Chats löschen.');
    }
    if (chat.type === ChatType.Group) {
      throw new ForbiddenException(
        'Gruppenchats werden über die Chatverwaltung gelöscht.',
      );
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Chat).softRemove(chat);
      await manager.getRepository(AuditLog).save({
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        action: 'chat.deleted',
        entityType: 'chat',
        entityId: chat.id,
        outcome: 'success',
        metadata: { type: chat.type, administrative: true },
      });
    });
  }

  async unread(actor: AuthenticatedUser): Promise<{ total: number; chats: { chatId: string; count: number }[] }> {
    const summaries = await this.list(actor);
    const chats = summaries
      .filter((chat) => chat.unreadCount > 0)
      .map((chat) => ({ chatId: chat.id, count: chat.unreadCount }));
    return { total: chats.reduce((sum, chat) => sum + chat.count, 0), chats };
  }

  async listAdmin(actor: AuthenticatedUser): Promise<(ChatSummary & { archived: boolean; active: boolean; groupIds: string[] })[]> {
    const chats = await this.chats.find({
      where: { organizationId: actor.organizationId, type: ChatType.Group },
      order: { title: 'ASC' },
    });
    return Promise.all(
      chats.map(async (chat) => ({
        ...(await this.toSummary(actor, chat)),
        archived: chat.archived,
        active: chat.active,
        groupIds: (
          await this.dataSource.getRepository(ChatGroup).findBy({ chatId: chat.id })
        ).map((entry) => entry.groupId),
      })),
    );
  }

  listAdminGroups(actor: AuthenticatedUser) {
    return this.dataSource.getRepository(Group).find({
      where: { organizationId: actor.organizationId, active: true },
      order: { name: 'ASC' },
    });
  }

  createManaged(actor: AuthenticatedUser, dto: ManageChatDto) {
    return this.saveManaged(actor, null, dto);
  }

  updateManaged(actor: AuthenticatedUser, id: string, dto: ManageChatDto) {
    return this.saveManaged(actor, id, dto);
  }

  async deleteManaged(actor: AuthenticatedUser, id: string): Promise<void> {
    const chat = await this.chats.findOneBy({
      id,
      organizationId: actor.organizationId,
      type: ChatType.Group,
    });
    if (!chat) throw new NotFoundException('Chat wurde nicht gefunden.');
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Chat).softRemove(chat);
      await manager.getRepository(AuditLog).save({
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        action: 'chat.deleted',
        entityType: 'chat',
        entityId: id,
        outcome: 'success',
        metadata: { title: chat.title },
      });
    });
  }

  async uploadChatAvatar(actor: AuthenticatedUser, id: string, file: Express.Multer.File) {
    const chat = await this.chats.findOneBy({
      id,
      organizationId: actor.organizationId,
      type: ChatType.Group,
    });
    if (!chat) throw new NotFoundException('Chat wurde nicht gefunden.');
    const { mime, extension } = resolveImageUpload(file, 5 * 1024 * 1024);
    const root = this.avatarRoot();
    const stored = await storeImage(root, file.buffer, extension);
    const previous = chat.avatarStoredName;
    chat.avatarStoredName = stored;
    chat.avatarMimeType = mime;
    await this.chats.save(chat);
    await deleteImage(root, previous);
    return { id: chat.id };
  }

  async deleteChatAvatar(actor: AuthenticatedUser, id: string): Promise<void> {
    const chat = await this.chats.findOneBy({
      id,
      organizationId: actor.organizationId,
      type: ChatType.Group,
    });
    if (!chat) throw new NotFoundException('Chat wurde nicht gefunden.');
    const previous = chat.avatarStoredName;
    chat.avatarStoredName = null;
    chat.avatarMimeType = null;
    await this.chats.save(chat);
    await deleteImage(this.avatarRoot(), previous);
  }

  async chatAvatar(actor: AuthenticatedUser, id: string): Promise<{ mime: string; buffer: Buffer }> {
    const chat = await this.assertAccess(actor, id);
    if (!chat.avatarStoredName || !chat.avatarMimeType)
      throw new NotFoundException('Bild wurde nicht gefunden.');
    return {
      mime: chat.avatarMimeType,
      buffer: await readImage(this.avatarRoot(), chat.avatarStoredName),
    };
  }

  private avatarRoot(): string {
    return this.config.get<string>('AVATAR_STORAGE_PATH') ?? '/app/data/avatars';
  }

  private async saveManaged(actor: AuthenticatedUser, id: string | null, dto: ManageChatDto) {
    return this.dataSource.transaction(async (manager) => {
      const groupIds = [...new Set(dto.groupIds)];
      const groups = groupIds.length
        ? await manager
            .getRepository(Group)
            .find({ where: { id: In(groupIds), organizationId: actor.organizationId } })
        : [];
      if (groups.length !== groupIds.length)
        throw new NotFoundException('Mindestens eine Gruppe wurde nicht gefunden.');
      let chat = id
        ? await manager
            .getRepository(Chat)
            .findOneBy({ id, organizationId: actor.organizationId, type: ChatType.Group })
        : null;
      if (id && !chat) throw new NotFoundException('Chat wurde nicht gefunden.');
      chat ??= manager.getRepository(Chat).create({
        organizationId: actor.organizationId,
        type: ChatType.Group,
        requiredPermission: null,
        systemKey: null,
        directKey: null,
        createdBy: actor.id,
      });
      Object.assign(chat, {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        icon: dto.icon,
        archived: dto.archived,
        active: dto.active,
      });
      chat = await manager.getRepository(Chat).save(chat);
      await manager.getRepository(ChatGroup).delete({ chatId: chat.id });
      if (groupIds.length) {
        await manager
          .getRepository(ChatGroup)
          .insert(groupIds.map((groupId) => ({ chatId: chat.id, groupId })));
      }
      await manager.getRepository(AuditLog).save({
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        action: id ? 'chat.updated' : 'chat.created',
        entityType: 'chat',
        entityId: chat.id,
        outcome: 'success',
        metadata: { title: chat.title, groupIds },
      });
      return {
        ...(await this.toSummary(actor, chat)),
        archived: chat.archived,
        active: chat.active,
        groupIds,
      };
    });
  }

  private async assertAccess(actor: AuthenticatedUser, chatId: string): Promise<Chat> {
    const chat = await this.chats.findOneBy({
      id: chatId,
      organizationId: actor.organizationId,
    });
    if (!chat) throw new NotFoundException('Chat wurde nicht gefunden.');
    if (!chat.active || chat.archived) throw new NotFoundException('Chat wurde nicht gefunden.');
    if (chat.type === ChatType.Group) {
      const allowed = await this.canAccessGroupChat(actor, chat);
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
    const otherUser =
      chat.type === ChatType.Direct ? await this.directParticipant(chat.id, actor.id) : null;
    return {
      id: chat.id,
      type: chat.type,
      title:
        chat.type === ChatType.Group
          ? (chat.title ?? 'Gruppe')
          : (otherUser ? displayName(otherUser) : 'Direktnachricht'),
      description: chat.description,
      icon: chat.icon ?? (chat.type === ChatType.Group ? 'group' : 'person'),
      avatarUrl:
        chat.type === ChatType.Group
          ? chat.avatarStoredName
            ? `/api/v1/chats/${chat.id}/avatar`
            : null
          : otherUser?.avatarStoredName
            ? `/api/v1/users/${otherUser.id}/avatar`
            : null,
      unreadCount: Number(unreadRows[0]?.count ?? 0),
      lastMessage: lastMessage ? toMessageSummary(lastMessage) : null,
    };
  }

  private async canAccessGroupChat(
    actor: AuthenticatedUser,
    chat: Chat,
    knownPermissions?: Set<string>,
  ): Promise<boolean> {
    if (chat.requiredPermission) {
      return knownPermissions
        ? knownPermissions.has(chat.requiredPermission)
        : this.permissions.hasAll(actor.id, actor.organizationId, [chat.requiredPermission]);
    }
    const rows: Array<{ allowed: boolean }> = await this.dataSource.query(
      `SELECT EXISTS(SELECT 1 FROM chat_groups cg JOIN user_groups ug ON ug."groupId"=cg."groupId"
       WHERE cg."chatId"=$1 AND ug."userId"=$2) AS allowed`,
      [chat.id, actor.id],
    );
    return rows[0]?.allowed === true;
  }

  private async directParticipant(chatId: string, actorId: string): Promise<User | null> {
    const participants = await this.participants.find({
      where: { chatId, leftAt: IsNull() },
      relations: { user: true },
    });
    return participants.find((entry) => entry.userId !== actorId)?.user ?? null;
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
    imageUrl: message.imageStoredName
      ? `/api/v1/chats/${message.chatId}/messages/${message.id}/image`
      : null,
    audioUrl: message.audioStoredName
      ? `/api/v1/chats/${message.chatId}/messages/${message.id}/voice`
      : null,
    audioDurationMs: message.audioDurationMs ?? null,
    editedAt: message.editedAt ?? null,
    replyToId: message.replyToId ?? null,
    replyToText: message.replyToText ?? null,
  };
}

export { detectImage };

export function detectAudio(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  // WebM / Matroska (EBML header)
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3)
    return 'audio/webm';
  // Ogg
  if (buffer.subarray(0, 4).toString('latin1') === 'OggS') return 'audio/ogg';
  // MP4 / M4A (ftyp box)
  if (buffer.subarray(4, 8).toString('latin1') === 'ftyp') return 'audio/mp4';
  // WAV (RIFF....WAVE)
  if (
    buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buffer.subarray(8, 12).toString('latin1') === 'WAVE'
  )
    return 'audio/wav';
  // MP3 (ID3 tag or MPEG frame sync)
  if (buffer.subarray(0, 3).toString('latin1') === 'ID3') return 'audio/mpeg';
  if (buffer.length >= 2 && buffer[0] === 0xff && ((buffer[1] ?? 0) & 0xe0) === 0xe0)
    return 'audio/mpeg';
  return null;
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
