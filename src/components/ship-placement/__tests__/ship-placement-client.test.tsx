import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"

import { ShipPlacementClient } from "@/components/ship-placement/ship-placement-client"
import type { PlacementTile } from "@/components/ship-placement/ship-placement-board"
import { saveTeamShipPlacements } from "@/app/actions/battleship"
import { toast } from "@/hooks/use-toast"

jest.mock("@/app/actions/battleship", () => ({
  saveTeamShipPlacements: jest.fn(),
}))
jest.mock("@/hooks/use-toast", () => ({ toast: jest.fn() }))

const saveMock = saveTeamShipPlacements as jest.Mock
const toastMock = toast as jest.Mock

/**
 * 4x3 board (3 rows, 4 columns), blind titles. Index 5 is hidden.
 *
 *   t0 t1 t2  t3
 *   t4 t5* t6 t7
 *   t8 t9 t10 t11
 */
const tiles: PlacementTile[] = Array.from({ length: 12 }, (_, index) => ({
  id: `t${index}`,
  index,
  title: `Tile ${index + 1}`,
  isHidden: index === 5,
  isBlind: true,
}))

// Two rules for length 2: they aggregate to two 2-tile ships, plus one 3-tile.
const rules = [
  { length: 2, count: 1 },
  { length: 2, count: 1 },
  { length: 3, count: 1 },
]

function renderClient(
  props: Partial<React.ComponentProps<typeof ShipPlacementClient>> = {}
) {
  return render(
    <ShipPlacementClient
      bingoId="bingo-1"
      teamId="team-1"
      teamName="Team Red"
      rows={3}
      columns={4}
      tiles={tiles}
      rules={rules}
      savedShips={[]}
      locked={false}
      {...props}
    />
  )
}

const cell = (name: string | RegExp) => screen.getByRole("gridcell", { name })
const tileCell = (n: number) => cell(new RegExp(`Tile ${n},`))
const click = (...numbers: number[]) =>
  numbers.forEach((n) => fireEvent.click(tileCell(n)))
const button = (name: string | RegExp) => screen.getByRole("button", { name })
const status = () => screen.getByRole("status")

beforeEach(() => {
  jest.clearAllMocks()
  saveMock.mockResolvedValue({ success: true })
})

describe("fleet palette", () => {
  it("shows one entry per length with the aggregated required count", () => {
    renderClient()
    const group = screen.getByRole("radiogroup", {
      name: "Ship length to place",
    })
    const entries = within(group).getAllByRole("radio")
    expect(entries).toHaveLength(2)
    expect(
      within(group).getByRole("radio", { name: /2 tiles.*0\/2 placed/ })
    ).toBeChecked()
    expect(
      within(group).getByRole("radio", { name: /3 tiles.*0\/1 placed/ })
    ).not.toBeChecked()
  })

  it("counts placed ships per length and completes a length", () => {
    renderClient()
    click(1, 2)
    expect(
      screen.getByRole("radio", { name: /2 tiles.*1\/2 placed/ })
    ).toBeChecked()
    click(9, 10)
    const done = screen.getByRole("radio", { name: /2 tiles.*2\/2 placed/ })
    expect(done).toBeDisabled()
    expect(screen.getByRole("radio", { name: /3 tiles/ })).toBeChecked()
  })

  it("lets the user pick the length to place next", () => {
    renderClient()
    fireEvent.click(screen.getByRole("radio", { name: /3 tiles/ }))
    click(1, 2, 3)
    expect(cell(/Tile 3, ship of length 3/)).toBeInTheDocument()
  })

  it("does not allow another length while a ship is being built", () => {
    renderClient()
    click(1)
    expect(screen.getByRole("radio", { name: /3 tiles/ })).toBeDisabled()
  })
})

