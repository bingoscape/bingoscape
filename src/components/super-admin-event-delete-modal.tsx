"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { deleteEvent } from "@/app/actions/super-admin"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Trash2, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Event {
  id: string
  title: string
}

interface SuperAdminEventDeleteModalProps {
  event: Event
}

export function SuperAdminEventDeleteModal({ event }: SuperAdminEventDeleteModalProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const handleDelete = async () => {
    setLoading(true)

    try {
      await deleteEvent(event.id)

      toast({
        title: "Event deleted",
        description: "Event and all associated data has been permanently deleted.",
      })

      setOpen(false)
      router.push("/super-admin/events")
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete event. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Event
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Event
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This action cannot be undone. This will permanently delete the event and all associated data including:
            </AlertDescription>
          </Alert>

          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            <li>All event participants</li>
            <li>All teams and team members</li>
            <li>All bingo boards and tiles</li>
            <li>All tile submissions and progress</li>
            <li>All event-related data</li>
          </ul>

          <div className="p-3 bg-muted rounded-lg">
            <p className="font-medium">Event to delete:</p>
            <p className="text-sm">{event.title}</p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? "Deleting..." : "Delete Event"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
