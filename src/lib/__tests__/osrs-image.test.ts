import {
  normalizeWikiImagePath,
  parseWikiImageUrl,
  toProxyUrl,
} from "@/lib/osrs-image"

const BASE = "https://oldschool.runescape.wiki"

describe("parseWikiImageUrl", () => {
  it("accepts a plain image and keeps the path as key", () => {
    expect(
      parseWikiImageUrl(`${BASE}/images/Lunar_Chest_%28open%29.png`)
    ).toEqual({ key: "Lunar_Chest_%28open%29.png" })
    expect(parseWikiImageUrl(`${BASE}/images/Abyssal_whip.gif`)).toEqual({
      key: "Abyssal_whip.gif",
    })
  })

  it("accepts thumb URLs", () => {
    expect(
      parseWikiImageUrl(
        `${BASE}/images/thumb/Giant_frog.png/800px-Giant_frog.png`
      )
    ).toEqual({ key: "thumb/Giant_frog.png/800px-Giant_frog.png" })
  })

  it("strips ?hash and fragments so one image has one key", () => {
    const plain = parseWikiImageUrl(`${BASE}/images/Great_Olm.png`)
    expect(plain).toEqual({ key: "Great_Olm.png" })
    expect(parseWikiImageUrl(`${BASE}/images/Great_Olm.png?f1081`)).toEqual(
      plain
    )
    expect(parseWikiImageUrl(`${BASE}/images/Great_Olm.png?a=1&b=2`)).toEqual(
      plain
    )
    expect(parseWikiImageUrl(`${BASE}/images/Great_Olm.png#top`)).toEqual(plain)
    expect(
      parseWikiImageUrl(`${BASE}/images/thumb/Sue.png/290px-Sue.png?290bd`)
    ).toEqual({ key: "thumb/Sue.png/290px-Sue.png" })
  })

  it("normalises encoded and literal punctuation to one key", () => {
    const encoded = parseWikiImageUrl(`${BASE}/images/Frog_%28Zanaris%29.png`)
    const literal = parseWikiImageUrl(`${BASE}/images/Frog_(Zanaris).png`)
    expect(literal).toEqual(encoded)
    expect(parseWikiImageUrl(`${BASE}/images/Telos%2c_the_Warden.png`)).toEqual(
      { key: "Telos%2C_the_Warden.png" }
    )
    expect(parseWikiImageUrl(`${BASE}/images/Ranul's_staff.png`)).toEqual({
      key: "Ranul%27s_staff.png",
    })
  })

  it("accepts the allowed extensions case-insensitively", () => {
    expect(parseWikiImageUrl(`${BASE}/images/A.PNG`)).toEqual({ key: "A.PNG" })
    expect(parseWikiImageUrl(`${BASE}/images/A.jpg`)).not.toBeNull()
    expect(parseWikiImageUrl(`${BASE}/images/A.jpeg`)).not.toBeNull()
    expect(parseWikiImageUrl(`${BASE}/images/A.webp`)).not.toBeNull()
  })

  it("is case-insensitive on the host only", () => {
    expect(
      parseWikiImageUrl("https://OldSchool.RuneScape.wiki/images/A.png")
    ).toEqual({ key: "A.png" })
  })

  it.each([
    ["http", "http://oldschool.runescape.wiki/images/A.png"],
    ["other scheme", "ftp://oldschool.runescape.wiki/images/A.png"],
    ["protocol-relative", "//oldschool.runescape.wiki/images/A.png"],
    ["other host", "https://evil.example/images/A.png"],
    ["RS3 wiki", "https://runescape.wiki/images/A.png"],
    ["prices host", "https://prices.runescape.wiki/images/A.png"],
    ["subdomain", "https://x.oldschool.runescape.wiki/images/A.png"],
    [
      "host suffix",
      "https://oldschool.runescape.wiki.evil.example/images/A.png",
    ],
    ["host prefix", "https://eviloldschool.runescape.wiki/images/A.png"],
    ["userinfo", "https://user:pw@oldschool.runescape.wiki/images/A.png"],
    [
      "userinfo trick",
      "https://oldschool.runescape.wiki@evil.example/images/A.png",
    ],
    ["explicit port", "https://oldschool.runescape.wiki:443/images/A.png"],
    ["other port", "https://oldschool.runescape.wiki:8080/images/A.png"],
    [
      "backslash host",
      "https://oldschool.runescape.wiki\\@evil.example/images/A.png",
    ],
    ["trailing dot host", "https://oldschool.runescape.wiki./images/A.png"],
    ["no path", "https://oldschool.runescape.wiki"],
    ["no images prefix", "https://oldschool.runescape.wiki/A.png"],
    ["other prefix", "https://oldschool.runescape.wiki/w/File:A.png"],
    ["api", "https://oldschool.runescape.wiki/api.php?action=query"],
    ["prefix only", "https://oldschool.runescape.wiki/images/"],
    ["dot-dot", "https://oldschool.runescape.wiki/images/../etc/passwd.png"],
    [
      "dot-dot in thumb",
      "https://oldschool.runescape.wiki/images/thumb/../A.png",
    ],
    ["encoded dot-dot", "https://oldschool.runescape.wiki/images/%2e%2e/A.png"],
    [
      "encoded dot-dot upper",
      "https://oldschool.runescape.wiki/images/thumb/%2E%2E/800px-A.png",
    ],
    ["encoded slash", "https://oldschool.runescape.wiki/images/..%2FA.png"],
    [
      "encoded slash in name",
      "https://oldschool.runescape.wiki/images/a%2Fb.png",
    ],
    ["encoded backslash", "https://oldschool.runescape.wiki/images/a%5Cb.png"],
    [
      "double encoding",
      "https://oldschool.runescape.wiki/images/%252e%252e.png",
    ],
    [
      "bad percent encoding",
      "https://oldschool.runescape.wiki/images/%E0%A4%A.png",
    ],
    ["null byte", "https://oldschool.runescape.wiki/images/A%00.png"],
    ["newline", "https://oldschool.runescape.wiki/images/A%0A.png"],
    ["space", "https://oldschool.runescape.wiki/images/A%20B.png"],
    ["leading dot", "https://oldschool.runescape.wiki/images/.hidden.png"],
    ["empty segment", "https://oldschool.runescape.wiki/images//A.png"],
    ["trailing slash", "https://oldschool.runescape.wiki/images/A.png/"],
    ["svg", "https://oldschool.runescape.wiki/images/A.svg"],
    [
      "svg thumb",
      "https://oldschool.runescape.wiki/images/thumb/A.svg/120px-A.svg.png",
    ],
    ["no extension", "https://oldschool.runescape.wiki/images/A"],
    ["bad extension", "https://oldschool.runescape.wiki/images/A.exe"],
    ["double extension", "https://oldschool.runescape.wiki/images/A.png.php"],
    ["html", "https://oldschool.runescape.wiki/images/A.html"],
    [
      "thumb without size",
      "https://oldschool.runescape.wiki/images/thumb/A.png/A.png",
    ],
    [
      "thumb zero size",
      "https://oldschool.runescape.wiki/images/thumb/A.png/0px-A.png",
    ],
    [
      "thumb missing name",
      "https://oldschool.runescape.wiki/images/thumb/A.png",
    ],
    [
      "thumb extra segment",
      "https://oldschool.runescape.wiki/images/thumb/a/A.png/10px-A.png",
    ],
    [
      "unknown directory",
      "https://oldschool.runescape.wiki/images/archive/A.png/10px-A.png",
    ],
    ["leading space", " https://oldschool.runescape.wiki/images/A.png"],
    ["empty", ""],
    ["not a URL", "Giant_frog.png"],
    ["data URL", "data:image/png;base64,AAAA"],
    ["relative upload", "/uploads/abc.png"],
  ])("rejects %s", (_name, url) => {
    expect(parseWikiImageUrl(url)).toBeNull()
  })

  it("rejects overlong names", () => {
    expect(
      parseWikiImageUrl(`${BASE}/images/${"a".repeat(252)}.png`)
    ).toBeNull()
    expect(
      parseWikiImageUrl(`${BASE}/images/${"a".repeat(251)}.png`)
    ).not.toBeNull()
  })
})

