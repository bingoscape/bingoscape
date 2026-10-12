import { fireEvent, render, screen } from "@testing-library/react"
import "@/components/goals/__tests__/dom-polyfills"
import { TileSourcePicker } from "@/components/goal-setup/tile-source-picker"
import { makeGoal, makeTile } from "./fixtures"

const tiles = [
  makeTile({
    id: "t1",
    index: 0,
    title: "Fire cape",
    goals: [makeGoal({ id: "g1", tileId: "t1" })],
  }),
  makeTile({
    id: "t2",
    index: 6,
    title: "Zulrah",
    goals: [
      makeGoal({ id: "g2", tileId: "t2" }),
      makeGoal({ id: "g3", tileId: "t2", orderIndex: 1 }),
    ],
  }),
  makeTile({
    id: "t3",
    index: 11,
    title: "99 Slayer",
    goals: [makeGoal({ id: "g4", tileId: "t3" })],
  }),
]

function renderPicker(value: string | null = null) {
  const onChange = jest.fn()
  render(<TileSourcePicker tiles={tiles} value={value} onChange={onChange} />)
  return { onChange }
}

const search = (text: string) =>
  fireEvent.change(screen.getByPlaceholderText("Search by name or number..."), {
    target: { value: text },
  })

describe("TileSourcePicker", () => {
  it("lists every tile with its position and goal count", () => {
    renderPicker()
    expect(
      screen.getAllByRole("option").map((option) => option.textContent)
    ).toEqual(["1Fire cape1 goal", "7Zulrah2 goals", "1299 Slayer1 goal"])
  })

  it("filters by part of the title in any case", () => {
    renderPicker()
    search("ZUL")
    expect(screen.getAllByRole("option")).toHaveLength(1)
    expect(screen.getByRole("option")).toHaveTextContent("Zulrah")
  })

  it("filters by position", () => {
    renderPicker()
    search("7")
    expect(screen.getByRole("option")).toHaveTextContent("Zulrah")
    search("#12")
    expect(screen.getByRole("option")).toHaveTextContent("99 Slayer")
  })

  it("says when nothing matches", async () => {
    renderPicker()
    search("nothing like this")
    expect(
      await screen.findByText("No tile with goals matches.")
    ).toBeInTheDocument()
  })

  it("reports the tile that was picked", () => {
    const { onChange } = renderPicker()
    fireEvent.click(screen.getByRole("option", { name: /Zulrah/ }))
    expect(onChange).toHaveBeenCalledWith("t2")
  })

  it("marks the chosen tile, also for screen readers", () => {
    renderPicker("t2")
    expect(screen.getByRole("option", { name: /Zulrah/ })).toHaveTextContent(
      "Selected"
    )
    expect(
      screen.getByRole("option", { name: /Fire cape/ })
    ).not.toHaveTextContent("Selected")
  })
})
