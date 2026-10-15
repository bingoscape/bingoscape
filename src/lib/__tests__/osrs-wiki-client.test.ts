import {
  DEFAULT_OSRS_IMAGE_CACHE_DIR,
  getOsrsImageCacheDir,
  getWikiUserAgent,
  wikiRequestHeaders,
} from "@/lib/osrs-wiki-client"

const ORIGINAL = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL }
})

describe("getWikiUserAgent", () => {
  it("puts the contact address from the env into the User-Agent", () => {
    process.env.OSRS_WIKI_CONTACT_EMAIL = "ops@example.test"
    expect(getWikiUserAgent()).toBe("Bingoscape/1.0.0 - ops@example.test")
    expect(wikiRequestHeaders()).toEqual({
      "User-Agent": "Bingoscape/1.0.0 - ops@example.test",
    })
  })

  it("falls back when the contact is unset or empty", () => {
    delete process.env.OSRS_WIKI_CONTACT_EMAIL
    expect(getWikiUserAgent()).toBe("Bingoscape/1.0.0 - unknown@example.com")
    process.env.OSRS_WIKI_CONTACT_EMAIL = "  "
    expect(getWikiUserAgent()).toBe("Bingoscape/1.0.0 - unknown@example.com")
  })
})

describe("getOsrsImageCacheDir", () => {
  it("uses the env var, or the dev default", () => {
    process.env.OSRS_IMAGE_CACHE_DIR = "/app/data/osrs-images"
    expect(getOsrsImageCacheDir()).toBe("/app/data/osrs-images")
    delete process.env.OSRS_IMAGE_CACHE_DIR
    expect(getOsrsImageCacheDir()).toBe(DEFAULT_OSRS_IMAGE_CACHE_DIR)
    expect(DEFAULT_OSRS_IMAGE_CACHE_DIR).toBe("./.data/osrs-images")
  })
})
