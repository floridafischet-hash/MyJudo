import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditLog } from '../audit/audit-log.entity';
import { AuthenticatedUser } from '../auth/auth.types';
import { PERMISSIONS } from '../rbac/permission.catalog';
import { PermissionService } from '../rbac/permission.service';
import { CastVoteDto } from './dto/cast-vote.dto';
import { CreatePollDto } from './dto/create-poll.dto';
import { PollOption } from './poll-option.entity';
import { PollVote } from './poll-vote.entity';
import { Poll, PollType } from './poll.entity';

export interface PollOptionSummary {
  id: string;
  label: string;
  position: number;
  voteCount: number | null;
}

export interface PollSummary {
  id: string;
  type: PollType;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  state: 'scheduled' | 'open' | 'closed';
  requiredPermission: string | null;
  resultsVisibleToParticipants: boolean;
  canViewResults: boolean;
  totalVotes: number | null;
  selectedOptionId: string | null;
  options: PollOptionSummary[];
  createdBy: string;
}

@Injectable()
export class PollsService {
  constructor(
    @InjectRepository(Poll) private readonly polls: Repository<Poll>,
    @InjectRepository(PollVote) private readonly votes: Repository<PollVote>,
    private readonly dataSource: DataSource,
    private readonly permissions: PermissionService,
  ) {}

  async list(actor: AuthenticatedUser): Promise<PollSummary[]> {
    const permissionSet = await this.permissionSet(actor);
    const polls = await this.polls.find({
      where: { organizationId: actor.organizationId },
      relations: { options: true },
      order: { endsAt: 'ASC' },
    });
    return Promise.all(
      polls
        .filter((poll) => !poll.requiredPermission || permissionSet.has(poll.requiredPermission))
        .map((poll) => this.toSummary(actor, poll, permissionSet)),
    );
  }

  async find(actor: AuthenticatedUser, id: string): Promise<PollSummary> {
    const permissionSet = await this.permissionSet(actor);
    const poll = await this.findAccessible(actor, id, permissionSet);
    return this.toSummary(actor, poll, permissionSet);
  }

