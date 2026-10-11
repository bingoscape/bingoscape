import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { FolderOpen, LayoutTemplate } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CreateTemplateButton } from "@/components/create-template-button"
import { FilterPills } from "@/components/filter-pills"
import { PageHeader } from "@/components/page-header"
import { TemplateCard } from "@/components/template-card"
import { UserTemplateActions } from "@/components/user-template-actions"
import { getServerAuthSession } from "@/server/auth"
import { getManageableEvents } from "@/server/queries/manageable-events"
import {
  getCategorySuggestions,
  getUserTemplates,
} from "@/server/queries/templates"
import type { RawSearchParams } from "@/lib/admin-list-params"
import {
  parseTemplateVisibility,
  type TemplateVisibility,
} from "@/lib/template-list-params"

export const metadata: Metadata = { title: "My templates" }

const VISIBILITY_LABELS: Record<TemplateVisibility, string> = {
  all: "All",
  public: "Public",
  private: "Private",
}

function visibilityHref(visibility: TemplateVisibility) {
  return visibility === "all"
    ? "/templates/my-templates"
    : `/templates/my-templates?visibility=${visibility}`
}

export default async function MyTemplatesPage(props: {
  searchParams: Promise<RawSearchParams>
}) {
  const session = await getServerAuthSession()
  if (!session?.user) redirect("/sign-in?callbackUrl=/templates/my-templates")

  const visibility = parseTemplateVisibility(await props.searchParams)

  const [{ templates, counts }, events, categorySuggestions] =
    await Promise.all([
      getUserTemplates(session.user.id, visibility),
      getManageableEvents(session.user.id, { withBoards: true }),
      getCategorySuggestions(session.user.id),
    ])

  const createButton = (
    <CreateTemplateButton
      events={events}
      categorySuggestions={categorySuggestions}
    />
  )

  return (
    <div className="container mx-auto space-y-6 px-4 py-6 sm:py-8">
      <PageHeader
        title="My templates"
        icon={FolderOpen}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Templates", href: "/templates" },
          { label: "My templates" },
        ]}
        meta={
          <span>
            {counts.all} {counts.all === 1 ? "template" : "templates"}
          </span>
        }
        actions={
          <>
            {createButton}
            <Button asChild variant="outline">
              <Link href="/templates">
                <LayoutTemplate aria-hidden="true" />
                Browse gallery
              </Link>
            </Button>
          </>
        }
      />

      {counts.all > 0 ? (
        <FilterPills
          label="Filter your templates by visibility"
          pills={(Object.keys(VISIBILITY_LABELS) as TemplateVisibility[]).map(
            (value) => ({
              label: VISIBILITY_LABELS[value],
              count: counts[value],
              href: visibilityHref(value),
              selected: visibility === value,
            })
          )}
        />
      ) : null}

      {templates.length === 0 ? (
        <div className="osrs-panel mx-auto max-w-2xl rounded-sm p-6 text-center sm:p-10">
          <div className="osrs-slot mx-auto mb-4 w-fit rounded-sm p-4">
            <FolderOpen aria-hidden="true" className="text-primary h-10 w-10" />
          </div>
          <h2 className="osrs-heading text-2xl font-bold">
            {counts.all === 0
              ? "You haven't made a template yet"
              : `No ${visibility} templates`}
          </h2>
          <p className="text-muted-foreground mt-2">
            {counts.all === 0
              ? "Save one of your boards as a template to reuse it or share it with the community."
              : "Nothing matches this filter. Try another one."}
          </p>
          <div className="mt-6 flex justify-center">
            {counts.all === 0 ? (
              createButton
            ) : (
              <Button asChild>
                <Link href={visibilityHref("all")}>Show all templates</Link>
              </Button>
            )}
          </div>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <li key={template.id}>
              <TemplateCard
                template={template}
                variant="mine"
                actions={
                  <UserTemplateActions
                    template={{
                      id: template.id,
                      title: template.title,
                      description: template.description,
                      category: template.category,
                      tags: template.tags,
                      isPublic: template.isPublic,
                    }}
                    categorySuggestions={categorySuggestions}
                  />
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
