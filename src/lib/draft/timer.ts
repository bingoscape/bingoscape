/**
 * The pick countdown on the client (team draft 3/4, #217). The deadline is
 * database time; the browser's clock is only used to measure how far it is
 * from the server's (`clockOffsetMs`), so a wrong local clock changes nothing
 * and nobody can lengthen or shorten a turn from the client. Pure, so the
 * rules are unit tested and `turn-timer.tsx` stays thin.
 */

/** The countdown turns amber at this many seconds left... */
export const WARNING_SECONDS = 10
/** ...and red at this many. */
export const DANGER_SECONDS = 5

/** Server time minus client time, from a server timestamp received now. */
export function clockOffsetMs(
  serverNowIso: string | null | undefined,
  clientNowMs: number
): number | null {
  if (!serverNowIso) return null
  const serverMs = Date.parse(serverNowIso)
  return Number.isFinite(serverMs) ? serverMs - clientNowMs : null
}

export interface CountdownInput {
  /** ISO database time the turn ends; null: no timer, or paused. */
  deadline: string | null
  /** Time frozen on the turn while the draft is paused. */
  pausedRemainingMs: number | null
  paused: boolean
  clientNowMs: number
  clockOffsetMs: number
}

/** Milliseconds left on the turn (never below 0), or null when untimed. */
export function remainingMs(input: CountdownInput): number | null {
  if (input.paused) return input.pausedRemainingMs
  if (!input.deadline) return null
  const deadlineMs = Date.parse(input.deadline)
  if (!Number.isFinite(deadlineMs)) return null
  const serverNow = input.clientNowMs + input.clockOffsetMs
  return Math.max(0, deadlineMs - serverNow)
}

/** Whole seconds shown on the clock: a turn with 0.2 s left still reads 0:01. */
export function secondsLeft(ms: number): number {
  return Math.ceil(Math.max(0, ms) / 1000)
}

export function formatCountdown(ms: number): string {
  const total = secondsLeft(ms)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

export type TimerTone = "normal" | "warning" | "danger"

export function timerTone(ms: number): TimerTone {
  const seconds = secondsLeft(ms)
  if (seconds <= DANGER_SECONDS) return "danger"
  if (seconds <= WARNING_SECONDS) return "warning"
  return "normal"
}

/**
 * The step a screen reader announcement belongs to: the smallest of 5, 10,
 * 30, 60, 90 ... (every 30 s, then 10 s and 5 s) that is not below the
 * seconds left. An announcement is made when the step changes, never once per
 * second.
 */
export function announcementStep(seconds: number): number {
  if (seconds <= DANGER_SECONDS) return DANGER_SECONDS
  if (seconds <= WARNING_SECONDS) return WARNING_SECONDS
  if (seconds <= 30) return 30
  return Math.ceil(seconds / 30) * 30
}
