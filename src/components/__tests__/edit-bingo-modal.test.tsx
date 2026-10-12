import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"

import { EditBingoModal } from "@/components/edit-bingo-modal"
import { updateBingo } from "@/app/actions/bingo"
import { toast } from "@/hooks/use-toast"

jest.mock("@/app/actions/bingo", () => ({
  updateBingo: jest.fn(),
  getBingoWithPatternBonuses: jest.fn().mockResolvedValue({ success: false }),
}))
jest.mock("@/hooks/use-toast", () => ({ toast: jest.fn() }))
jest.mock("@/components/pattern-bonus-schematic-editor", () => ({
  PatternBonusSchematicEditor: () => null,
}))

const updateBingoMock = updateBingo as jest.Mock
const toastMock = toast as jest.Mock

const baseBingo = {
  id: "bingo-1",
  title: "Fleet battle",
  description: null,
  visible: true,
  locked: false,
  codephrase: "phrase",
  rows: 5,
  columns: 5,
}

const fleet = [
  { length: 2, count: 1 },
  { length: 3, count: 2 },
]

function renderModal(
  props: Partial<React.ComponentProps<typeof EditBingoModal>> = {}
) {
  return render(
    <EditBingoModal
      bingo={{ ...baseBingo, bingoType: "battleship" }}
      isOpen
      onClose={jest.fn()}
      battleship={{ rules: fleet, started: false }}
      {...props}
    />
  )
}

const tab = (name: string) => screen.queryByRole("tab", { name })

afterEach(() => {
  jest.restoreAllMocks()
})

beforeEach(() => {
  jest.clearAllMocks()
  updateBingoMock.mockResolvedValue({ success: true, clearedTeams: 0 })
})

describe("EditBingoModal tabs", () => {
  it("shows Ship rules and no Pattern bonuses for a battleship board", () => {
    renderModal()
    expect(tab("Ship rules")).toBeInTheDocument()
    expect(tab("Pattern Bonuses")).not.toBeInTheDocument()
  })

  it("shows Pattern bonuses and no Ship rules for a standard board", async () => {
    renderModal({
      bingo: { ...baseBingo, bingoType: "standard" },
      battleship: undefined,
    })
    // Let the pattern bonus load settle.
    await act(async () => {})
    expect(tab("Pattern Bonuses")).toBeInTheDocument()
    expect(tab("Ship rules")).not.toBeInTheDocument()
  })

  it("hides both for a progression board", () => {
    renderModal({
      bingo: { ...baseBingo, bingoType: "progression" },
      battleship: undefined,
    })
    expect(tab("Pattern Bonuses")).not.toBeInTheDocument()
    expect(tab("Ship rules")).not.toBeInTheDocument()
  })
})

describe("EditBingoModal ship rules", () => {
  const openShipRules = () =>
    fireEvent.click(screen.getByRole("tab", { name: "Ship rules" }))
  const save = () =>
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }))

  it("warns that changing the rules clears every team's fleet", async () => {
    renderModal()
    openShipRules()
    expect(
      await screen.findByText(/clears the placed fleet of every team/)
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "More ships of type 1" })
    ).toBeEnabled()
  })

  it("saves changed rules with the other settings in one call and reports the cleared teams", async () => {
    updateBingoMock.mockResolvedValue({ success: true, clearedTeams: 2 })
    renderModal()
    openShipRules()
    fireEvent.click(
      await screen.findByRole("button", { name: "More ships of type 1" })
    )
    save()

    await waitFor(() => expect(updateBingoMock).toHaveBeenCalledTimes(1))
    expect(updateBingoMock).toHaveBeenCalledWith(
      "bingo-1",
      expect.objectContaining({
        title: "Fleet battle",
        shipRules: [
          { length: 2, count: 2 },
          { length: 3, count: 2 },
        ],
      })
    )
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining("2 teams were"),
        })
      )
    )
  })

  it("does not send rules that did not change, so nothing is cleared", async () => {
    renderModal()
    save()
    await waitFor(() => expect(updateBingoMock).toHaveBeenCalledTimes(1))
    expect(updateBingoMock.mock.calls[0]![1].shipRules).toBeUndefined()
  })

  it("shows the server's reason when saving fails", async () => {
    updateBingoMock.mockResolvedValue({
      success: false,
      error: "Ship setup is only allowed before the event starts",
    })
    jest.spyOn(console, "error").mockImplementation(() => {})
    renderModal()
    save()
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "Ship setup is only allowed before the event starts",
        })
      )
    )
  })

  it("does not call the server when the fleet does not fit the board", async () => {
    renderModal({
      bingo: { ...baseBingo, rows: 3, columns: 3, bingoType: "battleship" },
    })
    openShipRules()
    // 3-tile ships x4 = 12 tiles on a 9 tile board.
    for (let i = 0; i < 2; i++) {
      fireEvent.click(
        await screen.findByRole("button", { name: "More ships of type 2" })
      )
    }
    save()

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          title: "The fleet does not fit this board",
        })
      )
    )
    expect(updateBingoMock).not.toHaveBeenCalled()
  })

  it("is read-only with an explanation once the event has started", async () => {
    renderModal({ battleship: { rules: fleet, started: true } })
    openShipRules()
    expect(
      await screen.findByText(
        /The event has started, so the fleet can no longer change/
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "More ships of type 1" })
    ).toBeDisabled()
    expect(
      screen.queryByRole("button", { name: "Add another ship type" })
    ).not.toBeInTheDocument()

    save()
    await waitFor(() => expect(updateBingoMock).toHaveBeenCalledTimes(1))
    expect(updateBingoMock.mock.calls[0]![1].shipRules).toBeUndefined()
  })
})
