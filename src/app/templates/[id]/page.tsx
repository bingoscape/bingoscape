import type { ReactNode } from "react"
import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import {
  Download,
  EyeOff,
  Grid3x3,
  LayoutTemplate,
  Layers,
  Zap,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ImportTemplateButton } from "@/components/import-template-button"
import { PageHeader } from "@/components/page-header"
import TemplatePreviewWithTooltip from "@/components/template-preview-with-tooltip"
import { TemplateOwnerButtons } from "@/components/user-template-actions"
import { getServerAuthSession } from "@/server/auth"
import { getManageableEvents } from "@/server/queries/manageable-events"
import {
  getCategorySuggestions,
  getTemplateDetail,
} from "@/server/queries/templates"
import {
  BINGO_TYPE_LABELS,
  describeBoard,
  formatBoardSize,
} from "@/lib/template-labels"
import { getOptimizedImageUrl } from "@/lib/utils"

export const metadata: Metadata = { title: "Template" }

export default async function TemplatePage(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params
  const session = await getServerAuthSession()
  if (!session?.user) redirect(`/sign-in?callbackUrl=/templates/${id}`)

  // Private templates of other users are indistinguishable from missing ones.
  const template = await getTemplateDetail(id, session.user.id)
  if (!template) notFound()

  const { facts, preview, isOwner } = template

  const [events, categorySuggestions] = await Promise.all([
    getManageableEvents(session.user.id),
    isOwner ? getCategorySuggestions(session.user.id) : Promise.resolve([]),
  ])

  const createdAgo = formatDistanceToNow(template.createdAt, {
    addSuffix: true,
  })
  const downloads = `${template.downloadCount} ${
    template.downloadCount === 1 ? "download" : "downloads"
  }`

  const useButton = preview ? (
    <ImportTemplateButton
      templateId={template.id}
      boardLabel={describeBoard(facts)}
      events={events}
      className="w-full lg:w-auto"
    />
  ) : null

  return (
    <div className="container mx-auto space-y-6 px-4 py-6 pb-28 sm:py-8 lg:pb-8">
      <PageHeader
        title={template.title}
        icon={LayoutTemplate}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Templates", href: "/templates" },
          { label: template.title },
        ]}
        meta={
          <>
            <span className="flex items-center gap-1.5">
              <Avatar className="size-5">
                <AvatarImage
                  src={getOptimizedImageUrl(template.creatorImage)}
                  alt=""
                />
                <AvatarFallback>
                  {template.creatorName[0] ?? "U"}
                </AvatarFallback>
              </Avatar>
              <span>
                <span className="sr-only">Created by </span>
                {template.creatorName}
              </span>
            </span>
            <span className="flex items-center gap-1">
              <Download aria-hidden="true" className="size-3.5" />
              {downloads}
            </span>
            {facts ? (
              <>
                <span>{formatBoardSize(facts.rows, facts.columns)}</span>
                <span>{BINGO_TYPE_LABELS[facts.bingoType]}</span>
              </>
            ) : null}
            {!template.isPublic ? (
              <Badge variant="pending">
                <EyeOff aria-hidden="true" className="size-3" />
                Private
              </Badge>
            ) : null}
          </>
        }
        actions={
          <>
            {useButton ? (
              <div className="hidden lg:block">{useButton}</div>
            ) : null}
            {isOwner ? (
              <TemplateOwnerButtons
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
            ) : null}
          </>
        }
      />

      {facts ? (
        <dl className="osrs-panel grid grid-cols-3 gap-px rounded-sm text-center">
          <Stat
            icon={<Grid3x3 aria-hidden="true" className="size-4" />}
            label="Tiles"
            value={String(facts.tileCount)}
          />
          <Stat
            icon={<Zap aria-hidden="true" className="size-4" />}
            label="Total XP"
            hint={facts.hasPatternBonuses ? "incl. bonuses" : undefined}
            value={facts.totalXp.toLocaleString("en-US")}
          />
          <Stat
            icon={<Layers aria-hidden="true" className="size-4" />}
            label="Type"
            hint={
              facts.bingoType === "progression"
                ? `${facts.tierCount} ${facts.tierCount === 1 ? "tier" : "tiers"}`
                : undefined
            }
            value={BINGO_TYPE_LABELS[facts.bingoType]}
          />
        </dl>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section
          aria-labelledby="board-preview"
          className="osrs-panel min-w-0 space-y-4 rounded-sm p-4 sm:p-6"
        >
          <div className="space-y-1">
            <h2 id="board-preview" className="osrs-heading text-xl font-bold">
              Board preview
            </h2>
            {template.description ? (
              <p className="text-muted-foreground text-sm whitespace-pre-line">
                {template.description}
              </p>
            ) : null}
          </div>

          {preview ? (
            <>
              <p className="text-muted-foreground text-sm">
                Tap a tile to see its XP, description and goals.
              </p>
              <TemplatePreviewWithTooltip
                preview={preview}
                title={template.title}
              />
            </>
          ) : (
            <div className="osrs-panel-inset text-muted-foreground rounded-sm p-6 text-center text-sm">
              This template&apos;s data couldn&apos;t be read, so it can&apos;t
              be previewed or used.
            </div>
          )}
        </section>

        <aside
          aria-label="Template details"
          className="osrs-panel space-y-4 rounded-sm p-4 sm:p-6 lg:sticky lg:top-6"
        >
          <h2 className="osrs-heading text-xl font-bold">Details</h2>

          {preview && preview.maskedCount > 0 ? (
            <p className="text-muted-foreground text-sm">
              {preview.maskedCount} hidden{" "}
              {preview.maskedCount === 1 ? "tile is" : "tiles are"} shown as
              ???. You still get the full board when you use this template.
            </p>
          ) : null}

          <dl className="space-y-3 text-sm">
            <DetailRow label="Created">{createdAgo}</DetailRow>
            <DetailRow label="Downloads">{downloads}</DetailRow>
            {template.category ? (
              <DetailRow label="Category">
                <Badge variant="secondary">{template.category}</Badge>
              </DetailRow>
            ) : null}
            {template.tags.length > 0 ? (
              <DetailRow label="Tags">
                <ul className="flex flex-wrap gap-1.5">
                  {template.tags.map((tag) => (
                    <li key={tag}>
                      <Badge variant="outline">{tag}</Badge>
                    </li>
                  ))}
                </ul>
              </DetailRow>
            ) : null}
            {isOwner ? (
              <DetailRow label="Visibility">
                {template.isPublic
                  ? "Public: everyone signed in can use it"
                  : "Private: only you can see it"}
              </DetailRow>
            ) : null}
          </dl>

          <p className="text-muted-foreground border-border border-t pt-4 text-xs">
            Templates carry the board only: tiles, goals, tiers and pattern
            bonuses. Rules, prizes and buy-ins aren&apos;t included.
          </p>
        </aside>
      </div>

      {useButton ? (
        <div className="osrs-panel fixed inset-x-0 bottom-0 z-30 rounded-none border-x-0 border-b-0 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
          {useButton}
        </div>
      ) : null}
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="space-y-0.5 p-3">
      <dt className="text-muted-foreground flex items-center justify-center gap-1 text-xs">
        {icon}
        {label}
      </dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  )
}

function DetailRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1">
      <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
