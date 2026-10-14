"use client"

import { useEffect, useRef, useState } from "react"

import {
  announcementStep,
  formatCountdown,
  remainingMs,
  secondsLeft,
  timerTone,
} from "@/lib/draft/timer"
import { cn } from "@/lib/utils"

interface TurnTimerProps {
  /** ISO database time the turn ends; null while paused. */
  deadline: string | null
  /** Time frozen on the turn while the draft is paused. */
  pausedRemainingMs: number | null
  paused: boolean
  /** Database time minus this browser's time (see `useDraftStream`). */
  clockOffsetMs: number
  /**
   * Called when the time is up, and again every few seconds while nothing
   * changed, so the page asks the server (which settles the turn) instead of
   * waiting for the stream.
   */
  onExpired?: () => void
}

const TICK_MS = 250
const EXPIRED_RETRY_MS = 3000

const TONE_CLASS = {
  normal: "text-foreground",
  warning: "text-amber-500",
  danger: "text-red-500",
} as const

/**
 * The pick countdown. `role="timer"` (which is not announced by itself), amber
 * at 10 s and red at 5 s. Screen readers get a separate polite message every
 * 30 s and then at 10 s and 5 s, never one per second. It counts down against
 * the offset to the server's clock; a paused draft shows the frozen time.
 */
export function TurnTimer({
  deadline,
  pausedRemainingMs,
  paused,
  clockOffsetMs,
  onExpired,
}: TurnTimerProps) {
  const [now, setNow] = useState<number | null>(null)
  const [announcement, setAnnouncement] = useState("")
  const expiredRef = useRef(onExpired)
  const lastExpiredCall = useRef(0)
  const lastStep = useRef<number | null>(null)
  useEffect(() => {
    expiredRef.current = onExpired
  }, [onExpired])

  const remaining =
    now === null
      ? paused
        ? pausedRemainingMs
        : null
      : remainingMs({
          deadline,
          pausedRemainingMs,
          paused,
          clientNowMs: now,
          clockOffsetMs,
        })

  // A new turn starts the announcements over.
  useEffect(() => {
    lastStep.current = null
    lastExpiredCall.current = 0
  }, [deadline])

  // Tick against the wall clock: a throttled background tab catches up at once.
  useEffect(() => {
    if (paused || !deadline) return
    const tick = () => {
      const clientNow = Date.now()
      setNow(clientNow)
      const left = remainingMs({
        deadline,
        pausedRemainingMs: null,
        paused: false,
        clientNowMs: clientNow,
        clockOffsetMs,
      })
      if (left === null) return
      if (left <= 0) {
        if (clientNow - lastExpiredCall.current >= EXPIRED_RETRY_MS) {
          lastExpiredCall.current = clientNow
          expiredRef.current?.()
        }
        return
      }
      const seconds = secondsLeft(left)
      const step = announcementStep(seconds)
      if (lastStep.current !== null && step !== lastStep.current) {
        setAnnouncement(`${step} seconds left to pick`)
      }
      lastStep.current = step
    }
    tick()
    const timer = window.setInterval(tick, TICK_MS)
    return () => window.clearInterval(timer)
  }, [deadline, paused, clockOffsetMs])

  if (remaining === null) {
    return paused || deadline ? (
      <span role="timer" aria-live="off" aria-label="Time left to pick">
        -:--
      </span>
    ) : null
  }

  const tone = paused ? "normal" : timerTone(remaining)
  return (
    <>
      <span
        role="timer"
        // Off, also inside the banner's polite live region: no per-second chatter.
        aria-live="off"
        aria-label={paused ? "Time left to pick (paused)" : "Time left to pick"}
        data-tone={tone}
        className={cn(
          "font-mono text-2xl font-semibold tabular-nums",
          TONE_CLASS[tone],
          paused && "opacity-70"
        )}
      >
        {formatCountdown(remaining)}
      </span>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </>
  )
}
