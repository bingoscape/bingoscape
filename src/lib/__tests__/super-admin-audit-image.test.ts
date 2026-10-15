/**
 * @jest-environment node
 *
 * The `image.*` super-admin actions (wiki image cache 4/6, #230) in the audit
 * helpers and the revalidation list.
 */
import {
  targetIdFromInput,
  targetTypeFromAction,
} from "@/lib/super-admin-audit"
import { adminPathsToRevalidate } from "@/server/super-admin/revalidate"

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))

describe("image audit targets", () => {
  it("maps image actions to the image target type", () => {
    expect(targetTypeFromAction("image.refresh")).toBe("image")
    expect(targetTypeFromAction("image.purge")).toBe("image")
    expect(targetTypeFromAction("image.bulk.refresh")).toBe("image")
    expect(targetTypeFromAction("clan.update")).toBe("clan")
    expect(targetTypeFromAction("nothing.here")).toBeNull()
  })

  it("takes the cache key as the target id, without the 64 character cap of ids", () => {
    const key = `thumb/${"A".repeat(100)}.png/800px-${"A".repeat(100)}.png`
    expect(targetIdFromInput({ key })).toBe(key)
    expect(targetIdFromInput({ key: "x".repeat(600) })).toHaveLength(512)
    expect(targetIdFromInput({ clanId: "c1", key: "k" })).toBe("c1")
    expect(targetIdFromInput({ key: 5 })).toBeNull()
  })
})

describe("adminPathsToRevalidate", () => {
  it("adds the image cache page only when asked", () => {
    expect(adminPathsToRevalidate({ imageCache: true })).toEqual([
      "/super-admin",
      "/super-admin/audit",
      "/super-admin/image-cache",
    ])
    expect(adminPathsToRevalidate({})).not.toContain("/super-admin/image-cache")
  })
})
