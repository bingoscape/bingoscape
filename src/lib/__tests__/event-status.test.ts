import {
  canSeeBattleshipTileDetails,
  isEventActive,
} from "@/lib/event-status"

describe("event-status", () => {
  const start = "2026-06-01T00:00:00Z"
  const end = "2026-06-30T23:59:59Z"

  it("isEventActive is true within the event window", () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date("2026-06-15T12:00:00Z"))
    expect(isEventActive(start, end)).toBe(true)
    jest.useRealTimers()
  })

  it("isEventActive is false before start", () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date("2026-05-01T12:00:00Z"))
    expect(isEventActive(start, end)).toBe(false)
    jest.useRealTimers()
  })

  it("only event creator sees battleship details before the event is active", () => {
    expect(
      canSeeBattleshipTileDetails(false, "creator-1", "creator-1", "participant")
    ).toBe(true)
    expect(
      canSeeBattleshipTileDetails(false, "creator-1", "other-user", "participant")
    ).toBe(false)
    expect(
      canSeeBattleshipTileDetails(false, "creator-1", "other-user", "management")
    ).toBe(true)
  })

  it("shows tile details to everyone once the event is active", () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date("2026-06-15T12:00:00Z"))

    expect(
      canSeeBattleshipTileDetails(true, "creator-1", "creator-1", "participant")
    ).toBe(true)
    expect(
      canSeeBattleshipTileDetails(true, "creator-1", "other-user", "participant")
    ).toBe(true)

    jest.useRealTimers()
  })
})
