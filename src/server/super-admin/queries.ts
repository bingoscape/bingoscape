/**
 * Read-only queries for the super-admin views.
 *
 * Every export returns an explicit DTO built from selected columns, so password
 * hashes, usernames and other full rows never reach a Server Component's props
 * (and therefore never end up in the RSC payload sent to the browser). These
 * are deliberately NOT server actions: they cannot be invoked from the client.
 */
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  isNull,
  or,
  sql,
  type AnyColumn,
  type SQL,
} from "drizzle-orm"

import { db } from "@/server/db"
import {
  bingos,
  clanMembers,
  clans,
  eventParticipants,
  events,
  submissions,
  teamMembers,
  adminAuditLog,
  teamTileSubmissions,
  teams,
  tiles,
  users,
} from "@/server/db/schema"
import { requireSuperAdmin } from "@/lib/super-admin"
import {
  ADMIN_PAGE_SIZE,
  clampPage,
  containsPattern,
  isUuid,
  type ListConfig,
  type ListParams,
  type SortDir,
} from "@/lib/admin-list-params"
import type { AuditFilters } from "@/lib/super-admin-audit"
import type { SelectOption, UserRef } from "@/lib/super-admin-format"

/* -------------------------------------------------------------------------- */
/* Shared types and helpers                                                    */
/* -------------------------------------------------------------------------- */

export interface Paged<T> {
  rows: T[]
  totalCount: number
  totalPages: number
  page: number
  pageSize: number
}

export type ClanRole = "admin" | "management" | "member" | "guest"
export type EventRole = "admin" | "management" | "participant"

export interface UserSummary extends UserRef {
  image: string | null
}

export interface EventSummary {
  id: string
  title: string
  startDate: Date
  endDate: Date
  timezone: string
  locked: boolean
  public: boolean
}

const sqlCount = (query: SQL) => sql<number>`(${query})`.mapWith(Number)

function orderBy(expr: SQL | AnyColumn, dir: SortDir, tiebreaker: AnyColumn) {
  return [
    dir === "asc" ? sql`${expr} asc nulls last` : sql`${expr} desc nulls last`,
    asc(tiebreaker),
  ]
}

function paginate(totalCount: number, requestedPage: number) {
  const totalPages = Math.max(Math.ceil(totalCount / ADMIN_PAGE_SIZE), 1)
  const page = clampPage(requestedPage, totalPages)
  return {
    totalPages,
    page,
    offset: (page - 1) * ADMIN_PAGE_SIZE,
  }
}

/* -------------------------------------------------------------------------- */
/* Overview                                                                    */
/* -------------------------------------------------------------------------- */

export interface SuperAdminOverview {
  users: number
  clans: number
  clansWithoutOwner: number
  events: number
  liveEvents: number
  upcomingEvents: number
}

export async function getSuperAdminOverview(): Promise<SuperAdminOverview> {
  await requireSuperAdmin()

  const [[userRow], [clanRow], [eventRow]] = await Promise.all([
    db.select({ total: count() }).from(users),
    db
      .select({
        total: count(),
        withoutOwner:
          sql<number>`count(*) filter (where ${clans.ownerId} is null)`.mapWith(
            Number
          ),
      })
      .from(clans),
    db
      .select({
        total: count(),
        live: sql<number>`count(*) filter (where ${events.startDate} <= now() and ${events.endDate} >= now())`.mapWith(
          Number
        ),
        upcoming:
          sql<number>`count(*) filter (where ${events.startDate} > now())`.mapWith(
            Number
          ),
      })
      .from(events),
  ])

  return {
    users: userRow?.total ?? 0,
    clans: clanRow?.total ?? 0,
    clansWithoutOwner: clanRow?.withoutOwner ?? 0,
    events: eventRow?.total ?? 0,
    liveEvents: eventRow?.live ?? 0,
    upcomingEvents: eventRow?.upcoming ?? 0,
  }
}

/* -------------------------------------------------------------------------- */
/* Users                                                                       */
/* -------------------------------------------------------------------------- */

export const USER_LIST_CONFIG = {
  sortKeys: ["name", "email", "rsn"],
  defaultSort: "name",
  defaultDir: "asc",
} as const satisfies ListConfig<"name" | "email" | "rsn">

export type UserSortKey = (typeof USER_LIST_CONFIG.sortKeys)[number]

export interface UserListRow extends UserSummary {
  email: string | null
  emailVerified: Date | null
  clanMemberships: number
  createdEvents: number
  ownedClans: number
  eventParticipations: number
}

