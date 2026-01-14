import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { type LucideIcon, ChevronRight, ExternalLink } from "lucide-react"
import { type ReactNode } from "react"

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
        bg: "bg-amber-50 dark:bg-amber-950/30",
        border: "border-amber-200 dark:border-amber-800",
        hover: "hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-100/50 dark:hover:bg-amber-900/30",
        icon: "bg-amber-100 dark:bg-amber-900/50",
        iconColor: "text-amber-600 dark:text-amber-400",
        shadow: "hover:shadow-amber-200/50 dark:hover:shadow-amber-900/50",
    },
    purple: {
        bg: "bg-purple-50 dark:bg-purple-950/30",
        border: "border-purple-200 dark:border-purple-800",
        hover: "hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-100/50 dark:hover:bg-purple-900/30",
        icon: "bg-purple-100 dark:bg-purple-900/50",
        iconColor: "text-purple-600 dark:text-purple-400",
        shadow: "hover:shadow-purple-200/50 dark:hover:shadow-purple-900/50",
    },
    green: {
        bg: "bg-green-50 dark:bg-green-950/30",
        border: "border-green-200 dark:border-green-800",
        hover: "hover:border-green-300 dark:hover:border-green-700 hover:bg-green-100/50 dark:hover:bg-green-900/30",
        icon: "bg-green-100 dark:bg-green-900/50",
        iconColor: "text-green-600 dark:text-green-400",
        shadow: "hover:shadow-green-200/50 dark:hover:shadow-green-900/50",
    },
    blue: {
        bg: "bg-blue-50 dark:bg-blue-950/30",
        border: "border-blue-200 dark:border-blue-800",
        hover: "hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-100/50 dark:hover:bg-blue-900/30",
        icon: "bg-blue-100 dark:bg-blue-900/50",
        iconColor: "text-blue-600 dark:text-blue-400",
        shadow: "hover:shadow-blue-200/50 dark:hover:shadow-blue-900/50",
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
            className={`
                relative flex items-center gap-4 p-4 rounded-lg border-2 transition-all duration-200
                ${colors.bg} ${colors.border} ${colors.hover} ${colors.shadow}
                hover:shadow-lg hover:scale-[1.02] cursor-pointer
                ${className}
            `}
        >
            {/* Icon */}
            <div className={`flex-shrink-0 w-10 h-10 ${colors.icon} rounded-full flex items-center justify-center`}>
                <Icon className={`h-5 w-5 ${colors.iconColor}`} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{title}</p>
                    {badge !== undefined && (
                        <Badge variant={badgeVariant} className="ml-auto">
                            {badge}
                        </Badge>
                    )}
                </div>
                {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
            </div>

            {/* Arrow/External Icon */}
            {!children && (
                <div className="flex-shrink-0">
                    {external ? (
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                </div>
            )}
        </div>
    )

    // If it's a modal trigger with children, render the child component styled as a card
    if (children) {
        return (
            <div
                className={`
                    relative rounded-lg border-2 transition-all duration-200
                    ${colors.bg} ${colors.border} ${colors.hover} ${colors.shadow}
                    hover:shadow-lg hover:scale-[1.02]
                    ${className}
                `}
            >
                <div className="w-full">
                    {children}
                </div>
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
