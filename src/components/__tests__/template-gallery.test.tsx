import { render, screen, within } from "@testing-library/react"

import { TemplateGallery } from "@/components/template-gallery"
import { parseTemplateListParams } from "@/lib/template-list-params"
import type {
  TemplateFacets,
  TemplateListItem,
} from "@/server/queries/templates"

const facets: TemplateFacets = {
  categories: [
    { value: "PvM", count: 5 },
    { value: "Skilling", count: 3 },
  ],
  sizes: [
    { value: "3x3", count: 2 },
    { value: "5x5", count: 6 },
  ],
  types: [
    { value: "progression", count: 1 },
    { value: "standard", count: 7 },
  ],
}

function item(id: string, overrides: Partial<TemplateListItem> = {}) {
  return {
    id,
    title: `Template ${id}`,
    description: "A board",
    category: "PvM",
    tags: [],
    isPublic: true,
    downloadCount: 1,
    createdAt: new Date("2026-01-01"),
    creatorName: "Zezima",
    creatorImage: "https://cdn.discordapp.com/a.png",
    facts: {
      schemaVersion: "2.0",
      bingoType: "standard",
      rows: 5,
      columns: 5,
      tileCount: 25,
      tierCount: 1,
      totalXp: 100,
      hasPatternBonuses: false,
      hasHiddenTiles: false,
    },
    preview: { rows: 1, columns: 1, bingoType: "standard", cells: [] },
    ...overrides,
  } satisfies TemplateListItem
}

const create = <button type="button">Create template</button>

function renderGallery(
  raw: Record<string, string>,
  templates: TemplateListItem[],
  total = templates.length
) {
  return render(
    <TemplateGallery
      params={parseTemplateListParams(raw)}
      templates={templates}
      total={total}
      facets={facets}
      createAction={create}
    />
  )
}

describe("TemplateGallery", () => {
  it("renders each template as a heading with a stretched link", () => {
    renderGallery({}, [item("a"), item("b")])

    const heading = screen.getByRole("heading", {
      level: 3,
      name: "Template a",
    })
    expect(within(heading).getByRole("link")).toHaveAttribute(
      "href",
      "/templates/a"
    )
    expect(screen.getByRole("status")).toHaveTextContent("2 templates")
  })

  it("labels the search field and keeps filters in the form", () => {
    renderGallery({ category: "PvM", sort: "popular" }, [item("a")])

    const search = screen.getByLabelText(/Search templates/)
    expect(search.closest("form")).toHaveAttribute("method", "get")
    expect(
      search.closest("form")?.querySelector('input[name="category"]')
    ).toHaveValue("PvM")
    expect(
      search.closest("form")?.querySelector('input[name="sort"]')
    ).toHaveValue("popular")
  })

  it("marks the active filter pill and links others to reset the page", () => {
    renderGallery({ category: "PvM", page: "3" }, [item("a")], 40)

    const categories = screen.getByRole("navigation", {
      name: "Filter templates by category",
    })
    expect(
      within(categories).getByRole("link", { name: /PvM/ })
    ).toHaveAttribute("aria-current", "page")
    expect(
      within(categories).getByRole("link", { name: /Skilling/ })
    ).toHaveAttribute("href", "/templates?category=Skilling")
  })

  it("explains filtered-out results and offers to clear them", () => {
    renderGallery({ search: "zzz", category: "PvM" }, [])

    expect(
      screen.getByRole("heading", { name: "No templates match" })
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      "/templates"
    )
  })

  it("invites the first template when the gallery is truly empty", () => {
    renderGallery({}, [])

    expect(
      screen.getByRole("heading", { name: "No templates yet" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Create template" })
    ).toBeInTheDocument()
  })

  it("paginates with the current page marked", () => {
    renderGallery({ page: "2" }, [item("a")], 30)

    const pager = screen.getByRole("navigation", {
      name: "Templates pagination",
    })
    expect(within(pager).getByRole("link", { name: "Page 2" })).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(
      within(pager).getByRole("link", { name: /Previous/ })
    ).toHaveAttribute("href", "/templates")
    expect(screen.getByRole("status")).toHaveTextContent("page 2 of 3")
  })

  it("moves categories beyond the first six behind a disclosure", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      value: `Cat${i}`,
      count: 9 - i,
    }))
    render(
      <TemplateGallery
        params={parseTemplateListParams({})}
        templates={[item("a")]}
        total={1}
        facets={{ ...facets, categories: many }}
        createAction={create}
      />
    )

    expect(screen.getByText("More categories (3)")).toBeInTheDocument()
  })
})
