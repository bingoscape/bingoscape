import { eq, inArray } from "drizzle-orm"

import { db } from "@/server/db"
import {
  bingos,
  eventParticipants,
  events,
  goalGroups,
  goals,
  goalValues,
  images,
  submissions,
  teamMembers,
  teams,
  teamTileSubmissions,
  tiles,
  users,
} from "@/server/db/schema"

/**
 * A committed multi-Event fixture for authorization tests on real Postgres.
 *
 * Event 1 (owned by `creator`, whose participant row says plain `participant`
 * on purpose, so the "creator counts as admin" rule is exercised):
 *   admin, management, participant, creator, leaderA, memberA, memberB
 *   Team A (leaderA leads, memberA), Team B (memberB)
 *   one Board, Tile, Goal group, Goal, Goal value, Team A submission
 *
 * Event 2 (owned by `otherCreator`, who has no participant row at all):
 *   `admin` is only a plain participant there; `outsider` is in neither Event.
 *   one Board, Tile and Goal
 */
export interface AuthzFixture {
  users: {
    creator: string
    admin: string
    management: string
    participant: string
    leaderA: string
    memberA: string
    memberB: string
    outsider: string
    otherCreator: string
  }
  event1: {
    id: string
    teamAId: string
    teamBId: string
    bingoId: string
    tileId: string
    goalId: string
    goalGroupId: string
    goalValueId: string
    teamTileSubmissionId: string
    submissionId: string
  }
  event2: {
    id: string
    teamId: string
    bingoId: string
    tileId: string
    goalId: string
  }
  cleanup: () => Promise<void>
}

const NAMES = [
  "creator",
  "admin",
  "management",
  "participant",
  "leaderA",
  "memberA",
  "memberB",
  "outsider",
  "otherCreator",
] as const

export async function createAuthzFixture(): Promise<AuthzFixture> {
  const suffix = Math.random().toString(36).slice(2)
  const startDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000)

  const created = await db
    .insert(users)
    .values(
      NAMES.map((name) => ({ name, email: `${name}-${suffix}@example.test` }))
    )
    .returning({ id: users.id, email: users.email })
  const idOf = (name: (typeof NAMES)[number]) =>
    created.find((u) => u.email === `${name}-${suffix}@example.test`)!.id
  const u = Object.fromEntries(
    NAMES.map((n) => [n, idOf(n)])
  ) as AuthzFixture["users"]

  const [e1, e2] = await db
    .insert(events)
    .values([
      {
        title: `authz-1-${suffix}`,
        startDate,
        endDate,
        creatorId: u.creator,
      },
      {
        title: `authz-2-${suffix}`,
        startDate,
        endDate,
        creatorId: u.otherCreator,
      },
    ])
    .returning({ id: events.id, title: events.title })
  const event1Id = e1!.id
  const event2Id = e2!.id

  await db.insert(eventParticipants).values([
    { eventId: event1Id, userId: u.creator, role: "participant" },
    { eventId: event1Id, userId: u.admin, role: "admin" },
    { eventId: event1Id, userId: u.management, role: "management" },
    { eventId: event1Id, userId: u.participant, role: "participant" },
    { eventId: event1Id, userId: u.leaderA, role: "participant" },
    { eventId: event1Id, userId: u.memberA, role: "participant" },
    { eventId: event1Id, userId: u.memberB, role: "participant" },
    { eventId: event2Id, userId: u.admin, role: "participant" },
  ])

  const [teamA, teamB, teamC] = await db
    .insert(teams)
    .values([
      { eventId: event1Id, name: "Team A" },
      { eventId: event1Id, name: "Team B" },
      { eventId: event2Id, name: "Team C" },
    ])
    .returning({ id: teams.id })
  await db.insert(teamMembers).values([
    { teamId: teamA!.id, userId: u.leaderA, isLeader: true },
    { teamId: teamA!.id, userId: u.memberA },
    { teamId: teamB!.id, userId: u.memberB },
  ])

  const [b1, b2] = await db
    .insert(bingos)
    .values([
      {
        eventId: event1Id,
        title: "Board 1",
        rows: 1,
        columns: 1,
        codephrase: "code-1",
      },
      {
        eventId: event2Id,
        title: "Board 2",
        rows: 1,
        columns: 1,
        codephrase: "code-2",
      },
    ])
    .returning({ id: bingos.id })
  const [t1, t2] = await db
    .insert(tiles)
    .values([
      {
        bingoId: b1!.id,
        title: "Tile 1",
        description: "Tile 1",
        weight: 1,
        index: 0,
        isHidden: false,
      },
      {
        bingoId: b2!.id,
        title: "Tile 2",
        description: "Tile 2",
        weight: 1,
        index: 0,
        isHidden: false,
      },
    ])
    .returning({ id: tiles.id })

  const [group] = await db
    .insert(goalGroups)
    .values({ tileId: t1!.id, name: "Group", logicalOperator: "AND" })
    .returning({ id: goalGroups.id })
  const [g1, g2] = await db
    .insert(goals)
    .values([
      {
        tileId: t1!.id,
        description: "Goal 1",
        targetValue: 1,
        goalType: "item",
      },
      {
        tileId: t2!.id,
        description: "Goal 2",
        targetValue: 1,
        goalType: "item",
      },
    ])
    .returning({ id: goals.id })
  const [value] = await db
    .insert(goalValues)
    .values({ goalId: g1!.id, value: 1, description: "Value" })
    .returning({ id: goalValues.id })

  const [tts] = await db
    .insert(teamTileSubmissions)
    .values({ tileId: t1!.id, teamId: teamA!.id, status: "incomplete" })
    .returning({ id: teamTileSubmissions.id })
  const [image] = await db
    .insert(images)
    .values({ path: `/uploads/authz-${suffix}` })
    .returning({ id: images.id })
  const [submission] = await db
    .insert(submissions)
    .values({
      teamTileSubmissionId: tts!.id,
      imageId: image!.id,
      goalId: g1!.id,
      submittedBy: u.memberA,
      status: "pending",
    })
    .returning({ id: submissions.id })

  return {
    users: u,
    event1: {
      id: event1Id,
      teamAId: teamA!.id,
      teamBId: teamB!.id,
      bingoId: b1!.id,
      tileId: t1!.id,
      goalId: g1!.id,
      goalGroupId: group!.id,
      goalValueId: value!.id,
      teamTileSubmissionId: tts!.id,
      submissionId: submission!.id,
    },
    event2: {
      id: event2Id,
      teamId: teamC!.id,
      bingoId: b2!.id,
      tileId: t2!.id,
      goalId: g2!.id,
    },
    cleanup: async () => {
      await db.delete(events).where(inArray(events.id, [event1Id, event2Id]))
      await db.delete(images).where(eq(images.id, image!.id))
      await db.delete(users).where(
        inArray(
          users.id,
          created.map((c) => c.id)
        )
      )
    },
  }
}
