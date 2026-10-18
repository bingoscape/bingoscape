/**
 * @jest-environment node
 *
 * Cross-Event access: the attacker is the admin of Event 1 (and only a plain
 * participant of Event 2). Every id-taking action is called with a resource of
 * Event 2 -- directly, or mixed with an Event 1 id where the action takes both
 * -- and must answer Forbidden / Not found (mutations), or the empty value
 * (reads), without changing anything. Runs on real Postgres.
 *
 * Every `permission` entry of the policy registry must either have a case below
 * or be listed in EXEMPT with the reason.
 */
import { eq } from "drizzle-orm"
import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"

import * as battleship from "@/app/actions/battleship"
import * as importExport from "@/app/actions/bingo-import-export"
import * as bingo from "@/app/actions/bingo"
import * as clan from "@/app/actions/clan"
import * as draft from "@/app/actions/draft"
import * as webhooks from "@/app/actions/discord-webhooks"
import * as events from "@/app/actions/events"
import * as submissionsRead from "@/app/actions/getSubmissions"
import * as goalBatch from "@/app/actions/goal-batch"
import * as goalGroupActions from "@/app/actions/goal-groups"
import * as goalActions from "@/app/actions/goals"
import * as metadata from "@/app/actions/player-metadata"
import * as balancing from "@/app/actions/team-balancing"
import * as statistics from "@/app/actions/team-statistics"
import * as team from "@/app/actions/team"
import * as templates from "@/app/actions/templates"
import * as tracker from "@/app/actions/tracker"
import {
  GET as commentsGET,
  POST as commentsPOST,
} from "@/app/api/submissions/[id]/comments/route"
import { GET as runeliteBingoGET } from "@/app/api/runelite/bingos/[bingoId]/route"
import { POST as runeliteSubmissionPOST } from "@/app/api/runelite/tiles/[tileId]/submissions/route"
import { POST as runeliteAutoSubmissionPOST } from "@/app/api/runelite/tiles/[tileId]/auto-submissions/route"
import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import {
  bingos,
  discordWebhooks,
  eventDonations,
  eventParticipants,
  eventRules,
  events as eventsTable,
  goalGroups,
  goals,
  goalValues,
  submissions,
  teamMembers,
  teams,
  tiles,
} from "@/server/db/schema"
import { POLICY_REGISTRY } from "@/server/authz/registry"
import {
  createCrossEventFixture,
  type CrossEventFixture,
} from "@/server/__tests__/helpers/cross-event-fixture"

jest.mock("@/server/auth", () => ({
  getServerAuthSession: jest.fn(),
  authOptions: {},
}))
jest.mock("next-auth", () => ({ getServerSession: jest.fn() }))
jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
  unstable_noStore: jest.fn(),
}))
jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))

const session = getServerAuthSession as jest.Mock
const routeSession = getServerSession as jest.Mock

let f: CrossEventFixture
let fetchSpy: jest.SpyInstance

beforeAll(async () => {
  f = await createCrossEventFixture()
  fetchSpy = jest
    .spyOn(global, "fetch")
    .mockResolvedValue(new Response(null, { status: 204 }))
})
afterAll(async () => {
  fetchSpy.mockRestore()
  await f.cleanup()
})

function signInAs(userId: string | null) {
  const value = userId ? { user: { id: userId } } : null
  session.mockResolvedValue(value)
  routeSession.mockResolvedValue(value)
}

// ---------------------------------------------------------------------------
// How a denial looks
// ---------------------------------------------------------------------------

type Outcome = "denied" | "empty"

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined || value === 0) return true
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    // A zeroed result of a read, or the legacy `{ error }` of an export.
    if ("error" in record && !("success" in record)) return true
    return Object.keys(record).length === 0
  }
  return false
}

/** Mutations answer `{ success: false, code }` (or throw an AuthzError). */
function expectDenied(result: unknown) {
  const r = result as { success?: boolean; code?: string; error?: string }
  expect(r).toMatchObject({ success: false })
  expect(["FORBIDDEN", "NOT_FOUND", "INVALID"]).toContain(r.code)
}

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

interface Case {
  /** Registry key of what is called. */
  key: string
  /** Builds the call from the fixture. */
  call: (fx: CrossEventFixture) => Promise<unknown>
  expect: Outcome
  /** Describes the foreign id(s) passed. */
  note?: string
}

const A = "src/app/actions/"
const key = (file: string, name: string) => `${A}${file}#${name}`

const formData = (entries: Record<string, string>) => {
  const data = new FormData()
  for (const [k, v] of Object.entries(entries)) data.append(k, v)
  return data
}

const UNKNOWN_UUID = "00000000-0000-4000-8000-000000000000"

