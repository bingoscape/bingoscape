import "server-only"

import {
  and,
  asc,
  desc,
  eq,
  ilike,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

import type { RegistrationRequest } from "@/app/actions/events"
import type { EventRole } from "@/lib/authz/roles"
import { hasPermission } from "@/server/authz"
import { db } from "@/server/db"
import {
  eventBuyIns,
  eventDonations,
  eventParticipants,
  eventRegistrationRequests,
  events,
  playerMetadata,
  teamMembers,
  teams,
  users,
} from "@/server/db/schema"

/**
 * Participant and registration-request reads for the management views. One
 * SQL statement per page instead of five queries per participant; filtering,
 * sorting and paging happen in the database.
 *
 * Not a "use server" module: nothing here is callable from the client. Like the
 * other reads, a denial reads as an empty result (see `@/server/authz/guards`).
 */

export type PaymentStatus = "unpaid" | "partial" | "paid"

export const PARTICIPANT_SORT_FIELDS = [
  "name",
  "role",
  "team",
  "buyIn",
  "donations",
  "status",
] as const
export type ParticipantSortField = (typeof PARTICIPANT_SORT_FIELDS)[number]

export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

export interface ParticipantListFilters {
  /** Matches the (overridden) RuneScape name or the original one. */
  q?: string
  role?: EventRole
  /** `"none"` for participants without a team, else a team id. */
  team?: string
  payment?: PaymentStatus
  sort?: ParticipantSortField
  dir?: "asc" | "desc"
  page?: number
  pageSize?: number
}

export interface ParticipantRow {
  /** The user id. */
  id: string
  runescapeName: string
  hasOverride: boolean
  originalRunescapeName: string
  role: EventRole
  teamId: string | null
  teamName: string | null
  /** Paid so far. */
  buyIn: number
  /** What the participant owes (the row's snapshot, else the Event's minimum). */
  expectedBuyIn: number
  paymentStatus: PaymentStatus
  totalDonations: number
  skillLevel: string | null
  hasMetadata: boolean
}

export interface ParticipantPage {
  rows: ParticipantRow[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Escapes the characters that are special in a LIKE pattern. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/**
 * The payment state from what was paid and what is owed. A free Event (owed 0)
 * counts as paid for everybody, as the buy-in checkbox always did.
 */
export function paymentStatusOf(
  amount: number,
  expected: number
): PaymentStatus {
  if (amount >= expected) return "paid"
  return amount > 0 ? "partial" : "unpaid"
}

function paymentStatusSql(amount: SQL, expected: SQL): SQL<PaymentStatus> {
  return sql<PaymentStatus>`(case
    when ${amount} >= ${expected} then 'paid'
    when ${amount} > 0 then 'partial'
    else 'unpaid' end)`
}

const emptyPage = (page: number, pageSize: number): ParticipantPage => ({
  rows: [],
  total: 0,
  page,
  pageSize,
  pageCount: 0,
})

function normalizePaging(filters: ParticipantListFilters) {
  const pageSize = Math.min(
    Math.max(Math.trunc(filters.pageSize ?? DEFAULT_PAGE_SIZE), 1),
    MAX_PAGE_SIZE
  )
  const page = Math.max(Math.trunc(filters.page ?? 1), 1)
  return { page, pageSize }
}

/** The joined, filterable participant relation of one Event. */
function participantRelation(eventId: string) {
  const participantTeam = db
    .select({
      userId: teamMembers.userId,
      teamId: teams.id,
      teamName: teams.name,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(eq(teams.eventId, eventId))
    .as("participant_team")

  const participantDonations = db
    .select({
      participantId: eventDonations.eventParticipantId,
      total: sql<number>`sum(${eventDonations.amount})`
        .mapWith(Number)
        .as("total"),
    })
    .from(eventDonations)
    .groupBy(eventDonations.eventParticipantId)
    .as("participant_donations")

  const name = sql<string>`coalesce(${playerMetadata.runescapeNameOverride}, ${users.runescapeName}, '')`
  const paid = sql<number>`coalesce(${eventBuyIns.amount}, 0)`
  const expected = sql<number>`coalesce(${eventBuyIns.expectedAmount}, ${events.minimumBuyIn})`
  const donations = sql<number>`coalesce(${participantDonations.total}, 0)`
  const status = paymentStatusSql(paid, expected)

  return {
    participantTeam,
    participantDonations,
    name,
    paid,
    expected,
    donations,
    status,
  }
}

function filterConditions(
  eventId: string,
  filters: ParticipantListFilters,
  rel: ReturnType<typeof participantRelation>
): SQL | undefined {
  const conditions: (SQL | undefined)[] = [
    eq(eventParticipants.eventId, eventId),
  ]
  const q = filters.q?.trim()
  if (q) {
    const pattern = `%${escapeLike(q)}%`
    conditions.push(
      or(sql`${rel.name} ilike ${pattern}`, ilike(users.runescapeName, pattern))
    )
  }
  if (filters.role) conditions.push(eq(eventParticipants.role, filters.role))
  if (filters.team === "none") {
    conditions.push(isNull(rel.participantTeam.userId))
  } else if (filters.team) {
    conditions.push(eq(rel.participantTeam.teamId, filters.team))
  }
  if (filters.payment) {
    conditions.push(sql`${rel.status} = ${filters.payment}`)
  }
  return and(...conditions)
}

function orderBy(
  filters: ParticipantListFilters,
  rel: ReturnType<typeof participantRelation>
): SQL[] {
  const direction = filters.dir === "desc" ? desc : asc
  const lowerName = sql`lower(${rel.name})`
  const rank = (expression: SQL) => direction(expression)
  const primary: SQL | undefined = (() => {
    switch (filters.sort) {
      case "role":
        return rank(sql`(case ${eventParticipants.role}
          when 'admin' then 0 when 'management' then 1 else 2 end)`)
      case "team":
        return sql`lower(${rel.participantTeam.teamName}) ${
          filters.dir === "desc" ? sql`desc` : sql`asc`
        } nulls last`
      case "buyIn":
        return rank(rel.paid)
      case "donations":
        return rank(rel.donations)
      case "status":
        return rank(sql`(case ${rel.status}
          when 'paid' then 2 when 'partial' then 1 else 0 end)`)
      case "name":
      default:
        return rank(lowerName)
    }
  })()
  // Stable paging: break ties by name, then by user.
  return [
    ...(primary ? [primary] : []),
    asc(lowerName),
    asc(eventParticipants.userId),
  ]
}

type ListRow = {
  id: string
  role: EventRole
  runescapeName: string
  override: string | null
  original: string | null
  teamId: string | null
  teamName: string | null
  paid: number
  expected: number
  donations: number
  skillLevel: string | null
  metadataId: string | null
}

function toRow(r: ListRow): ParticipantRow {
  const paid = Number(r.paid)
  const expected = Number(r.expected)
  return {
    id: r.id,
    runescapeName: r.runescapeName,
    hasOverride: !!r.override,
    originalRunescapeName: r.original ?? "",
    role: r.role,
    teamId: r.teamId,
    teamName: r.teamName,
    buyIn: paid,
    expectedBuyIn: expected,
    paymentStatus: paymentStatusOf(paid, expected),
    totalDonations: Number(r.donations),
    skillLevel: r.skillLevel,
    hasMetadata: r.metadataId !== null,
  }
}

async function selectParticipants(
  eventId: string,
  filters: ParticipantListFilters,
  paging?: { page: number; pageSize: number }
) {
  const rel = participantRelation(eventId)
  const query = db
    .select({
      id: eventParticipants.userId,
      role: eventParticipants.role,
      runescapeName: rel.name,
      override: playerMetadata.runescapeNameOverride,
      original: users.runescapeName,
      teamId: rel.participantTeam.teamId,
      teamName: rel.participantTeam.teamName,
      paid: rel.paid.mapWith(Number),
      expected: rel.expected.mapWith(Number),
      donations: rel.donations.mapWith(Number),
      skillLevel: playerMetadata.skillLevel,
      metadataId: playerMetadata.id,
    })
    .from(eventParticipants)
    .innerJoin(users, eq(users.id, eventParticipants.userId))
    .innerJoin(events, eq(events.id, eventParticipants.eventId))
    .leftJoin(
      playerMetadata,
      and(
        eq(playerMetadata.userId, eventParticipants.userId),
        eq(playerMetadata.eventId, eventParticipants.eventId)
      )
    )
    .leftJoin(
      eventBuyIns,
      eq(eventBuyIns.eventParticipantId, eventParticipants.id)
    )
    .leftJoin(
      rel.participantDonations,
      eq(rel.participantDonations.participantId, eventParticipants.id)
    )
    .leftJoin(
      rel.participantTeam,
      eq(rel.participantTeam.userId, eventParticipants.userId)
    )
    .where(filterConditions(eventId, filters, rel))
    .orderBy(...orderBy(filters, rel))
    .$dynamic()

  const rows = paging
    ? await query
        .limit(paging.pageSize)
        .offset((paging.page - 1) * paging.pageSize)
    : await query
  return rows.map(toRow)
}

async function countParticipants(
  eventId: string,
  filters: ParticipantListFilters
): Promise<number> {
  const rel = participantRelation(eventId)
  const [row] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(eventParticipants)
    .innerJoin(users, eq(users.id, eventParticipants.userId))
    .innerJoin(events, eq(events.id, eventParticipants.eventId))
    .leftJoin(
      playerMetadata,
      and(
        eq(playerMetadata.userId, eventParticipants.userId),
        eq(playerMetadata.eventId, eventParticipants.eventId)
      )
    )
    .leftJoin(
      eventBuyIns,
      eq(eventBuyIns.eventParticipantId, eventParticipants.id)
    )
    .leftJoin(
      rel.participantDonations,
      eq(rel.participantDonations.participantId, eventParticipants.id)
    )
    .leftJoin(
      rel.participantTeam,
      eq(rel.participantTeam.userId, eventParticipants.userId)
    )
    .where(filterConditions(eventId, filters, rel))
  return row?.count ?? 0
}

function invalidFilters(filters: ParticipantListFilters): boolean {
  return !!filters.team && filters.team !== "none" && !UUID.test(filters.team)
}

/** One page of an Event's participants. Managers only. */
export async function listParticipants(
  eventId: string,
  filters: ParticipantListFilters = {}
): Promise<ParticipantPage> {
  const { page, pageSize } = normalizePaging(filters)
  if (!(await hasPermission(eventId, "participant:list"))) {
    return emptyPage(page, pageSize)
  }
  if (invalidFilters(filters)) return emptyPage(page, pageSize)

  const total = await countParticipants(eventId, filters)
  if (total === 0) return emptyPage(1, pageSize)

  // A page past the end shows the last one instead of nothing.
  const pageCount = Math.ceil(total / pageSize)
  const current = Math.min(page, pageCount)
  const rows = await selectParticipants(eventId, filters, {
    page: current,
    pageSize,
  })
  return { rows, total, page: current, pageSize, pageCount }
}

/** Every participant of an Event, unpaged (selectors, exports). Managers only. */
export async function listAllParticipants(
  eventId: string,
  filters: Omit<ParticipantListFilters, "page" | "pageSize"> = {}
): Promise<ParticipantRow[]> {
  if (!(await hasPermission(eventId, "participant:list"))) return []
  if (invalidFilters(filters)) return []
  return selectParticipants(eventId, filters)
}

export interface RegistrationListFilters {
  status?: "pending" | "approved" | "rejected"
  q?: string
}

/** An Event's registration requests, newest first. Reviewers only. */
export async function listRegistrationRequests(
  eventId: string,
  filters: RegistrationListFilters = {}
): Promise<RegistrationRequest[]> {
  if (!(await hasPermission(eventId, "registration:review"))) return []

  const reviewer = alias(users, "reviewer")
  const conditions: (SQL | undefined)[] = [
    eq(eventRegistrationRequests.eventId, eventId),
  ]
  if (filters.status) {
    conditions.push(eq(eventRegistrationRequests.status, filters.status))
  }
  const q = filters.q?.trim()
  if (q) {
    const pattern = `%${escapeLike(q)}%`
    conditions.push(
      or(
        ilike(users.name, pattern),
        ilike(users.email, pattern),
        ilike(users.runescapeName, pattern),
        ilike(eventRegistrationRequests.message, pattern)
      )
    )
  }

  const rows = await db
    .select({
      request: eventRegistrationRequests,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        runescapeName: users.runescapeName,
      },
      event: { id: events.id, title: events.title },
      reviewer: { id: reviewer.id, name: reviewer.name },
    })
    .from(eventRegistrationRequests)
    .innerJoin(users, eq(users.id, eventRegistrationRequests.userId))
    .innerJoin(events, eq(events.id, eventRegistrationRequests.eventId))
    .leftJoin(reviewer, eq(reviewer.id, eventRegistrationRequests.reviewedBy))
    .where(and(...conditions))
    .orderBy(
      desc(eventRegistrationRequests.createdAt),
      desc(eventRegistrationRequests.id)
    )

  return rows.map(({ request, user, event, reviewer: by }) => ({
    ...request,
    user,
    event,
    reviewer: by && by.id ? by : null,
  }))
}

export interface ParticipantsOverview {
  participants: number
  onTeam: number
  unassigned: number
  registrations: { pending: number; approved: number; rejected: number }
  payment: {
    paid: number
    partial: number
    unpaid: number
    expectedTotal: number
    paidTotal: number
    outstanding: number
  }
  metadata: {
    withMetadata: number
    /** Share of participants with a metadata row, 0-100. */
    coverage: number
    fields: {
      ehp: number
      ehb: number
      timezone: number
      dailyHours: number
      skillLevel: number
    }
  }
}

const emptyOverview = (): ParticipantsOverview => ({
  participants: 0,
  onTeam: 0,
  unassigned: 0,
  registrations: { pending: 0, approved: 0, rejected: 0 },
  payment: {
    paid: 0,
    partial: 0,
    unpaid: 0,
    expectedTotal: 0,
    paidTotal: 0,
    outstanding: 0,
  },
  metadata: {
    withMetadata: 0,
    coverage: 0,
    fields: { ehp: 0, ehb: 0, timezone: 0, dailyHours: 0, skillLevel: 0 },
  },
})

/**
 * Counts for the management header: who is in, who has no team, who has paid
 * and how complete the player data is. Two grouped queries. Managers only;
 * the registration counts need the review permission and read 0 without it.
 */
export async function getParticipantsOverview(
  eventId: string
): Promise<ParticipantsOverview> {
  if (!(await hasPermission(eventId, "participant:list"))) {
    return emptyOverview()
  }

  const rel = participantRelation(eventId)
  const count = (condition?: SQL) =>
    condition
      ? sql<number>`count(*) filter (where ${condition})`.mapWith(Number)
      : sql<number>`count(*)`.mapWith(Number)
  const sum = (expression: SQL) =>
    sql<number>`coalesce(sum(${expression}), 0)`.mapWith(Number)

  const [row] = await db
    .select({
      participants: count(),
      onTeam: count(sql`${rel.participantTeam.userId} is not null`),
      paid: count(sql`${rel.status} = 'paid'`),
      partial: count(sql`${rel.status} = 'partial'`),
      unpaid: count(sql`${rel.status} = 'unpaid'`),
      expectedTotal: sum(rel.expected),
      paidTotal: sum(rel.paid),
      outstanding: sum(sql`greatest(${rel.expected} - ${rel.paid}, 0)`),
      withMetadata: count(sql`${playerMetadata.id} is not null`),
      ehp: count(sql`${playerMetadata.ehp} is not null`),
      ehb: count(sql`${playerMetadata.ehb} is not null`),
      timezone: count(sql`${playerMetadata.timezone} is not null`),
      dailyHours: count(sql`${playerMetadata.dailyHoursAvailable} is not null`),
      skillLevel: count(sql`${playerMetadata.skillLevel} is not null`),
    })
    .from(eventParticipants)
    .innerJoin(events, eq(events.id, eventParticipants.eventId))
    .leftJoin(
      playerMetadata,
      and(
        eq(playerMetadata.userId, eventParticipants.userId),
        eq(playerMetadata.eventId, eventParticipants.eventId)
      )
    )
    .leftJoin(
      eventBuyIns,
      eq(eventBuyIns.eventParticipantId, eventParticipants.id)
    )
    .leftJoin(
      rel.participantTeam,
      eq(rel.participantTeam.userId, eventParticipants.userId)
    )
    .where(eq(eventParticipants.eventId, eventId))

  const overview = emptyOverview()
  if (!row) return overview

  overview.participants = row.participants
  overview.onTeam = row.onTeam
  overview.unassigned = row.participants - row.onTeam
  overview.payment = {
    paid: row.paid,
    partial: row.partial,
    unpaid: row.unpaid,
    expectedTotal: row.expectedTotal,
    paidTotal: row.paidTotal,
    outstanding: row.outstanding,
  }
  overview.metadata = {
    withMetadata: row.withMetadata,
    coverage:
      row.participants === 0
        ? 0
        : Math.round((row.withMetadata / row.participants) * 100),
    fields: {
      ehp: row.ehp,
      ehb: row.ehb,
      timezone: row.timezone,
      dailyHours: row.dailyHours,
      skillLevel: row.skillLevel,
    },
  }

  if (await hasPermission(eventId, "registration:review")) {
    const grouped = await db
      .select({
        status: eventRegistrationRequests.status,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(eventRegistrationRequests)
      .where(eq(eventRegistrationRequests.eventId, eventId))
      .groupBy(eventRegistrationRequests.status)
    for (const { status, count: n } of grouped) {
      overview.registrations[status] = n
    }
  }
  return overview
}

export interface ParticipantsEventInfo {
  title: string
  minimumBuyIn: number
  clanId: string | null
}

/** The few Event fields the participant views need (not the whole Event graph). */
export async function getParticipantsEventInfo(
  eventId: string
): Promise<ParticipantsEventInfo | null> {
  const [row] = await db
    .select({
      title: events.title,
      minimumBuyIn: events.minimumBuyIn,
      clanId: events.clanId,
    })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1)
  return row ?? null
}
