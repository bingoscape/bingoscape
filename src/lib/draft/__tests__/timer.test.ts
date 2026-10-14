/**
 * @jest-environment node
 */
import {
  announcementStep,
  clockOffsetMs,
  formatCountdown,
  remainingMs,
  secondsLeft,
  timerTone,
} from "@/lib/draft/timer"

const SERVER = "2026-01-01T12:00:00.000Z"
const serverMs = Date.parse(SERVER)

describe("clockOffsetMs", () => {
  it("is the server time minus the client time", () => {
    expect(clockOffsetMs(SERVER, serverMs - 5_000)).toBe(5_000)
    expect(clockOffsetMs(SERVER, serverMs + 2_000)).toBe(-2_000)
  })

  it("is null without a usable server time", () => {
    expect(clockOffsetMs(undefined, 0)).toBeNull()
    expect(clockOffsetMs(null, 0)).toBeNull()
    expect(clockOffsetMs("not a date", 0)).toBeNull()
  })
})

describe("remainingMs", () => {
  const base = {
    pausedRemainingMs: null,
    paused: false,
    clockOffsetMs: 0,
  }

  it("counts down to the deadline against the server clock", () => {
    const deadline = new Date(serverMs + 30_000).toISOString()
    // The client runs 10 s behind the server, so 30 s remain either way.
    const offset = clockOffsetMs(SERVER, serverMs - 10_000)!
    expect(
      remainingMs({
        ...base,
        deadline,
        clockOffsetMs: offset,
        clientNowMs: serverMs - 10_000,
      })
    ).toBe(30_000)
    expect(
      remainingMs({
        ...base,
        deadline,
        clockOffsetMs: offset,
        clientNowMs: serverMs - 10_000 + 12_500,
      })
    ).toBe(17_500)
  })

  it("is not moved by the client clock", () => {
    const deadline = new Date(serverMs + 30_000).toISOString()
    // Two clients with very different clocks, both calibrated against the
    // same server timestamp, agree.
    const early = serverMs - 3_600_000
    const late = serverMs + 3_600_000
    const a = remainingMs({
      ...base,
      deadline,
      clockOffsetMs: clockOffsetMs(SERVER, early)!,
      clientNowMs: early + 1_000,
    })
    const b = remainingMs({
      ...base,
      deadline,
      clockOffsetMs: clockOffsetMs(SERVER, late)!,
      clientNowMs: late + 1_000,
    })
    expect(a).toBe(29_000)
    expect(b).toBe(29_000)
  })

  it("never goes below zero", () => {
    const deadline = new Date(serverMs - 1).toISOString()
    expect(remainingMs({ ...base, deadline, clientNowMs: serverMs })).toBe(0)
  })

  it("shows the frozen time while paused, whatever the clock says", () => {
    expect(
      remainingMs({
        ...base,
        deadline: null,
        paused: true,
        pausedRemainingMs: 12_345,
        clientNowMs: serverMs + 999_999,
      })
    ).toBe(12_345)
  })

  it("is null without a timer", () => {
    expect(
      remainingMs({ ...base, deadline: null, clientNowMs: serverMs })
    ).toBeNull()
  })
})

describe("display", () => {
  it("rounds up to whole seconds and formats minutes", () => {
    expect(secondsLeft(200)).toBe(1)
    expect(secondsLeft(0)).toBe(0)
    expect(formatCountdown(61_000)).toBe("1:01")
    expect(formatCountdown(9_001)).toBe("0:10")
    expect(formatCountdown(0)).toBe("0:00")
  })

  it("turns amber at 10 s and red at 5 s", () => {
    expect(timerTone(11_000)).toBe("normal")
    expect(timerTone(10_000)).toBe("warning")
    expect(timerTone(6_000)).toBe("warning")
    expect(timerTone(5_000)).toBe("danger")
    expect(timerTone(0)).toBe("danger")
  })
})

describe("announcementStep", () => {
  it("announces every 30 s, then at 10 s and 5 s", () => {
    expect(announcementStep(95)).toBe(120)
    expect(announcementStep(61)).toBe(90)
    expect(announcementStep(60)).toBe(60)
    expect(announcementStep(31)).toBe(60)
    expect(announcementStep(30)).toBe(30)
    expect(announcementStep(11)).toBe(30)
    expect(announcementStep(10)).toBe(10)
    expect(announcementStep(6)).toBe(10)
    expect(announcementStep(5)).toBe(5)
    expect(announcementStep(0)).toBe(5)
  })

  it("changes only a handful of times over a 90 s turn, not once per second", () => {
    const steps = new Set<number>()
    for (let s = 90; s >= 0; s--) steps.add(announcementStep(s))
    expect([...steps].sort((a, b) => b - a)).toEqual([90, 60, 30, 10, 5])
  })
})
