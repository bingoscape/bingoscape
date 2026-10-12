import { render, screen } from "@testing-library/react"
import { SunkAnnouncement } from "@/components/event-workspace/sunk-announcement"
import { toast } from "@/hooks/use-toast"

jest.mock("@/hooks/use-toast", () => ({ toast: jest.fn() }))

const toastMock = jest.mocked(toast)

describe("SunkAnnouncement", () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] })
    jest.setSystemTime(new Date("2026-05-01T12:00:00Z"))
    toastMock.mockClear()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const status = () => screen.getByRole("status")

  it("says nothing on the first render, even with ships already sunk", () => {
    render(<SunkAnnouncement sunkTileIds={["a", "b"]} />)
    expect(toastMock).not.toHaveBeenCalled()
    expect(status()).toBeEmptyDOMElement()
    expect(status()).toHaveAttribute("aria-live", "polite")
  })

  it("announces a newly sunk ship once, with a toast that is not an error", () => {
    const { rerender } = render(<SunkAnnouncement sunkTileIds={[]} />)
    rerender(<SunkAnnouncement sunkTileIds={["a", "b"]} />)

    expect(toastMock).toHaveBeenCalledTimes(1)
    const call = toastMock.mock.calls[0]?.[0]
    expect(call?.title).toBe("Ship sunk!")
    expect(call).not.toHaveProperty("variant", "destructive")
    expect(status()).toHaveTextContent("Ship sunk!")

    // The same data again (a refresh without news) stays quiet.
    rerender(<SunkAnnouncement sunkTileIds={["a", "b"]} />)
    rerender(<SunkAnnouncement sunkTileIds={["b", "a"]} />)
    expect(toastMock).toHaveBeenCalledTimes(1)
  })

  it("announces each further ship separately", () => {
    const { rerender } = render(<SunkAnnouncement sunkTileIds={["a", "b"]} />)
    rerender(<SunkAnnouncement sunkTileIds={["a", "b", "c"]} />)
    expect(toastMock).toHaveBeenCalledTimes(1)
    rerender(<SunkAnnouncement sunkTileIds={["a", "b", "c", "d", "e"]} />)
    expect(toastMock).toHaveBeenCalledTimes(2)
  })

  it("does nothing when the set shrinks, and announces a returning ship again", () => {
    const { rerender } = render(<SunkAnnouncement sunkTileIds={["a", "b"]} />)
    rerender(<SunkAnnouncement sunkTileIds={[]} />)
    expect(toastMock).not.toHaveBeenCalled()

    rerender(<SunkAnnouncement sunkTileIds={["a", "b"]} />)
    expect(toastMock).toHaveBeenCalledTimes(1)
  })

  it("starts over for another Board when mounted with a new key", () => {
    const { rerender } = render(
      <SunkAnnouncement key="board-1" sunkTileIds={["a"]} />
    )
    rerender(<SunkAnnouncement key="board-2" sunkTileIds={["x", "y"]} />)
    expect(toastMock).not.toHaveBeenCalled()
  })
})
