import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import { searchWikiImages } from "@/app/actions/wiki-image-search"
import { TileDetailsTab } from "@/components/tile-details-tab"
import type { Tile } from "@/types/model"

jest.mock("@/app/actions/wiki-image-search", () => ({
  searchWikiImages: jest.fn(),
}))
jest.mock("@/app/actions/tracker", () => ({ syncTrackerProgress: jest.fn() }))
jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}))
// ESM-only and not what this test is about.
jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))
jest.mock("@/components/forward-ref-editor", () => ({
  ForwardRefEditor: () => null,
}))

const mockedSearch = searchWikiImages as jest.Mock
const fetchMock = jest.fn()

beforeAll(() => {
  // jsdom has no ResizeObserver; the Radix scroll area uses one.
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = fetchMock as unknown as typeof fetch
})

const tile = {
  id: "t1",
  title: "Frog",
  description: "",
  weight: 10,
  headerImage: null,
  isHidden: false,
  goals: [],
  goalGroups: [],
} as unknown as Tile

function openSearch(gameType: "osrs" | "rs3") {
  render(
    <TileDetailsTab
      selectedTile={tile}
      editedTile={{ title: "Frog", weight: 10 }}
      canEdit
      teams={[]}
      gameType={gameType}
      onEditTile={jest.fn()}
      onUpdateTile={jest.fn()}
      onEditorChange={jest.fn()}
      onUpdateProgress={jest.fn()}
    />
  )
  fireEvent.click(screen.getByRole("button", { name: /edit/i }))
  fireEvent.click(
    screen.getByRole("button", {
      name: gameType === "osrs" ? /osrs wiki/i : /rs3 wiki/i,
    })
  )
}

function search(query: string) {
  fireEvent.change(screen.getByPlaceholderText(/search for images/i), {
    target: { value: query },
  })
  fireEvent.click(screen.getByRole("button", { name: "Search" }))
}

describe("TileDetailsTab wiki image search", () => {
  it("searches through the server action and makes no direct request to the wiki", async () => {
    mockedSearch.mockResolvedValue({
      success: true,
      images: [
        {
          title: "Giant_frog.png",
          url: "https://oldschool.runescape.wiki/images/Giant_frog.png?a8fe4",
          thumbnail:
            "https://oldschool.runescape.wiki/images/thumb/Giant_frog.png/100px-Giant_frog.png",
        },
      ],
    })
    openSearch("osrs")

    search("frog")

    expect(await screen.findByText("Giant_frog.png")).toBeInTheDocument()
    expect(mockedSearch).toHaveBeenCalledWith("frog", "osrs")
    expect(fetchMock).not.toHaveBeenCalled()
    // Thumbnails are served by our own cache route.
    expect(screen.getByAltText("Giant_frog.png").getAttribute("src")).toContain(
      encodeURIComponent("/api/osrs-image/thumb/Giant_frog.png/100px-Giant_frog.png")
    )
  })

  it("passes the game of an RS3 event to the action", async () => {
    mockedSearch.mockResolvedValue({ success: true, images: [] })
    openSearch("rs3")

    search("frog")

    await waitFor(() =>
      expect(mockedSearch).toHaveBeenCalledWith("frog", "rs3")
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
