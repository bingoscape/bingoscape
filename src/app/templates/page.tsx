import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { FolderOpen, LayoutTemplate } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CreateTemplateButton } from "@/components/create-template-button"
import { PageHeader } from "@/components/page-header"
import { TemplateGallery } from "@/components/template-gallery"
import { getServerAuthSession } from "@/server/auth"
import { getManageableEvents } from "@/server/queries/manageable-events"
import {
  getCategorySuggestions,
  getPublicTemplates,
  getTemplateFacets,
} from "@/server/queries/templates"
import type { RawSearchParams } from "@/lib/admin-list-params"
import {
  TEMPLATE_PAGE_SIZE,
  buildTemplateListHref,
  parseTemplateListParams,
} from "@/lib/template-list-params"

export const metadata: Metadata = { title: "Templates" }

export default async function TemplatesPage(props: {
  searchParams: Promise<RawSearchParams>
}) {
  const session = await getServerAuthSession()
  if (!session?.user) redirect("/sign-in?callbackUrl=/templates")

  const params = parseTemplateListParams(await props.searchParams)

  const [{ templates, total }, facets, events, categorySuggestions] =
    await Promise.all([
      getPublicTemplates({
        search: params.search,
        category: params.category,
        size: params.size,
        bingoType: params.type,
        sort: params.sort,
        limit: TEMPLATE_PAGE_SIZE,
        offset: (params.page - 1) * TEMPLATE_PAGE_SIZE,
      }),
      getTemplateFacets(),
      getManageableEvents(session.user.id, { withBoards: true }),
      getCategorySuggestions(session.user.id),
    ])

  // A stale link to a page past the end lands on the last page instead.
  const totalPages = Math.max(1, Math.ceil(total / TEMPLATE_PAGE_SIZE))
  if (params.page > totalPages) {
    redirect(buildTemplateListHref(params, { page: totalPages }))
  }

  const createButton = (
    <CreateTemplateButton
      events={events}
      categorySuggestions={categorySuggestions}
    />
  )

  return (
    <div className="container mx-auto space-y-6 px-4 py-6 sm:py-8">
      <PageHeader
        title="Templates"
        icon={LayoutTemplate}
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Templates" }]}
        description="Start from a board the community already built, or share your own."
        actions={
          <>
            {createButton}
            <Button asChild variant="outline">
              <Link href="/templates/my-templates">
                <FolderOpen aria-hidden="true" />
                My templates
              </Link>
            </Button>
          </>
        }
      />

      <TemplateGallery
        params={params}
        templates={templates}
        total={total}
        facets={facets}
        createAction={createButton}
      />
    </div>
  )
}
