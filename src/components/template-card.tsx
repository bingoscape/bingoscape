import type { ReactNode } from "react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { Download, Eye, EyeOff } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { TemplateMiniBoard } from "@/components/template-mini-board"
import { BINGO_TYPE_LABELS, formatBoardSize } from "@/lib/template-labels"
import type { TemplateListItem } from "@/server/queries/templates"

interface TemplateCardProps {
  template: TemplateListItem
  /** Gallery cards credit the creator; "My templates" shows the age instead. */
  variant?: "gallery" | "mine"
  /** Extra controls (e.g. the overflow menu), placed above the stretched link. */
  actions?: ReactNode
}

/**
 * Card for the gallery and "My templates". The title is a real link stretched
 * over the whole card (`after:inset-0`), so the card is keyboard focusable and
 * long-pressable. Anything else interactive needs `relative z-10`.
 */
export function TemplateCard({
  template,
  variant = "gallery",
  actions,
}: TemplateCardProps) {
  const { facts, preview } = template
  const downloads = `${template.downloadCount} ${
    template.downloadCount === 1 ? "download" : "downloads"
  }`

  return (
    <Card className="group has-focus-visible:ring-ring relative flex h-full flex-col overflow-hidden transition-colors hover:brightness-110 has-focus-visible:ring-2">
      <div className="flex items-start justify-between gap-2 p-4 pb-2">
        <div className="min-w-0">
          <h3 className="osrs-heading text-primary text-lg leading-snug font-semibold wrap-break-word">
            <Link
              href={`/templates/${template.id}`}
              className="line-clamp-2 after:absolute after:inset-0 after:content-[''] focus-visible:outline-hidden"
            >
              {template.title}
            </Link>
          </h3>
        </div>
        {actions ? (
          <div className="relative z-10 -mt-1 -mr-2">{actions}</div>
        ) : null}
      </div>

      <div className="flex grow flex-col gap-3 px-4 pb-3">
        {preview ? (
          <TemplateMiniBoard preview={preview} />
        ) : (
          <div className="osrs-panel-inset text-muted-foreground mx-auto flex aspect-square w-full max-w-56 items-center justify-center rounded-sm p-3 text-center text-xs">
            Preview unavailable
          </div>
        )}

        {template.description ? (
          <p className="text-muted-foreground line-clamp-2 text-sm">
            {template.description}
          </p>
        ) : null}

        <ul className="mt-auto flex flex-wrap gap-1.5" aria-label="Details">
          {variant === "mine" ? (
            <li>
              {template.isPublic ? (
                <Badge variant="success">
                  <Eye aria-hidden="true" className="size-3" />
                  Public
                </Badge>
              ) : (
                <Badge variant="pending">
                  <EyeOff aria-hidden="true" className="size-3" />
                  Private
                </Badge>
              )}
            </li>
          ) : null}
          {facts ? (
            <>
              <li>
                <Badge variant="outline">
                  {formatBoardSize(facts.rows, facts.columns)}
                </Badge>
              </li>
              <li>
                <Badge
                  variant={
                    facts.bingoType === "progression" ? "info" : "outline"
                  }
                >
                  {BINGO_TYPE_LABELS[facts.bingoType]}
                </Badge>
              </li>
            </>
          ) : null}
          {template.category ? (
            <li>
              <Badge variant="secondary">{template.category}</Badge>
            </li>
          ) : null}
        </ul>
      </div>

      <div className="border-border text-muted-foreground flex items-center justify-between gap-3 border-t px-4 py-2.5 text-xs">
        {variant === "gallery" ? (
          <span className="flex min-w-0 items-center gap-2">
            <Avatar className="size-5 shrink-0">
              <AvatarImage src={template.creatorImage} alt="" />
              <AvatarFallback>{template.creatorName[0] ?? "U"}</AvatarFallback>
            </Avatar>
            <span className="truncate">
              <span className="sr-only">Created by </span>
              {template.creatorName}
            </span>
          </span>
        ) : (
          <span>
            Created{" "}
            {formatDistanceToNow(template.createdAt, { addSuffix: true })}
          </span>
        )}
        <span className="flex shrink-0 items-center gap-1">
          <Download aria-hidden="true" className="size-3.5" />
          {downloads}
        </span>
      </div>
    </Card>
  )
}