const CASES: Case[] = [
  // --- events -------------------------------------------------------------
  {
    key: key("events.ts", "updateEvent"),
    call: (x) =>
      events.updateEvent(x.event2.id, {
        title: "Hijacked",
        description: null,
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        registrationDeadline: null,
        minimumBuyIn: 0,
        basePrizePool: 0,
      }),
    expect: "denied",
  },
  {
    key: key("events.ts", "deleteEventByAdmin"),
    call: (x) => events.deleteEventByAdmin(x.event2.id),
    expect: "denied",
  },
  {
    key: key("events.ts", "assignEventToClan"),
    call: (x) => events.assignEventToClan(x.event2.id, UNKNOWN_UUID),
    expect: "denied",
  },
  {
    key: key("events.ts", "generateEventInviteLink"),
    call: (x) => events.generateEventInviteLink(x.event2.id),
    expect: "denied",
  },
  {
    key: key("events.ts", "joinEvent"),
    call: (x) => events.joinEvent(x.event2.id, true),
    expect: "denied",
    note: "the registration override of another Event",
  },
  {
    key: key("events.ts", "getPendingRegistrationCount"),
    call: (x) => events.getPendingRegistrationCount(x.event2.id),
    expect: "empty",
  },
  {
    key: key("events.ts", "getRegistrationRequests"),
    call: (x) => events.getRegistrationRequests(x.event2.id),
    expect: "empty",
  },
  {
    key: key("events.ts", "approveRegistrationRequest"),
    call: (x) =>
      events.approveRegistrationRequest(x.event2Extra.registrationRequestId),
    expect: "denied",
  },
  {
    key: key("events.ts", "rejectRegistrationRequest"),
    call: (x) =>
      events.rejectRegistrationRequest(x.event2Extra.registrationRequestId),
    expect: "denied",
  },
  {
    key: key("events.ts", "getEventParticipants"),
    call: (x) => events.getEventParticipants(x.event2.id),
    expect: "empty",
  },
  {
    key: key("events.ts", "updateParticipantRole"),
    call: (x) =>
      events.updateParticipantRole(x.event2.id, x.users.admin, "admin"),
    expect: "denied",
  },
  {
    key: key("events.ts", "transferEventOwnership"),
    call: (x) => events.transferEventOwnership(x.event2.id, x.users.admin),
    expect: "denied",
  },
  {
    key: key("events.ts", "assignParticipantToTeam"),
    call: (x) =>
      events.assignParticipantToTeam(x.event2.id, x.users.admin, x.event2.teamId),
    expect: "denied",
  },
  {
    key: key("events.ts", "removeParticipantFromEvent"),
    call: (x) => events.removeParticipantFromEvent(x.event2.id, x.users.admin),
    expect: "denied",
  },
  {
    key: key("events.ts", "addClanMembersToEvent"),
    call: (x) => events.addClanMembersToEvent(x.event2.id, [x.users.outsider]),
    expect: "denied",
  },
  {
    key: key("events.ts", "updateParticipantBuyIn"),
    call: (x) => events.updateParticipantBuyIn(x.event2.id, x.users.admin, true),
    expect: "denied",
  },
  {
    key: key("events.ts", "addParticipantDonation"),
    call: (x) =>
      events.addParticipantDonation(x.event2.id, x.users.admin, 5, "x"),
    expect: "denied",
  },
  {
    key: key("events.ts", "updateParticipantDonation"),
    call: (x) =>
      events.updateParticipantDonation(
        x.event1.id,
        x.event2Extra.donationId,
        9999,
        "own Event, foreign donation"
      ),
    expect: "denied",
    note: "Event 1 id with a donation of Event 2",
  },
  {
    key: key("events.ts", "removeParticipantDonation"),
    call: (x) =>
      events.removeParticipantDonation(x.event1.id, x.event2Extra.donationId),
    expect: "denied",
    note: "Event 1 id with a donation of Event 2 (nothing is deleted)",
  },
  {
    key: key("events.ts", "getParticipantDonations"),
    call: (x) => events.getParticipantDonations(x.event2.id, x.users.admin),
    expect: "empty",
  },
  {
    key: key("events.ts", "createEventRule"),
    call: (x) => events.createEventRule(x.event2.id, "A new rule"),
    expect: "denied",
  },
  {
    key: key("events.ts", "updateEventRule"),
    call: (x) =>
      events.updateEventRule(x.event2Extra.ruleId, x.event2.id, "Changed"),
    expect: "denied",
  },
  {
    key: key("events.ts", "deleteEventRule"),
    call: (x) => events.deleteEventRule(x.event2Extra.ruleId, x.event2.id),
    expect: "denied",
  },
  // --- team draft ---------------------------------------------------------
  {
    key: key("draft.ts", "createDraft"),
    call: (x) =>
      draft.createDraft({
        eventId: x.event2.id,
        orderType: "snake",
        rounds: 2,
        pickTimerSeconds: null,
        onTimeout: "auto_pick",
        autoPickRule: "best_rated",
        captains: [
          { userId: x.users.admin, teamName: "A" },
          { userId: x.users.outsider, teamName: "B" },
        ],
      }),
    expect: "denied",
  },
  {
    key: key("draft.ts", "startDraft"),
    call: (x) => draft.startDraft({ draftId: x.event2Extra.draftId }),
    expect: "denied",
  },
  {
    key: key("draft.ts", "pauseDraft"),
    call: (x) => draft.pauseDraft({ draftId: x.event2Extra.draftId }),
    expect: "denied",
  },
  {
    key: key("draft.ts", "resumeDraft"),
    call: (x) => draft.resumeDraft({ draftId: x.event2Extra.draftId }),
    expect: "denied",
  },
  {
    key: key("draft.ts", "cancelDraft"),
    call: (x) => draft.cancelDraft({ draftId: x.event2Extra.draftId }),
    expect: "denied",
  },
  {
    key: key("draft.ts", "forcePick"),
    call: (x) =>
      draft.forcePick({
        draftId: x.event2Extra.draftId,
        poolEntryId: UNKNOWN_UUID,
      }),
    expect: "denied",
  },
  {
    key: key("draft.ts", "skipTurn"),
    call: (x) => draft.skipTurn({ draftId: x.event2Extra.draftId }),
    expect: "denied",
  },
  {
    key: key("draft.ts", "undoPick"),
    call: (x) => draft.undoPick({ draftId: x.event2Extra.draftId }),
    expect: "denied",
  },
  {
    key: key("draft.ts", "applyDraft"),
    call: (x) => draft.applyDraft({ draftId: x.event2Extra.draftId }),
    expect: "denied",
  },
  // --- clans --------------------------------------------------------------
  {
    key: key("clan.ts", "getClanMembersForEvent"),
    call: (x) => clan.getClanMembersForEvent(x.event2.id),
    expect: "denied",
  },
  // --- teams --------------------------------------------------------------
  {
    key: key("team.ts", "createTeam"),
    call: (x) => team.createTeam(x.event2.id, "Intruders"),
    expect: "denied",
  },
  {
    key: key("team.ts", "addUserToTeam"),
    call: (x) => team.addUserToTeam(x.event2.teamId, x.users.outsider),
    expect: "denied",
  },
  {
    key: key("team.ts", "removeUserFromTeam"),
    call: (x) => team.removeUserFromTeam(x.event2.teamId, x.users.outsider),
    expect: "denied",
  },
  {
    key: key("team.ts", "deleteTeam"),
    call: (x) => team.deleteTeam(x.event2.teamId),
    expect: "denied",
  },
  {
    key: key("team.ts", "updateTeamName"),
    call: (x) => team.updateTeamName(x.event2.teamId, "Renamed"),
    expect: "denied",
  },
  {
    key: key("team.ts", "updateTeamMember"),
    call: (x) => team.updateTeamMember(x.event2.teamId, x.users.admin, true),
    expect: "denied",
  },
  {
    key: key("team.ts", "getEventParticipants"),
    call: (x) => team.getEventParticipants(x.event2.id),
    expect: "empty",
  },
  {
    key: key("team.ts", "assignParticipantToTeam"),
    call: (x) =>
      team.assignParticipantToTeam(x.event1.id, x.users.participant, x.event2.teamId),
    expect: "denied",
    note: "a Team of Event 2 for a participant of Event 1",
  },
  {
    key: key("team-balancing.ts", "generateBalancedTeams"),
    call: (x) =>
      balancing.generateBalancedTeams(x.event2.id, {
        generationMethod: "teamCount",
        teamCount: 2,
        teamNamePrefix: "T",
      }),
    expect: "denied",
  },
  {
    key: key("team-balancing.ts", "calculateTeamBalanceMetrics"),
    call: (x) => balancing.calculateTeamBalanceMetrics(x.event2.id),
    expect: "empty",
  },
  {
    key: key("team-balancing.ts", "canUseBalancedGeneration"),
    call: async (x) => (await balancing.canUseBalancedGeneration(x.event2.id)) || null,
    expect: "empty",
  },
  {
    key: key("team-statistics.ts", "getEventTeamStatistics"),
    call: (x) => statistics.getEventTeamStatistics(x.event2.id),
    expect: "empty",
  },
  // --- player metadata ----------------------------------------------------
  {
    key: key("player-metadata.ts", "getPlayerMetadata"),
    call: (x) => metadata.getPlayerMetadata(x.users.otherCreator, x.event2.id),
    expect: "empty",
    note: "another player's metadata, as a mere participant",
  },
  {
    key: key("player-metadata.ts", "getEventParticipantMetadata"),
    call: (x) => metadata.getEventParticipantMetadata(x.event2.id),
    expect: "empty",
  },
  {
    key: key("player-metadata.ts", "updatePlayerMetadata"),
    call: (x) =>
      metadata.updatePlayerMetadata(x.users.admin, x.event2.id, { ehp: 1 }),
    expect: "denied",
  },
  {
    key: key("player-metadata.ts", "deletePlayerMetadata"),
    call: (x) => metadata.deletePlayerMetadata(x.users.admin, x.event2.id),
    expect: "denied",
  },
  {
    key: key("player-metadata.ts", "calculateMetadataCoverage"),
    call: (x) => metadata.calculateMetadataCoverage(x.event2.id),
    expect: "empty",
  },
  {
    key: key("player-metadata.ts", "fetchWOMDataForPlayer"),
    call: (x) =>
      metadata.fetchWOMDataForPlayer(x.users.admin, x.event2.id, "Zezima"),
    expect: "denied",
  },
  // --- boards, tiles ------------------------------------------------------
  {
    key: key("bingo.ts", "createBingo"),
    call: (x) =>
      bingo.createBingo(
        formData({
          eventId: x.event2.id,
          title: "Planted",
          rows: "1",
          columns: "1",
          codephrase: "x",
        })
      ),
    expect: "denied",
  },
  {
    key: key("bingo.ts", "deleteBingo"),
    call: (x) => bingo.deleteBingo(x.event2.bingoId),
    expect: "denied",
  },
  {
    key: key("bingo.ts", "updateBingo"),
    call: (x) => bingo.updateBingo(x.event2.bingoId, { title: "Hijacked" } as never),
    expect: "denied",
  },
  {
    key: key("bingo.ts", "getBingoWithPatternBonuses"),
    call: (x) => bingo.getBingoWithPatternBonuses(x.event2.bingoId),
    expect: "denied",
  },
  {
    key: key("bingo.ts", "updateTile"),
    call: (x) => bingo.updateTile(x.event2.tileId, { title: "Hijacked" }),
    expect: "denied",
  },
  {
    key: key("bingo.ts", "reorderTiles"),
    call: (x) =>
      bingo.reorderTiles([
        { id: x.event1.tileId, index: 0 },
        { id: x.event2.tileId, index: 1 },
      ]),
    expect: "denied",
    note: "an Event 1 Tile mixed with a Tile of Event 2",
  },
  {
    key: key("bingo.ts", "addRowOrColumn"),
    call: (x) => bingo.addRowOrColumn(x.event2.bingoId, "row"),
    expect: "denied",
  },
  {
    key: key("bingo.ts", "deleteRowOrColumn"),
    call: (x) => bingo.deleteRowOrColumn(x.event2.bingoId, "row"),
    expect: "denied",
  },
  {
    key: key("bingo.ts", "addTile"),
    call: (x) => bingo.addTile(x.event2.bingoId),
    expect: "denied",
  },
  {
    key: key("bingo.ts", "deleteTile"),
    call: (x) => bingo.deleteTile(x.event2.tileId, x.event2.bingoId),
    expect: "denied",
  },
  {
    key: key("bingo.ts", "updateTileTier"),
    call: (x) => bingo.updateTileTier(x.event2.tileId, 1),
    expect: "denied",
  },
  {
    key: key("bingo.ts", "getTierXpRequirements"),
    call: (x) => bingo.getTierXpRequirements(x.event2.bingoId),
    expect: "empty",
  },
  {
    key: key("bingo.ts", "setTierXpRequirement"),
    call: (x) => bingo.setTierXpRequirement(x.event2.bingoId, 0, 5),
    expect: "denied",
  },
  {
    key: key("bingo.ts", "initializeTierXpRequirements"),
    call: (x) => bingo.initializeTierXpRequirements(x.event2.bingoId),
    expect: "denied",
  },
  {
    key: key("bingo.ts", "createNewTier"),
    call: (x) => bingo.createNewTier(x.event2.bingoId),
    expect: "denied",
  },
  {
    key: key("bingo.ts", "deleteTier"),
    call: (x) => bingo.deleteTier(x.event2.bingoId, 0),
    expect: "denied",
  },
  {
    key: key("bingo.ts", "initializeTeamTierProgress"),
    call: (x) =>
      bingo.initializeTeamTierProgress(x.event1.teamAId, x.event2.bingoId),
    expect: "denied",
    note: "a Team of Event 1 with a Board of Event 2",
  },
  {
    key: key("bingo.ts", "checkAndUnlockNextTier"),
    call: (x) =>
      bingo.checkAndUnlockNextTier(x.event1.teamAId, x.event2.bingoId),
    expect: "denied",
    note: "a Team of Event 1 with a Board of Event 2",
  },
  {
    key: key("bingo-import-export.ts", "exportBingoBoard"),
    call: (x) => importExport.exportBingoBoard(x.event2.bingoId),
    expect: "empty",
    note: "answers { error } and no data",
  },
  {
    key: key("bingo-import-export.ts", "importBingoBoard"),
    call: (x) => importExport.importBingoBoard(x.event2.id, {}),
    expect: "denied",
  },
  {
    key: key("battleship.ts", "saveTeamShipPlacements"),
    call: (x) =>
      battleship.saveTeamShipPlacements(x.event2.bingoId, x.event2.teamId, []),
    expect: "denied",
  },
  {
    key: key("battleship.ts", "updateBingoShipRules"),
    call: (x) => battleship.updateBingoShipRules(x.event2.bingoId, []),
    expect: "denied",
  },
  {
    key: key("tracker.ts", "syncTrackerProgress"),
    call: (x) => tracker.syncTrackerProgress(x.event2.bingoId),
    expect: "denied",
  },
  {
    key: key("tracker.ts", "createWiseOldManCompetition"),
    call: (x) =>
      tracker.createWiseOldManCompetition(x.event2.bingoId, "overall"),
    expect: "denied",
  },
  {
    key: key("tracker.ts", "linkWiseOldManCompetition"),
    call: (x) => tracker.linkWiseOldManCompetition(x.event2.bingoId, 1),
    expect: "denied",
  },
  {
    key: key("tracker.ts", "unlinkWiseOldManCompetition"),
    call: (x) => tracker.unlinkWiseOldManCompetition(x.event2.bingoId),
    expect: "denied",
  },
  // --- goals --------------------------------------------------------------
  {
    key: key("bingo.ts", "createGoals"),
    call: (x) =>
      bingo.createGoals(x.event2.tileId, [
        { type: "generic", description: "Planted", targetValue: 1 },
      ]),
    expect: "denied",
  },
  {
    key: key("bingo.ts", "addGoal"),
    call: (x) =>
      bingo.addGoal(x.event2.tileId, { description: "Planted", targetValue: 1 }),
    expect: "denied",
  },
  {
    key: key("bingo.ts", "createItemGoal"),
    call: (x) =>
      bingo.createItemGoal(x.event2.tileId, 1, "Item", "Item", "img", 1),
    expect: "denied",
  },
  {
    key: key("bingo.ts", "createMetricGoal"),
    call: (x) =>
      bingo.createMetricGoal(x.event2.tileId, "overall", "Overall", 10),
    expect: "denied",
  },
  {
    key: key("bingo.ts", "updateGoal"),
    call: (x) => bingo.updateGoal(x.event2.goalId, { description: "Hijacked" }),
    expect: "denied",
  },
  {
    key: key("bingo.ts", "updateMetricGoal"),
    call: (x) =>
      bingo.updateMetricGoal(x.event2.goalId, "overall", "Overall", 10),
    expect: "denied",
  },
  {
    key: key("bingo.ts", "updateItemGoal"),
    call: (x) =>
      bingo.updateItemGoal(x.event2.goalId, 1, "Item", "Item", "img"),
    expect: "denied",
  },
  {
    key: key("bingo.ts", "deleteGoal"),
    call: (x) => bingo.deleteGoal(x.event2.goalId),
    expect: "denied",
  },
  {
    key: key("bingo.ts", "updateGoalProgress"),
    call: (x) =>
      bingo.updateGoalProgress(x.event1.goalId, x.event2.teamId, 99),
    expect: "denied",
    note: "a Goal of Event 1 with a Team of Event 2",
  },
  {
    key: key("goal-batch.ts", "applyGoalsToTiles"),
    call: (x) =>
      goalBatch.applyGoalsToTiles(x.event2.bingoId, [x.event2.tileId], {
        kind: "goals",
        goals: [{ type: "generic", description: "Planted", targetValue: 1 }],
      }),
    expect: "denied",
  },
  {
    key: key("goal-groups.ts", "createGoalGroup"),
    call: (x) => goalGroupActions.createGoalGroup(x.event2.tileId, "AND"),
    expect: "denied",
  },
  {
    key: key("goal-groups.ts", "updateGoalGroup"),
    call: (x) =>
      goalGroupActions.updateGoalGroup(x.event2Extra.goalGroupId, {
        name: "Hijacked",
      }),
    expect: "denied",
  },
  {
    key: key("goal-groups.ts", "deleteGoalGroup"),
    call: (x) => goalGroupActions.deleteGoalGroup(x.event2Extra.goalGroupId),
    expect: "denied",
  },
  {
    key: key("goal-groups.ts", "moveGoalToGroup"),
    call: (x) =>
      goalGroupActions.moveGoalToGroup(x.event1.goalId, x.event2Extra.goalGroupId),
    expect: "denied",
    note: "a Goal of Event 1 into a group of Event 2",
  },
  {
    key: key("goal-groups.ts", "moveGroupToGroup"),
    call: (x) =>
      goalGroupActions.moveGroupToGroup(
        x.event1.goalGroupId,
        x.event2Extra.goalGroupId
      ),
    expect: "denied",
    note: "a group of Event 1 into a group of Event 2",
  },
  {
    key: key("goal-groups.ts", "reorderItems"),
    call: (x) =>
      goalGroupActions.reorderItems([
        { id: x.event1.goalId, type: "goal", orderIndex: 0 },
        { id: x.event2.goalId, type: "goal", orderIndex: 1 },
      ]),
    expect: "denied",
    note: "a Goal of Event 1 mixed with one of Event 2",
  },
  {
    key: key("goal-groups.ts", "moveMultipleItems"),
    call: (x) =>
      goalGroupActions.moveMultipleItems(
        [{ id: x.event1.goalId, type: "goal" }],
        x.event2Extra.goalGroupId
      ),
    expect: "denied",
    note: "a Goal of Event 1 into a group of Event 2",
  },
  {
    key: key("goals.ts", "addGoalValue"),
    call: (x) => goalActions.addGoalValue(x.event2.goalId, 5, "Planted"),
    expect: "denied",
  },
  {
    key: key("goals.ts", "deleteGoalValue"),
    call: (x) => goalActions.deleteGoalValue(x.event2Extra.goalValueId),
    expect: "denied",
  },
  {
    key: key("goals.ts", "updateSubmissionGoalAndValue"),
    call: (x) =>
      goalActions.updateSubmissionGoalAndValue(
        x.event1.submissionId,
        x.event2.goalId,
        5
      ),
    expect: "denied",
    note: "a Submission of Event 1 assigned to a Goal of Event 2",
  },
  // --- submissions --------------------------------------------------------
  {
    key: key("bingo.ts", "updateSubmissionStatus"),
    call: (x) =>
      bingo.updateSubmissionStatus(x.event2Extra.submissionId, "approved"),
    expect: "denied",
  },
  {
    key: key("bingo.ts", "updateSubmissionStatusWithComment"),
    call: (x) =>
      bingo.updateSubmissionStatusWithComment(
        x.event2Extra.submissionId,
        "needs_review",
        "A comment of ten characters"
      ),
    expect: "denied",
  },
  {
    key: key("bingo.ts", "updateTeamTileSubmissionStatus"),
    call: (x) =>
      bingo.updateTeamTileSubmissionStatus(
        x.event2Extra.teamTileSubmissionId,
        "completed"
      ),
    expect: "denied",
  },
  {
    key: key("bingo.ts", "deleteSubmission"),
    call: (x) => bingo.deleteSubmission(x.event2Extra.submissionId),
    expect: "denied",
  },
  {
    key: key("getSubmissions.ts", "getEventSubmissions"),
    call: (x) => submissionsRead.getEventSubmissions(x.event2.id),
    expect: "empty",
  },
  {
    key: key("bingo.ts", "getAllSubmissionsForTeam"),
    call: (x) =>
      bingo.getAllSubmissionsForTeam(x.event2.bingoId, x.event2.teamId),
    expect: "empty",
  },
  {
    key: key("bingo.ts", "getSelectableUsersForSubmission"),
    call: (x) =>
      bingo.getSelectableUsersForSubmission(x.event2.id, x.event2.teamId),
    expect: "empty",
  },
  {
    key: key("bingo.ts", "submitImage"),
    call: (x) =>
      bingo.submitImage(
        formData({
          tileId: x.event2.tileId,
          teamId: x.event2.teamId,
          image: "not-a-file",
        })
      ),
    expect: "denied",
    note: "a missing image already fails; see EXEMPT_NOTES for the full path",
  },
  // --- webhooks -----------------------------------------------------------
  {
    key: key("discord-webhooks.ts", "getDiscordWebhooks"),
    call: (x) => webhooks.getDiscordWebhooks(x.event2.id),
    expect: "empty",
  },
  {
    key: key("discord-webhooks.ts", "createDiscordWebhook"),
    call: (x) =>
      webhooks.createDiscordWebhook(
        x.event2.id,
        "x",
        "https://discord.com/api/webhooks/1/abc"
      ),
    expect: "denied",
  },
  {
    key: key("discord-webhooks.ts", "updateDiscordWebhook"),
    call: (x) =>
      webhooks.updateDiscordWebhook(x.event2Extra.webhookId, { name: "x" }),
    expect: "denied",
  },
  {
    key: key("discord-webhooks.ts", "deleteDiscordWebhook"),
    call: (x) => webhooks.deleteDiscordWebhook(x.event2Extra.webhookId),
    expect: "denied",
  },
  {
    key: key("discord-webhooks.ts", "testWebhook"),
    call: (x) => webhooks.testWebhook(x.event2Extra.webhookId),
    expect: "denied",
  },
  // --- templates ----------------------------------------------------------
  {
    key: key("templates.ts", "saveBingoAsTemplate"),
    call: (x) =>
      templates.saveBingoAsTemplate(x.event2.bingoId, {
        title: "Stolen board",
        description: "x",
        category: "other",
        tags: "",
        isPublic: true,
      }),
    expect: "denied",
  },
]

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

