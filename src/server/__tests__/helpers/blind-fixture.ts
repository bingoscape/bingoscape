import { eq } from "drizzle-orm"

import { db } from "@/server/db"
import {
  eventParticipants,
  events,
  goalGroups,
  goals,
  goalValues,
  images,
  itemGoals,
  metricGoals,
  bingos,
  submissions,
  teamGoalProgress,
  teamTileSubmissions,
  tiles,
} from "@/server/db/schema"
import {
  createBattleshipFixture,
  DAY_MS,
  type BattleshipFixture,
} from "@/server/__tests__/helpers/battleship-fixture"

/**
 * A battleship fixture whose Tiles carry recognisable secrets (title,
 * description, image, goals, goal values, a goal group, team progress and a
 * team submission with an image). Tests serialise whatever a read path returns
 * and assert that none of `secrets` is in it.
 */
export interface BlindFixture extends BattleshipFixture {
  /** Distinct per fixture so assertions never match another test's data. */
  tag: string
  /** Every secret string seeded on the Tiles, goals and submissions. */
  secrets: string[]
  /** Title / description of tile i. */
  titleOf: (index: number) => string
  descriptionOf: (index: number) => string
  /** Goal ids seeded on tile 0 (item goal) and tile 1 (metric goal). */
  itemGoalId: string
  metricGoalId: string
  goalGroupId: string
  submissionId: string
  startDate: Date
  endDate: Date
  /** Instants around the Event: before it starts, at, after, after it ended. */
  clock: {
    beforeStart: Date
    atStart: Date
    afterStart: Date
    afterEnd: Date
  }
}

export async function createBlindFixture(
  options: { bingoType?: "standard" | "progression" | "battleship" } = {}
): Promise<BlindFixture> {
  const base = await createBattleshipFixture(options)
  const tag = `zq${Math.random().toString(36).slice(2, 10)}`

  const titleOf = (i: number) => `Secret title ${i} ${tag}`
  const descriptionOf = (i: number) => `Secret description ${i} ${tag}`
  const imageOf = (i: number) => `https://example.test/${tag}-header-${i}.png`

  for (const [index, tileId] of base.tileIds.entries()) {
    await db
      .update(tiles)
      .set({
        title: titleOf(index),
        description: descriptionOf(index),
        headerImage: imageOf(index),
        weight: 77,
      })
      .where(eq(tiles.id, tileId))
  }

  // Boards are only listed to non-managers when visible; the public pages also
  // need a public event. Both are harmless for the other tests.
  await db
    .update(bingos)
    .set({ visible: true })
    .where(eq(bingos.id, base.bingoId))
  await db
    .update(events)
    .set({ public: true })
    .where(eq(events.id, base.eventId))
  await db
    .insert(eventParticipants)
    .values({ eventId: base.eventId, userId: base.managerId, role: "admin" })
    .onConflictDoNothing()

  const [group] = await db
    .insert(goalGroups)
    .values({
      tileId: base.tileIds[0]!,
      name: `Secret group ${tag}`,
      logicalOperator: "AND",
    })
    .returning({ id: goalGroups.id })

  const [itemGoal] = await db
    .insert(goals)
    .values({
      tileId: base.tileIds[0]!,
      description: `Secret item goal ${tag}`,
      targetValue: 3,
      goalType: "item",
    })
    .returning({ id: goals.id })
  await db.insert(itemGoals).values({
    goalId: itemGoal!.id,
    itemId: 4151,
    baseName: `Secret item ${tag}`,
    imageUrl: `https://example.test/${tag}-item.png`,
  })
  await db.insert(goalValues).values({
    goalId: itemGoal!.id,
    value: 2,
    description: `Secret value ${tag}`,
  })

  const [metricGoal] = await db
    .insert(goals)
    .values({
      tileId: base.tileIds[1]!,
      description: `Secret metric goal ${tag}`,
      targetValue: 99,
      goalType: "metric",
    })
    .returning({ id: goals.id })
  await db.insert(metricGoals).values({
    goalId: metricGoal!.id,
    metricType: "skill",
    metricName: `secretskill${tag}`,
  })

  await db.insert(teamGoalProgress).values({
    teamId: base.teamAId,
    goalId: itemGoal!.id,
    currentValue: 1,
  })

  const [tts] = await db
    .insert(teamTileSubmissions)
    .values({
      tileId: base.tileIds[0]!,
      teamId: base.teamAId,
      status: "completed",
      completedAt: new Date(base.startDate.getTime() - 5 * DAY_MS),
    })
    .returning({ id: teamTileSubmissions.id })
  const [image] = await db
    .insert(images)
    .values({ path: `/uploads/secret-${tag}` })
    .returning({ id: images.id })
  const [submission] = await db
    .insert(submissions)
    .values({
      teamTileSubmissionId: tts!.id,
      imageId: image!.id,
      goalId: itemGoal!.id,
      submittedBy: base.memberAId,
      status: "approved",
    })
    .returning({ id: submissions.id })

  const startDate = base.startDate
  const endDate = new Date(startDate.getTime() + DAY_MS)

  return {
    ...base,
    tag,
    secrets: [
      tag,
      ...base.tileIds.flatMap((_, i) => [titleOf(i), descriptionOf(i)]),
    ],
    titleOf,
    descriptionOf,
    itemGoalId: itemGoal!.id,
    metricGoalId: metricGoal!.id,
    goalGroupId: group!.id,
    submissionId: submission!.id,
    startDate,
    endDate,
    clock: {
      beforeStart: new Date(startDate.getTime() - 60 * 60 * 1000),
      atStart: startDate,
      afterStart: new Date(startDate.getTime() + 60 * 60 * 1000),
      afterEnd: new Date(endDate.getTime() + DAY_MS),
    },
  }
}

/** Asserts none of the secrets is anywhere in the serialised value. */
export function expectNoSecrets(value: unknown, secrets: string[]): void {
  const json = JSON.stringify(value)
  for (const secret of secrets) {
    expect(json).not.toContain(secret)
  }
}

/** Asserts the serialised value carries the given secret. */
export function expectSecret(value: unknown, secret: string): void {
  expect(JSON.stringify(value)).toContain(secret)
}
