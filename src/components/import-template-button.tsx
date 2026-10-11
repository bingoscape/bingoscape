"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import {
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
} from "@/components/responsive-dialog"
import { importTemplateIntoEvent } from "@/app/actions/templates"
import { toast } from "@/hooks/use-toast"
import type { ManageableEvent } from "@/server/queries/manageable-events"

interface ImportTemplateButtonProps {
  templateId: string
  /** What gets added, e.g. "5×5 Standard board". */
  boardLabel: string
  /** Events the user can manage (loaded by the page). */
  events: ManageableEvent[]
  className?: string
}

export function ImportTemplateButton({
  templateId,
  boardLabel,
  events,
  className,
}: ImportTemplateButtonProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [eventId, setEventId] = useState("")

  const selectedEvent = events.find((event) => event.id === eventId)

  const handleOpenChange = (open: boolean) => {
    if (pending) return
    setIsOpen(open)
    // Forms start fresh every time they open.
    if (open) setEventId(events.length === 1 ? (events[0]?.id ?? "") : "")
  }

  const handleSubmit = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    if (!selectedEvent) return

    setPending(true)
    try {
      const result = await importTemplateIntoEvent(templateId, selectedEvent.id)
      if (!result.success) {
        throw new Error(result.error ?? "Failed to import template")
      }
      toast({
        title: "Board added",
        description: `A new ${boardLabel} was added to ${selectedEvent.title}.`,
      })
      setIsOpen(false)
      router.push(
        result.bingoId
          ? `/events/${selectedEvent.id}?board=${result.bingoId}`
          : `/events/${selectedEvent.id}`
      )
    } catch (error) {
      toast({
        title: "Couldn't use the template",
        description:
          error instanceof Error ? error.message : "Failed to import template",
        variant: "destructive",
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className={className}>
          <Download aria-hidden="true" />
          Use template
        </Button>
      </DialogTrigger>
      <ResponsiveDialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Use this template</DialogTitle>
          <DialogDescription>
            Choose the event that gets a new board from this template.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <ResponsiveDialogBody>
            {events.length === 0 ? (
              <div className="osrs-slot space-y-3 rounded-sm p-4 text-sm">
                <p className="font-medium">
                  You don&apos;t manage any events yet.
                </p>
                <p className="text-muted-foreground">
                  Templates are added to an event you run or manage. Create one
                  first, then come back.
                </p>
                <Button asChild variant="outline">
                  <Link href="/">Create an event</Link>
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor={`import-template-event-${templateId}`}>
                    Event
                  </Label>
                  <Select
                    value={eventId}
                    onValueChange={setEventId}
                    disabled={pending}
                  >
                    <SelectTrigger id={`import-template-event-${templateId}`}>
                      <SelectValue placeholder="Select an event" />
                    </SelectTrigger>
                    <SelectContent>
                      {events.map((event) => (
                        <SelectItem key={event.id} value={event.id}>
                          {event.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p aria-live="polite" className="text-muted-foreground text-sm">
                  {selectedEvent
                    ? `Adds a new ${boardLabel} to ${selectedEvent.title}. Existing boards aren't changed.`
                    : "You can edit the board after it's added."}
                </p>
              </>
            )}
          </ResponsiveDialogBody>

          <ResponsiveDialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            {events.length > 0 ? (
              <Button type="submit" disabled={pending || !selectedEvent}>
                {pending ? (
                  <>
                    <Spinner aria-hidden="true" />
                    Adding…
                  </>
                ) : (
                  "Add board"
                )}
              </Button>
            ) : null}
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </Dialog>
  )
}
