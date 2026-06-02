import { render, screen } from "@testing-library/react"
import { BingoTile } from "../bingo-tile"

jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => <div>{children}</div>,
}))

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: { alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={props.alt} />
  ),
}))

jest.mock("@/app/actions/goal-groups", () => ({
  getGoalTreeWithProgress: jest.fn().mockResolvedValue([]),
}))

jest.mock("../compact-goal-tree", () => ({
  CompactGoalTree: () => null,
}))
import type { Tile } from "@/app/actions/events"

const baseTile: Tile = {
  id: "tile-1",
  bingoId: "bingo-1",
  title: "Dragon Slayer",
  description: "Kill a dragon",
  headerImage: "/frog.png",
  weight: 5,
  index: 0,
  isHidden: false,
  tier: 0,
  teamTileSubmissions: [],
}

describe("BingoTile battleship hits", () => {
  it("shows hit icon when the current team scored a hit", () => {
    render(
      <BingoTile
        tile={baseTile}
        onClick={jest.fn()}
        onTogglePlaceholder={jest.fn()}
        userRole="participant"
        currentTeamId="team-atk"
        isLocked
        isHitByCurrentTeam
      />
    )

    expect(screen.getByTestId("battleship-hit-icon")).toBeInTheDocument()
  })

  it("does not show hit icon when the current team did not score", () => {
    render(
      <BingoTile
        tile={baseTile}
        onClick={jest.fn()}
        onTogglePlaceholder={jest.fn()}
        userRole="participant"
        currentTeamId="team-atk"
        isLocked
        isHitByCurrentTeam={false}
      />
    )

    expect(screen.queryByTestId("battleship-hit-icon")).not.toBeInTheDocument()
  })

  it("shows miss icon when tile is completed but not a hit", () => {
    const tileWithApproval: Tile = {
      ...baseTile,
      teamTileSubmissions: [
        {
          id: "tts-1",
          teamId: "team-atk",
          status: "approved",
          createdAt: new Date(),
          updatedAt: new Date(),
          tileId: "tile-1",
          reviewedBy: null,
          submissions: [],
          team: {
            id: "team-atk",
            name: "Attackers",
            eventId: "event-1",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ],
    }

    render(
      <BingoTile
        tile={tileWithApproval}
        onClick={jest.fn()}
        onTogglePlaceholder={jest.fn()}
        userRole="participant"
        currentTeamId="team-atk"
        isLocked
        isMissByCurrentTeam
      />
    )

    expect(screen.getByTestId("battleship-miss-icon")).toBeInTheDocument()
    expect(screen.queryByTestId("battleship-hit-icon")).not.toBeInTheDocument()
  })

  it("does not show miss icon when the tile is a hit", () => {
    render(
      <BingoTile
        tile={baseTile}
        onClick={jest.fn()}
        onTogglePlaceholder={jest.fn()}
        userRole="participant"
        currentTeamId="team-atk"
        isLocked
        isHitByCurrentTeam
        isMissByCurrentTeam
      />
    )

    expect(screen.getByTestId("battleship-hit-icon")).toBeInTheDocument()
    expect(screen.queryByTestId("battleship-miss-icon")).not.toBeInTheDocument()
  })

  it("shows sunk icon instead of hit icon on fully sunk ship tiles", () => {
    render(
      <BingoTile
        tile={baseTile}
        onClick={jest.fn()}
        onTogglePlaceholder={jest.fn()}
        userRole="participant"
        currentTeamId="team-atk"
        isLocked
        isHitByCurrentTeam
        isSunkHitByCurrentTeam
      />
    )

    expect(screen.getByTestId("battleship-sunk-icon")).toBeInTheDocument()
    expect(screen.queryByTestId("battleship-hit-icon")).not.toBeInTheDocument()
  })

  it("renders blank placeholder cells when tile details are hidden", () => {
    render(
      <BingoTile
        tile={baseTile}
        onClick={jest.fn()}
        onTogglePlaceholder={jest.fn()}
        userRole="participant"
        isLocked
        hideTileDetails
        tileLabel="7"
      />
    )

    expect(screen.getByText("7")).toBeInTheDocument()
    expect(screen.queryByText("Dragon Slayer")).not.toBeInTheDocument()
    expect(screen.queryByTestId("battleship-hit-icon")).not.toBeInTheDocument()
  })
})
