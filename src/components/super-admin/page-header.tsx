import Link from "next/link"
import { Fragment, type ReactNode } from "react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"

export interface Crumb {
  label: string
  href?: string
}

interface PageHeaderProps {
  title: string
  /** Rendered before the title, e.g. an avatar. Decorative content only. */
  leading?: ReactNode
  /** Short context under the title: counts, owner, dates. */
  meta?: ReactNode
  description?: string | null
  /** Trail ending at the current page. "Super admin" is prepended automatically. */
  breadcrumbs?: Crumb[]
  /** Primary action(s), right-aligned from `sm`. */
  actions?: ReactNode
  className?: string
}

/** Compact page header: breadcrumbs, the page's only `h1`, meta line and actions. */
export function PageHeader({
  title,
  leading,
  meta,
  description,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  const trail: Crumb[] = [
    { label: "Super admin", href: "/super-admin" },
    ...(breadcrumbs ?? []),
  ]

  return (
    <header className={cn("mb-4 space-y-3", className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <Breadcrumb>
          <BreadcrumbList>
            {trail.map((crumb, index) => {
              const last = index === trail.length - 1
              return (
                <Fragment key={`${crumb.label}-${index}`}>
                  <BreadcrumbItem>
                    {last || !crumb.href ? (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href={crumb.href}>{crumb.label}</Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!last && <BreadcrumbSeparator />}
                </Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {leading}
          <div className="min-w-0">
            <h1 className="osrs-heading text-primary text-2xl wrap-break-word sm:text-[32px] sm:leading-tight">
              {title}
            </h1>
            {meta ? (
              <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                {meta}
              </div>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>

      {description ? (
        <p className="text-muted-foreground max-w-3xl text-sm">{description}</p>
      ) : null}
    </header>
  )
}
