/**
 * @jest-environment node
 */
import { parseInviteCode } from "@/lib/invite-code"

describe("parseInviteCode", () => {
  it("returns a bare code unchanged (trimmed)", () => {
    expect(parseInviteCode("  abc123  ")).toBe("abc123")
  })

  it("extracts the code from a full invite link", () => {
    expect(
      parseInviteCode("https://bingoscape.org/events/join/abc123?ref=discord")
    ).toBe("abc123")
    expect(parseInviteCode("/events/join/abc123#top")).toBe("abc123")
  })

  it("rejects empty input and multi-segment garbage", () => {
    expect(parseInviteCode("   ")).toBeNull()
    expect(parseInviteCode("not a code")).toBeNull()
    expect(parseInviteCode("foo/bar")).toBeNull()
  })
})
