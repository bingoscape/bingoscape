import Link from "next/link"
import { Fragment, type ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"

export interface PageHeaderCrumb {
  label: string
  href?: string
}

interface PageHeaderProps {
  title: string
  /** Icon shown in a recessed slot before the title. Decorative. */
  icon?: LucideIcon
  /** Rendered instead of `icon`, e.g. an avatar. Decorative content only. */
  leading?: ReactNode
  /** Short context under the title: counts, owner, status. */
  meta?: ReactNode
  description?: ReactNode
  /** Trail ending at the current page. */
  breadcrumbs?: PageHeaderCrumb[]
  /** Primary action(s). A two-column grid on phones, inline from `sm`. */
  actions?: ReactNode
  className?: string
}

/**
 * Page header used by the dashboard-style pages: breadcrumbs, the page's only
 * `h1` in the pixel-art heading font, a meta line, and actions that wrap onto
 * their own row on phones instead of squeezing the title.
 */
export function PageHeader({
  title,
  icon: Icon,
  leading,
  meta,
  description,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("space-y-3", className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, index) => {
              const last = index === breadcrumbs.length - 1
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

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {leading ??
            (Icon ? (
              <div className="osrs-slot shrink-0 rounded-sm p-2">
                <Icon aria-hidden="true" className="text-primary h-6 w-6" />
              </div>
            ) : null)}
          <div className="min-w-0">
            <h1 className="osrs-heading text-2xl font-bold tracking-tight wrap-break-word">
              {title}
            </h1>
            {meta ? (
              <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                {meta}
              </div>
            ) : null}
          </div>
        </div>

        {actions ? (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
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
