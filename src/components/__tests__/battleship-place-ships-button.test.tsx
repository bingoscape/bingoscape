import { render, screen } from "@testing-library/react"
import { BattleshipPlaceShipsButton } from "../battleship-place-ships-button"

describe("BattleshipPlaceShipsButton", () => {
  it("renders nothing without a team id", () => {
    const { container } = render(
      <BattleshipPlaceShipsButton
        eventId="event-1"
        bingoId="bingo-1"
        teamId={undefined}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("links to the ship placement page for the team", () => {
    render(
      <BattleshipPlaceShipsButton
        eventId="event-1"
        bingoId="bingo-1"
        teamId="team-42"
      />
    )

    const link = screen.getByRole("link", { name: /place ships/i })
    expect(link).toHaveAttribute(
      "href",
      "/events/event-1/bingos/bingo-1/ships?teamId=team-42"
    )
  })
})
