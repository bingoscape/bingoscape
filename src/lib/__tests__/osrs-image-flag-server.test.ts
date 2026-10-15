/**
 * @jest-environment node
 */
import { toProxyUrl } from "@/lib/osrs-image"

const URL_ = "https://oldschool.runescape.wiki/images/Great_Olm.png?f1081"

describe("toProxyUrl on the server", () => {
  const original = process.env.OSRS_IMAGE_PROXY

  afterEach(() => {
    if (original === undefined) delete process.env.OSRS_IMAGE_PROXY
    else process.env.OSRS_IMAGE_PROXY = original
  })

  it("rewrites by default", () => {
    delete process.env.OSRS_IMAGE_PROXY
    expect(toProxyUrl(URL_)).toBe("/api/osrs-image/Great_Olm.png")
  })

  it("returns its input when OSRS_IMAGE_PROXY is false", () => {
    process.env.OSRS_IMAGE_PROXY = "false"
    expect(toProxyUrl(URL_)).toBe(URL_)
  })

  it("is read on every call, so a restart is enough to flip it", () => {
    process.env.OSRS_IMAGE_PROXY = "false"
    expect(toProxyUrl(URL_)).toBe(URL_)
    process.env.OSRS_IMAGE_PROXY = "true"
    expect(toProxyUrl(URL_)).toBe("/api/osrs-image/Great_Olm.png")
  })
})
