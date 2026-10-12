import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import { CreateBingoModal } from "@/components/create-bingo-modal"
import { createBingo } from "@/app/actions/bingo"

jest.mock("@/app/actions/bingo", () => ({
  createBingo: jest.fn(),
}))
jest.mock("@/components/ui/date-time-picker", () => ({
  DateTimePicker: () => null,
}))
jest.mock("@/components/pattern-bonus-schematic-editor", () => ({
  PatternBonusSchematicEditor: () => <div>pattern bonus editor</div>,
}))

const createBingoMock = createBingo as jest.Mock

function renderModal(teamCount = 2) {
  return render(
    <CreateBingoModal
      eventId="event-1"
      isOpen
      onClose={jest.fn()}
      teamCount={teamCount}
    />
  )
}

async function goToTypeStep() {
  fireEvent.change(screen.getByLabelText(/Board Title/), {
    target: { value: "Fleet battle" },
  })
  fireEvent.click(screen.getByRole("button", { name: /Next Step/ }))
  return screen.findByRole("radiogroup", { name: "Bingo Type" })
}

beforeEach(() => {
  jest.clearAllMocks()
  createBingoMock.mockResolvedValue({ success: true })
})

describe("CreateBingoModal: battleship", () => {
  it("offers Battleship as a third radio next to Standard and Progression", async () => {
    renderModal()
    const group = await goToTypeStep()

    const radios = screen.getAllByRole("radio")
    expect(radios.map((r) => r.getAttribute("value"))).toEqual([
      "standard",
      "progression",
      "battleship",
    ])
    expect(group).toHaveClass("sm:grid-cols-3")
    expect(screen.getByRole("radio", { name: /Standard/ })).toBeChecked()
    expect(screen.getByRole("radio", { name: /Battleship/ })).not.toBeChecked()
  })

  it("says that the teams share one board and that completing tiles fires at the opponent", async () => {
    renderModal()
    await goToTypeStep()
    expect(
      screen.getByText(/share one board and hide a fleet on it/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Completing a tile fires at the opponent's ships/)
    ).toBeInTheDocument()
  })

  it("disables the card with the reason when the event has more than two teams", async () => {
    renderModal(3)
    await goToTypeStep()

    const radio = screen.getByRole("radio", { name: /Battleship/ })
    expect(radio).toBeDisabled()
    expect(radio).toHaveAccessibleDescription(
      "This event has 3 teams. Battleship is played by exactly 2."
    )
  })

  it("keeps the card selectable with exactly two teams", async () => {
    renderModal(2)
    await goToTypeStep()
    expect(screen.getByRole("radio", { name: /Battleship/ })).toBeEnabled()
  })

  it("shows the rules step instead of pattern bonuses and sends the fleet as JSON", async () => {
    renderModal()
    await goToTypeStep()

    fireEvent.click(screen.getByRole("radio", { name: /Battleship/ }))
    expect(screen.getByRole("radio", { name: /Battleship/ })).toBeChecked()
    fireEvent.click(screen.getByRole("button", { name: /Next Step/ }))

    expect(
      await screen.findByRole("heading", {
        name: "What ships must each team place?",
      })
    ).toBeInTheDocument()
    expect(screen.queryByText("pattern bonus editor")).not.toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent(
      "This fleet fits on a 5×5 board"
    )

    // Make the fleet one ship longer so the payload differs from the default.
    fireEvent.click(
      screen.getByRole("button", { name: "More ships of type 2" })
    )
    fireEvent.click(screen.getByRole("button", { name: /Next Step/ }))
    fireEvent.click(await screen.findByRole("button", { name: /Create Board/ }))

    await waitFor(() => expect(createBingoMock).toHaveBeenCalledTimes(1))
    const form = createBingoMock.mock.calls[0]![0] as FormData
    expect(form.get("bingoType")).toBe("battleship")
    expect(JSON.parse(form.get("shipRules") as string)).toEqual([
      { length: 2, count: 2 },
      { length: 3, count: 2 },
    ])
    expect(form.get("mainDiagonalBonus")).toBeNull()
    expect(form.get("rowBonus-0")).toBeNull()
  })

  it("does not leave the rules step while the fleet does not fit the board", async () => {
    renderModal()
    await goToTypeStep()
    fireEvent.change(screen.getByLabelText("Number of Rows"), {
      target: { value: "2" },
    })
    fireEvent.change(screen.getByLabelText("Number of Columns"), {
      target: { value: "2" },
    })
    fireEvent.click(screen.getByRole("radio", { name: /Battleship/ }))
    fireEvent.click(screen.getByRole("button", { name: /Next Step/ }))
    await screen.findByRole("heading", {
      name: "What ships must each team place?",
    })

    fireEvent.click(screen.getByRole("button", { name: /Next Step/ }))
    expect(
      await screen.findByText(
        /Ship length 3 exceeds board dimensions \(2×2\)/,
        {
          selector: "div",
        }
      )
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Create Board/ })
    ).not.toBeInTheDocument()
  })

  it("keeps sending pattern bonuses for a standard board", async () => {
    renderModal()
    await goToTypeStep()
    fireEvent.click(screen.getByRole("button", { name: /Next Step/ }))
    expect(await screen.findByText("pattern bonus editor")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Next Step/ }))
    fireEvent.click(await screen.findByRole("button", { name: /Create Board/ }))

    await waitFor(() => expect(createBingoMock).toHaveBeenCalledTimes(1))
    const form = createBingoMock.mock.calls[0]![0] as FormData
    expect(form.get("bingoType")).toBe("standard")
    expect(form.get("shipRules")).toBeNull()
    expect(form.get("completeBoardBonus")).toBe("0")
  })
})
