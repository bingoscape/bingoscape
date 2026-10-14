import { z } from "zod"

import {
  DRAFT_AUTO_PICK_RULES,
  DRAFT_ON_TIMEOUT,
  DRAFT_ORDER_TYPES,
} from "./constants"

/**
 * Draft setup: the input of `createDraft` (shared by the form and the server
 * action) and the order preview ("24 players, 4 teams, 6 rounds, 0 leftover").
 */

export const MAX_DRAFT_CAPTAINS = 32
export const MAX_DRAFT_ROUNDS = 50
export const MAX_PICK_TIMER_SECONDS = 3600

export const draftCaptainSchema = z.object({
  userId: z.string().uuid(),
  teamName: z.string().trim().min(1, "Team name is required").max(255),
})

export const draftSettingsSchema = z.object({
  orderType: z.enum(DRAFT_ORDER_TYPES),
  rounds: z.number().int().min(1).max(MAX_DRAFT_ROUNDS),
  /** Seconds per pick; null (or 0 in the form) means no timer. */
  pickTimerSeconds: z
    .number()
    .int()
    .min(1)
    .max(MAX_PICK_TIMER_SECONDS)
    .nullable(),
  onTimeout: z.enum(DRAFT_ON_TIMEOUT),
  autoPickRule: z.enum(DRAFT_AUTO_PICK_RULES),
  /** Captains in setup order. */
  captains: z
    .array(draftCaptainSchema)
    .min(2, "A draft needs at least two captains")
    .max(MAX_DRAFT_CAPTAINS),
})

export type DraftSettingsInput = z.infer<typeof draftSettingsSchema>

export interface DraftSetupSummary {
  /** Players the captains can pick from (unassigned participants, no captains). */
  players: number
  teams: number
  rounds: number
  /** Players nobody gets to pick (the draft runs out of rounds first). */
  leftover: number
  /** Picks the rounds call for beyond the pool; the draft ends when the pool is empty. */
  shortfall: number
}

export function summarizeDraftSetup(input: {
  poolSize: number
  captains: number
  rounds: number
}): DraftSetupSummary {
  const picks = input.captains * input.rounds
  return {
    players: input.poolSize,
    teams: input.captains,
    rounds: input.rounds,
    leftover: Math.max(0, input.poolSize - picks),
    shortfall: Math.max(0, picks - input.poolSize),
  }
}

export function describeDraftSetup(summary: DraftSetupSummary): string {
  const plural = (n: number, word: string) =>
    `${n} ${word}${n === 1 ? "" : "s"}`
  const text = `${plural(summary.players, "player")}, ${plural(summary.teams, "team")}, ${plural(summary.rounds, "round")}, ${summary.leftover} leftover`
  return summary.shortfall > 0
    ? `${text} (${plural(summary.shortfall, "pick")} short: the pool runs out first)`
    : text
}