export async function listUsers(
  params: ListParams<UserSortKey>
): Promise<Paged<UserListRow>> {
  await requireSuperAdmin()

  const where = params.q
    ? or(
        ilike(users.name, containsPattern(params.q)),
        ilike(users.email, containsPattern(params.q)),
        ilike(users.runescapeName, containsPattern(params.q))
      )
    : undefined

  const [totalRow] = await db
    .select({ total: count() })
    .from(users)
    .where(where)
  const totalCount = totalRow?.total ?? 0
  const { totalPages, page, offset } = paginate(totalCount, params.page)

  const sortExpr =
    params.sort === "email"
      ? sql`lower(${users.email})`
      : params.sort === "rsn"
        ? sql`lower(${users.runescapeName})`
        : sql`lower(${users.name})`

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      runescapeName: users.runescapeName,
      image: users.image,
      emailVerified: users.emailVerified,
      clanMemberships: sqlCount(
        sql`select count(*) from ${clanMembers} where ${clanMembers.userId} = ${users.id}`
      ),
      createdEvents: sqlCount(
        sql`select count(*) from ${events} where ${events.creatorId} = ${users.id}`
      ),
      ownedClans: sqlCount(
        sql`select count(*) from ${clans} where ${clans.ownerId} = ${users.id}`
      ),
      eventParticipations: sqlCount(
        sql`select count(*) from ${eventParticipants} where ${eventParticipants.userId} = ${users.id}`
      ),
    })
    .from(users)
    .where(where)
    .orderBy(...orderBy(sortExpr, params.dir, users.id))
    .limit(ADMIN_PAGE_SIZE)
    .offset(offset)

  return { rows, totalCount, totalPages, page, pageSize: ADMIN_PAGE_SIZE }
}

export interface UserDetail {
  user: UserSummary & { email: string | null; emailVerified: Date | null }
  clans: {
    clanId: string
    clanName: string
    role: ClanRole
    isMain: boolean
    joinedAt: Date
  }[]
  participations: (EventSummary & { role: EventRole; joinedAt: Date })[]
  createdEvents: (EventSummary & { participantCount: number })[]
  ownedClans: { id: string; name: string }[]
  totals: {
    clans: number
    participations: number
    createdEvents: number
    ownedClans: number
    submissions: number
    othersInCreatedEvents: number
  }
}

const DETAIL_LIST_CAP = 100

