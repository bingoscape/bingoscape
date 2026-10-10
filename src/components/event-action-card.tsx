import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { type LucideIcon, ChevronRight, ExternalLink } from "lucide-react"
import { type ReactNode } from "react"
import { cn } from "@/lib/utils"

interface EventActionCardProps {
  icon: LucideIcon
  title: string
  description?: string
  badge?: number | string
  badgeVariant?: "default" | "secondary" | "destructive" | "outline"
  colorScheme: "amber" | "purple" | "green" | "blue"
  onClick?: () => void
  href?: string
  external?: boolean
  children?: ReactNode
  className?: string
}

const colorSchemes = {
  amber: {
    accent: "border-l-warning",
    iconColor: "text-warning",
  },
  purple: {
    accent: "border-l-info",
    iconColor: "text-info",
  },
  green: {
    accent: "border-l-success",
    iconColor: "text-success",
  },
  blue: {
    accent: "border-l-pending",
    iconColor: "text-pending",
  },
}

export function EventActionCard({
  icon: Icon,
  title,
  description,
  badge,
  badgeVariant = "secondary",
  colorScheme,
  onClick,
  href,
  external = false,
  children,
  className = "",
}: EventActionCardProps) {
  const colors = colorSchemes[colorScheme]

  const cardContent = (
    <div
      className={cn(
        "osrs-panel relative flex cursor-pointer items-center gap-4 rounded-sm border-l-4 p-4 transition-colors hover:brightness-110",
        colors.accent,
        className
      )}
    >
      {/* Icon */}
      <div className="osrs-slot flex h-10 w-10 shrink-0 items-center justify-center rounded-sm">
        <Icon aria-hidden="true" className={cn("h-5 w-5", colors.iconColor)} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-display text-sm font-semibold">{title}</p>
          {badge !== undefined && (
            <Badge variant={badgeVariant} className="ml-auto">
              {badge}
            </Badge>
          )}
        </div>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>

      {/* Arrow/External Icon */}
      {!children && (
        <div className="shrink-0">
          {external ? (
            <ExternalLink
              aria-hidden="true"
              className="h-4 w-4 text-muted-foreground"
            />
          ) : (
            <ChevronRight
              aria-hidden="true"
              className="h-4 w-4 text-muted-foreground"
            />
          )}
        </div>
      )}
    </div>
  )

  // If it's a modal trigger with children, render the child component styled as a card
  if (children) {
    return (
      <div
        className={cn(
          "osrs-panel relative rounded-sm border-l-4 transition-colors hover:brightness-110",
          colors.accent,
          className
        )}
      >
        <div className="w-full">{children}</div>
      </div>
    )
  }

  // If it has a link, wrap in Link component
  if (href) {
    return (
      <Link href={href} className="block">
        {cardContent}
      </Link>
    )
  }

  // If it has an onClick, render as button
  if (onClick) {
    return (
      <button onClick={onClick} className="block w-full text-left">
        {cardContent}
      </button>
    )
  }

  // Fallback to just the card content
  return cardContent
}
