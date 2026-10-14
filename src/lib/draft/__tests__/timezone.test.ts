/**
 * @jest-environment node
 */
import { utcOffsetOfTimezone } from "@/lib/draft/timezone"

const JANUARY = new Date("2026-01-15T12:00:00Z")
const JULY = new Date("2026-07-15T12:00:00Z")

describe("utcOffsetOfTimezone", () => {
  it("counts hours east of UTC as positive", () => {
    expect(utcOffsetOfTimezone("Asia/Tokyo", JANUARY)).toBe(9)
    expect(utcOffsetOfTimezone("America/New_York", JANUARY)).toBe(-5)
    expect(utcOffsetOfTimezone("Europe/London", JANUARY)).toBe(0)
  })

  it("follows daylight saving", () => {
    expect(utcOffsetOfTimezone("America/New_York", JULY)).toBe(-4)
    expect(utcOffsetOfTimezone("Europe/Berlin", JULY)).toBe(2)
    expect(utcOffsetOfTimezone("Europe/Berlin", JANUARY)).toBe(1)
  })

  it("is never negative zero", () => {
    expect(Object.is(utcOffsetOfTimezone("UTC", JANUARY), 0)).toBe(true)
  })

  it("has no offset for a missing zone", () => {
    expect(utcOffsetOfTimezone(null)).toBeNull()
    expect(utcOffsetOfTimezone(undefined)).toBeNull()
    expect(utcOffsetOfTimezone("")).toBeNull()
  })
})
