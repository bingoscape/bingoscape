import { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react"

import {
  TemplateDetailsFields,
  toTemplateInput,
  type TemplateDetailsValue,
} from "@/components/template-details-fields"

// jsdom has no ResizeObserver, which Radix radio buttons use inside forms.
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const onSubmit = jest.fn()

function Harness({ initial }: { initial?: Partial<TemplateDetailsValue> }) {
  const [value, setValue] = useState<TemplateDetailsValue>({
    title: "Raids",
    description: "",
    category: "",
    tags: [],
    isPublic: true,
    ...initial,
  })
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(toTemplateInput(value))
      }}
    >
      <TemplateDetailsFields
        idPrefix="t"
        value={value}
        onChange={setValue}
        categorySuggestions={["PvM", "Skilling", "Questing"]}
      />
      <button type="submit">Save</button>
    </form>
  )
}

beforeEach(() => onSubmit.mockClear())

describe("TemplateDetailsFields", () => {
  it("adds a tag chip on Enter without submitting the form", () => {
    render(<Harness />)

    const input = screen.getByLabelText("Tags")
    fireEvent.change(input, { target: { value: "boss" } })
    fireEvent.keyDown(input, { key: "Enter" })

    expect(onSubmit).not.toHaveBeenCalled()
    expect(
      screen.getByRole("button", { name: "Remove tag boss" })
    ).toBeInTheDocument()
    expect(screen.getByText("1 of 5")).toBeInTheDocument()
  })

  it("ignores duplicate tags and removes chips", () => {
    render(<Harness initial={{ tags: ["boss"] }} />)

    const input = screen.getByLabelText("Tags")
    fireEvent.change(input, { target: { value: "BOSS" } })
    fireEvent.keyDown(input, { key: "," })
    expect(screen.getAllByRole("button", { name: /Remove tag/ })).toHaveLength(
      1
    )

    fireEvent.click(screen.getByRole("button", { name: "Remove tag boss" }))
    expect(screen.queryByRole("button", { name: /Remove tag/ })).toBeNull()
  })

  it("stops at five tags", () => {
    render(<Harness initial={{ tags: ["a", "b", "c", "d", "e"] }} />)

    expect(screen.getByLabelText("Tags")).toBeDisabled()
  })

  it("keeps a pending tag when the input loses focus", () => {
    render(<Harness />)

    const input = screen.getByLabelText("Tags")
    fireEvent.change(input, { target: { value: "ironman" } })
    fireEvent.blur(input)
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ tags: "ironman" })
    )
  })

  it("fills the category from a suggestion", () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole("button", { name: "Skilling" }))

    expect(screen.getByLabelText("Category")).toHaveValue("Skilling")
  })

  it("shows the title counter against the limit", () => {
    render(<Harness />)

    expect(screen.getByText("5/255")).toBeInTheDocument()
  })

  it("switches visibility with explanations for both options", () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole("radio", { name: /Private/ }))
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ isPublic: false })
    )
    expect(screen.getByText(/Only you can see and use it/)).toBeInTheDocument()
  })
})