describe("placing ships", () => {
  it("places a ship tile by tile and tells the user what to do next", () => {
    renderClient()
    click(1)
    expect(cell(/Tile 1, ship of length 2, being placed/)).toBeInTheDocument()
    expect(status()).toHaveTextContent("1 of 2 tiles")
    click(2)
    expect(cell(/Tile 2, ship of length 2$/)).toBeInTheDocument()
    expect(status()).toHaveTextContent("Placed a 2-tile ship")
  })

  it("only extends a ship from one of its ends", () => {
    renderClient()
    fireEvent.click(screen.getByRole("radio", { name: /3 tiles/ }))
    click(1, 5) // tile 5 is right below tile 1
    expect(status()).toHaveTextContent("2 of 3 tiles")
    click(7) // not next to either end of the column
    expect(status()).toHaveTextContent("straight line")
    expect(cell(/Tile 7, empty/)).toBeInTheDocument()
    click(2) // sideways from the top end
    expect(cell(/Tile 2, empty/)).toBeInTheDocument()
    click(9)
    expect(cell(/Tile 9, ship of length 3/)).toBeInTheDocument()
  })

  it("keeps hidden tiles out of reach", () => {
    renderClient()
    const hidden = screen.getByRole("gridcell", { name: /hidden tile/ })
    fireEvent.click(hidden)
    expect(status()).not.toHaveTextContent("1 of 2")
    expect(screen.queryByText(/ship of length 2, being placed/)).toBeNull()
  })

  it("places ships from the keyboard", () => {
    renderClient()
    const first = tileCell(1)
    first.focus()
    fireEvent.keyDown(first, { key: "Enter" })
    fireEvent.keyDown(first, { key: "ArrowRight" })
    fireEvent.keyDown(tileCell(2), { key: " " })
    expect(cell(/Tile 1, ship of length 2/)).toBeInTheDocument()
    expect(cell(/Tile 2, ship of length 2/)).toBeInTheDocument()
  })

  it("cancels the ship being built with Escape or the button", () => {
    renderClient()
    click(1)
    fireEvent.keyDown(tileCell(1), { key: "Escape" })
    expect(cell(/Tile 1, empty/)).toBeInTheDocument()
    click(1)
    fireEvent.click(button("Cancel ship"))
    expect(cell(/Tile 1, empty/)).toBeInTheDocument()
  })

  it("removes one single ship after selecting it", () => {
    renderClient()
    click(1, 2, 9, 10)
    expect(screen.queryByRole("button", { name: "Remove ship" })).toBeNull()

    click(9)
    expect(cell(/Tile 9, ship of length 2, selected/)).toBeInTheDocument()
    fireEvent.click(button("Remove ship"))

    expect(cell(/Tile 9, empty/)).toBeInTheDocument()
    expect(cell(/Tile 10, empty/)).toBeInTheDocument()
    // The other ship stays.
    expect(cell(/Tile 1, ship of length 2/)).toBeInTheDocument()
    expect(
      screen.getByRole("radio", { name: /2 tiles.*1\/2 placed/ })
    ).toBeChecked()
  })
})

describe("saving", () => {
  const placeAll = () => {
    click(1, 2) // 2
    click(9, 10) // 2
    click(4, 8, 12) // 3: tiles 4, 8, 12 are a column? 4=(r1,c0), 8=(r2,c0), 12=(r3,c0)
  }

  it("only enables Save once the whole fleet is placed", () => {
    renderClient()
    expect(button("Save placement")).toBeDisabled()
    click(1, 2, 9, 10)
    expect(button("Save placement")).toBeDisabled()
    expect(screen.getByText(/Place all 3 ships to save/)).toBeInTheDocument()
    click(4, 8, 12)
    expect(button("Save placement")).toBeEnabled()
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument()
  })

  it("saves the fleet, then shows it as saved", async () => {
    renderClient()
    placeAll()
    await act(async () => {
      fireEvent.click(button("Save placement"))
    })

    expect(saveMock).toHaveBeenCalledTimes(1)
    const [bingoId, teamId, fleet] = saveMock.mock.calls[0]!
    expect(bingoId).toBe("bingo-1")
    expect(teamId).toBe("team-1")
    expect(fleet).toEqual([
      { length: 2, tileIds: ["t0", "t1"] },
      { length: 2, tileIds: ["t8", "t9"] },
      { length: 3, tileIds: ["t3", "t7", "t11"] },
    ])
    await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument())
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Ships saved" })
    )
    expect(button("Save placement")).toBeDisabled()
  })

  it("disables the button while saving and never sends two saves at once", async () => {
    let resolveSave: (v: { success: boolean }) => void = () => {}
    saveMock.mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve
      })
    )
    renderClient()
    placeAll()

    const save = button("Save placement")
    await act(async () => {
      fireEvent.click(save)
      fireEvent.click(save)
    })

    expect(saveMock).toHaveBeenCalledTimes(1)
    expect(button("Saving…")).toBeDisabled()
    // The board and the other actions are locked too.
    expect(button("Reset")).toBeDisabled()
    fireEvent.click(tileCell(3))
    expect(saveMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveSave({ success: true })
    })
    await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument())
    expect(saveMock).toHaveBeenCalledTimes(1)
  })

  it("reports an error with a destructive toast and keeps the draft", async () => {
    saveMock.mockResolvedValue({
      success: false,
      error: "Ship setup is only allowed before the event starts",
    })
    renderClient()
    placeAll()
    await act(async () => {
      fireEvent.click(button("Save placement"))
    })

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        description: "Ship setup is only allowed before the event starts",
      })
    )
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument()
    expect(button("Save placement")).toBeEnabled()
  })

  it("reports an unexpected failure with a destructive toast", async () => {
    saveMock.mockRejectedValue(new Error("network"))
    renderClient()
    placeAll()
    await act(async () => {
      fireEvent.click(button("Save placement"))
    })
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive" })
    )
    expect(button("Save placement")).toBeEnabled()
  })

  it("warns before leaving the page with unsaved changes only", () => {
    renderClient()
    const leave = () => {
      const event = new Event("beforeunload", { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    }
    expect(leave()).toBe(false)
    click(1)
    expect(leave()).toBe(true)
  })
})