const R = "src/app/api/"

interface RouteCase {
  key: string
  call: (fx: CrossEventFixture) => Promise<Response>
  status: number[]
}

function apiRequest(
  url: string,
  apiKey: string,
  init: { method: string; body?: FormData | string }
) {
  return new NextRequest(`http://localhost${url}`, {
    method: init.method,
    headers: { Authorization: `Bearer ${apiKey}` },
    body: init.body,
  })
}

const ROUTE_CASES: RouteCase[] = [
  {
    key: `${R}submissions/[id]/comments/route.ts#GET`,
    call: (x) =>
      commentsGET(
        new NextRequest("http://localhost/api/submissions/x/comments"),
        { params: Promise.resolve({ id: x.event2Extra.submissionId }) }
      ),
    status: [404],
  },
  {
    key: `${R}submissions/[id]/comments/route.ts#POST`,
    call: (x) =>
      commentsPOST(
        new NextRequest("http://localhost/api/submissions/x/comments", {
          method: "POST",
          body: JSON.stringify({ comment: "A comment of ten characters" }),
        }),
        { params: Promise.resolve({ id: x.event2Extra.submissionId }) }
      ),
    status: [404],
  },
  {
    key: `${R}runelite/bingos/[bingoId]/route.ts#GET`,
    call: (x) =>
      runeliteBingoGET(
        apiRequest(`/api/runelite/bingos/${x.event2.bingoId}`, x.adminApiKey, {
          method: "GET",
        }),
        { params: Promise.resolve({ bingoId: x.event2.bingoId }) }
      ),
    // The plugin answers 404 for a Board of an Event the key's owner is not in
    // as a member of; here the owner is a participant, but the Board is read
    // like any participant would.
    status: [200, 404],
  },
  {
    key: `${R}runelite/tiles/[tileId]/submissions/route.ts#POST`,
    call: (x) => {
      const body = new FormData()
      body.append("image", new Blob(["x"], { type: "image/png" }), "x.png")
      return runeliteSubmissionPOST(
        apiRequest(
          `/api/runelite/tiles/${x.event2.tileId}/submissions`,
          x.adminApiKey,
          { method: "POST", body }
        ),
        { params: Promise.resolve({ tileId: x.event2.tileId }) }
      )
    },
    // A participant of Event 2 without a Team there: no Team to submit for.
    status: [400, 403, 404],
  },
  {
    key: `${R}runelite/tiles/[tileId]/auto-submissions/route.ts#POST`,
    call: (x) => {
      const body = new FormData()
      body.append("image", new Blob(["x"], { type: "image/png" }), "x.png")
      return runeliteAutoSubmissionPOST(
        apiRequest(
          `/api/runelite/tiles/${x.event2.tileId}/auto-submissions`,
          x.adminApiKey,
          { method: "POST", body }
        ),
        { params: Promise.resolve({ tileId: x.event2.tileId }) }
      )
    },
    status: [400, 403, 404],
  },
]