export async function getUserDetail(
  userId: string
): Promise<UserDetail | null> {
  await requireSuperAdmin()
  if (!isUuid(userId)) return null

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      runescapeName: users.runescapeName,
      image: users.image,
      emailVerified: users.emailVerified,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  if (!user) return null

  const eventColumns = {
    id: events.id,
    title: events.title,
    startDate: events.startDate,
    endDate: events.endDate,
    timezone: events.timezone,
    locked: events.locked,
    public: events.public,
  }

  const [
    clanRows,
    participationRows,
    createdRows,
    ownedRows,
    [clanTotal],
    [participationTotal],
    [createdTotal],
    [ownedTotal],
    [submissionTotal],
    [othersTotal],
  ] = await Promise.all([
    db
      .select({
        clanId: clans.id,
        clanName: clans.name,
        role: clanMembers.role,
        isMain: clanMembers.isMain,
        joinedAt: clanMembers.joinedAt,
      })
      .from(clanMembers)
      .innerJoin(clans, eq(clanMembers.clanId, clans.id))
      .where(eq(clanMembers.userId, userId))
      .orderBy(desc(clanMembers.isMain), asc(clans.name))
      .limit(DETAIL_LIST_CAP),
    db
      .select({
        ...eventColumns,
        role: eventParticipants.role,
        joinedAt: eventParticipants.createdAt,
      })
      .from(eventParticipants)
      .innerJoin(events, eq(eventParticipants.eventId, events.id))
      .where(eq(eventParticipants.userId, userId))
      .orderBy(desc(events.startDate))
      .limit(DETAIL_LIST_CAP),
    db
      .select({
        ...eventColumns,
        participantCount: sqlCount(
          sql`select count(*) from ${eventParticipants} where ${eventParticipants.eventId} = ${events.id}`
        ),
      })
      .from(events)
      .where(eq(events.creatorId, userId))
      .orderBy(desc(events.startDate))
      .limit(DETAIL_LIST_CAP),
    db
      .select({ id: clans.id, name: clans.name })
      .from(clans)
      .where(eq(clans.ownerId, userId))
      .orderBy(asc(clans.name))
      .limit(DETAIL_LIST_CAP),
    db
      .select({ total: count() })
      .from(clanMembers)
      .where(eq(clanMembers.userId, userId)),
    db
      .select({ total: count() })
      .from(eventParticipants)
      .where(eq(eventParticipants.userId, userId)),
    db
      .select({ total: count() })
      .from(events)
      .where(eq(events.creatorId, userId)),
    db.select({ total: count() }).from(clans).where(eq(clans.ownerId, userId)),
    db
      .select({ total: count() })
      .from(submissions)
      .where(eq(submissions.submittedBy, userId)),
    db
      .select({ total: count() })
      .from(eventParticipants)
      .innerJoin(events, eq(eventParticipants.eventId, events.id))
      .where(
        and(
          eq(events.creatorId, userId),
          sql`${eventParticipants.userId} <> ${userId}`
        )
      ),
  ])

  return {
    user,
    clans: clanRows,
    participations: participationRows,
    createdEvents: createdRows,
    ownedClans: ownedRows,
    totals: {
      clans: clanTotal?.total ?? 0,
      participations: participationTotal?.total ?? 0,
      createdEvents: createdTotal?.total ?? 0,
      ownedClans: ownedTotal?.total ?? 0,
      submissions: submissionTotal?.total ?? 0,
      othersInCreatedEvents: othersTotal?.total ?? 0,
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Clans                                                                       */
/* -------------------------------------------------------------------------- */

export const CLAN_LIST_CONFIG = {
  sortKeys: ["name", "members", "events", "created"],
  defaultSort: "created",
  defaultDir: "desc",
  filters: ["no-owner"],
} as const satisfies ListConfig<"name" | "members" | "events" | "created">

export type ClanSortKey = (typeof CLAN_LIST_CONFIG.sortKeys)[number]

export interface ClanListRow {
  id: string
  name: string
  description: string | null
  createdAt: Date
  owner: UserRef | null
  memberCount: number
  eventCount: number
}

export async function listClans(
  params: ListParams<ClanSortKey>
): Promise<Paged<ClanListRow>> {
  await requireSuperAdmin()

  const searchFilter = params.q
    ? or(
        ilike(clans.name, containsPattern(params.q)),
        ilike(clans.description, containsPattern(params.q))
      )
    : undefined
  const where = and(
    searchFilter,
    params.filter === "no-owner" ? isNull(clans.ownerId) : undefined
  )

  const [totalRow] = await db
    .select({ total: count() })
    .from(clans)
    .where(where)
  const totalCount = totalRow?.total ?? 0
  const { totalPages, page, offset } = paginate(totalCount, params.page)

  const memberCount = sqlCount(
    sql`select count(*) from ${clanMembers} where ${clanMembers.clanId} = ${clans.id}`
  )
  const eventCount = sqlCount(
    sql`select count(*) from ${events} where ${events.clanId} = ${clans.id}`
  )
  const sortExpr =
    params.sort === "name"
      ? sql`lower(${clans.name})`
      : params.sort === "members"
        ? memberCount
        : params.sort === "events"
          ? eventCount
          : clans.createdAt

  const rows = await db
    .select({
      id: clans.id,
      name: clans.name,
      description: clans.description,
      createdAt: clans.createdAt,
      ownerId: users.id,
      ownerName: users.name,
      ownerRunescapeName: users.runescapeName,
      memberCount,
      eventCount,
    })
    .from(clans)
    .leftJoin(users, eq(clans.ownerId, users.id))
    .where(where)
    .orderBy(...orderBy(sortExpr, params.dir, clans.id))
    .limit(ADMIN_PAGE_SIZE)
    .offset(offset)

  return {
    rows: rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: row.createdAt,
      owner: row.ownerId
        ? {
            id: row.ownerId,
            name: row.ownerName,
            runescapeName: row.ownerRunescapeName,
          }
        : null,
      memberCount: row.memberCount,
      eventCount: row.eventCount,
    })),
    totalCount,
    totalPages,
    page,
    pageSize: ADMIN_PAGE_SIZE,
  }
}

export interface ClanDetail {
  clan: {
    id: string
    name: string
    description: string | null
    createdAt: Date
  }
  owner: UserRef | null
  memberCount: number
  eventCount: number
  lockedEvents: number
  publicEvents: number
  /** Submissions members made inside this clan's events. */
  submissionCount: number
  roles: Record<ClanRole, number>
}

