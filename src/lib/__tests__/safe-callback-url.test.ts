import { safeCallbackUrl } from "@/lib/safe-callback-url"

describe("safeCallbackUrl", () => {
  it("keeps relative paths including the query string", () => {
    expect(safeCallbackUrl("/clans/join?code=abc")).toBe("/clans/join?code=abc")
    expect(safeCallbackUrl("/templates")).toBe("/templates")
  })

  it("falls back when missing", () => {
    expect(safeCallbackUrl(undefined)).toBe("/")
    expect(safeCallbackUrl(null)).toBe("/")
    expect(safeCallbackUrl("")).toBe("/")
    expect(safeCallbackUrl("", "/home")).toBe("/home")
  })

  it("uses the first value of a repeated param", () => {
    expect(safeCallbackUrl(["/clans", "/other"])).toBe("/clans")
  })

  it.each([
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "javascript:alert(1)",
    "clans",
    "/\t/evil.com",
  ])("rejects %j", (value) => {
    expect(safeCallbackUrl(value)).toBe("/")
  })
})
