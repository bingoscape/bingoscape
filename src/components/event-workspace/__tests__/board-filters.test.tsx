import { fireEvent, render, screen } from "@testing-library/react"
import { BoardFilters } from "@/components/event-workspace/board-filters"

const counts = { attention: 2, incomplete: 5, hidden: 0 }

describe("BoardFilters", () => {
  const setup = (
    over: Partial<React.ComponentProps<typeof BoardFilters>> = {}
  ) => {
    const onChange = jest.fn()
    render(
      <BoardFilters
        context={{ teamId: "t1", isManagement: false }}
        active={null}
        counts={counts}
        onChange={onChange}
        {...over}
      />
    )
    return onChange
  }

  it("shows the player chips with counts and hides empty ones", () => {
    setup()
    expect(
      screen.getByRole("button", { name: "Needs attention 2" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Incomplete 5" })
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Hidden/ })).toBeNull()
  })

  it("labels the review chip for management and offers Hidden", () => {
    setup({
      context: { teamId: "t1", isManagement: true },
      counts: { ...counts, hidden: 3 },
    })
    expect(
      screen.getByRole("button", { name: "Needs review 2" })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Hidden 3" })).toBeInTheDocument()
  })

  it("never offers Hidden to players, even with a count", () => {
    setup({ counts: { ...counts, hidden: 3 } })
    expect(screen.queryByRole("button", { name: /Hidden/ })).toBeNull()
  })

  it("toggles a filter on and off", () => {
    const onChange = setup()
    fireEvent.click(screen.getByRole("button", { name: "Incomplete 5" }))
    expect(onChange).toHaveBeenLastCalledWith("incomplete")
  })

  it("keeps an active filter visible so it can be cleared", () => {
    const onChange = setup({
      active: "attention",
      counts: { ...counts, attention: 0 },
    })
    const chip = screen.getByRole("button", { name: "Needs attention 0" })
    expect(chip).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(chip)
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it("renders nothing when no filter has Tiles", () => {
    setup({ counts: { attention: 0, incomplete: 0, hidden: 0 } })
    expect(screen.queryByRole("group")).toBeNull()
  })
})