export async function getClanDetail(
  clanId: string
): Promise<ClanDetail | null> {
  await requireSuperAdmin()
  if (!isUuid(clanId)) return null

  const [row] = await db
    .select({
      id: clans.id,
      name: clans.name,
      description: clans.description,
      createdAt: clans.createdAt,
      ownerId: users.id,
      ownerName: users.name,
      ownerRunescapeName: users.runescapeName,
    })
    .from(clans)
    .leftJoin(users, eq(clans.ownerId, users.id))
    .where(eq(clans.id, clanId))
    .limit(1)
  if (!row) return null

  const [roleRows, [eventRow], [submissionRow]] = await Promise.all([
    db
      .select({ role: clanMembers.role, total: count() })
      .from(clanMembers)
      .where(eq(clanMembers.clanId, clanId))
      .groupBy(clanMembers.role),
    db
      .select({
        total: count(),
        locked: sql<number>`count(*) filter (where ${events.locked})`.mapWith(
          Number
        ),
        public: sql<number>`count(*) filter (where ${events.public})`.mapWith(
          Number
        ),
      })
      .from(events)
      .where(eq(events.clanId, clanId)),
    db
      .select({ total: count() })
      .from(submissions)
      .innerJoin(
        teamTileSubmissions,
        eq(submissions.teamTileSubmissionId, teamTileSubmissions.id)
      )
      .innerJoin(tiles, eq(teamTileSubmissions.tileId, tiles.id))
      .innerJoin(bingos, eq(tiles.bingoId, bingos.id))
      .innerJoin(events, eq(bingos.eventId, events.id))
      .where(eq(events.clanId, clanId)),
  ])

  const roles: Record<ClanRole, number> = {
    admin: 0,
    management: 0,
    member: 0,
    guest: 0,
  }
  for (const r of roleRows) roles[r.role] = r.total

  return {
    clan: {
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: row.createdAt,
    },
    owner: row.ownerId
      ? {
          id: row.ownerId,
          name: row.ownerName,
          runescapeName: row.ownerRunescapeName,
        }
      : null,
    memberCount: Object.values(roles).reduce((a, b) => a + b, 0),
    eventCount: eventRow?.total ?? 0,
    lockedEvents: eventRow?.locked ?? 0,
    publicEvents: eventRow?.public ?? 0,
    submissionCount: submissionRow?.total ?? 0,
    roles,
  }
}

const OPTION_CAP = 500

/** Owner candidates: the clan's members (capped), plus the current owner if they left. */
export async function getClanOwnerOptions(
  clanId: string,
  currentOwnerId: string | null
): Promise<SelectOption[]> {
  await requireSuperAdmin()
  if (!isUuid(clanId)) return []

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      runescapeName: users.runescapeName,
    })
    .from(clanMembers)
    .innerJoin(users, eq(clanMembers.userId, users.id))
    .where(eq(clanMembers.clanId, clanId))
    .orderBy(asc(sql`lower(${users.name})`), asc(users.id))
    .limit(OPTION_CAP)

  const options = rows.map((r) => ({
    value: r.id,
    label:
      r.name?.trim() || r.runescapeName?.trim() || `User ${r.id.slice(0, 8)}`,
    hint: r.name && r.runescapeName ? r.runescapeName : undefined,
  }))

  if (currentOwnerId && !options.some((o) => o.value === currentOwnerId)) {
    const [owner] = await db
      .select({
        id: users.id,
        name: users.name,
        runescapeName: users.runescapeName,
      })
      .from(users)
      .where(eq(users.id, currentOwnerId))
      .limit(1)
    if (owner) {
      options.unshift({
        value: owner.id,
        label:
          owner.name?.trim() ||
          owner.runescapeName?.trim() ||
          `User ${owner.id.slice(0, 8)}`,
        hint: "Not a member",
      })
    }
  }
  return options
}

export const CLAN_MEMBER_LIST_CONFIG = {
  sortKeys: ["name", "role", "joined", "submissions"],
  defaultSort: "joined",
  defaultDir: "desc",
} as const satisfies ListConfig<"name" | "role" | "joined" | "submissions">

export type ClanMemberSortKey =
  (typeof CLAN_MEMBER_LIST_CONFIG.sortKeys)[number]

export interface ClanMemberRow {
  userId: string
  user: UserSummary
  role: ClanRole
  joinedAt: Date
  isOwner: boolean
  /** Submissions this member made inside the clan's events. */
  submissionCount: number
}

