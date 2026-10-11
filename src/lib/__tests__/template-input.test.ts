/**
 * @jest-environment node
 */
import {
  parseTags,
  serializeTags,
  templateDetailsSchema,
} from "@/lib/template-input"

describe("parseTags", () => {
  it("trims, drops empties and de-duplicates case-insensitively", () => {
    expect(parseTags(" boss, Raids ,,boss,RAIDS , ironman")).toEqual([
      "boss",
      "Raids",
      "ironman",
    ])
  })

  it("handles null and empty input", () => {
    expect(parseTags(null)).toEqual([])
    expect(parseTags("")).toEqual([])
  })

  it("round-trips through serializeTags", () => {
    expect(serializeTags(["a", "b", "A"])).toBe("a,b")
  })
})

describe("templateDetailsSchema", () => {
  const base = { title: "Raids", isPublic: true }

  it("applies defaults and trims", () => {
    const result = templateDetailsSchema.parse({ ...base, title: "  Raids  " })

    expect(result).toEqual({
      title: "Raids",
      description: "",
      category: "",
      tags: "",
      isPublic: true,
    })
  })

  it("normalises tags into the stored comma string", () => {
    const result = templateDetailsSchema.parse({
      ...base,
      tags: "boss, boss , raids",
    })

    expect(result.tags).toBe("boss,raids")
  })

  it("rejects a blank title", () => {
    const result = templateDetailsSchema.safeParse({ ...base, title: "   " })

    expect(result.success).toBe(false)
  })

  it("rejects more than five tags", () => {
    const result = templateDetailsSchema.safeParse({
      ...base,
      tags: "a,b,c,d,e,f",
    })

    expect(result.success).toBe(false)
  })

  it("rejects over-long tags and categories", () => {
    expect(
      templateDetailsSchema.safeParse({ ...base, tags: "x".repeat(31) }).success
    ).toBe(false)
    expect(
      templateDetailsSchema.safeParse({ ...base, category: "x".repeat(101) })
        .success
    ).toBe(false)
  })

  it("requires isPublic", () => {
    expect(templateDetailsSchema.safeParse({ title: "x" }).success).toBe(false)
  })
})
