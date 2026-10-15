/**
 * @jest-environment node
 *
 * The wiki image search action (wiki image cache 5/6, #231) with a mocked
 * session and a mocked `fetch`: nothing reaches the real wiki.
 */
import { searchWikiImages } from "@/app/actions/wiki-image-search"
import { RATE_LIMITS } from "@/lib/rate-limit-policies"
import { getServerAuthSession } from "@/server/auth"
import { resetRateLimits } from "@/server/rate-limit"
import {
  SEARCH_CACHE_TTL_MS,
  resetWikiSearchCache,
  searchWikiImagesCached,
} from "@/server/wiki-image-search"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("next/headers", () => ({ headers: async () => new Headers() }))
jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}))

const mockedSession = getServerAuthSession as jest.Mock
const fetchMock = jest.fn()

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

const searchResponse = (...titles: string[]) =>
  json({ query: { search: titles.map((title) => ({ title })) } })

function infoPage(host: string, file: string) {
  return {
    title: `File:${file}`,
    imageinfo: [
      {
        url: `https://${host}/images/${file}?abc12`,
        thumburl: `https://${host}/images/thumb/${file}/100px-${file}`,
      },
    ],
  }
}

const OSRS = "oldschool.runescape.wiki"

/** Answers the search call with `files`, the info call with a page per file. */
function mockWiki(host: string, ...files: string[]) {
  fetchMock.mockImplementation(async (url: string) => {
    const params = new URL(url).searchParams
    if (params.get("list") === "search") {
      return searchResponse(...files.map((f) => `File:${f}`))
    }
    return json({
      query: { pages: files.map((f) => infoPage(host, f)) },
    })
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  fetchMock.mockReset()
  global.fetch = fetchMock as unknown as typeof fetch
  resetRateLimits()
  resetWikiSearchCache()
  mockedSession.mockResolvedValue({ user: { id: "user-1" } })
  process.env.OSRS_WIKI_CONTACT_EMAIL = "ops@example.test"
})

describe("searchWikiImages", () => {
  it("requires a signed-in user and never calls the wiki without one", async () => {
    mockedSession.mockResolvedValue(null)
    const result = await searchWikiImages("whip", "osrs")
    expect(result).toEqual({ success: false, error: "Unauthorized" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects an unknown game and bad queries before any request", async () => {
    const unknownGame = await searchWikiImages(
      "whip",
      "evil.example" as unknown as "osrs"
    )
    expect(unknownGame.success).toBe(false)
    expect((await searchWikiImages("   ", "osrs")).success).toBe(false)
    expect((await searchWikiImages("x".repeat(101), "osrs")).success).toBe(
      false
    )
    expect(
      (await searchWikiImages(42 as unknown as string, "osrs")).success
    ).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("maps the wiki response and keeps the search order", async () => {
    // The info response lists the pages in another order than the search.
    fetchMock.mockImplementation(async (url: string) => {
      if (new URL(url).searchParams.get("list") === "search") {
        return searchResponse("File:Whip.png", "File:Whip_(red).png")
      }
      return json({
        query: {
          pages: [infoPage(OSRS, "Whip_(red).png"), infoPage(OSRS, "Whip.png")],
        },
      })
    })

    const result = await searchWikiImages("whip", "osrs")

    expect(result).toEqual({
      success: true,
      images: [
        {
          title: "Whip.png",
          url: `https://${OSRS}/images/Whip.png?abc12`,
          thumbnail: `https://${OSRS}/images/thumb/Whip.png/100px-Whip.png`,
        },
        {
          title: "Whip_(red).png",
          url: `https://${OSRS}/images/Whip_(red).png?abc12`,
          thumbnail: `https://${OSRS}/images/thumb/Whip_(red).png/100px-Whip_(red).png`,
        },
      ],
    })
  })

  it("makes one search and one batched info request with the shared User-Agent", async () => {
    mockWiki(OSRS, "A.png", "B.png", "C.png")

    await searchWikiImages("abyssal whip", "osrs")

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [searchUrl, searchInit] = fetchMock.mock.calls[0]!
    const [infoUrl, infoInit] = fetchMock.mock.calls[1]!
    expect(new URL(searchUrl).origin).toBe(`https://${OSRS}`)
    expect(new URL(searchUrl).pathname).toBe("/api.php")
    expect(new URL(searchUrl).searchParams.get("srsearch")).toBe("abyssal whip")
    expect(new URL(searchUrl).searchParams.get("srnamespace")).toBe("6")
    expect(new URL(infoUrl).origin).toBe(`https://${OSRS}`)
    expect(new URL(infoUrl).searchParams.get("titles")).toBe(
      "File:A.png|File:B.png|File:C.png"
    )
    for (const init of [searchInit, infoInit]) {
      expect(init.headers).toEqual({
        "User-Agent": "Bingoscape/1.0.0 - ops@example.test",
      })
    }
  })

  it("makes a single request when nothing matches", async () => {
    fetchMock.mockResolvedValue(searchResponse())
    const result = await searchWikiImages("zzzzqqq", "osrs")
    expect(result).toEqual({ success: true, images: [] })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("answers a repeated search from the cache without a request", async () => {
    mockWiki(OSRS, "A.png")
    const first = await searchWikiImages("Abyssal  Whip", "osrs")
    expect(fetchMock).toHaveBeenCalledTimes(2)

    // Same search after normalisation (case, whitespace), also for another user.
    mockedSession.mockResolvedValue({ user: { id: "user-2" } })
    const second = await searchWikiImages(" abyssal whip ", "osrs")

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(second).toEqual(first)
  })

  it("searches again once the cached answer has expired", async () => {
    mockWiki(OSRS, "A.png")
    const t0 = 1_000_000
    await searchWikiImagesCached("osrs", "whip", t0)
    await searchWikiImagesCached("osrs", "whip", t0 + SEARCH_CACHE_TTL_MS - 1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await searchWikiImagesCached("osrs", "whip", t0 + SEARCH_CACHE_TTL_MS + 1)
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it("shares one request between concurrent identical searches", async () => {
    mockWiki(OSRS, "A.png")
    await Promise.all([
      searchWikiImages("whip", "osrs"),
      searchWikiImages("whip", "osrs"),
    ])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("keeps the wikis apart and uses the RuneScape 3 wiki host for rs3", async () => {
    mockWiki("runescape.wiki", "Whip.png")
    const rs3 = await searchWikiImages("whip", "rs3")

    expect(new URL(fetchMock.mock.calls[0]![0]).origin).toBe(
      "https://runescape.wiki"
    )
    expect(rs3).toMatchObject({
      success: true,
      images: [{ url: "https://runescape.wiki/images/Whip.png?abc12" }],
    })

    // The same query on the other game is not served from the rs3 answer.
    fetchMock.mockClear()
    mockWiki(OSRS, "Whip.png")
    await searchWikiImages("whip", "osrs")
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(new URL(fetchMock.mock.calls[0]![0]).origin).toBe(`https://${OSRS}`)
  })

  it("drops results whose URL is not on the wiki host", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (new URL(url).searchParams.get("list") === "search") {
        return searchResponse("File:Good.png", "File:Evil.png")
      }
      return json({
        query: {
          pages: [
            infoPage(OSRS, "Good.png"),
            infoPage("evil.example", "Evil.png"),
          ],
        },
      })
    })
    const result = await searchWikiImages("x", "osrs")
    expect(result).toMatchObject({
      success: true,
      images: [{ title: "Good.png" }],
    })
    expect((result as { images: unknown[] }).images).toHaveLength(1)
  })

  it("returns an error, and does not cache it, when the wiki fails", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 503))
    const failed = await searchWikiImages("whip", "osrs")
    expect(failed).toEqual({
      success: false,
      error: "The wiki search is unavailable right now",
    })

    mockWiki(OSRS, "A.png")
    const retry = await searchWikiImages("whip", "osrs")
    expect(retry.success).toBe(true)
  })

  it("treats a wiki API error object as a failure", async () => {
    fetchMock.mockResolvedValue(json({ error: { code: "badvalue" } }))
    expect((await searchWikiImages("whip", "osrs")).success).toBe(false)
  })

  it("enforces the per-user rate limit and counts each user on their own", async () => {
    mockWiki(OSRS, "A.png")
    const { limit } = RATE_LIMITS.wikiImageSearch
    for (let i = 0; i < limit; i++) {
      expect((await searchWikiImages(`query ${i}`, "osrs")).success).toBe(true)
    }
    fetchMock.mockClear()

    const blocked = await searchWikiImages("one more", "osrs")
    expect(blocked).toMatchObject({ success: false, code: "RATE_LIMITED" })
    expect(fetchMock).not.toHaveBeenCalled()

    mockedSession.mockResolvedValue({ user: { id: "user-2" } })
    expect((await searchWikiImages("one more", "osrs")).success).toBe(true)
  })
})