export async function listClanMembers(
  clanId: string,
  params: ListParams<ClanMemberSortKey>
): Promise<Paged<ClanMemberRow> & { adminCount: number }> {
  await requireSuperAdmin()
  const empty = {
    rows: [],
    totalCount: 0,
    totalPages: 1,
    page: 1,
    pageSize: ADMIN_PAGE_SIZE,
    adminCount: 0,
  }
  if (!isUuid(clanId)) return empty

  const searchFilter = params.q
    ? or(
        ilike(users.name, containsPattern(params.q)),
        ilike(users.email, containsPattern(params.q)),
        ilike(users.runescapeName, containsPattern(params.q))
      )
    : undefined
  const where = and(eq(clanMembers.clanId, clanId), searchFilter)

  const [[totalRow], [adminRow]] = await Promise.all([
    db
      .select({ total: count() })
      .from(clanMembers)
      .innerJoin(users, eq(clanMembers.userId, users.id))
      .where(where),
    db
      .select({ total: count() })
      .from(clanMembers)
      .where(
        and(eq(clanMembers.clanId, clanId), eq(clanMembers.role, "admin"))
      ),
  ])
  const totalCount = totalRow?.total ?? 0
  const { totalPages, page, offset } = paginate(totalCount, params.page)

  const submissionCount = sqlCount(sql`
    select count(*) from ${submissions}
    inner join ${teamTileSubmissions} on ${teamTileSubmissions.id} = ${submissions.teamTileSubmissionId}
    inner join ${tiles} on ${tiles.id} = ${teamTileSubmissions.tileId}
    inner join ${bingos} on ${bingos.id} = ${tiles.bingoId}
    inner join ${events} on ${events.id} = ${bingos.eventId}
    where ${submissions.submittedBy} = ${clanMembers.userId}
      and ${events.clanId} = ${clanMembers.clanId}`)

  const sortExpr =
    params.sort === "name"
      ? sql`lower(${users.name})`
      : params.sort === "role"
        ? sql`case ${clanMembers.role} when 'admin' then 4 when 'management' then 3 when 'member' then 2 else 1 end`
        : params.sort === "submissions"
          ? submissionCount
          : clanMembers.joinedAt

  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      runescapeName: users.runescapeName,
      image: users.image,
      role: clanMembers.role,
      joinedAt: clanMembers.joinedAt,
      isOwner: sql<boolean>`${clans.ownerId} = ${users.id}`,
      submissionCount,
    })
    .from(clanMembers)
    .innerJoin(users, eq(clanMembers.userId, users.id))
    .innerJoin(clans, eq(clanMembers.clanId, clans.id))
    .where(where)
    .orderBy(...orderBy(sortExpr, params.dir, users.id))
    .limit(ADMIN_PAGE_SIZE)
    .offset(offset)

  return {
    rows: rows.map((r) => ({
      userId: r.userId,
      user: {
        id: r.userId,
        name: r.name,
        runescapeName: r.runescapeName,
        image: r.image,
      },
      role: r.role,
      joinedAt: r.joinedAt,
      isOwner: r.isOwner === true,
      submissionCount: r.submissionCount,
    })),
    totalCount,
    totalPages,
    page,
    pageSize: ADMIN_PAGE_SIZE,
    adminCount: adminRow?.total ?? 0,
  }
}

/* -------------------------------------------------------------------------- */
/* Events                                                                      */
/* -------------------------------------------------------------------------- */

export const EVENT_LIST_CONFIG = {
  sortKeys: ["title", "start", "participants", "created"],
  defaultSort: "created",
  defaultDir: "desc",
  filters: ["live", "upcoming", "ended"],
} as const satisfies ListConfig<"title" | "start" | "participants" | "created">

export type EventSortKey = (typeof EVENT_LIST_CONFIG.sortKeys)[number]

export interface EventListRow extends EventSummary {
  description: string | null
  createdAt: Date
  creator: UserRef | null
  clan: { id: string; name: string } | null
  participantCount: number
  teamCount: number
  boardCount: number
}

export interface EventListScope {
  clanId?: string
}

