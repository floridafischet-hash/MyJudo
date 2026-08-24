import { ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { AuthenticatedUser } from '../auth/auth.types';
import { User } from '../users/user.entity';
import { ChecklistItem } from './checklist-item.entity';
import {
  CreateCardDto,
  CreateProjectDto,
  ChecklistItemDto,
  ReorderProjectsDto,
  UpdateCardDto,
  UpdateProjectDto,
} from './dto/project.dto';
import { ProjectActivity } from './project-activity.entity';
import { ProjectCard, ProjectCardType } from './project-card.entity';
import { ProjectAccess, ProjectMember } from './project-member.entity';
import { ProjectOrder } from './project-order.entity';
import { Project, ProjectStatus } from './project.entity';
import { PermissionService } from '../rbac/permission.service';
import { AuditLog } from '../audit/audit-log.entity';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly db: DataSource,
    @Optional() private readonly permissions?: PermissionService,
  ) {}
  // Completed projects are excluded from the default list (see the separate
  // completed-projects view in the client) unless explicitly requested via
  // `status`, so callers keep using the same endpoint and access scoping.
  async list(actor: AuthenticatedUser, status?: ProjectStatus) {
    const superuser = await this.isSuperuser(actor);
    const params: unknown[] = superuser ? [actor.organizationId] : [actor.organizationId, actor.id];
    let statusClause = `p.status <> 'completed'`;
    if (status) {
      params.push(status);
      statusClause = `p.status = $${params.length}`;
    }
    const memberNames =
      `(SELECT string_agg(mu."firstName"||' '||mu."lastName", ', ' ORDER BY mu."firstName") ` +
      `FROM project_members pm2 JOIN users mu ON mu.id=pm2."userId" WHERE pm2."projectId"=p.id) members`;
    const rows: Array<{ id: string }> = superuser
      ? await this.db.query(
          `SELECT p.*,'admin' access,(u."firstName"||' '||u."lastName") creator,${memberNames} FROM projects p JOIN users u ON u.id=p."createdBy" WHERE p."organizationId"=$1 AND p."deletedAt" IS NULL AND ${statusClause} ORDER BY p."updatedAt" DESC`,
          params,
        )
      : await this.db.query(
          `SELECT p.*,pm.access,(u."firstName"||' '||u."lastName") creator,${memberNames} FROM projects p JOIN project_members pm ON pm."projectId"=p.id AND pm."userId"=$2 JOIN users u ON u.id=p."createdBy" WHERE p."organizationId"=$1 AND p."deletedAt" IS NULL AND ${statusClause} ORDER BY p."updatedAt" DESC`,
          params,
        );
    // Personal drag-and-drop order only applies to the default (active)
    // view; the completed-projects archive keeps its own recency order.
    if (status) return rows;
    return this.applyPersonalOrder(actor, rows);
  }
  // Positioned projects come first (by the user's saved position); anything
  // without a saved position - new projects, or projects the user has never
  // reordered - keeps its original (most-recently-updated-first) relative
  // order and is appended after the positioned ones.
  private async applyPersonalOrder<T extends { id: string }>(
    actor: AuthenticatedUser,
    rows: T[],
  ): Promise<T[]> {
    const order = await this.db.getRepository(ProjectOrder).findBy({ userId: actor.id });
    if (!order.length) return rows;
    const position = new Map(order.map((entry) => [entry.projectId, entry.position]));
    return [...rows].sort((a, b) => {
      const pa = position.get(a.id);
      const pb = position.get(b.id);
      if (pa !== undefined && pb !== undefined) return pa - pb;
      if (pa !== undefined) return -1;
      if (pb !== undefined) return 1;
      return 0;
    });
  }
  // Reorders only the projects the caller can currently see in their active
  // list. Positions for completed or inaccessible projects are left
  // untouched, so completing/reopening a project can never corrupt another
  // project's position, and a stale/foreign id can never be injected.
  async reorder(actor: AuthenticatedUser, dto: ReorderProjectsDto): Promise<void> {
    const accessible = await this.accessibleActiveProjectIds(actor);
    const requested = dto.order.filter((id) => accessible.has(id));
    const missing = [...accessible].filter((id) => !requested.includes(id));
    const finalOrder = [...requested, ...missing];
    await this.db.transaction(async (m) => {
      await m
        .getRepository(ProjectOrder)
        .delete({ userId: actor.id, projectId: In([...accessible]) });
      if (finalOrder.length)
        await m
          .getRepository(ProjectOrder)
          .insert(
            finalOrder.map((projectId, position) => ({ userId: actor.id, projectId, position })),
          );
    });
  }
  async resetOrder(actor: AuthenticatedUser): Promise<void> {
    await this.db.getRepository(ProjectOrder).delete({ userId: actor.id });
  }
  private async accessibleActiveProjectIds(actor: AuthenticatedUser): Promise<Set<string>> {
    const superuser = await this.isSuperuser(actor);
    const rows: Array<{ id: string }> = superuser
      ? await this.db.query(
          `SELECT id FROM projects WHERE "organizationId"=$1 AND "deletedAt" IS NULL AND status <> 'completed'`,
          [actor.organizationId],
        )
      : await this.db.query(
          `SELECT p.id FROM projects p JOIN project_members pm ON pm."projectId"=p.id AND pm."userId"=$2 WHERE p."organizationId"=$1 AND p."deletedAt" IS NULL AND p.status <> 'completed'`,
          [actor.organizationId, actor.id],
        );
    return new Set(rows.map((row) => row.id));
  }
  async detail(actor: AuthenticatedUser, id: string) {
    const access = await this.access(actor, id, ProjectAccess.Read);
    const project = await this.db
      .getRepository(Project)
      .findOneBy({ id, organizationId: actor.organizationId });
    if (!project) throw new NotFoundException('Projekt wurde nicht gefunden.');
    const members = await this.db.query(
      `SELECT pm."userId",pm.access,(u."firstName"||' '||u."lastName") name FROM project_members pm JOIN users u ON u.id=pm."userId" WHERE pm."projectId"=$1 ORDER BY name`,
      [id],
    );
    const cards = await this.db.query(
      `SELECT c.*,COALESCE((SELECT jsonb_agg(jsonb_build_object('id',i.id,'text',i.text,'completed',i.completed,'completedBy',i."completedBy") ORDER BY i.position,i."createdAt") FROM checklist_items i WHERE i."cardId"=c.id AND i."deletedAt" IS NULL),'[]') items FROM project_cards c WHERE c."projectId"=$1 AND c."deletedAt" IS NULL ORDER BY c.position,c."createdAt"`,
      [id],
    );
    const activities = await this.db.query(
      `SELECT a.*,(u."firstName"||' '||u."lastName") actor FROM project_activities a JOIN users u ON u.id=a."actorUserId" WHERE a."projectId"=$1 ORDER BY a."createdAt" DESC LIMIT 50`,
      [id],
    );
    return { ...project, access, members, cards, activities };
  }
  async create(actor: AuthenticatedUser, dto: CreateProjectDto) {
    return this.db.transaction(async (m) => {
      const ids = [...new Set(dto.members.map((x) => x.userId)), actor.id];
      await this.assertUsersBelongToOrganization(m, ids, actor.organizationId);
      const project = await m.getRepository(Project).save({
        organizationId: actor.organizationId,
        createdBy: actor.id,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        category: dto.category?.trim() || null,
        status: dto.status,
        completedAt: dto.status === ProjectStatus.Completed ? new Date() : null,
      });
      const roles = new Map(dto.members.map((x) => [x.userId, x.access]));
      roles.set(actor.id, ProjectAccess.Admin);
      await m
        .getRepository(ProjectMember)
        .insert([...roles].map(([userId, access]) => ({ projectId: project.id, userId, access })));
      await m.getRepository(ProjectActivity).save({
        projectId: project.id,
        actorUserId: actor.id,
        action: 'project.created',
        description: `Projekt „${project.title}“ erstellt.`,
      });
      for (const [cardPosition, checklist] of (dto.initialChecklists ?? []).entries()) {
        const card = await m.getRepository(ProjectCard).save({
          projectId: project.id,
          createdBy: actor.id,
          type: ProjectCardType.Checklist,
          title: checklist.title.trim(),
          position: cardPosition,
        });
        const items = checklist.items
          .map((text) => text.trim())
          .filter((text) => text.length > 0)
          .map((text, position) => ({ cardId: card.id, text, position }));
        if (items.length) await m.getRepository(ChecklistItem).insert(items);
        await m.getRepository(ProjectActivity).save({
          projectId: project.id,
          actorUserId: actor.id,
          action: 'card.created',
          description: `Checkliste „${card.title}“ mit ${items.length} Punkt${items.length === 1 ? '' : 'en'} erstellt.`,
        });
      }
      await this.audit(m, actor, 'project.created', 'project', project.id, {
        title: project.title,
      });
      return project;
    });
  }
  async update(actor: AuthenticatedUser, id: string, dto: UpdateProjectDto) {
    await this.access(actor, id, ProjectAccess.Admin);
    return this.db.transaction(async (m) => {
      const project = await m
        .getRepository(Project)
        .findOneBy({ id, organizationId: actor.organizationId });
      if (!project || project.deletedAt)
        throw new NotFoundException('Projekt wurde nicht gefunden.');
      const ids = [...new Set(dto.members.map((entry) => entry.userId)), project.createdBy];
      await this.assertUsersBelongToOrganization(m, ids, actor.organizationId);

      const previousStatus = project.status;
      const becameCompleted =
        previousStatus !== ProjectStatus.Completed && dto.status === ProjectStatus.Completed;
      const reopened =
        previousStatus === ProjectStatus.Completed && dto.status !== ProjectStatus.Completed;

      Object.assign(project, {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        category: dto.category?.trim() || null,
        status: dto.status,
        completedAt: becameCompleted ? new Date() : reopened ? null : project.completedAt,
      });
      await m.getRepository(Project).save(project);
      const roles = new Map(dto.members.map((entry) => [entry.userId, entry.access]));
      roles.set(project.createdBy, ProjectAccess.Admin);
      await m.getRepository(ProjectMember).delete({ projectId: id });
      await m
        .getRepository(ProjectMember)
        .insert([...roles].map(([userId, access]) => ({ projectId: id, userId, access })));
      const action = becameCompleted
        ? 'project.completed'
        : reopened
          ? 'project.reopened'
          : 'project.updated';
      const description = becameCompleted
        ? `Projekt „${project.title}“ als abgeschlossen markiert.`
        : reopened
          ? `Projekt „${project.title}“ wieder geöffnet.`
          : `Projekt „${project.title}“ aktualisiert.`;
      await m.getRepository(ProjectActivity).save({
        projectId: id,
        actorUserId: actor.id,
        action,
        description,
      });
      await this.audit(m, actor, action, 'project', project.id, {
        title: project.title,
        previousStatus,
        status: project.status,
      });
      return project;
    });
  }
  async addCard(actor: AuthenticatedUser, projectId: string, dto: CreateCardDto) {
    // Gemeinsame Notizen sind bewusst für jedes Projektmitglied beschreibbar.
    // Alle anderen Karten behalten die bestehende Edit-Berechtigung.
    await this.access(
      actor,
      projectId,
      dto.type === ProjectCardType.Note ? ProjectAccess.Read : ProjectAccess.Edit,
    );
    const card = await this.db.getRepository(ProjectCard).save({
      projectId,
      createdBy: actor.id,
      type: dto.type,
      title: dto.title.trim(),
      content: dto.content?.trim() || null,
    });
    await this.log(projectId, actor.id, 'card.created', `Eintrag „${card.title}“ erstellt.`);
    return card;
  }
  async updateCard(
    actor: AuthenticatedUser,
    projectId: string,
    cardId: string,
    dto: UpdateCardDto,
  ) {
    await this.access(actor, projectId, ProjectAccess.Read);
    const card = await this.db.getRepository(ProjectCard).findOneBy({
      id: cardId,
      projectId,
      type: ProjectCardType.Note,
    });
    if (!card || card.deletedAt) throw new NotFoundException('Notiz wurde nicht gefunden.');
    card.title = dto.title.trim();
    card.content = dto.content?.trim() || null;
    await this.db.getRepository(ProjectCard).save(card);
    await this.log(projectId, actor.id, 'note.updated', `Notiz „${card.title}“ aktualisiert.`);
    return card;
  }
  async addItem(
    actor: AuthenticatedUser,
    projectId: string,
    cardId: string,
    dto: ChecklistItemDto,
  ) {
    await this.access(actor, projectId, ProjectAccess.Edit);
    await this.card(projectId, cardId);
    const item = await this.db.getRepository(ChecklistItem).save({ cardId, text: dto.text.trim() });
    await this.log(
      projectId,
      actor.id,
      'checklist.created',
      `Checklistenpunkt „${item.text}“ erstellt.`,
    );
    return item;
  }
  async updateItem(
    actor: AuthenticatedUser,
    projectId: string,
    cardId: string,
    itemId: string,
    dto: ChecklistItemDto,
  ) {
    await this.access(actor, projectId, ProjectAccess.Edit);
    await this.card(projectId, cardId);
    const item = await this.db.getRepository(ChecklistItem).findOneBy({ id: itemId, cardId });
    if (!item) throw new NotFoundException();
    item.text = dto.text.trim();
    return this.db.getRepository(ChecklistItem).save(item);
  }
  async toggleItem(actor: AuthenticatedUser, projectId: string, cardId: string, itemId: string) {
    await this.access(actor, projectId, ProjectAccess.Edit);
    await this.card(projectId, cardId);
    const item = await this.db.getRepository(ChecklistItem).findOneBy({ id: itemId, cardId });
    if (!item) throw new NotFoundException();
    item.completed = !item.completed;
    item.completedBy = item.completed ? actor.id : null;
    item.completedAt = item.completed ? new Date() : null;
    await this.db.getRepository(ChecklistItem).save(item);
    await this.log(
      projectId,
      actor.id,
      item.completed ? 'checklist.completed' : 'checklist.reopened',
      `Checklistenpunkt „${item.text}“ ${item.completed ? 'erledigt' : 'wieder geöffnet'}.`,
    );
    return item;
  }
  async deleteItem(actor: AuthenticatedUser, projectId: string, cardId: string, itemId: string) {
    await this.access(actor, projectId, ProjectAccess.Edit);
    await this.card(projectId, cardId);
    const item = await this.db.getRepository(ChecklistItem).findOneBy({ id: itemId, cardId });
    if (!item) throw new NotFoundException();
    await this.db.getRepository(ChecklistItem).softRemove(item);
    await this.log(
      projectId,
      actor.id,
      'checklist.deleted',
      `Checklistenpunkt „${item.text}“ gelöscht.`,
    );
  }
  async deleteCard(actor: AuthenticatedUser, projectId: string, cardId: string) {
    await this.access(actor, projectId, ProjectAccess.Admin);
    const card = await this.db.getRepository(ProjectCard).findOneBy({ id: cardId, projectId });
    if (!card) throw new NotFoundException();
    await this.db.transaction(async (m) => {
      await m.getRepository(ChecklistItem).softDelete({ cardId });
      await m.getRepository(ProjectCard).softRemove(card);
      await this.audit(m, actor, 'project.card.deleted', 'project_card', card.id, {
        title: card.title,
        projectId,
      });
    });
  }
  async deleteProject(actor: AuthenticatedUser, id: string) {
    await this.access(actor, id, ProjectAccess.Admin);
    const project = await this.db
      .getRepository(Project)
      .findOneBy({ id, organizationId: actor.organizationId });
    if (!project) throw new NotFoundException();
    await this.db.transaction(async (m) => {
      const cards = await m.getRepository(ProjectCard).findBy({ projectId: id });
      if (cards.length)
        await m.getRepository(ChecklistItem).softDelete(cards.map((c) => ({ cardId: c.id })));
      await m.getRepository(ProjectCard).softDelete({ projectId: id });
      await m.getRepository(Project).softRemove(project);
      await this.audit(m, actor, 'project.deleted', 'project', id, { title: project.title });
    });
  }
  private async access(
    actor: AuthenticatedUser,
    id: string,
    need: ProjectAccess,
  ): Promise<ProjectAccess> {
    if (await this.isSuperuser(actor)) return ProjectAccess.Admin;
    const rows: Array<{ access: ProjectAccess }> = await this.db.query(
      `SELECT pm.access FROM project_members pm JOIN projects p ON p.id=pm."projectId" WHERE pm."projectId"=$1 AND pm."userId"=$2 AND p."organizationId"=$3 AND p."deletedAt" IS NULL`,
      [id, actor.id, actor.organizationId],
    );
    const got = rows[0]?.access;
    const rank = { read: 1, edit: 2, admin: 3 };
    if (!got || rank[got] < rank[need])
      throw new ForbiddenException('Kein Zugriff auf dieses Projekt.');
    return got;
  }
  private isSuperuser(actor: AuthenticatedUser) {
    return (
      this.permissions?.hasRole(actor.id, actor.organizationId, 'Superuser') ??
      Promise.resolve(false)
    );
  }
  private audit(
    m: EntityManager,
    actor: AuthenticatedUser,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ) {
    return m.getRepository(AuditLog).save({
      organizationId: actor.organizationId,
      actorUserId: actor.id,
      action,
      entityType,
      entityId,
      outcome: 'success',
      metadata,
    });
  }
  private async card(projectId: string, id: string) {
    if (
      !(await this.db
        .getRepository(ProjectCard)
        .findOneBy({ id, projectId, type: ProjectCardType.Checklist }))
    )
      throw new NotFoundException('Checkliste wurde nicht gefunden.');
  }
  private log(projectId: string, actorUserId: string, action: string, description: string) {
    return this.db
      .getRepository(ProjectActivity)
      .save({ projectId, actorUserId, action, description });
  }
  private async assertUsersBelongToOrganization(
    manager: EntityManager,
    ids: string[],
    organizationId: string,
  ) {
    const rows: Array<{ id: string }> = await manager.query(
      `SELECT id FROM users WHERE "organizationId"=$1 AND "deletedAt" IS NULL AND id = ANY($2::uuid[])`,
      [organizationId, ids],
    );
    const found = new Set(rows.map((row) => row.id));
    if (ids.some((id) => !found.has(id)))
      throw new NotFoundException('Mindestens ein ausgewählter Teilnehmer wurde nicht gefunden.');
  }
}