// ---------------------------------------------------------------------------
// Exemptions: registry `permission` entries without a case, and why.
// ---------------------------------------------------------------------------

const EXEMPT: Record<string, string> = {
  [key("events.ts", "getEventRules")]:
    "event:view: the attacker is a legitimate participant of Event 2, so the read is allowed",
  [key("player-metadata.ts", "updateOwnPlayerMetadata")]:
    "always writes the caller's own row, and the attacker is a participant of Event 2",
  [key("templates.ts", "importTemplateIntoEvent")]:
    "needs a stored template; the permission is enforced by importBingoBoard, which has a case",
  [key("draft.ts", "setPickQueue")]:
    "draft:view: the attacker is a legitimate participant of Event 2; only a captain of a Team of the draft may queue (draft-timer.test.ts)",
  [key("draft.ts", "makePick")]:
    "draft:view: the attacker is a legitimate participant of Event 2; whether they may pick (only the on-turn captain) is covered in draft.test.ts and draft-concurrency.test.ts",
  [`${R}events/[id]/draft/state/route.ts#GET`]:
    "draft:view: the attacker is a legitimate participant of Event 2, so the read is allowed; non-members get 403 (draft-state.test.ts)",
  [`${R}events/[id]/draft/recap-image/route.ts#GET`]:
    "draft:view: the attacker is a legitimate participant of Event 2, so the read is allowed; non-members get 403 (draft-recap-image.test.ts)",
  [`${R}events/[id]/draft/stream/route.ts#GET`]:
    "draft:view: the attacker is a legitimate participant of Event 2, so the stream opens; non-members get 403 (draft-stream.test.ts)",
  [key("bingo.ts", "submitImage")]:
    "the case above stops at the missing image; the member / manager rules of the full path are covered in blind-board-submit.test.ts and bingo-authz.test.ts",
}

