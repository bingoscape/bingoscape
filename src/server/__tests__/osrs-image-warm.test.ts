/**
 * @jest-environment node
 *
 * The cache warm-up (wiki image cache 6/6, #232): URL collection, the plan
 * against the cache table, the paced loop and the dry run. No database, no
 * network: the cache is replaced by a mock.
 */
import { OSRS_FROG_IMAGES } from "@/lib/getRandomFrog"
import { parseWikiImageUrl } from "@/lib/osrs-image"
import type { GetCachedImageResult } from "@/server/osrs-image/cache"
import {
  WARM_INTERVAL_MS,
  builtInImageUrls,
  collectWikiKeys,
  planWarmUp,
  runWarmUp,
  templateJsonStrings,
  warmUp,
  type CacheRowState,
} from "@/server/osrs-image/warm"

const WIKI = "https://oldschool.runescape.wiki/images"
const NOW = new Date("2026-03-01T12:00:00.000Z")

const hit = { kind: "hit" } as unknown as GetCachedImageResult
const notFound: GetCachedImageResult = {
  kind: "unavailable",
  status: "not_found",
  retryAfter: null,
}

describe("collectWikiKeys", () => {
  it("dedupes URLs that differ only in ?hash or percent-encoding", () => {
    expect(
      collectWikiKeys([
        `${WIKI}/Dave.png?d30e8`,
        `${WIKI}/Dave.png?other`,
        `${WIKI}/Dave.png`,
        `${WIKI}/Frog_(Zanaris).png`,
        `${WIKI}/Frog_%28Zanaris%29.png`,
      ])
    ).toEqual(["Dave.png", "Frog_%28Zanaris%29.png"])
  })

  it("skips everything that is not an OSRS Wiki image", () => {
    expect(
      collectWikiKeys([
        null,
        undefined,
        "",
        "/uploads/a.png",
        "https://example.com/images/a.png",
        "https://runescape.wiki/images/Nex.png",
        "https://oldschool.runescape.wiki/w/Dave",
        "https://oldschool.runescape.wiki/images/Evil.svg",
        "https://oldschool.runescape.wiki.evil.test/images/Dave.png",
        "just some description text",
        `${WIKI}/Sue.png`,
      ])
    ).toEqual(["Sue.png"])
  })

  it("returns the keys sorted, so a run is deterministic", () => {
    expect(
      collectWikiKeys([`${WIKI}/Zulrah.png`, `${WIKI}/Abyssal_Sire.png`])
    ).toEqual(["Abyssal_Sire.png", "Zulrah.png"])
  })
})

describe("templateJsonStrings", () => {
  it("reads every string value, nested ones included", () => {
    const json = JSON.stringify({
      metadata: { title: "T" },
      tiles: [
        {
          headerImage: `${WIKI}/Nex.png`,
          goals: [{ imageUrl: `${WIKI}/Dave.png`, targetValue: 3 }],
        },
      ],
    })
    expect(collectWikiKeys(templateJsonStrings(json))).toEqual([
      "Dave.png",
      "Nex.png",
    ])
  })

  it("yields nothing for a document that is not JSON", () => {
    expect(templateJsonStrings("not json {")).toEqual([])
  })
})

describe("builtInImageUrls", () => {
  const keys = collectWikiKeys(builtInImageUrls())

  it("lists the frogs, the metric icons and the showcase template images", () => {
    for (const frog of OSRS_FROG_IMAGES) {
      expect(keys).toContain(parseWikiImageUrl(frog)!.key)
    }
    expect(keys).toContain("Woodcutting_icon.png")
    expect(keys).toContain("Zulrah.png")
    expect(keys).toContain("TzRek-Jad.png")
  })

  it("only yields keys the cache may fetch", () => {
    expect(keys.length).toBeGreaterThan(50)
  })
})

describe("planWarmUp", () => {
  const rows: CacheRowState[] = [
    { key: "a.png", status: "ok", retryAfter: null },
    {
      key: "b.png",
      status: "not_found",
      retryAfter: new Date(NOW.getTime() + 1000),
    },
    {
      key: "c.png",
      status: "error",
      retryAfter: new Date(NOW.getTime() - 1000),
    },
  ]

  it("skips cached keys and keys inside their backoff, fetches the rest", () => {
    expect(
      planWarmUp(["a.png", "b.png", "c.png", "d.png"], rows, NOW)
    ).toEqual({
      total: 4,
      cached: 1,
      backingOff: 1,
      pending: ["c.png", "d.png"],
    })
  })

  it("is resumable: the next plan only holds what is still missing", () => {
    const after: CacheRowState[] = [
      ...rows,
      { key: "d.png", status: "ok", retryAfter: null },
      { key: "c.png", status: "ok", retryAfter: null },
    ]
    expect(
      planWarmUp(["a.png", "b.png", "c.png", "d.png"], after, NOW).pending
    ).toEqual([])
  })
})

