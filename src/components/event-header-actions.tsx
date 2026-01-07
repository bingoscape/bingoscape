"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    ButtonGroup,
    ButtonGroupSeparator,
} from "@/components/ui/button-group"
import { ClipboardList, Link2, Settings, FileJson, Trash2 } from "lucide-react"
import Link from "next/link"
import type { UUID } from "crypto"
import { GenerateEventInviteLink } from "./generate-event-invite-link"
import { EditEventModal } from "./edit-event-modal"
import { EventCommandPalette } from "./event-command-palette"
import { CreateBingoModal } from "./create-bingo-modal"
import { BingoImportExportModal } from "./bingo-import-export-modal"
import { ShareEventButton } from "./share-event-button"
import AssignEventToClanModal from "./assign-event-to-clan-modal"
import { DiscordWebhookManagement } from "./discord-webhook-management"
import { EventDeleteModal } from "./event-delete-modal"
import type { Event } from "@/app/actions/events"

interface EventHeaderActionsProps {
    eventId: string
    userRole: "admin" | "management" | "verified" | "pending"
    requiresApproval: boolean
    pendingRegistrationsCount: number
    event: Event
    userClans: Array<{ clan: { id: string; name: string } }>
}

export function EventHeaderActions({
    eventId,
    userRole,
    requiresApproval,
    pendingRegistrationsCount,
    event,
    userClans,
}: EventHeaderActionsProps) {
    const isAdmin = userRole === "admin"
    const [editModalOpen, setEditModalOpen] = useState(false)
    const [createBingoModalOpen, setCreateBingoModalOpen] = useState(false)
    const [importExportModalOpen, setImportExportModalOpen] = useState(false)
    const [deleteModalOpen, setDeleteModalOpen] = useState(false)

    return (
        <>
            <div className="flex items-center gap-3">
                {/* Primary Action Button Group */}
                <ButtonGroup>
                    {/* Registration Requests Button */}
                    {requiresApproval && isAdmin && (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                asChild
                                className="relative gap-2"
                            >
                                <Link href={`/events/${eventId}/participants?tab=registrations`}>
                                    <ClipboardList className="h-4 w-4" />
                                    <span>Requests</span>
                                    {pendingRegistrationsCount > 0 && (
                                        <span className="h-5 min-w-5 px-1 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-medium">
                                            {pendingRegistrationsCount}
                                        </span>
                                    )}
                                </Link>
                            </Button>
                            <ButtonGroupSeparator />
                        </>
                    )}

                    {/* Generate Invite Link Button */}
                    {isAdmin && (
                        <>
                            <GenerateEventInviteLink eventId={event.id as UUID}>
                                <Button variant="outline" size="sm" className="gap-2">
                                    <Link2 className="h-4 w-4" />
                                    <span>Invite</span>
                                </Button>
                            </GenerateEventInviteLink>
                            <ButtonGroupSeparator />
                        </>
                    )}

                    {/* Event Settings Button - Admin Only */}
                    {isAdmin && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditModalOpen(true)}
                            className="gap-2"
                        >
                            <Settings className="h-4 w-4" />
                            <span>Settings</span>
                        </Button>
                    )}
                </ButtonGroup>

                {/* Command Palette */}
                <EventCommandPalette
                    eventId={event.id as UUID}
                    pendingRegistrationsCount={pendingRegistrationsCount}
                    isAdmin={isAdmin}
                    isPublic={event.public ?? false}
                    hasClan={!!event.clan}
                    createBingoModal={
                        <Button
                            variant="ghost"
                            className="w-full justify-start"
                            onClick={() => setCreateBingoModalOpen(true)}
                        >
                            Create New Board
                        </Button>
                    }
                    importExportModal={
                        <Button
                            variant="ghost"
                            className="w-full justify-start"
                            onClick={() => setImportExportModalOpen(true)}
                        >
                            <FileJson className="mr-2 h-4 w-4" />
                            Import/Export
                        </Button>
                    }
                    generateInviteLink={
                        <GenerateEventInviteLink eventId={event.id as UUID}>
                            <Button variant="ghost" className="w-full justify-start">
                                <Link2 className="mr-2 h-4 w-4" />
                                Generate Invite Link
                            </Button>
                        </GenerateEventInviteLink>
                    }
                    shareEventButton={
                        <ShareEventButton
                            eventId={event.id}
                            eventTitle={event.title}
                            isPublic={event.public ?? false}
                        />
                    }
                    editEventModal={
                        isAdmin ? (
                            <Button
                                variant="ghost"
                                className="w-full justify-start"
                                onClick={() => setEditModalOpen(true)}
                            >
                                <Settings className="mr-2 h-4 w-4" />
                                Edit Event Settings
                            </Button>
                        ) : undefined
                    }
                    assignClanModal={
                        isAdmin && !event.clan ? (
                            <AssignEventToClanModal
                                eventId={event.id}
                                clans={userClans.map((uc) => ({
                                    id: uc.clan.id,
                                    name: uc.clan.name,
                                }))}
                            />
                        ) : undefined
                    }
                    discordWebhooks={
                        <DiscordWebhookManagement eventId={event.id} />
                    }
                    deleteEventModal={
                        isAdmin ? (
                            <Button
                                variant="ghost"
                                className="w-full justify-start text-destructive hover:text-destructive"
                                onClick={() => setDeleteModalOpen(true)}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Event
                            </Button>
                        ) : undefined
                    }
                />
            </div>

            {/* Edit Event Modal */}
            {isAdmin && (
                <EditEventModal
                    event={event}
                    isOpen={editModalOpen}
                    onClose={() => setEditModalOpen(false)}
                />
            )}

            {/* Create Bingo Modal */}
            <CreateBingoModal
                eventId={event.id}
                isOpen={createBingoModalOpen}
                onClose={() => setCreateBingoModalOpen(false)}
            />

            {/* Import/Export Modal */}
            <BingoImportExportModal
                eventId={event.id}
                bingoId={
                    (event.bingos?.length ?? 0) > 0
                        ? event.bingos![0]?.id
                        : undefined
                }
                bingoTitle={
                    (event.bingos?.length ?? 0) > 0
                        ? event.bingos![0]?.title
                        : undefined
                }
                isOpen={importExportModalOpen}
                onClose={() => setImportExportModalOpen(false)}
            />

            {/* Delete Event Modal */}
            {isAdmin && (
                <EventDeleteModal
                    event={{
                        id: event.id,
                        title: event.title,
                        participantsCount: event.eventParticipants?.length,
                        teamsCount: event.teams?.length,
                        bingosCount: event.bingos?.length,
                    }}
                    isOpen={deleteModalOpen}
                    onClose={() => setDeleteModalOpen(false)}
                />
            )}
        </>
    )
}
