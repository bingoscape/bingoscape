"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { getUserCreatedEvents } from "@/app/actions/events"
import { getTemplateData } from "@/app/actions/templates"
import { importBingoBoard } from "@/app/actions/bingo-import-export"
import { Download } from "lucide-react"

interface ImportTemplateButtonProps {
  templateId: string
}

export function ImportTemplateButton({ templateId }: ImportTemplateButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [events, setEvents] = useState<Array<{ id: string; title: string }>>([])
  const [selectedEventId, setSelectedEventId] = useState("")
  const router = useRouter()

  const loadEvents = async () => {
    try {
      const eventsData = await getUserCreatedEvents()
      setEvents(eventsData.map((e) => ({ id: e.event.id, title: e.event.title })))
    } catch (error) {
      console.error("Error loading events:", error)
      toast({
        title: "Error",
        description: "Failed to load your events",
        variant: "destructive",
      })
    }
  }

  const handleImport = async () => {
    if (!selectedEventId) {
      toast({
        title: "Error",
        description: "Please select an event",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      // Get the template data
      const templateData = await getTemplateData(templateId)

      if ("error" in templateData) {
        throw new Error(templateData.error)
      }

      // Import the template into the selected event
      const result = await importBingoBoard(selectedEventId, templateData)

      if (result.success) {
        toast({
          title: "Success",
          description: "Template imported successfully",
        })
        setIsOpen(false)

        // Navigate to the new bingo board
        if (result.bingoId) {
          router.push(`/events/${selectedEventId}/bingos/${result.bingoId}`)
        } else {
          router.push(`/events/${selectedEventId}`)
        }
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to import template",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (open) {
      loadEvents().then(() => console.log("Events loaded")).catch((error) => console.error("Error loading events:", error))
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Download className="mr-2 h-4 w-4" />
          Use Template
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Import Template</DialogTitle>
          <DialogDescription>Select an event to import this template into</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="event">Event</Label>
            <Select value={selectedEventId} onValueChange={setSelectedEventId}>
              <SelectTrigger id="event">
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
        </div>
        <DialogFooter>
          <Button onClick={handleImport} disabled={isLoading || !selectedEventId}>
            {isLoading ? "Importing..." : "Import Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