describe("saved fleet", () => {
  const saved = [
    { length: 2, tileIds: ["t0", "t1"] },
    { length: 2, tileIds: ["t8", "t9"] },
    { length: 3, tileIds: ["t3", "t7", "t11"] },
  ]

  it("starts as saved with the ships on the board", () => {
    renderClient({ savedShips: saved })
    expect(screen.getByText("Saved")).toBeInTheDocument()
    expect(cell(/Tile 12, ship of length 3/)).toBeInTheDocument()
    expect(button("Save placement")).toBeDisabled()
  })

  it("asks before it resets the board, and only saves on request", async () => {
    renderClient({ savedShips: saved })
    fireEvent.click(button("Reset"))
    const dialog = screen.getByRole("alertdialog")
    expect(within(dialog).getByText("Remove all ships?")).toBeInTheDocument()
    // Nothing changed yet (the board is hidden from assistive tech behind the dialog).
    expect(
      screen.getByRole("gridcell", {
        name: /Tile 1, ship of length 2/,
        hidden: true,
      })
    ).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Remove all ships" })
      )
    })
    expect(
      await screen.findByRole("gridcell", { name: /Tile 1, empty/ })
    ).toBeInTheDocument()
    expect(saveMock).not.toHaveBeenCalled()
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument()
  })

  it("keeps the ships when the reset is cancelled", () => {
    renderClient({ savedShips: saved })
    fireEvent.click(button("Reset"))
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Cancel",
      })
    )
    expect(cell(/Tile 1, ship of length 2/)).toBeInTheDocument()
  })

  it("discards unsaved changes after a confirmation", async () => {
    renderClient({ savedShips: saved })
    click(1)
    fireEvent.click(button("Remove ship"))
    expect(cell(/Tile 1, empty/)).toBeInTheDocument()

    fireEvent.click(button("Discard changes"))
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole("alertdialog")).getByRole("button", {
          name: "Discard changes",
        })
      )
    })
    expect(
      await screen.findByRole("gridcell", { name: /Tile 1, ship of length 2/ })
    ).toBeInTheDocument()
    expect(screen.getByText("Saved")).toBeInTheDocument()
  })

  it("clears the saved placement on the server after a confirmation", async () => {
    renderClient({ savedShips: saved })
    fireEvent.click(button("Clear placement"))
    expect(saveMock).not.toHaveBeenCalled()

    await act(async () => {
      fireEvent.click(
        within(screen.getByRole("alertdialog")).getByRole("button", {
          name: "Clear placement",
        })
      )
    })

    expect(saveMock).toHaveBeenCalledWith("bingo-1", "team-1", [])
    await waitFor(() => expect(cell(/Tile 1, empty/)).toBeInTheDocument())
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Placement cleared" })
    )
    expect(screen.getByText("Saved")).toBeInTheDocument()
  })
})

describe("locked", () => {
  it("explains that the event started and disables every change", () => {
    renderClient({
      locked: true,
      savedShips: [{ length: 2, tileIds: ["t0", "t1"] }],
    })
    expect(
      screen.getByText(
        "Ship placement is locked: the event has started. Ships can no longer be changed."
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Save placement" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Clear placement" })).toBeNull()
    expect(
      screen
        .getAllByRole("radio")
        .every((r) => (r as HTMLInputElement).disabled)
    ).toBe(true)

    fireEvent.click(tileCell(3))
    expect(cell(/Tile 3, empty/)).toBeInTheDocument()
    expect(cell(/Tile 1, ship of length 2/)).toBeInTheDocument()
  })
})
