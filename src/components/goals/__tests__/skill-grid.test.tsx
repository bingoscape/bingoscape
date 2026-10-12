import { useState } from "react"
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { SkillGrid } from "@/components/goals/skill-grid"
import { getMetricIds, getMetricName } from "@/lib/osrs-metrics"
import "./dom-polyfills"

function Harness({
  initial = "",
  onValueChange,
  autoFocus,
}: {
  initial?: string
  onValueChange?: (skill: string) => void
  autoFocus?: boolean
}) {
  const [value, setValue] = useState(initial)
  return (
    <SkillGrid
      value={value}
      onValueChange={(skill) => {
        setValue(skill)
        onValueChange?.(skill)
      }}
      autoFocus={autoFocus}
    />
  )
}

const radio = (name: string) => screen.getByRole("radio", { name })
const checkedRadios = () =>
  screen
    .getAllByRole("radio")
    .filter((r) => r.getAttribute("aria-checked") === "true")

describe("SkillGrid", () => {
  it("is a radiogroup labelled Skill with one radio per skill", () => {
    render(<Harness />)

    const group = screen.getByRole("radiogroup", { name: "Skill" })
    expect(within(group).getAllByRole("radio")).toHaveLength(
      getMetricIds("skill").length
    )
  })

  it("names every radio after the skill's display name and shows that name too", () => {
    render(<Harness />)

    for (const skill of getMetricIds("skill")) {
      const name = getMetricName(skill)
      // The accessible name comes from aria-label, the visible label is the same text,
      // so the icon is never the only cue.
      expect(within(radio(name)).getByText(name)).toBeInTheDocument()
    }
  })

  it("lists the skills in the order of the in-game skills tab", () => {
    render(<Harness />)

    expect(
      screen
        .getAllByRole("radio")
        .slice(0, 8)
        .map((r) => r.getAttribute("aria-label"))
    ).toEqual([
      "Overall",
      "Attack",
      "Hitpoints",
      "Mining",
      "Strength",
      "Agility",
      "Smithing",
      "Defence",
    ])
  })

  it("has nothing selected by default", () => {
    render(<Harness />)

    expect(checkedRadios()).toHaveLength(0)
  })

  it("selects a skill with one click and reports it", () => {
    const onValueChange = jest.fn()
    render(<Harness onValueChange={onValueChange} />)

    fireEvent.click(radio("Woodcutting"))

    expect(onValueChange).toHaveBeenCalledWith("woodcutting")
    expect(radio("Woodcutting")).toBeChecked()
    expect(radio("Woodcutting")).toHaveAttribute("data-state", "checked")
  })

  it("is a single select: choosing another skill unselects the first", () => {
    render(<Harness />)

    fireEvent.click(radio("Woodcutting"))
    fireEvent.click(radio("Fishing"))

    expect(checkedRadios().map((r) => r.getAttribute("aria-label"))).toEqual([
      "Fishing",
    ])
  })

  it("shows the selected skill's name next to the label", () => {
    render(<Harness initial="mining" />)

    // The <p> next to the label, not the radio's own caption.
    expect(screen.getByText("Mining", { selector: "p" })).toBeInTheDocument()
  })

  it("shows no selected name while nothing is selected", () => {
    render(<Harness />)

    expect(
      screen.queryByText("Mining", { selector: "p" })
    ).not.toBeInTheDocument()
  })

  it("starts with the given skill selected", () => {
    render(<Harness initial="magic" />)

    expect(radio("Magic")).toBeChecked()
    expect(checkedRadios()).toHaveLength(1)
  })

  it("moves the selection with the arrow keys", async () => {
    render(<Harness initial="woodcutting" />)
    act(() => radio("Woodcutting").focus())

    // Radix moves focus on the next tick, and selection follows focus.
    fireEvent.keyDown(radio("Woodcutting"), { key: "ArrowRight" })
    await waitFor(() => expect(radio("Runecrafting")).toBeChecked())
    expect(radio("Runecrafting")).toHaveFocus()

    fireEvent.keyDown(radio("Runecrafting"), { key: "ArrowLeft" })
    await waitFor(() => expect(radio("Woodcutting")).toBeChecked())
    expect(checkedRadios()).toHaveLength(1)
  })

  it("moves with ArrowDown and ArrowUp as well", async () => {
    render(<Harness initial="attack" />)
    act(() => radio("Attack").focus())

    fireEvent.keyDown(radio("Attack"), { key: "ArrowDown" })
    await waitFor(() => expect(radio("Hitpoints")).toBeChecked())

    fireEvent.keyDown(radio("Hitpoints"), { key: "ArrowUp" })
    await waitFor(() => expect(radio("Attack")).toBeChecked())
  })

  it("focuses the first skill when asked to", () => {
    render(<Harness autoFocus />)

    expect(radio("Overall")).toHaveFocus()
  })

  it("does not take focus by default", () => {
    render(<Harness />)

    expect(radio("Overall")).not.toHaveFocus()
  })

  describe("strip variant", () => {
    it("is still a radiogroup labelled Skill with every skill, but shows no heading", () => {
      render(
        <SkillGrid value="" onValueChange={() => undefined} variant="strip" />
      )

      const group = screen.getByRole("radiogroup", { name: "Skill" })
      expect(within(group).getAllByRole("radio")).toHaveLength(
        getMetricIds("skill").length
      )
      expect(screen.getByText("Skill", { selector: "p" })).toHaveClass(
        "sr-only"
      )
    })

    it("scrolls horizontally instead of wrapping into a grid", () => {
      render(
        <SkillGrid value="" onValueChange={() => undefined} variant="strip" />
      )

      const group = screen.getByRole("radiogroup", { name: "Skill" })
      expect(group.className).toContain("overflow-x-auto")
      expect(group.className).not.toContain("grid")
    })
  })

  describe("viaKeyboard", () => {
    it("is false for a click and true when an arrow key moved the selection", async () => {
      const onValueChange = jest.fn()
      render(<SkillGrid value="" onValueChange={onValueChange} />)

      fireEvent.click(radio("Attack"))
      expect(onValueChange).toHaveBeenLastCalledWith("attack", {
        viaKeyboard: false,
      })

      act(() => radio("Overall").focus())
      fireEvent.keyDown(radio("Overall"), { key: "ArrowRight" })
      await waitFor(() =>
        expect(onValueChange).toHaveBeenLastCalledWith("attack", {
          viaKeyboard: true,
        })
      )
    })
  })

  it("gives two grids on one page their own labels", () => {
    render(
      <>
        <SkillGrid value="" onValueChange={() => undefined} />
        <SkillGrid value="" onValueChange={() => undefined} variant="strip" />
      </>
    )

    const ids = screen
      .getAllByRole("radiogroup")
      .map((group) => group.getAttribute("aria-labelledby"))
    expect(new Set(ids).size).toBe(2)
  })
})
