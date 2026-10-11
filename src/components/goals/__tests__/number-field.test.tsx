import { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { NumberField } from "@/components/goals/number-field"

function Harness({ initial = "1", unit }: { initial?: string; unit?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <NumberField
      id="target"
      label="XP to gain"
      value={value}
      onValueChange={setValue}
      unit={unit}
      hint="What this counts"
    />
  )
}

const input = () => screen.getByLabelText("XP to gain") as HTMLInputElement

describe("NumberField", () => {
  it("is a numeric-keyboard text field", () => {
    render(<Harness />)

    expect(input()).toHaveAttribute("inputmode", "numeric")
    expect(input()).toHaveAttribute("type", "text")
  })

  it("does not snap back to 1 when the field is cleared, so 500000 is typed as 500000", () => {
    render(<Harness initial="1" />)

    fireEvent.change(input(), { target: { value: "" } })
    expect(input().value).toBe("")

    fireEvent.change(input(), { target: { value: "5" } })
    fireEvent.change(input(), { target: { value: "50" } })
    fireEvent.change(input(), { target: { value: "500000" } })
    expect(input().value).toBe("500000")
  })

  it("keeps the typed shorthand and previews what it means", () => {
    render(<Harness unit="XP" />)

    fireEvent.change(input(), { target: { value: "500k" } })

    expect(input().value).toBe("500k")
    expect(screen.getByText("= 500,000 XP")).toBeInTheDocument()
  })

  it("previews thousands separators and decimals shorthand", () => {
    render(<Harness unit="XP" />)

    fireEvent.change(input(), { target: { value: "13,034,431" } })
    expect(screen.getByText("= 13,034,431 XP")).toBeInTheDocument()

    fireEvent.change(input(), { target: { value: "2.5m" } })
    expect(screen.getByText("= 2,500,000 XP")).toBeInTheDocument()
  })

  it("does not show an error while the user is still typing", () => {
    render(<Harness initial="5" />)

    fireEvent.change(input(), { target: { value: "" } })

    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(input()).toHaveAttribute("aria-invalid", "false")
  })

  it("shows an inline error on blur and wires it to the input", () => {
    render(<Harness initial="5" />)

    fireEvent.change(input(), { target: { value: "" } })
    fireEvent.blur(input())

    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("Enter a number")
    expect(input()).toHaveAttribute("aria-invalid", "true")
    expect(input().getAttribute("aria-describedby")).toContain(alert.id)
  })

  it.each([
    ["0", /greater than 0/],
    ["1.5", /whole number/],
    ["abc", /whole number/],
    ["2147483648", /cannot exceed/],
  ])("flags %p on blur", (value, message) => {
    render(<Harness />)

    fireEvent.change(input(), { target: { value } })
    fireEvent.blur(input())

    expect(screen.getByRole("alert")).toHaveTextContent(message)
  })

  it("clears the error once the value is fixed and previews it instead", () => {
    render(<Harness unit="XP" />)
    fireEvent.change(input(), { target: { value: "abc" } })
    fireEvent.blur(input())
    expect(screen.getByRole("alert")).toBeInTheDocument()

    fireEvent.change(input(), { target: { value: "1m" } })

    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(input()).toHaveAttribute("aria-invalid", "false")
    expect(screen.getByText("= 1,000,000 XP")).toBeInTheDocument()
  })

  it("reveals the error when Enter is pressed on an invalid value", () => {
    render(<Harness initial="" />)

    fireEvent.keyDown(input(), { key: "Enter" })

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a number")
  })

  it("describes the field with its hint", () => {
    render(<Harness />)

    const hint = screen.getByText("What this counts")
    expect(input().getAttribute("aria-describedby")).toContain(hint.id)
  })
})
