/**
 * @jest-environment node
 *
 * The Discord posts of the team draft on real Postgres (team draft 4/4,
 * #218): each log event is posted once and in order, after the transaction
 * that wrote it committed; a failing webhook cannot touch a pick; the payload
 * has the shape Discord needs.
 */
import { and, asc, eq, sql } from "drizzle-orm"

import {
  makePick,
  startDraft,
  createDraft,
  undoPick,
} from "@/app/actions/draft"
import { sendDiscordWebhook } from "@/lib/discord-webhook"
import { onTurnSlot } from "@/lib/draft/view"
import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import {
  discordWebhooks,
  draftPicks,
  draftPoolEntries,
  drafts,
} from "@/server/db/schema"
import { flushDraftDiscord } from "@/server/draft/discord"
import { performPick } from "@/server/draft/core"
import { sweepExpiredDrafts } from "@/server/draft/expire"
import { loadDraftSnapshot } from "@/server/draft/queries"
import { resetRateLimits } from "@/server/rate-limit"
import {
  createDraftWorld,
  draftSettings,
  startedDraft,
  type DraftWorld,
} from "@/server/__tests__/helpers/draft-fixture"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))
jest.mock("@/lib/discord-webhook", () => ({
  ...jest.requireActual("@/lib/discord-webhook"),
  sendDiscordWebhook: jest.fn(),
}))

const session = getServerAuthSession as jest.Mock
const send = sendDiscordWebhook as jest.Mock
const signInAs = (userId: string | null) =>
  session.mockResolvedValue(userId ? { user: { id: userId } } : null)

const URL_A = "https://discord.com/api/webhooks/1/aaa"
const URL_B = "https://discord.com/api/webhooks/2/bbb"

let w: DraftWorld

beforeEach(async () => {
  resetRateLimits()
  jest.clearAllMocks()
  send.mockResolvedValue(true)
  w = await createDraftWorld({ captains: 2, players: 6 })
  await db.insert(discordWebhooks).values({
    eventId: w.eventId,
    name: "main",
    webhookUrl: URL_A,
    createdBy: w.manager,
  })
})
afterEach(async () => {
  await w.cleanup()
})

/** The first embed of every call, in order. */
const posted = () =>
  send.mock.calls.map(
    ([, payload]) => (payload as { embeds: { title: string }[] }).embeds[0]!
  )
const titles = () => posted().map((embed) => embed.title)

