/**
 * @jest-environment node
 */
import fs from "fs/promises"
import os from "os"
import path from "path"

import { getInlineImageSrc } from "@/server/osrs-image/inline"
import { getCachedImage } from "@/server/osrs-image/cache"

jest.mock("@/server/osrs-image/cache", () => ({ getCachedImage: jest.fn() }))

const mockedGet = jest.mocked(getCachedImage)
const WIKI = "https://oldschool.runescape.wiki/images/Great_Olm.png?f1081"

describe("getInlineImageSrc", () => {
  let dir: string
  let file: string
  const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "inline-"))
    file = path.join(dir, "olm.png")
    await fs.writeFile(file, bytes)
  })
  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })
  beforeEach(() => {
    mockedGet.mockReset()
    delete process.env.OSRS_IMAGE_PROXY
  })

  it("inlines a cached wiki image as a data URI", async () => {
    mockedGet.mockResolvedValue({
      kind: "hit",
      image: {
        key: "Great_Olm.png",
        filePath: file,
        contentType: "image/png",
        bytes: bytes.length,
        etag: '"x"',
      },
    })
    await expect(getInlineImageSrc(WIKI)).resolves.toBe(
      `data:image/png;base64,${bytes.toString("base64")}`
    )
    expect(mockedGet).toHaveBeenCalledWith("Great_Olm.png")
  })

  it("returns null when the cache has no image", async () => {
    mockedGet.mockResolvedValue({
      kind: "unavailable",
      status: "not_found",
      retryAfter: null,
    })
    await expect(getInlineImageSrc(WIKI)).resolves.toBeNull()
  })

  it("returns null when the cached file cannot be read", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined)
    mockedGet.mockResolvedValue({
      kind: "hit",
      image: {
        key: "Great_Olm.png",
        filePath: path.join(dir, "missing.png"),
        contentType: "image/png",
        bytes: 1,
        etag: '"x"',
      },
    })
    await expect(getInlineImageSrc(WIKI)).resolves.toBeNull()
  })

  it("passes other URLs through without touching the cache", async () => {
    await expect(getInlineImageSrc("https://example.com/a.png")).resolves.toBe(
      "https://example.com/a.png"
    )
    await expect(getInlineImageSrc(null)).resolves.toBeNull()
    expect(mockedGet).not.toHaveBeenCalled()
  })

  it("keeps the wiki URL while OSRS_IMAGE_PROXY is off", async () => {
    process.env.OSRS_IMAGE_PROXY = "false"
    await expect(getInlineImageSrc(WIKI)).resolves.toBe(WIKI)
    expect(mockedGet).not.toHaveBeenCalled()
  })
})
