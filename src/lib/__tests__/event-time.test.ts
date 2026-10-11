/**
 * @jest-environment node
 */
import {
  formatDateRange,
  formatDuration,
  getStatusLabel,
} from "@/lib/event-time"

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

describe("formatDuration", () => {
  it("uses minutes under an hour, never showing 0m", () => {
    expect(formatDuration(45 * MIN)).toBe("45m")
    expect(formatDuration(10_000)).toBe("1m")
    expect(formatDuration(-5)).toBe("1m")
  })

  it("uses hours up to a day, then day+hours up to 48h, then days", () => {
    expect(formatDuration(HOUR)).toBe("1h")
    expect(formatDuration(23 * HOUR + 59 * MIN)).toBe("23h")
    expect(formatDuration(DAY)).toBe("1d")
    expect(formatDuration(DAY + 4 * HOUR)).toBe("1d 4h")
    expect(formatDuration(2 * DAY)).toBe("2d")
    expect(formatDuration(6.9 * DAY)).toBe("6d")
  })
})

describe("getStatusLabel", () => {
  const now = new Date("2026-06-15T12:00:00Z")
  const start = new Date("2026-06-10T00:00:00Z")
  const end = new Date("2026-06-17T12:00:00Z")

  it("describes live events by time left", () => {
    expect(getStatusLabel("active", start, end, "UTC", now)).toBe(
      "Live · ends in 2d"
    )
  })

  it("describes upcoming events by time until start", () => {
    const later = new Date("2026-06-18T12:00:00Z")
    expect(getStatusLabel("upcoming", later, end, "UTC", now)).toBe(
      "Starts in 3d"
    )
  })

  it("describes past events by end date in the event time zone", () => {
    const pastEnd = new Date("2026-06-03T23:30:00Z")
    expect(getStatusLabel("past", start, pastEnd, "UTC", now)).toBe(
      "Ended Jun 3"
    )
    expect(getStatusLabel("past", start, pastEnd, "Asia/Tokyo", now)).toBe(
      "Ended Jun 4"
    )
  })
})

describe("formatDateRange", () => {
  const now = new Date("2026-06-15T12:00:00Z")

  it("omits the year when it is the current one", () => {
    expect(
      formatDateRange(
        new Date("2026-10-11T12:00:00Z"),
        new Date("2026-10-18T12:00:00Z"),
        "UTC",
        now
      )
    ).toBe("Oct 11 – Oct 18")
  })

  it("adds the year when it differs", () => {
    expect(
      formatDateRange(
        new Date("2025-12-30T12:00:00Z"),
        new Date("2026-01-03T12:00:00Z"),
        "UTC",
        now
      )
    ).toBe("Dec 30, 2025 – Jan 3")
  })
})
