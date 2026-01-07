"use client"

import { useState, useEffect, useCallback } from "react"
import {
    ClipboardList,
    Users,
    BarChart3,
    Grip,
    Upload,
    Link2,
    Share2,
    Settings,
    Search,
    Command,
    Trash2
} from "lucide-react"
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { X } from "lucide-react"
import Link from "next/link"
import type { UUID } from "crypto"

interface EventAction {
    id: string
    icon: React.ComponentType<{ className?: string }>
    label: string
    description?: string
    badge?: number
    onClick?: () => void
    href?: string
    category: "participants" | "boards" | "collaboration" | "configuration"
    keywords?: string[]
    component?: React.ReactNode
}

// Category metadata for visual grouping - unified with EventActionCard color schemes
const categoryMetadata = {
    participants: {
        label: "Participant Management",
        color: "text-blue-600 dark:text-blue-400",
        icon: "bg-blue-100 dark:bg-blue-900/50",
        hover: "hover:bg-blue-50/80 dark:hover:bg-blue-950/50",
        selected: "bg-blue-50 dark:bg-blue-950/40",
    },
    boards: {
        label: "Board Management",
        color: "text-purple-600 dark:text-purple-400",
        icon: "bg-purple-100 dark:bg-purple-900/50",
        hover: "hover:bg-purple-50/80 dark:hover:bg-purple-950/50",
        selected: "bg-purple-50 dark:bg-purple-950/40",
    },
    collaboration: {
        label: "Collaboration & Sharing",
        color: "text-green-600 dark:text-green-400",
        icon: "bg-green-100 dark:bg-green-900/50",
        hover: "hover:bg-green-50/80 dark:hover:bg-green-950/50",
        selected: "bg-green-50 dark:bg-green-950/40",
    },
    configuration: {
        label: "Settings & Configuration",
        color: "text-amber-600 dark:text-amber-400",
        icon: "bg-amber-100 dark:bg-amber-900/50",
        hover: "hover:bg-amber-50/80 dark:hover:bg-amber-950/50",
        selected: "bg-amber-50 dark:bg-amber-950/40",
    },
} as const

interface EventCommandPaletteProps {
    eventId: UUID
    pendingRegistrationsCount: number
    isAdmin: boolean
    isPublic: boolean
    hasClan: boolean
    createBingoModal: React.ReactNode
    importExportModal: React.ReactNode
    generateInviteLink: React.ReactNode
    shareEventButton: React.ReactNode
    editEventModal?: React.ReactNode
    assignClanModal?: React.ReactNode
    discordWebhooks: React.ReactNode
    deleteEventModal?: React.ReactNode
}

