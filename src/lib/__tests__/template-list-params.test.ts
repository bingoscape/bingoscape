/**
 * @jest-environment node
 */
import {
  buildTemplateListHref,
  countActiveFilters,
  paginationWindow,
  parseTemplateListParams,
  parseTemplateVisibility,
} from "@/lib/template-list-params"

describe("parseTemplateListParams", () => {
  it("returns defaults for empty params", () => {
    expect(parseTemplateListParams({})).toEqual({
      search: "",
      category: "",
      size: "",
      type: "",
      sort: "newest",
      page: 1,
    })
  })

  it("sanitises hostile values", () => {
    const params = parseTemplateListParams({
      size: "5x5); DROP TABLE",
      type: "weird",
      sort: "random",
      page: "-4",
      search: "x".repeat(500),
    })

    expect(params.size).toBe("")
    expect(params.type).toBe("")
    expect(params.sort).toBe("newest")
    expect(params.page).toBe(1)
    expect(params.search).toHaveLength(100)
  })

  it("accepts valid values and takes the first of repeated params", () => {
    const params = parseTemplateListParams({
      size: ["5X5", "3x3"],
      type: "progression",
      sort: "popular",
      page: "3",
      category: " PvM ",
    })

    expect(params).toMatchObject({
      size: "5x5",
      type: "progression",
      sort: "popular",
      page: 3,
      category: "PvM",
    })
  })

  it("treats a non-numeric page as 1", () => {
    expect(parseTemplateListParams({ page: "abc" }).page).toBe(1)
  })
})

describe("buildTemplateListHref", () => {
  const base = parseTemplateListParams({ category: "PvM", page: "4" })

  it("omits defaults", () => {
    expect(buildTemplateListHref(parseTemplateListParams({}))).toBe(
      "/templates"
    )
  })

  it("resets the page when a filter changes", () => {
    expect(buildTemplateListHref(base, { size: "5x5" })).toBe(
      "/templates?category=PvM&size=5x5"
    )
  })

  it("keeps an explicit page", () => {
    expect(buildTemplateListHref(base, { page: 5 })).toBe(
      "/templates?category=PvM&page=5"
    )
  })

  it("clears a filter with an empty override", () => {
    expect(buildTemplateListHref(base, { category: "" })).toBe("/templates")
  })

  it("encodes values", () => {
    expect(buildTemplateListHref(base, { search: "a&b c" })).toContain(
      "search=a%26b+c"
    )
  })
})

describe("countActiveFilters", () => {
  it("does not count sort or page", () => {
    expect(
      countActiveFilters(
        parseTemplateListParams({
          sort: "popular",
          page: "2",
          type: "standard",
        })
      )
    ).toBe(1)
  })
})

describe("parseTemplateVisibility", () => {
  it("falls back to all", () => {
    expect(parseTemplateVisibility({ visibility: "nope" })).toBe("all")
    expect(parseTemplateVisibility({ visibility: "private" })).toBe("private")
  })
})

describe("paginationWindow", () => {
  it("lists every page when there are few", () => {
    expect(paginationWindow(2, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it("collapses the middle of long ranges", () => {
    expect(paginationWindow(1, 20)).toEqual([1, 2, "ellipsis", 20])
    expect(paginationWindow(10, 20)).toEqual([
      1,
      "ellipsis",
      9,
      10,
      11,
      "ellipsis",
      20,
    ])
    expect(paginationWindow(20, 20)).toEqual([1, "ellipsis", 19, 20])
  })
})
