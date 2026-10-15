import { render } from "@testing-library/react"

import { BingoTile } from "@/components/bingo-tile"
import { PROXY_DISABLED_GLOBAL } from "@/lib/osrs-image"
import type { Tile } from "@/types/model"

const WIKI_IMAGE =
  "https://oldschool.runescape.wiki/images/thumb/Giant_frog.png/800px-Giant_frog.png?a8fe4"

function tile(headerImage: string | null): Tile {
  return {
    id: "tile-1",
    bingoId: "b1",
    index: 0,
    title: "Frog",
    description: "",
    headerImage,
    weight: 10,
    isHidden: false,
    isBlind: false,
    tier: 0,
    goals: [],
    goalGroups: [],
    teamTileSubmissions: [],
  } as unknown as Tile
}

function renderTile(headerImage: string | null) {
  return render(
    <BingoTile
      tile={tile(headerImage)}
      onClick={jest.fn()}
      onTogglePlaceholder={jest.fn()}
      isManagement={false}
      isLocked
      readOnly
    />
  )
}

/** next/image renders `unoptimized` sources as given. The image has an empty alt, so no img role. */
function imageSrc(container: HTMLElement) {
  return container.querySelector("img")?.getAttribute("src")
}

describe("BingoTile header image", () => {
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>)[PROXY_DISABLED_GLOBAL]
  })

  it("serves a wiki header image through the cache route", () => {
    const { container } = renderTile(WIKI_IMAGE)
    expect(imageSrc(container)).toBe(
      "/api/osrs-image/thumb/Giant_frog.png/800px-Giant_frog.png"
    )
  })

  it("leaves a non-wiki header image untouched", () => {
    const { container } = renderTile("https://example.com/pic.png")
    expect(imageSrc(container)).toBe("https://example.com/pic.png")
  })

  it("keeps the wiki URL while the proxy is switched off", () => {
    ;(window as unknown as Record<string, unknown>)[PROXY_DISABLED_GLOBAL] =
      false
    const { container } = renderTile(WIKI_IMAGE)
    expect(imageSrc(container)).toBe(WIKI_IMAGE)
  })
})
