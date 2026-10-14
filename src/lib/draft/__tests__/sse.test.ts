/**
 * @jest-environment node
 */
import { SSE_HEARTBEAT, formatSseFrame } from "@/lib/draft/sse"

describe("formatSseFrame", () => {
  it("writes id, event and one line of JSON data, ended by a blank line", () => {
    expect(
      formatSseFrame({ id: 7, event: "draft", data: { a: "x\ny", b: 1 } })
    ).toBe('id: 7\nevent: draft\ndata: {"a":"x\\ny","b":1}\n\n')
  })

  it("writes only a retry hint", () => {
    expect(formatSseFrame({ retry: 2000 })).toBe("retry: 2000\n\n")
  })

  it("keeps a heartbeat a comment", () => {
    expect(SSE_HEARTBEAT.startsWith(":")).toBe(true)
    expect(SSE_HEARTBEAT.endsWith("\n\n")).toBe(true)
  })
})