export async function listEvents(
  params: ListParams<EventSortKey>,
  scope: EventListScope = {}
): Promise<Paged<EventListRow>> {
  await requireSuperAdmin()

  const searchFilter = params.q
    ? or(
        ilike(events.title, containsPattern(params.q)),
        ilike(events.description, containsPattern(params.q))
      )
    : undefined
  const stateFilter =
    params.filter === "live"
      ? sql`${events.startDate} <= now() and ${events.endDate} >= now()`
      : params.filter === "upcoming"
        ? sql`${events.startDate} > now()`
        : params.filter === "ended"
          ? sql`${events.endDate} < now()`
          : undefined
  const where = and(
    searchFilter,
    stateFilter,
    scope.clanId ? eq(events.clanId, scope.clanId) : undefined
  )

  const [totalRow] = await db
    .select({ total: count() })
    .from(events)
    .where(where)
  const totalCount = totalRow?.total ?? 0
  const { totalPages, page, offset } = paginate(totalCount, params.page)

  const participantCount = sqlCount(
    sql`select count(*) from ${eventParticipants} where ${eventParticipants.eventId} = ${events.id}`
  )
  const sortExpr =
    params.sort === "title"
      ? sql`lower(${events.title})`
      : params.sort === "start"
        ? events.startDate
        : params.sort === "participants"
          ? participantCount
          : events.createdAt

  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      startDate: events.startDate,
      endDate: events.endDate,
      timezone: events.timezone,
      createdAt: events.createdAt,
      locked: events.locked,
      public: events.public,
      creatorId: users.id,
      creatorName: users.name,
      creatorRunescapeName: users.runescapeName,
      clanId: clans.id,
      clanName: clans.name,
      participantCount,
      teamCount: sqlCount(
        sql`select count(*) from ${teams} where ${teams.eventId} = ${events.id}`
      ),
      boardCount: sqlCount(
        sql`select count(*) from ${bingos} where ${bingos.eventId} = ${events.id}`
      ),
    })
    .from(events)
    .leftJoin(users, eq(events.creatorId, users.id))
    .leftJoin(clans, eq(events.clanId, clans.id))
    .where(where)
    .orderBy(...orderBy(sortExpr, params.dir, events.id))
    .limit(ADMIN_PAGE_SIZE)
    .offset(offset)

  return {
    rows: rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      startDate: r.startDate,
      endDate: r.endDate,
      timezone: r.timezone,
      createdAt: r.createdAt,
      locked: r.locked,
      public: r.public,
      creator: r.creatorId
        ? {
            id: r.creatorId,
            name: r.creatorName,
            runescapeName: r.creatorRunescapeName,
          }
        : null,
      clan: r.clanId && r.clanName ? { id: r.clanId, name: r.clanName } : null,
      participantCount: r.participantCount,
      teamCount: r.teamCount,
      boardCount: r.boardCount,
    })),
    totalCount,
    totalPages,
    page,
    pageSize: ADMIN_PAGE_SIZE,
  }
}

/** Clan choices for the event edit form (capped; the form says when truncated). */
export async function getClanOptions(): Promise<{
  options: SelectOption[]
  truncated: boolean
}> {
  await requireSuperAdmin()
  const rows = await db
    .select({ id: clans.id, name: clans.name })
    .from(clans)
    .orderBy(asc(sql`lower(${clans.name})`), asc(clans.id))
    .limit(OPTION_CAP + 1)
  return {
    options: rows
      .slice(0, OPTION_CAP)
      .map((r) => ({ value: r.id, label: r.name })),
    truncated: rows.length > OPTION_CAP,
  }
}

export interface EventDetail {
  event: EventSummary & {
    description: string | null
    createdAt: Date
  }
  creator: UserRef | null
  clan: { id: string; name: string } | null
  counts: {
    participants: number
    teams: number
    boards: number
    tiles: number
    submissions: number
  }
}

export async function getEventDetail(
  eventId: string
): Promise<EventDetail | null> {
  await requireSuperAdmin()
  if (!isUuid(eventId)) return null

  const [row] = await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      startDate: events.startDate,
      endDate: events.endDate,
      timezone: events.timezone,
      createdAt: events.createdAt,
      locked: events.locked,
      public: events.public,
      creatorId: users.id,
      creatorName: users.name,
      creatorRunescapeName: users.runescapeName,
      clanId: clans.id,
      clanName: clans.name,
    })
    .from(events)
    .leftJoin(users, eq(events.creatorId, users.id))
    .leftJoin(clans, eq(events.clanId, clans.id))
    .where(eq(events.id, eventId))
    .limit(1)
  if (!row) return null

  const [[participants], [teamRow], [boardRow], [tileRow], [submissionRow]] =
    await Promise.all([
      db
        .select({ total: count() })
        .from(eventParticipants)
        .where(eq(eventParticipants.eventId, eventId)),
      db
        .select({ total: count() })
        .from(teams)
        .where(eq(teams.eventId, eventId)),
      db
        .select({ total: count() })
        .from(bingos)
        .where(eq(bingos.eventId, eventId)),
      db
        .select({ total: count() })
        .from(tiles)
        .innerJoin(bingos, eq(tiles.bingoId, bingos.id))
        .where(eq(bingos.eventId, eventId)),
      db
        .select({ total: count() })
        .from(submissions)
        .innerJoin(
          teamTileSubmissions,
          eq(submissions.teamTileSubmissionId, teamTileSubmissions.id)
        )
        .innerJoin(tiles, eq(teamTileSubmissions.tileId, tiles.id))
        .innerJoin(bingos, eq(tiles.bingoId, bingos.id))
        .where(eq(bingos.eventId, eventId)),
    ])

  return {
    event: {
      id: row.id,
      title: row.title,
      description: row.description,
      startDate: row.startDate,
      endDate: row.endDate,
      timezone: row.timezone,
      createdAt: row.createdAt,
      locked: row.locked,
      public: row.public,
    },
    creator: row.creatorId
      ? {
          id: row.creatorId,
          name: row.creatorName,
          runescapeName: row.creatorRunescapeName,
        }
      : null,
    clan:
      row.clanId && row.clanName
        ? { id: row.clanId, name: row.clanName }
        : null,
    counts: {
      participants: participants?.total ?? 0,
      teams: teamRow?.total ?? 0,
      boards: boardRow?.total ?? 0,
      tiles: tileRow?.total ?? 0,
      submissions: submissionRow?.total ?? 0,
    },
  }
}

