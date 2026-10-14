import { eq } from "drizzle-orm"

import { db } from "@/server/db"
import {
  bingos,
  events,
  goals,
  images,
  itemGoals,
  submissions,
  teamGoalProgress,
  teamTileSubmissions,
  tiles,
} from "@/server/db/schema"
import {
  createAuthzFixture,
  type AuthzFixture,
} from "@/server/__tests__/helpers/authz-fixture"

/**
 * Builds on the authz fixture (Event 1 with its roles and two Teams) for the
 * read policy tests. Event 1 starts in 24 hours and is private until
 * `setPublic(true)`. It gets:
 *
 * - Board 1 (standard, visible) with a visible Tile (from the authz fixture),
 *   a hidden Tile, a codephrase and a tracker verification code
 * - a draft Board (not visible) with one Tile
 * - a battleship Board (visible, blind until the Event starts) with one Tile
 * - approved item Submissions on the visible and on the hidden Tile (Team A)
 * - goal progress for Team A and Team B on the visible Tile's Goal
 *
 * Every title carries `tag`, so a test can search a serialised result for it.
 */
export interface ReadFixture extends AuthzFixture {
  tag: string
  codephrase: string
  verificationCode: string
  boards: { standardId: string; draftId: string; shipId: string }
  tileIds: {
    visible: string
    hidden: string
    draft: string
    ship: string
  }
  goalIds: { visible: string; hidden: string; ship: string }
  titles: { visible: string; hidden: string; draft: string; ship: string }
  /** Path of the image of the Team A Submission on the visible Tile. */
  imagePath: string
  /** Path of the image of the Team A Submission on the hidden Tile. */
  hiddenImagePath: string
  setPublic: (value: boolean) => Promise<void>
}

export async function createReadFixture(): Promise<ReadFixture> {
  const base = await createAuthzFixture()
  const tag = `rp${Math.random().toString(36).slice(2, 10)}`
  const titles = {
    visible: `Visible ${tag}`,
    hidden: `Hidden ${tag}`,
    draft: `Draft ${tag}`,
    ship: `Ship ${tag}`,
  }
  const codephrase = `phrase-${tag}`
  const verificationCode = `wom-${tag}`

  await db
    .update(bingos)
    .set({
      visible: true,
      codephrase,
      womVerificationCode: verificationCode,
      womCompetitionId: 4242,
    })
    .where(eq(bingos.id, base.event1.bingoId))
  await db
    .update(tiles)
    .set({ title: titles.visible, description: `Description ${tag}` })
    .where(eq(tiles.id, base.event1.tileId))

  const [draft, ship] = await db
    .insert(bingos)
    .values([
      {
        eventId: base.event1.id,
        title: `Draft board ${tag}`,
        rows: 1,
        columns: 1,
        codephrase: `draft-${tag}`,
        visible: false,
      },
      {
        eventId: base.event1.id,
        title: `Ship board ${tag}`,
        rows: 1,
        columns: 1,
        codephrase: `ship-${tag}`,
        bingoType: "battleship",
        visible: true,
      },
    ])
    .returning({ id: bingos.id })

  const [hiddenTile, draftTile, shipTile] = await db
    .insert(tiles)
    .values([
      {
        bingoId: base.event1.bingoId,
        title: titles.hidden,
        description: `Hidden description ${tag}`,
        weight: 3,
        index: 1,
        isHidden: true,
      },
      {
        bingoId: draft!.id,
        title: titles.draft,
        description: `Draft description ${tag}`,
        weight: 1,
        index: 0,
        isHidden: false,
      },
      {
        bingoId: ship!.id,
        title: titles.ship,
        description: `Ship description ${tag}`,
        weight: 1,
        index: 0,
        isHidden: false,
      },
    ])
    .returning({ id: tiles.id })

  const [hiddenGoal, shipGoal] = await db
    .insert(goals)
    .values([
      {
        tileId: hiddenTile!.id,
        description: `Hidden goal ${tag}`,
        targetValue: 1,
        goalType: "item",
      },
      {
        tileId: shipTile!.id,
        description: `Ship goal ${tag}`,
        targetValue: 1,
        goalType: "item",
      },
    ])
    .returning({ id: goals.id })

  await db.insert(itemGoals).values([
    {
      goalId: base.event1.goalId,
      itemId: 4151,
      baseName: `Whip ${tag}`,
      imageUrl: "https://example.test/whip.png",
    },
    {
      goalId: hiddenGoal!.id,
      itemId: 11802,
      baseName: `Godsword ${tag}`,
      imageUrl: "https://example.test/godsword.png",
    },
  ])

  // The authz fixture's Submission on the visible Tile becomes an approved item
  // Submission; Team A gets one on the hidden Tile too.
  await db
    .update(submissions)
    .set({ status: "approved" })
    .where(eq(submissions.id, base.event1.submissionId))
  const [hiddenTts] = await db
    .insert(teamTileSubmissions)
    .values({
      tileId: hiddenTile!.id,
      teamId: base.event1.teamAId,
      status: "completed",
    })
    .returning({ id: teamTileSubmissions.id })
  const hiddenImagePath = `/uploads/hidden-${tag}`
  const [hiddenImage] = await db
    .insert(images)
    .values({ path: hiddenImagePath })
    .returning({ id: images.id })
  await db.insert(submissions).values({
    teamTileSubmissionId: hiddenTts!.id,
    imageId: hiddenImage!.id,
    goalId: hiddenGoal!.id,
    submittedBy: base.users.memberA,
    status: "approved",
  })

  await db.insert(teamGoalProgress).values([
    {
      teamId: base.event1.teamAId,
      goalId: base.event1.goalId,
      currentValue: 1,
    },
    {
      teamId: base.event1.teamBId,
      goalId: base.event1.goalId,
      currentValue: 1,
    },
  ])

  const [visibleImage] = await db
    .select({ path: images.path })
    .from(images)
    .innerJoin(submissions, eq(submissions.imageId, images.id))
    .where(eq(submissions.id, base.event1.submissionId))

  return {
    ...base,
    tag,
    codephrase,
    verificationCode,
    boards: {
      standardId: base.event1.bingoId,
      draftId: draft!.id,
      shipId: ship!.id,
    },
    tileIds: {
      visible: base.event1.tileId,
      hidden: hiddenTile!.id,
      draft: draftTile!.id,
      ship: shipTile!.id,
    },
    goalIds: {
      visible: base.event1.goalId,
      hidden: hiddenGoal!.id,
      ship: shipGoal!.id,
    },
    titles,
    imagePath: visibleImage!.path,
    hiddenImagePath,
    setPublic: async (value) => {
      await db
        .update(events)
        .set({ public: value })
        .where(eq(events.id, base.event1.id))
    },
    cleanup: async () => {
      // Deleting the Events cascades to the extra Boards, Tiles and Submissions.
      await base.cleanup()
      await db.delete(images).where(eq(images.id, hiddenImage!.id))
    },
  }
}