export function EventCommandPalette({
    eventId,
    pendingRegistrationsCount,
    isAdmin,
    isPublic,
    hasClan,
    createBingoModal,
    importExportModal,
    generateInviteLink,
    shareEventButton,
    editEventModal,
    assignClanModal,
    discordWebhooks,
    deleteEventModal,
}: EventCommandPaletteProps) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState("")
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [isMac, setIsMac] = useState(false)

    // Detect OS for keyboard shortcut display
    useEffect(() => {
        setIsMac(navigator.platform.toUpperCase().includes('MAC'))
    }, [])

    // Build actions list with reorganized categories
    const actions: EventAction[] = [
        // Participant Management
        {
            id: "registrations",
            icon: ClipboardList,
            label: "View Registrations",
            description: "Manage registration requests",
            badge: pendingRegistrationsCount > 0 ? pendingRegistrationsCount : undefined,
            href: `/events/${eventId}/participants?tab=registrations`,
            category: "participants",
            keywords: ["registration", "requests", "pending", "approve"]
        },
        {
            id: "participants",
            icon: Users,
            label: "Manage Participants",
            description: "View and manage event participants",
            href: `/events/${eventId}/participants`,
            category: "participants",
            keywords: ["participants", "players", "members", "teams"]
        },
        // Board Management
        {
            id: "create-board",
            icon: Grip,
            label: "Create New Board",
            description: "Add a new bingo board to the event",
            category: "boards",
            keywords: ["create", "new", "board", "bingo"],
            component: createBingoModal
        },
        {
            id: "import-export",
            icon: Upload,
            label: "Import/Export Boards",
            description: "Manage board templates",
            category: "boards",
            keywords: ["import", "export", "template", "backup"],
            component: importExportModal
        },
        // Collaboration & Sharing
        {
            id: "invite-link",
            icon: Link2,
            label: "Generate Invite Link",
            description: "Create invitation links for participants",
            category: "collaboration",
            keywords: ["invite", "link", "share", "join"],
            component: generateInviteLink
        },
    ]

    // Add share button if event is public
    if (isPublic) {
        actions.push({
            id: "share-event",
            icon: Share2,
            label: "Share Event",
            description: "Share public event link",
            category: "collaboration",
            keywords: ["share", "public", "link"],
            component: shareEventButton
        })
    }

    // Add Discord webhooks to collaboration
    actions.push({
        id: "discord-webhooks",
        icon: Settings,
        label: "Discord Webhooks",
        description: "Manage Discord notifications",
        category: "collaboration",
        keywords: ["discord", "webhooks", "notifications"],
        component: discordWebhooks
    })

    // Event Configuration
    actions.push({
        id: "statistics",
        icon: BarChart3,
        label: "Event Statistics",
        description: "View event analytics and progress",
        href: `/events/${eventId}/stats`,
        category: "configuration",
        keywords: ["stats", "analytics", "reports", "progress"]
    })

    // Add admin actions to configuration
    if (isAdmin) {
        if (editEventModal) {
            actions.push({
                id: "edit-event",
                icon: Settings,
                label: "Edit Event Settings",
                description: "Modify event configuration",
                category: "configuration",
                keywords: ["edit", "settings", "configure", "modify"],
                component: editEventModal
            })
        }
        if (!hasClan && assignClanModal) {
            actions.push({
                id: "assign-clan",
                icon: Users,
                label: "Assign to Clan",
                description: "Associate event with a clan",
                category: "configuration",
                keywords: ["clan", "assign", "associate"],
                component: assignClanModal
            })
        }
        if (deleteEventModal) {
            actions.push({
                id: "delete-event",
                icon: Trash2,
                label: "Delete Event",
                description: "Permanently delete this event and all data",
                category: "configuration",
                keywords: ["delete", "remove", "destroy", "permanent"],
                component: deleteEventModal
            })
        }
    }

    // Filter actions based on search
    const filteredActions = actions.filter(action => {
        if (!search) return true
        const searchLower = search.toLowerCase()
        return (
            action.label.toLowerCase().includes(searchLower) ||
            (action.description?.toLowerCase().includes(searchLower) ?? false) ||
            (action.keywords?.some(k => k.includes(searchLower)) ?? false)
        )
    })

    // Group actions by category
    const groupedActions = filteredActions.reduce((acc, action) => {
        if (!acc[action.category]) {
            acc[action.category] = []
        }
        acc[action.category]!.push(action)
        return acc
    }, {} as Record<string, EventAction[]>)

    // Get ordered categories that have actions
    const orderedCategories = (["participants", "boards", "collaboration", "configuration"] as const).filter(
        cat => (groupedActions[cat]?.length ?? 0) > 0
    )

    // Reset selected index when search changes
    useEffect(() => {
        setSelectedIndex(0)
    }, [search])

    // Keyboard shortcuts
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen(open => !open)
            }
        }

        document.addEventListener("keydown", down)
        return () => document.removeEventListener("keydown", down)
    }, [])

    // Handle keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault()
            setSelectedIndex(i => (i + 1) % filteredActions.length)
        } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setSelectedIndex(i => (i - 1 + filteredActions.length) % filteredActions.length)
        } else if (e.key === "Enter") {
            e.preventDefault()
            const action = filteredActions[selectedIndex]
            if (action?.href) {
                window.location.href = action.href
            }
            setOpen(false)
        }
    }, [filteredActions, selectedIndex])

    return (
        <>
            <Button
                variant="outline"
                onClick={() => setOpen(true)}
                className="gap-2"
            >
                <Command className="h-4 w-4" />
                <span>Quick Actions</span>
                <KbdGroup className="hidden sm:flex">
                    <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
                    <Kbd>K</Kbd>
                </KbdGroup>
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[600px] p-0 gap-0">
                    <div className="relative flex items-center border-b bg-background">
                        <Search className="absolute left-4 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                            placeholder="Search actions or use keywords..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="border-0 pl-11 pr-20 h-12 sm:h-14 text-sm sm:text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                            autoFocus
                        />
                        {search && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="absolute right-2 h-8 px-2"
                                onClick={() => setSearch("")}
                            >
                                <X className="h-3 w-3 mr-1" />
                                Clear
                            </Button>
                        )}
                    </div>

                    <div className="max-h-[400px] overflow-y-auto overflow-x-hidden">
                        {filteredActions.length === 0 ? (
                            <div className="py-12 px-4 text-center">
                                <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                                <p className="text-sm font-medium text-foreground mb-1">
                                    No actions found
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Try searching with different keywords
                                </p>
                            </div>
                        ) : (
                            <div className="p-2 space-y-1">
                                {orderedCategories.map((category, categoryIdx) => {
                                    const categoryActions = groupedActions[category]
                                    const metadata = categoryMetadata[category]

                                    if (!categoryActions) return null

                                    return (
                                        <div key={category}>
                                            {/* Category Header - only show when not searching */}
                                            {!search && (
                                                <div className="px-3 py-2 mb-1">
                                                    <h3 className={`text-xs font-semibold uppercase tracking-wider ${metadata.color}`}>
                                                        {metadata.label}
                                                    </h3>
                                                </div>
                                            )}

                                            {/* Actions in this category */}
                                            {categoryActions.map((action) => {
                                                const Icon = action.icon
                                                const actionIndex = filteredActions.indexOf(action)
                                                const isSelected = actionIndex === selectedIndex

                                                if (action.component) {
                                                    // Render modal components with icon styling
                                                    return (
                                                        <div
                                                            key={action.id}
                                                            className={`
                                                                group relative rounded-lg transition-all duration-150
                                                                min-h-[56px] sm:min-h-0
                                                                ${isSelected ? metadata.selected + ' shadow-sm' : metadata.hover}
                                                            `}
                                                            onMouseEnter={() => setSelectedIndex(actionIndex)}
                                                        >
                                                            {/* Visual wrapper that looks like an action item */}
                                                            <div className="flex items-center gap-3 px-3 sm:px-4 py-3 pointer-events-none">
                                                                {/* Icon with colored background */}
                                                                <div className={`
                                                                    flex-shrink-0 w-9 h-9 rounded-md flex items-center justify-center
                                                                    ${metadata.icon}
                                                                    transition-transform group-hover:scale-110
                                                                `}>
                                                                    <Icon className={`h-4 w-4 ${metadata.color}`} />
                                                                </div>

                                                                {/* Content */}
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="text-sm font-medium">{action.label}</p>
                                                                        {action.badge !== undefined && (
                                                                            <Badge variant="secondary" className="ml-auto">
                                                                                {action.badge}
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    {/* Only show description when not searching */}
                                                                    {!search && action.description && (
                                                                        <p className="text-xs text-muted-foreground mt-0.5">
                                                                            {action.description}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Actual button trigger positioned absolutely */}
                                                            <div className="absolute inset-0 [&>*]:w-full [&>*]:h-full [&>*]:opacity-0">
                                                                {action.component}
                                                            </div>
                                                        </div>
                                                    )
                                                }

                                                // Render link actions
                                                return (
                                                    <Link
                                                        key={action.id}
                                                        href={action.href ?? "#"}
                                                        onClick={() => setOpen(false)}
                                                        className={`
                                                            group relative flex items-center gap-3 px-3 sm:px-4 py-3 rounded-lg
                                                            transition-all duration-150 cursor-pointer
                                                            min-h-[56px] sm:min-h-0
                                                            ${isSelected ? metadata.selected + ' shadow-sm' : metadata.hover}
                                                        `}
                                                        onMouseEnter={() => setSelectedIndex(actionIndex)}
                                                    >
                                                        {/* Icon with colored background */}
                                                        <div className={`
                                                            flex-shrink-0 w-9 h-9 rounded-md flex items-center justify-center
                                                            ${metadata.icon}
                                                            transition-transform group-hover:scale-110
                                                        `}>
                                                            <Icon className={`h-4 w-4 ${metadata.color}`} />
                                                        </div>

                                                        {/* Content */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-sm font-medium">{action.label}</p>
                                                                {action.badge !== undefined && (
                                                                    <Badge variant="secondary" className="ml-auto">
                                                                        {action.badge}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            {/* Only show description when not searching */}
                                                            {!search && action.description && (
                                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                                    {action.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </Link>
                                                )
                                            })}

                                            {/* Category Separator - only show between categories and when not searching */}
                                            {!search && categoryIdx < orderedCategories.length - 1 && (
                                                <div className="my-2 border-t" />
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between border-t px-4 py-3 bg-muted/30">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                                <Kbd>↑↓</Kbd>
                                Navigate
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Kbd>↵</Kbd>
                                Select
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Kbd>Esc</Kbd>
                                Close
                            </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {filteredActions.length} {filteredActions.length === 1 ? 'action' : 'actions'}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