/** Waits until `n` messages went out (the actions post in the background). */
async function waitForPosts(n: number) {
  const deadline = Date.now() + 5000
  while (send.mock.calls.length < n && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  expect(send.mock.calls.length).toBe(n)
}

const draftRow = async (draftId: string) =>
  (await db.select().from(drafts).where(eq(drafts.id, draftId)))[0]!

async function onTurnCaptain(): Promise<string> {
  const snapshot = (await loadDraftSnapshot(w.eventId))!
  return onTurnSlot(snapshot.state)!.captainUserId!
}

const firstAvailable = async (draftId: string) =>
  (
    await db
      .select()
      .from(draftPoolEntries)
      .where(
        and(
          eq(draftPoolEntries.draftId, draftId),
          eq(draftPoolEntries.status, "available")
        )
      )
      .orderBy(asc(draftPoolEntries.id))
      .limit(1)
  )[0]!

async function pickNext(): Promise<void> {
  const snapshot = (await loadDraftSnapshot(w.eventId))!
  const entry = await firstAvailable(snapshot.draftId)
  signInAs(await onTurnCaptain())
  const result = await makePick({
    draftId: snapshot.draftId,
    poolEntryId: entry.id,
  })
  if (!result.success) throw new Error(result.error)
}

describe("posting a draft", () => {
  it("posts the start, every pick and the completion in order", async () => {
    signInAs(w.manager)
    const created = await createDraft({
      eventId: w.eventId,
      ...draftSettings(w, { rounds: 2 }),
    })
    if (!created.success) throw new Error(created.error)
    const started = await startDraft({ draftId: created.draftId })
    if (!started.success) throw new Error(started.error)
    await waitForPosts(1)

    for (let i = 0; i < 4; i += 1) await pickNext()
    // started, 4 picks, completed
    await waitForPosts(6)
    expect(titles()).toEqual([
      "🏁 Team draft started",
      expect.stringMatching(/^🎯 Pick #1: /),
      expect.stringMatching(/^🎯 Pick #2: /),
      expect.stringMatching(/^🎯 Pick #3: /),
      expect.stringMatching(/^🎯 Pick #4: /),
      "✅ Team draft complete",
    ])
    // Every message went to the webhook of the Event.
    expect(send.mock.calls.every(([url]) => url === URL_A)).toBe(true)
  })

  it("sends a pick as a Discord embed with the player, team and rating", async () => {
    const { draftId } = await startedDraft(w, { rounds: 2 })
    await flushDraftDiscord(draftId) // the start
    send.mockClear()

    await pickNext()
    await waitForPosts(1)
    const [url, payload] = send.mock.calls[0] as [
      string,
      { embeds: Record<string, unknown>[]; files?: unknown },
    ]
    expect(url).toBe(URL_A)
    expect(payload.files).toBeUndefined()
    expect(payload.embeds).toHaveLength(1)
    const embed = payload.embeds[0]!
    expect(embed).toEqual({
      title: expect.stringMatching(/^🎯 Pick #1: \w+$/),
      description: expect.stringMatching(
        /^\*\*Team [12]\*\* drafted \*\*\w+\*\*$/
      ),
      color: expect.any(Number),
      fields: [
        {
          name: "🏆 Team",
          value: expect.stringMatching(/^Team [12]$/),
          inline: true,
        },
        { name: "🔁 Round", value: "1", inline: true },
        { name: "⭐ Rating", value: "Unrated", inline: true },
        { name: "🧾 How", value: "Picked by the captain", inline: false },
      ],
      footer: { text: expect.stringMatching(/^draft-.+ • pick 1 of 4$/) },
      timestamp: expect.any(String),
    })
  })

  it("posts an undo", async () => {
    const { draftId } = await startedDraft(w, { rounds: 2 })
    await pickNext()
    // The pick's own flush posts the start and the pick in the background.
    await waitForPosts(2)
    send.mockClear()

    signInAs(w.manager)
    const result = await undoPick({ draftId })
    expect(result.success).toBe(true)
    await waitForPosts(1)
    expect(titles()).toEqual(["↩️ Pick #1 undone"])
  })

  it("posts a pick the timer made, through the sweeper", async () => {
    const { draftId } = await startedDraft(w, {
      rounds: 2,
      pickTimerSeconds: 30,
      onTimeout: "auto_pick",
    })
    await flushDraftDiscord(draftId)
    send.mockClear()

    await db
      .update(drafts)
      .set({ turnDeadline: sql`clock_timestamp() - interval '1 second'` })
      .where(eq(drafts.id, draftId))
    const swept = await sweepExpiredDrafts()
    expect(swept.resolved).toBe(1)
    await waitForPosts(1)
    expect(titles()[0]).toMatch(/^🎯 Pick #1: /)
    expect(posted()[0]).toMatchObject({
      fields: expect.arrayContaining([
        {
          name: "🧾 How",
          value: "Auto-picked when the timer ran out",
          inline: false,
        },
      ]),
    })
  })
})

describe("exactly once", () => {
  it("does not post an event twice, however often it is asked", async () => {
    const { draftId } = await startedDraft(w, { rounds: 2 })
    // The pick's own flush (in the background) races the explicit ones below;
    // whichever claims the events posts them, nobody posts them again.
    await pickNext()
    await Promise.all([
      flushDraftDiscord(draftId),
      flushDraftDiscord(draftId),
      flushDraftDiscord(draftId),
    ])
    await waitForPosts(2)
    await flushDraftDiscord(draftId)
    await new Promise((resolve) => setTimeout(resolve, 100))
    // The start and the pick, once each.
    expect(titles()).toEqual([
      "🏁 Team draft started",
      expect.stringMatching(/^🎯 Pick #1: /),
    ])
  })

  it("posts once when several flushes run at the same time", async () => {
    const { draftId } = await startedDraft(w, { rounds: 2 })
    await Promise.all(
      Array.from({ length: 5 }, () => flushDraftDiscord(draftId))
    )
    expect(titles()).toEqual(["🏁 Team draft started"])
  })

  it("moves the cursor to the last event, posted or not", async () => {
    const { draftId } = await startedDraft(w, { rounds: 2 })
    await flushDraftDiscord(draftId)
    const row = await draftRow(draftId)
    const [last] = await db.execute<{ seq: string }>(
      sql`select max(seq)::text as seq from "bingoscape-next_draft_event" where draft_id = ${draftId}`
    )
    expect(row.discordPostedSeq).toBe(Number(last!.seq))
  })

  it("posts to every active webhook and skips inactive ones", async () => {
    await db.insert(discordWebhooks).values([
      {
        eventId: w.eventId,
        name: "second",
        webhookUrl: URL_B,
        createdBy: w.manager,
      },
      {
        eventId: w.eventId,
        name: "off",
        webhookUrl: "https://discord.com/api/webhooks/3/ccc",
        createdBy: w.manager,
        isActive: false,
      },
    ])
    const { draftId } = await startedDraft(w, { rounds: 2 })
    await flushDraftDiscord(draftId)
    expect(send.mock.calls.map(([url]) => url).sort()).toEqual([URL_A, URL_B])
  })

  it("does not replay the past when a webhook is added later", async () => {
    await db
      .update(discordWebhooks)
      .set({ isActive: false })
      .where(eq(discordWebhooks.eventId, w.eventId))
    const { draftId } = await startedDraft(w, { rounds: 2 })
    await flushDraftDiscord(draftId)
    expect(send).not.toHaveBeenCalled()

    await db
      .update(discordWebhooks)
      .set({ isActive: true })
      .where(eq(discordWebhooks.eventId, w.eventId))
    await flushDraftDiscord(draftId)
    expect(send).not.toHaveBeenCalled()
  })
})

describe("a webhook cannot hurt a pick", () => {
  it("sends nothing from inside the transaction that makes the pick", async () => {
    const { draftId } = await startedDraft(w, { rounds: 2 })
    await flushDraftDiscord(draftId)
    send.mockClear()

    const captain = await w.actorOf(await onTurnCaptain())
    const entry = await firstAvailable(draftId)
    await db.transaction(async (tx) => {
      const result = await performPick(tx, {
        draftId,
        poolEntryId: entry.id,
        actor: captain,
      })
      expect(result.success).toBe(true)
      expect(send).not.toHaveBeenCalled()
    })
    // Only after the commit does the poster see (and send) the pick.
    expect(send).not.toHaveBeenCalled()
    await flushDraftDiscord(draftId)
    expect(titles()).toEqual([expect.stringMatching(/^🎯 Pick #1: /)])
  })

  it.each([
    ["rejects", () => send.mockRejectedValue(new Error("network down"))],
    ["answers with a failure", () => send.mockResolvedValue(false)],
    [
      "throws synchronously",
      () =>
        send.mockImplementation(() => {
          throw new Error("boom")
        }),
    ],
  ])("the pick stands when the webhook %s", async (_name, break_) => {
    const { draftId } = await startedDraft(w, { rounds: 2 })
    await flushDraftDiscord(draftId)
    break_()

    const captainId = await onTurnCaptain()
    const entry = await firstAvailable(draftId)
    signInAs(captainId)
    const result = await makePick({ draftId, poolEntryId: entry.id })
    expect(result).toMatchObject({ success: true, pickNo: 1 })
    await waitForPosts(1)
    // The pick is committed and the draft moved on, whatever Discord did.
    const picks = await db
      .select()
      .from(draftPicks)
      .where(and(eq(draftPicks.draftId, draftId)))
    expect(picks).toHaveLength(1)
    expect((await draftRow(draftId)).currentPickNo).toBe(2)
    // And the next pick works too.
    send.mockResolvedValue(true)
    await pickNext()
    expect((await draftRow(draftId)).currentPickNo).toBe(3)
  })

  it("flushDraftDiscord never throws, not even when the database call fails", async () => {
    await expect(
      flushDraftDiscord("00000000-0000-0000-0000-000000000000")
    ).resolves.toBeUndefined()
    await expect(flushDraftDiscord("not-a-uuid")).resolves.toBeUndefined()
  })
})
