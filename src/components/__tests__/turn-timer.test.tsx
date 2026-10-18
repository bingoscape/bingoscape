import { act, render, screen } from "@testing-library/react"

import { TurnTimer } from "@/components/draft/turn-timer"

/** "Now" is fixed so the countdown is deterministic. */
const NOW = new Date("2026-01-01T12:00:00.000Z").getTime()

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(NOW)
})
afterEach(() => {
  jest.useRealTimers()
})

const deadlineIn = (seconds: number) =>
  new Date(NOW + seconds * 1000).toISOString()

const advance = (ms: number) => act(() => void jest.advanceTimersByTime(ms))

describe("TurnTimer", () => {
  it("is a timer that counts down", () => {
    render(
      <TurnTimer
        deadline={deadlineIn(65)}
        pausedRemainingMs={null}
        paused={false}
        clockOffsetMs={0}
      />
    )
    const timer = screen.getByRole("timer")
    expect(timer).toHaveTextContent("1:05")
    advance(5_000)
    expect(timer).toHaveTextContent("1:00")
  })

  it("counts against the server clock, not the local one", () => {
    // The browser clock is an hour ahead; its offset to the server says so.
    render(
      <TurnTimer
        deadline={deadlineIn(30)}
        pausedRemainingMs={null}
        paused={false}
        clockOffsetMs={0}
      />
    )
    expect(screen.getByRole("timer")).toHaveTextContent("0:30")
    // A browser whose clock is 10 s ahead calibrates to -10 s: same answer.
    jest.setSystemTime(NOW + 10_000)
    render(
      <TurnTimer
        deadline={deadlineIn(30)}
        pausedRemainingMs={null}
        paused={false}
        clockOffsetMs={-10_000}
      />
    )
    expect(screen.getAllByRole("timer")[1]).toHaveTextContent("0:30")
  })

  it("turns amber at 10 s and red at 5 s", () => {
    render(
      <TurnTimer
        deadline={deadlineIn(12)}
        pausedRemainingMs={null}
        paused={false}
        clockOffsetMs={0}
      />
    )
    const timer = screen.getByRole("timer")
    expect(timer).toHaveAttribute("data-tone", "normal")
    advance(2_000)
    expect(timer).toHaveAttribute("data-tone", "warning")
    expect(timer).toHaveClass("text-amber-500")
    advance(5_000)
    expect(timer).toHaveAttribute("data-tone", "danger")
    expect(timer).toHaveClass("text-red-500")
  })

  it("does not announce every second: only every 30 s, then at 10 s and 5 s", () => {
    render(
      <TurnTimer
        deadline={deadlineIn(65)}
        pausedRemainingMs={null}
        paused={false}
        clockOffsetMs={0}
      />
    )
    const announcements: string[] = []
    const note = () => {
      const text = screen.getByRole("status").textContent ?? ""
      if (text && announcements.at(-1) !== text) announcements.push(text)
    }
    for (let second = 0; second < 66; second++) {
      advance(1_000)
      note()
    }
    expect(announcements).toEqual([
      "60 seconds left to pick",
      "30 seconds left to pick",
      "10 seconds left to pick",
      "5 seconds left to pick",
    ])
  })

  it("never puts the per-second countdown in a live region", () => {
    render(
      <TurnTimer
        deadline={deadlineIn(30)}
        pausedRemainingMs={null}
        paused={false}
        clockOffsetMs={0}
      />
    )
    expect(screen.getByRole("timer")).toHaveAttribute("aria-live", "off")
  })

  it("asks the server to settle the turn when time is up, and again every few seconds", () => {
    const onExpired = jest.fn()
    render(
      <TurnTimer
        deadline={deadlineIn(2)}
        pausedRemainingMs={null}
        paused={false}
        clockOffsetMs={0}
        onExpired={onExpired}
      />
    )
    advance(1_900)
    expect(onExpired).not.toHaveBeenCalled()
    advance(500)
    expect(onExpired).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("timer")).toHaveTextContent("0:00")
    advance(3_000)
    expect(onExpired).toHaveBeenCalledTimes(2)
  })

  it("shows the frozen time while paused and does not tick", () => {
    render(
      <TurnTimer
        deadline={null}
        pausedRemainingMs={42_000}
        paused
        clockOffsetMs={0}
      />
    )
    const timer = screen.getByRole("timer")
    expect(timer).toHaveTextContent("0:42")
    advance(10_000)
    expect(timer).toHaveTextContent("0:42")
    expect(timer).toHaveAccessibleName("Time left to pick (paused)")
  })
})
