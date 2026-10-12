import { hasEventStarted } from "@/lib/event-status"

describe("hasEventStarted", () => {
  // Relative to the real clock; the tests inject `now` explicitly.
  const start = new Date(Math.floor(Date.now() / 1000) * 1000)

  it("is false before the start date", () => {
    expect(hasEventStarted(start, new Date(start.getTime() - 1))).toBe(false)
  })

  it("is true exactly at the start date", () => {
    expect(hasEventStarted(start, new Date(start.getTime()))).toBe(true)
  })

  it("stays true long after the event started", () => {
    const later = new Date(start.getTime() + 365 * 24 * 60 * 60 * 1000)
    expect(hasEventStarted(start, later)).toBe(true)
  })

  it("accepts ISO strings and timestamps", () => {
    const now = new Date(start.getTime() + 1000)
    expect(hasEventStarted(start.toISOString(), now)).toBe(true)
    expect(hasEventStarted(start.getTime() + 2000, now)).toBe(false)
  })

  it("uses the current time when none is given", () => {
    jest.useFakeTimers().setSystemTime(start)
    try {
      expect(hasEventStarted(start)).toBe(true)
      expect(hasEventStarted(new Date(start.getTime() + 1))).toBe(false)
    } finally {
      jest.useRealTimers()
    }
  })
})
