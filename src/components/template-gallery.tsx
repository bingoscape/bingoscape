import type { ReactNode } from "react"
import Link from "next/link"
import { LayoutGrid, Search, SearchX } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FilterDisclosure } from "@/components/filter-disclosure"
import { FilterPills, type FilterPill } from "@/components/filter-pills"
import { TemplateCard } from "@/components/template-card"
import { TemplatePagination } from "@/components/template-pagination"
import {
  TEMPLATE_PAGE_SIZE,
  buildTemplateListHref,
  countActiveFilters,
  type TemplateListParams,
} from "@/lib/template-list-params"
import { BINGO_TYPE_LABELS, formatSizeParam } from "@/lib/template-labels"
import type {
  FacetOption,
  TemplateFacets,
  TemplateListItem,
} from "@/server/queries/templates"

/** Categories shown as pills before the rest move behind "More". */
const VISIBLE_CATEGORIES = 6

interface TemplateGalleryProps {
  params: TemplateListParams
  templates: TemplateListItem[]
  total: number
  facets: TemplateFacets
  /** "Create template" control for the truly-empty state. */
  createAction: ReactNode
}

function allPill(
  label: string,
  params: TemplateListParams,
  key: "category" | "size" | "type"
): FilterPill {
  return {
    label,
    href: buildTemplateListHref(params, { [key]: "" }),
    selected: !params[key],
  }
}

function optionPills(
  options: FacetOption[],
  params: TemplateListParams,
  key: "category" | "size" | "type",
  format: (value: string) => string = (value) => value
): FilterPill[] {
  return options.map((option) => ({
    label: format(option.value),
    count: option.count,
    href: buildTemplateListHref(params, {
      [key]: params[key] === option.value ? "" : option.value,
    }),
    selected: params[key] === option.value,
  }))
}

function pluralTemplates(count: number) {
  return `${count} ${count === 1 ? "template" : "templates"}`
}

