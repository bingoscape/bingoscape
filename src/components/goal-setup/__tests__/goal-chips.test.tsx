import { render, screen, within } from "@testing-library/react"
import { GoalChips } from "@/components/goal-setup/goal-chips"
import type { GoalChipData } from "@/lib/goal-setup"

const chip = (key: string, over: Partial<GoalChipData> = {}): GoalChipData => ({
  key,
  kind: "task",
  label: `Goal ${key}`,
  target: "x1",
  ...over,
})

describe("GoalChips", () => {
  it("renders nothing without chips", () => {
    const { container } = render(<GoalChips chips={[]} label="Goals of X" />)
    expect(container).toBeEmptyDOMElement()
  })

  it("is a labelled list with one item per goal", () => {
    render(
      <GoalChips chips={[chip("a"), chip("b")]} label="Goals of Fire cape" />
    )
    const list = screen.getByRole("list", { name: "Goals of Fire cape" })
    expect(within(list).getAllByRole("listitem")).toHaveLength(2)
  })

  it("shows the name and the target", () => {
    render(
      <GoalChips
        chips={[
          chip("a", { label: "Zulrah", target: "50 kills", kind: "metric" }),
        ]}
        label="Goals"
      />
    )
    expect(screen.getByText("Zulrah")).toBeInTheDocument()
    expect(screen.getByText("50 kills")).toBeInTheDocument()
  })

  it("shows a group without a target", () => {
    render(
      <GoalChips
        chips={[
          chip("g", { kind: "group", label: "Any 2 of 3", target: null }),
        ]}
        label="Goals"
      />
    )
    expect(screen.getByRole("listitem")).toHaveTextContent(/^Any 2 of 3$/)
  })

  it("puts the full text in the title, for names that are cut off", () => {
    render(
      <GoalChips
        chips={[chip("a", { label: "A very long goal name", target: "x3" })]}
        label="Goals"
      />
    )
    expect(screen.getByRole("listitem")).toHaveAttribute(
      "title",
      "A very long goal name: x3"
    )
  })

  it("folds goals beyond the maximum into '+N more'", () => {
    const chips = Array.from({ length: 9 }, (_, i) => chip(String(i)))
    render(<GoalChips chips={chips} label="Goals" />)
    expect(screen.getByText("Goal 5")).toBeInTheDocument()
    expect(screen.queryByText("Goal 6")).not.toBeInTheDocument()
    expect(screen.getByText("+3 more")).toBeInTheDocument()
  })

  it("respects a custom maximum and shows no fold when everything fits", () => {
    render(<GoalChips chips={[chip("a"), chip("b")]} label="Goals" max={1} />)
    expect(screen.getByText("+1 more")).toBeInTheDocument()

    render(<GoalChips chips={[chip("c")]} label="Other goals" />)
    expect(screen.getAllByText(/more$/)).toHaveLength(1)
  })

  it("marks a goal that is still saving, for screen readers too", () => {
    render(<GoalChips chips={[chip("a", { pending: true })]} label="Goals" />)
    expect(screen.getByText("Saving")).toBeInTheDocument()
    expect(screen.getByRole("listitem")).toHaveClass("border-dashed")
  })
})