  async create(actor: AuthenticatedUser, dto: CreatePollDto): Promise<PollSummary> {
    const permissionSet = await this.permissionSet(actor);
    const title = dto.title.trim();
    if (!title) throw new BadRequestException('Der Titel darf nicht leer sein.');
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) {
      throw new BadRequestException('Das Ende muss nach dem Beginn liegen.');
    }
    if (dto.requiredPermission) {
      if (!(PERMISSIONS as readonly string[]).includes(dto.requiredPermission)) {
        throw new BadRequestException('Die Zielgruppen-Berechtigung ist ungültig.');
      }
      if (!permissionSet.has(dto.requiredPermission)) {
        throw new ForbiddenException('Du darfst diese Zielgruppe nicht auswählen.');
      }
    }
    const labels = this.optionLabels(dto);
    const poll = await this.dataSource.transaction(async (manager) => {
      const created = await manager.getRepository(Poll).save({
        organizationId: actor.organizationId,
        type: dto.type,
        title,
        description: dto.description?.trim() || null,
        startsAt,
        endsAt,
        requiredPermission: dto.requiredPermission ?? null,
        resultsVisibleToParticipants: dto.resultsVisibleToParticipants,
        createdBy: actor.id,
      });
      created.options = await manager
        .getRepository(PollOption)
        .save(labels.map((label, position) => ({ pollId: created.id, label, position })));
      await manager.getRepository(AuditLog).save({
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        action: 'poll.created',
        entityType: 'poll',
        entityId: created.id,
        outcome: 'success',
        metadata: { type: created.type, requiredPermission: created.requiredPermission },
      });
      return created;
    });
    return this.toSummary(actor, poll, permissionSet);
  }

  async vote(actor: AuthenticatedUser, pollId: string, dto: CastVoteDto): Promise<PollSummary> {
    const permissionSet = await this.permissionSet(actor);
    const poll = await this.findAccessible(actor, pollId, permissionSet);
    const now = new Date();
    if (now < poll.startsAt || now >= poll.endsAt) {
      throw new BadRequestException('Die Umfrage ist nicht geöffnet.');
    }
    if (!poll.options.some((option) => option.id === dto.optionId)) {
      throw new BadRequestException('Die Auswahl gehört nicht zu dieser Umfrage.');
    }
    await this.votes.upsert(
      { pollId: poll.id, userId: actor.id, optionId: dto.optionId },
      { conflictPaths: ['pollId', 'userId'] },
    );
    return this.toSummary(actor, poll, permissionSet);
  }

  private optionLabels(dto: CreatePollDto): string[] {
    if (dto.type === PollType.Attendance) {
      if (dto.options?.length) {
        throw new BadRequestException('Teilnahme-Umfragen verwenden feste Antworten.');
      }
      return ['Ja', 'Nein', 'Vielleicht'];
    }
    const labels = (dto.options ?? []).map((option) => option.trim());
    if (labels.length < 2 || labels.some((label) => !label)) {
      throw new BadRequestException('Eine Abstimmung benötigt mindestens zwei Optionen.');
    }
    if (new Set(labels.map((label) => label.toLocaleLowerCase('de-DE'))).size !== labels.length) {
      throw new BadRequestException('Optionen dürfen nicht doppelt vorkommen.');
    }
    return labels;
  }

  private async findAccessible(
    actor: AuthenticatedUser,
    id: string,
    permissionSet: Set<string>,
  ): Promise<Poll> {
    const poll = await this.polls.findOne({
      where: { id, organizationId: actor.organizationId },
      relations: { options: true },
    });
    if (!poll || (poll.requiredPermission && !permissionSet.has(poll.requiredPermission))) {
      throw new NotFoundException('Umfrage wurde nicht gefunden.');
    }
    return poll;
  }

  private async toSummary(
    actor: AuthenticatedUser,
    poll: Poll,
    permissionSet: Set<string>,
  ): Promise<PollSummary> {
    const canViewResults =
      poll.createdBy === actor.id ||
      poll.resultsVisibleToParticipants ||
      permissionSet.has('polls.results.view');
    const ownVote = await this.votes.findOneBy({ pollId: poll.id, userId: actor.id });
    const counts = new Map<string, number>();
    if (canViewResults) {
      const rows = await this.votes
        .createQueryBuilder('vote')
        .select('vote."optionId"', 'optionId')
        .addSelect('COUNT(*)', 'count')
        .where('vote."pollId" = :pollId', { pollId: poll.id })
        .groupBy('vote."optionId"')
        .getRawMany<{ optionId: string; count: string }>();
      rows.forEach((row) => counts.set(row.optionId, Number.parseInt(row.count, 10)));
    }
    const now = new Date();
    const state = now < poll.startsAt ? 'scheduled' : now >= poll.endsAt ? 'closed' : 'open';
    const options = [...poll.options]
      .sort((left, right) => left.position - right.position)
      .map((option) => ({
        id: option.id,
        label: option.label,
        position: option.position,
        voteCount: canViewResults ? (counts.get(option.id) ?? 0) : null,
      }));
    return {
      id: poll.id,
      type: poll.type,
      title: poll.title,
      description: poll.description,
      startsAt: poll.startsAt,
      endsAt: poll.endsAt,
      state,
      requiredPermission: poll.requiredPermission,
      resultsVisibleToParticipants: poll.resultsVisibleToParticipants,
      canViewResults,
      totalVotes: canViewResults
        ? options.reduce((total, option) => total + (option.voteCount ?? 0), 0)
        : null,
      selectedOptionId: ownVote?.optionId ?? null,
      options,
      createdBy: poll.createdBy,
    };
  }

  private async permissionSet(actor: AuthenticatedUser): Promise<Set<string>> {
    return new Set(await this.permissions.listForUser(actor.id, actor.organizationId));
  }
}