describe("cross-Event access", () => {
  beforeEach(() => {
    signInAs(f.users.admin)
    jest.clearAllMocks()
    signInAs(f.users.admin)
  })

  it.each(CASES.map((c) => [c.key.replace(A, ""), c] as const))(
    "%s refuses a resource of another Event",
    async (_name, c) => {
      let outcome: unknown
      try {
        outcome = await c.call(f)
      } catch (error) {
        // Throwing an AuthzError is a denial too.
        expect((error as Error).name).toBe("AuthzError")
        return
      }
      if (c.expect === "denied") expectDenied(outcome)
      else expect(isEmpty(outcome)).toBe(true)
    }
  )

  it.each(ROUTE_CASES.map((c) => [c.key.replace(R, ""), c] as const))(
    "%s refuses a resource of another Event",
    async (_name, c) => {
      const response = await c.call(f)
      expect(c.status).toContain(response.status)
    }
  )

  it("covers every permission-guarded entry point of the registry", () => {
    const covered = new Set([
      ...CASES.map((c) => c.key),
      ...ROUTE_CASES.map((c) => c.key),
      ...Object.keys(EXEMPT),
    ])
    const missing = Object.entries(POLICY_REGISTRY)
      .filter(([, entry]) => entry.kind === "permission")
      .map(([k]) => k)
      .filter((k) => !covered.has(k))
    expect(missing).toEqual([])
  })

  it("keeps the exemption list honest", () => {
    const stale = Object.keys(EXEMPT).filter((k) => !(k in POLICY_REGISTRY))
    expect(stale).toEqual([])
    expect(Object.values(EXEMPT).every((reason) => reason.length > 10)).toBe(
      true
    )
  })

  it("changed nothing in Event 2", async () => {
    const [event] = await db
      .select({ title: eventsTable.title, clanId: eventsTable.clanId })
      .from(eventsTable)
      .where(eq(eventsTable.id, f.event2.id))
    expect(event?.title).toMatch(/^authz-2-/)
    expect(event?.clanId).toBeNull()

    const board = await db.query.bingos.findFirst({
      where: eq(bingos.id, f.event2.bingoId),
    })
    expect(board?.title).toBe("Board 2")
    expect(
      await db.query.tiles.findMany({ where: eq(tiles.bingoId, f.event2.bingoId) })
    ).toHaveLength(1)
    expect(
      await db.query.bingos.findMany({ where: eq(bingos.eventId, f.event2.id) })
    ).toHaveLength(1)

    expect(
      await db.query.goals.findMany({ where: eq(goals.tileId, f.event2.tileId) })
    ).toHaveLength(1)
    expect(
      (await db.query.goals.findFirst({ where: eq(goals.id, f.event2.goalId) }))
        ?.description
    ).toBe("Goal 2")
    expect(
      await db.query.goalGroups.findMany({
        where: eq(goalGroups.tileId, f.event2.tileId),
      })
    ).toHaveLength(1)
    expect(
      await db.query.goalValues.findFirst({
        where: eq(goalValues.id, f.event2Extra.goalValueId),
      })
    ).toBeDefined()
    expect(
      (
        await db.query.submissions.findFirst({
          where: eq(submissions.id, f.event2Extra.submissionId),
        })
      )?.status
    ).toBe("pending")
    expect(
      await db.query.discordWebhooks.findFirst({
        where: eq(discordWebhooks.id, f.event2Extra.webhookId),
      })
    ).toMatchObject({ name: "hook" })
    expect(
      (
        await db.query.eventDonations.findFirst({
          where: eq(eventDonations.id, f.event2Extra.donationId),
        })
      )?.amount
    ).toBe(100)
    expect(
      (
        await db.query.eventRules.findFirst({
          where: eq(eventRules.id, f.event2Extra.ruleId),
        })
      )?.content
    ).toBe("Be nice")
    expect(
      await db.query.teams.findMany({ where: eq(teams.eventId, f.event2.id) })
    ).toHaveLength(1)
    expect(
      await db.query.teamMembers.findMany({
        where: eq(teamMembers.teamId, f.event2.teamId),
      })
    ).toHaveLength(0)
    const participants = await db.query.eventParticipants.findMany({
      where: eq(eventParticipants.eventId, f.event2.id),
    })
    expect(participants).toHaveLength(1)
    expect(participants[0]?.role).toBe("participant")
  })
})