export const PARTICIPANT_LIST_CONFIG = {
  sortKeys: ["name", "role", "joined"],
  defaultSort: "joined",
  defaultDir: "desc",
} as const satisfies ListConfig<"name" | "role" | "joined">

export type ParticipantSortKey =
  (typeof PARTICIPANT_LIST_CONFIG.sortKeys)[number]

export interface ParticipantRow {
  userId: string
  user: UserSummary
  role: EventRole
  joinedAt: Date
  isCreator: boolean
}

export async function listEventParticipants(
  eventId: string,
  params: ListParams<ParticipantSortKey>
): Promise<Paged<ParticipantRow> & { adminCount: number }> {
  await requireSuperAdmin()
  const empty = {
    rows: [],
    totalCount: 0,
    totalPages: 1,
    page: 1,
    pageSize: ADMIN_PAGE_SIZE,
    adminCount: 0,
  }
  if (!isUuid(eventId)) return empty

  const searchFilter = params.q
    ? or(
        ilike(users.name, containsPattern(params.q)),
        ilike(users.email, containsPattern(params.q)),
        ilike(users.runescapeName, containsPattern(params.q))
      )
    : undefined
  const where = and(eq(eventParticipants.eventId, eventId), searchFilter)

  const [[totalRow], [adminRow]] = await Promise.all([
    db
      .select({ total: count() })
      .from(eventParticipants)
      .innerJoin(users, eq(eventParticipants.userId, users.id))
      .where(where),
    db
      .select({ total: count() })
      .from(eventParticipants)
      .where(
        and(
          eq(eventParticipants.eventId, eventId),
          eq(eventParticipants.role, "admin")
        )
      ),
  ])
  const totalCount = totalRow?.total ?? 0
  const { totalPages, page, offset } = paginate(totalCount, params.page)

  const sortExpr =
    params.sort === "name"
      ? sql`lower(${users.name})`
      : params.sort === "role"
        ? sql`case ${eventParticipants.role} when 'admin' then 3 when 'management' then 2 else 1 end`
        : eventParticipants.createdAt

  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      runescapeName: users.runescapeName,
      image: users.image,
      role: eventParticipants.role,
      joinedAt: eventParticipants.createdAt,
      isCreator: sql<boolean>`${events.creatorId} = ${users.id}`,
    })
    .from(eventParticipants)
    .innerJoin(users, eq(eventParticipants.userId, users.id))
    .innerJoin(events, eq(eventParticipants.eventId, events.id))
    .where(where)
    .orderBy(...orderBy(sortExpr, params.dir, users.id))
    .limit(ADMIN_PAGE_SIZE)
    .offset(offset)

  return {
    rows: rows.map((r) => ({
      userId: r.userId,
      user: {
        id: r.userId,
        name: r.name,
        runescapeName: r.runescapeName,
        image: r.image,
      },
      role: r.role,
      joinedAt: r.joinedAt,
      isCreator: r.isCreator === true,
    })),
    totalCount,
    totalPages,
    page,
    pageSize: ADMIN_PAGE_SIZE,
    adminCount: adminRow?.total ?? 0,
  }
}

export interface EventStructure {
  teams: { id: string; name: string; memberCount: number }[]
  boards: {
    id: string
    title: string
    rows: number
    columns: number
    visible: boolean
    locked: boolean
  }[]
  teamTotal: number
  boardTotal: number
}

