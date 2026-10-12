import { useState } from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"

import { ShipRulesEditor } from "@/components/ship-rules-editor"
import type { ShipRule } from "@/server/db/schema"

function Harness({
  initial,
  board,
  readOnly,
  onChange,
}: {
  initial: ShipRule[]
  board?: { rows: number; columns: number }
  readOnly?: boolean
  onChange?: (rules: ShipRule[]) => void
}) {
  const [rules, setRules] = useState(initial)
  return (
    <ShipRulesEditor
      rules={rules}
      board={board}
      readOnly={readOnly}
      onChange={(next) => {
        setRules(next)
        onChange?.(next)
      }}
    />
  )
}

const stepper = (name: string) => screen.getByRole("group", { name })

describe("ShipRulesEditor", () => {
  it("merges two rules with the same length when a length is changed", () => {
    const onChange = jest.fn()
    render(
      <Harness
        initial={[
          { length: 2, count: 1 },
          { length: 3, count: 2 },
        ]}
        onChange={onChange}
      />
    )

    fireEvent.click(
      within(stepper("Length of ship type 2")).getByRole("button", {
        name: /Shorter ships of type 2/,
      })
    )

    expect(onChange).toHaveBeenLastCalledWith([{ length: 2, count: 3 }])
    expect(screen.queryByText("Ship type 2")).not.toBeInTheDocument()
    expect(screen.getByText("Ship type 1")).toBeInTheDocument()
  })

  it("never goes below two tiles per ship", () => {
    render(<Harness initial={[{ length: 2, count: 1 }]} />)
    expect(
      screen.getByRole("button", { name: "Shorter ships of type 1" })
    ).toBeDisabled()
  })

  it("caps lengths and counts at ten", () => {
    render(<Harness initial={[{ length: 10, count: 10 }]} />)
    expect(
      screen.getByRole("button", { name: "Longer ships of type 1" })
    ).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "More ships of type 1" })
    ).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Fewer ships of type 1" })
    ).toBeEnabled()
  })

  it("steps the count and the length", () => {
    const onChange = jest.fn()
    render(<Harness initial={[{ length: 3, count: 1 }]} onChange={onChange} />)
    fireEvent.click(
      screen.getByRole("button", { name: "More ships of type 1" })
    )
    expect(onChange).toHaveBeenLastCalledWith([{ length: 3, count: 2 }])
    fireEvent.click(
      screen.getByRole("button", { name: "Longer ships of type 1" })
    )
    expect(onChange).toHaveBeenLastCalledWith([{ length: 4, count: 2 }])
  })

  it("adds the next unused length and removes a ship type", () => {
    const onChange = jest.fn()
    render(<Harness initial={[{ length: 2, count: 1 }]} onChange={onChange} />)

    fireEvent.click(
      screen.getByRole("button", { name: "Add another ship type" })
    )
    expect(onChange).toHaveBeenLastCalledWith([
      { length: 2, count: 1 },
      { length: 3, count: 1 },
    ])

    fireEvent.click(screen.getByRole("button", { name: "Remove ship type 1" }))
    expect(onChange).toHaveBeenLastCalledWith([{ length: 3, count: 1 }])
    // The last remaining type cannot be removed.
    expect(
      screen.getByRole("button", { name: "Remove ship type 1" })
    ).toBeDisabled()
  })

  it("offers presets that fit the board and applies one", () => {
    const onChange = jest.fn()
    render(
      <Harness
        initial={[{ length: 2, count: 1 }]}
        board={{ rows: 3, columns: 3 }}
        onChange={onChange}
      />
    )

    expect(
      screen.queryByRole("button", { name: /Classic/ })
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Small/ }))
    expect(onChange).toHaveBeenLastCalledWith([
      { length: 3, count: 1 },
      { length: 2, count: 1 },
    ])
    expect(screen.getByRole("button", { name: /Small/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
  })

  it("says that the fleet fits the board", () => {
    render(
      <Harness
        initial={[{ length: 3, count: 2 }]}
        board={{ rows: 5, columns: 4 }}
      />
    )
    expect(screen.getByRole("status")).toHaveTextContent(
      "This fleet fits on a 5×4 board"
    )
    expect(
      screen.getByText(/2 ships covering 6 tiles on a 5×4 board/)
    ).toBeInTheDocument()
  })

  it("explains why the fleet does not fit", () => {
    render(
      <Harness
        initial={[{ length: 5, count: 1 }]}
        board={{ rows: 3, columns: 3 }}
      />
    )
    expect(screen.getByRole("status")).toHaveTextContent(
      "Ship length 5 exceeds board dimensions (3×3)"
    )
  })

  it("explains when the ships together need more tiles than the board has", () => {
    render(
      <Harness
        initial={[{ length: 3, count: 4 }]}
        board={{ rows: 3, columns: 3 }}
      />
    )
    expect(screen.getByRole("status")).toHaveTextContent(
      "Ship rules require 12 tiles but the board only has 9"
    )
  })

  it("is read-only when asked to", () => {
    render(
      <Harness
        initial={[{ length: 3, count: 2 }]}
        board={{ rows: 5, columns: 5 }}
        readOnly
      />
    )
    expect(
      screen.getByRole("button", { name: "More ships of type 1" })
    ).toBeDisabled()
    expect(
      screen.queryByRole("button", { name: "Add another ship type" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Remove ship type/ })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Standard/ })
    ).not.toBeInTheDocument()
  })
})