export function TemplateGallery({
  params,
  templates,
  total,
  facets,
  createAction,
}: TemplateGalleryProps) {
  const totalPages = Math.max(1, Math.ceil(total / TEMPLATE_PAGE_SIZE))
  const activeFilters = countActiveFilters(params)

  const categoryPills = optionPills(facets.categories, params, "category")
  // Keep the selected category visible even if it is outside the top few.
  const visibleCategories = categoryPills.filter(
    (pill, index) => index < VISIBLE_CATEGORIES || pill.selected
  )
  const moreCategories = categoryPills.filter(
    (pill) => !visibleCategories.includes(pill)
  )

  const typePills = optionPills(
    facets.types,
    params,
    "type",
    (value) =>
      BINGO_TYPE_LABELS[value as keyof typeof BINGO_TYPE_LABELS] ?? value
  )

  const clearHref = buildTemplateListHref(params, {
    search: "",
    category: "",
    size: "",
    type: "",
  })

  const filterSummary = [
    params.search && `“${params.search}”`,
    params.category && `category ${params.category}`,
    params.size && `size ${formatSizeParam(params.size)}`,
    params.type && `${BINGO_TYPE_LABELS[params.type]} boards`,
  ].filter(Boolean)

  return (
    <div className="space-y-6">
      <section aria-label="Search and filter templates" className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <form
            action="/templates"
            method="get"
            role="search"
            className="flex flex-1 gap-2 lg:max-w-xl"
          >
            {params.category ? (
              <input type="hidden" name="category" value={params.category} />
            ) : null}
            {params.size ? (
              <input type="hidden" name="size" value={params.size} />
            ) : null}
            {params.type ? (
              <input type="hidden" name="type" value={params.type} />
            ) : null}
            {params.sort !== "newest" ? (
              <input type="hidden" name="sort" value={params.sort} />
            ) : null}
            <label htmlFor="template-search" className="sr-only">
              Search templates by title, description or tag
            </label>
            <div className="relative min-w-0 flex-1">
              <Search
                aria-hidden="true"
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              />
              <Input
                key={params.search}
                id="template-search"
                type="search"
                name="search"
                maxLength={100}
                defaultValue={params.search}
                placeholder="Search templates"
                enterKeyHint="search"
                className="pl-9"
              />
            </div>
            <Button type="submit" className="min-h-11">
              Search
            </Button>
          </form>

          <FilterPills
            label="Sort templates"
            pills={[
              {
                label: "Newest",
                href: buildTemplateListHref(params, { sort: "newest" }),
                selected: params.sort === "newest",
              },
              {
                label: "Popular",
                href: buildTemplateListHref(params, { sort: "popular" }),
                selected: params.sort === "popular",
              },
            ]}
          />
        </div>

        <FilterDisclosure activeCount={activeFilters - (params.search ? 1 : 0)}>
          {typePills.length > 1 || params.type ? (
            <FilterGroup title="Board type">
              <FilterPills
                label="Filter templates by board type"
                pills={[allPill("All types", params, "type"), ...typePills]}
              />
            </FilterGroup>
          ) : null}

          {facets.sizes.length > 1 || params.size ? (
            <FilterGroup title="Size">
              <FilterPills
                label="Filter templates by board size"
                pills={[
                  allPill("Any size", params, "size"),
                  ...optionPills(facets.sizes, params, "size", formatSizeParam),
                ]}
              />
            </FilterGroup>
          ) : null}

          {categoryPills.length > 0 ? (
            <FilterGroup title="Category">
              <FilterPills
                label="Filter templates by category"
                pills={[
                  allPill("All categories", params, "category"),
                  ...visibleCategories,
                ]}
              />
              {moreCategories.length > 0 ? (
                <details className="group mt-2">
                  <summary className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex min-h-11 cursor-pointer items-center rounded-sm text-sm font-medium focus-visible:ring-2 focus-visible:outline-hidden">
                    <span className="group-open:hidden">
                      More categories ({moreCategories.length})
                    </span>
                    <span className="hidden group-open:inline">
                      Fewer categories
                    </span>
                  </summary>
                  <FilterPills
                    label="More template categories"
                    pills={moreCategories}
                    className="mt-2"
                  />
                </details>
              ) : null}
            </FilterGroup>
          ) : null}
        </FilterDisclosure>
      </section>

      <div
        role="status"
        aria-live="polite"
        className="text-muted-foreground flex flex-wrap items-center gap-x-3 text-sm"
      >
        <p>
          {pluralTemplates(total)}
          {filterSummary.length > 0 ? ` for ${filterSummary.join(", ")}` : null}
          {totalPages > 1 ? ` · page ${params.page} of ${totalPages}` : null}
        </p>
        {activeFilters > 0 && templates.length > 0 ? (
          <Link
            href={clearHref}
            className="text-primary inline-flex min-h-11 items-center underline-offset-4 hover:underline"
          >
            Clear filters
          </Link>
        ) : null}
      </div>

      {templates.length === 0 ? (
        <EmptyState
          filtered={activeFilters > 0}
          clearHref={clearHref}
          createAction={createAction}
        />
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <li key={template.id}>
                <TemplateCard template={template} />
              </li>
            ))}
          </ul>
          <TemplatePagination
            page={Math.min(params.page, totalPages)}
            totalPages={totalPages}
            hrefForPage={(page) => buildTemplateListHref(params, { page })}
          />
        </>
      )}
    </div>
  )
}

function FilterGroup({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div>
      <h2 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
        {title}
      </h2>
      {children}
    </div>
  )
}

function EmptyState({
  filtered,
  clearHref,
  createAction,
}: {
  filtered: boolean
  clearHref: string
  createAction: ReactNode
}) {
  const Icon = filtered ? SearchX : LayoutGrid
  return (
    <div className="osrs-panel mx-auto max-w-2xl rounded-sm p-6 text-center sm:p-10">
      <div className="osrs-slot mx-auto mb-4 w-fit rounded-sm p-4">
        <Icon aria-hidden="true" className="text-primary h-10 w-10" />
      </div>
      <h2 className="osrs-heading text-2xl font-bold">
        {filtered ? "No templates match" : "No templates yet"}
      </h2>
      <p className="text-muted-foreground mt-2">
        {filtered
          ? "Try a different search or remove some filters."
          : "Be the first to share a board. Save one of your boards as a template and others can start from it."}
      </p>
      <div className="mt-6 flex justify-center">
        {filtered ? (
          <Button asChild>
            <Link href={clearHref}>Clear filters</Link>
          </Button>
        ) : (
          createAction
        )}
      </div>
    </div>
  )
}