const STRUCTURE_CAP = 100

export async function getEventStructure(
  eventId: string
): Promise<EventStructure> {
  await requireSuperAdmin()
  if (!isUuid(eventId)) {
    return { teams: [], boards: [], teamTotal: 0, boardTotal: 0 }
  }

  const [teamRows, boardRows, [teamTotal], [boardTotal]] = await Promise.all([
    db
      .select({
        id: teams.id,
        name: teams.name,
        memberCount: sqlCount(
          sql`select count(*) from ${teamMembers} where ${teamMembers.teamId} = ${teams.id}`
        ),
      })
      .from(teams)
      .where(eq(teams.eventId, eventId))
      .orderBy(asc(sql`lower(${teams.name})`), asc(teams.id))
      .limit(STRUCTURE_CAP),
    db
      .select({
        id: bingos.id,
        title: bingos.title,
        rows: bingos.rows,
        columns: bingos.columns,
        visible: bingos.visible,
        locked: bingos.locked,
      })
      .from(bingos)
      .where(eq(bingos.eventId, eventId))
      .orderBy(asc(bingos.createdAt), asc(bingos.id))
      .limit(STRUCTURE_CAP),
    db.select({ total: count() }).from(teams).where(eq(teams.eventId, eventId)),
    db
      .select({ total: count() })
      .from(bingos)
      .where(eq(bingos.eventId, eventId)),
  ])

  return {
    teams: teamRows,
    boards: boardRows,
    teamTotal: teamTotal?.total ?? 0,
    boardTotal: boardTotal?.total ?? 0,
  }
}

/* -------------------------------------------------------------------------- */
/* Audit log                                                                   */
/* -------------------------------------------------------------------------- */

export const AUDIT_LIST_CONFIG = {
  sortKeys: ["time"],
  defaultSort: "time",
  defaultDir: "desc",
  filters: ["success", "denied", "failed"],
} as const satisfies ListConfig<"time">

export type AuditSortKey = (typeof AUDIT_LIST_CONFIG.sortKeys)[number]

export interface AuditRow {
  id: string
  createdAt: Date
  actorId: string | null
  actorLabel: string | null
  action: string
  targetType: string
  targetId: string | null
  targetLabel: string | null
  outcome: string
  reason: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}

/** Read-only audit trail. `q` matches the action and the target / actor labels. */
export async function listAuditLog(
  params: ListParams<AuditSortKey>,
  filters: AuditFilters
): Promise<Paged<AuditRow>> {
  await requireSuperAdmin()

  const searchFilter = params.q
    ? or(
        ilike(adminAuditLog.action, containsPattern(params.q)),
        ilike(adminAuditLog.targetLabel, containsPattern(params.q)),
        ilike(adminAuditLog.actorLabel, containsPattern(params.q))
      )
    : undefined
  const where = and(
    searchFilter,
    params.filter
      ? sql`${adminAuditLog.outcome} = ${params.filter}`
      : undefined,
    filters.action ? eq(adminAuditLog.action, filters.action) : undefined,
    filters.actorId ? eq(adminAuditLog.actorId, filters.actorId) : undefined,
    filters.targetType
      ? eq(adminAuditLog.targetType, filters.targetType)
      : undefined,
    filters.targetId ? eq(adminAuditLog.targetId, filters.targetId) : undefined
  )

  const [totalRow] = await db
    .select({ total: count() })
    .from(adminAuditLog)
    .where(where)
  const totalCount = totalRow?.total ?? 0
  const { totalPages, page, offset } = paginate(totalCount, params.page)

  const rows = await db
    .select({
      id: adminAuditLog.id,
      createdAt: adminAuditLog.createdAt,
      actorId: adminAuditLog.actorId,
      actorLabel: adminAuditLog.actorLabel,
      action: adminAuditLog.action,
      targetType: adminAuditLog.targetType,
      targetId: adminAuditLog.targetId,
      targetLabel: adminAuditLog.targetLabel,
      outcome: adminAuditLog.outcome,
      reason: adminAuditLog.reason,
      before: adminAuditLog.before,
      after: adminAuditLog.after,
    })
    .from(adminAuditLog)
    .where(where)
    .orderBy(...orderBy(adminAuditLog.createdAt, params.dir, adminAuditLog.id))
    .limit(ADMIN_PAGE_SIZE)
    .offset(offset)

  return {
    rows,
    totalCount,
    totalPages,
    page,
    pageSize: ADMIN_PAGE_SIZE,
  }
}
