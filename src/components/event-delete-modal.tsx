"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { deleteEventByAdmin } from "@/app/actions/events"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Trash2, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface EventDeleteModalProps {
  event: {
    id: string
    title: string
    participantsCount?: number
    teamsCount?: number
    bingosCount?: number
  }
  isOpen: boolean
  onClose: () => void
}

export function EventDeleteModal({
  event,
  isOpen,
  onClose,
}: EventDeleteModalProps) {
  const [confirmText, setConfirmText] = useState("")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const isConfirmed = confirmText === event.title

  const handleDelete = async () => {
    if (!isConfirmed) return

    setLoading(true)

    try {
      const result = await deleteEventByAdmin(event.id)

      if (result.success) {
        toast({
          title: "Event deleted",
          description: `${event.title} and all associated data has been permanently removed.`,
        })

        onClose()
        router.push("/")
      } else {
        toast({
          title: "Error",
          description: result.error ?? "Failed to delete event. Please try again.",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setConfirmText("")
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Event
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This action cannot be undone. This will permanently delete the
              event and all associated data including:
            </AlertDescription>
          </Alert>

          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            {event.participantsCount !== undefined &&
              event.participantsCount > 0 && (
                <li>
                  All {event.participantsCount} participant
                  {event.participantsCount !== 1 ? "s" : ""} and their data
                </li>
              )}
            {event.teamsCount !== undefined && event.teamsCount > 0 && (
              <li>
                All {event.teamsCount} team{event.teamsCount !== 1 ? "s" : ""}{" "}
                and team members
              </li>
            )}
            {event.bingosCount !== undefined && event.bingosCount > 0 && (
              <li>
                All {event.bingosCount} bingo board
                {event.bingosCount !== 1 ? "s" : ""}, tiles, and goals
              </li>
            )}
            <li>All tile submissions and comments</li>
            <li>All buy-ins, donations, and financial records</li>
            <li>All event webhooks and configurations</li>
          </ul>

          <div className="p-3 bg-muted rounded-lg space-y-2">
            <div>
              <p className="font-medium text-sm">Event to delete:</p>
              <p className="text-sm mt-1">{event.title}</p>
            </div>
            {(event.participantsCount !== undefined ||
              event.teamsCount !== undefined ||
              event.bingosCount !== undefined) && (
              <div className="flex gap-4 text-xs text-muted-foreground pt-2 border-t">
                {event.participantsCount !== undefined && (
                  <span>
                    {event.participantsCount} participant
                    {event.participantsCount !== 1 ? "s" : ""}
                  </span>
                )}
                {event.teamsCount !== undefined && (
                  <span>
                    {event.teamsCount} team{event.teamsCount !== 1 ? "s" : ""}
                  </span>
                )}
                {event.bingosCount !== undefined && (
                  <span>
                    {event.bingosCount} board{event.bingosCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-text" className="text-sm font-medium">
              Type <span className="font-mono text-destructive">{event.title}</span> to confirm
            </Label>
            <Input
              id="confirm-text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Enter event title"
              disabled={loading}
              className="font-mono"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!isConfirmed || loading}
            >
              {loading ? (
                <>
                  <Trash2 className="h-4 w-4 mr-2 animate-pulse" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Event
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