describe("normalizeWikiImagePath", () => {
  it("returns the canonical key for a valid path and null otherwise", () => {
    expect(normalizeWikiImagePath("Frog_(Zanaris).png")).toBe(
      "Frog_%28Zanaris%29.png"
    )
    expect(normalizeWikiImagePath("")).toBeNull()
    expect(normalizeWikiImagePath("../A.png")).toBeNull()
    expect(normalizeWikiImagePath("A.svg")).toBeNull()
  })

  it("is idempotent on its own output", () => {
    const key = normalizeWikiImagePath(
      "thumb/Frog_(Zanaris).png/200px-Frog_(Zanaris).png"
    )
    expect(key).toBe(
      "thumb/Frog_%28Zanaris%29.png/200px-Frog_%28Zanaris%29.png"
    )
    expect(normalizeWikiImagePath(key ?? "")).toBe(key)
  })
})

describe("toProxyUrl", () => {
  it("rewrites an allowlisted wiki URL to the proxy route", () => {
    expect(toProxyUrl(`${BASE}/images/Great_Olm.png?f1081`)).toBe(
      "/api/osrs-image/Great_Olm.png"
    )
    expect(
      toProxyUrl(
        `${BASE}/images/thumb/Giant_frog.png/800px-Giant_frog.png?a8fe4`
      )
    ).toBe("/api/osrs-image/thumb/Giant_frog.png/800px-Giant_frog.png")
    expect(toProxyUrl(`${BASE}/images/Frog_%28Zanaris%29.png`)).toBe(
      "/api/osrs-image/Frog_%28Zanaris%29.png"
    )
  })

  it("returns everything else unchanged", () => {
    const unchanged = [
      "http://oldschool.runescape.wiki/images/A.png",
      "https://runescape.wiki/images/thumb/Nex.png/800px-Nex.png",
      "https://cdn.discordapp.com/avatars/1/2.png",
      "https://evil.example/images/A.png",
      "https://oldschool.runescape.wiki/images/A.svg",
      "https://oldschool.runescape.wiki/images/../A.png",
      "/uploads/abc.png",
      "/api/osrs-image/Great_Olm.png",
      "not a url",
    ]
    for (const url of unchanged) expect(toProxyUrl(url)).toBe(url)
  })

  it("passes null, undefined and empty values through", () => {
    expect(toProxyUrl(null)).toBeNull()
    expect(toProxyUrl(undefined)).toBeUndefined()
    expect(toProxyUrl("")).toBe("")
  })
})