describe("warmUp", () => {
  it("fetches in order, pauses between requests and counts failures", async () => {
    const calls: string[] = []
    const sleeps: number[] = []
    const result = await warmUp(["a.png", "b.png", "c.png"], {
      fetchImage: async (key) => {
        calls.push(key)
        return key === "b.png" ? notFound : hit
      },
      sleep: async (ms) => {
        sleeps.push(ms)
      },
    })
    expect(calls).toEqual(["a.png", "b.png", "c.png"])
    // About one request per second: a pause between requests, none before the first.
    expect(sleeps).toEqual([WARM_INTERVAL_MS, WARM_INTERVAL_MS])
    expect(result).toEqual({ fetched: 2, failed: 1, stopped: false })
  })

  it("counts a throwing fetch as failed and keeps going", async () => {
    const result = await warmUp(["a.png", "b.png"], {
      fetchImage: async (key) => {
        if (key === "a.png") throw new Error("boom")
        return hit
      },
      sleep: async () => undefined,
    })
    expect(result).toEqual({ fetched: 1, failed: 1, stopped: false })
  })

  it("stops before the next image when asked to", async () => {
    let stop = false
    const fetchImage = jest.fn(async () => {
      stop = true
      return hit
    })
    const result = await warmUp(["a.png", "b.png", "c.png"], {
      fetchImage,
      sleep: async () => undefined,
      shouldStop: () => stop,
    })
    expect(fetchImage).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ fetched: 1, failed: 0, stopped: true })
  })
})

describe("runWarmUp", () => {
  const urls = [`${WIKI}/Dave.png?x`, `${WIKI}/Sue.png`, `${WIKI}/Gary.png`]
  const rows: CacheRowState[] = [
    { key: "Dave.png", status: "ok", retryAfter: null },
  ]

  it("--dry-run prints the counts and makes no request", async () => {
    const lines: string[] = []
    const fetchImage = jest.fn()
    const loadFetchImage = jest.fn(async () => fetchImage)
    const sleep = jest.fn(async () => undefined)

    const { plan, result } = await runWarmUp({
      urls,
      rows,
      now: NOW,
      dryRun: true,
      loadFetchImage,
      sleep,
      log: (line) => lines.push(line),
    })

    expect(plan).toMatchObject({
      total: 3,
      cached: 1,
      pending: ["Gary.png", "Sue.png"],
    })
    expect(result).toBeNull()
    // The cache module is not even loaded.
    expect(loadFetchImage).not.toHaveBeenCalled()
    expect(fetchImage).not.toHaveBeenCalled()
    expect(sleep).not.toHaveBeenCalled()
    const output = lines.join("\n")
    expect(output).toContain("Distinct wiki images referenced: 3")
    expect(output).toContain("to fetch:                      2")
    expect(output).toContain("Dry run")
  })

  it("fetches only the missing images otherwise", async () => {
    const fetchImage = jest.fn(async (_key: string) => hit)
    const { result } = await runWarmUp({
      urls,
      rows,
      now: NOW,
      dryRun: false,
      loadFetchImage: async () => fetchImage,
      sleep: async () => undefined,
      log: () => undefined,
    })
    expect(fetchImage.mock.calls.map(([key]) => key)).toEqual([
      "Gary.png",
      "Sue.png",
    ])
    expect(result).toEqual({ fetched: 2, failed: 0, stopped: false })
  })

  it("does nothing when the cache is already warm", async () => {
    const loadFetchImage = jest.fn()
    const { result } = await runWarmUp({
      urls: [`${WIKI}/Dave.png`],
      rows,
      now: NOW,
      dryRun: false,
      loadFetchImage,
      sleep: async () => undefined,
      log: () => undefined,
    })
    expect(result).toBeNull()
    expect(loadFetchImage).not.toHaveBeenCalled()
  })
})
