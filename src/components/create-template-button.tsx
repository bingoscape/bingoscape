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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { saveBingoAsTemplate } from "@/app/actions/templates"
import { getEventById, getUserCreatedEvents } from "@/app/actions/events"
import { getBingoById } from "@/app/actions/bingo"
import { Plus } from "lucide-react"

export function CreateTemplateButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState<"select-bingo" | "template-details">("select-bingo")
  const [events, setEvents] = useState<Array<{ id: string; title: string }>>([])
  const [bingos, setBingos] = useState<Array<{ id: string; title: string }>>([])
  const [selectedEventId, setSelectedEventId] = useState("")
  const [selectedBingoId, setSelectedBingoId] = useState("")
  const [templateData, setTemplateData] = useState({
    title: "",
    description: "",
    category: "",
    tags: "",
    isPublic: true,
  })
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

  const loadBingos = async (eventId: string) => {
    try {
      const eventData = await getEventById(eventId)
      if (eventData?.event.bingos) {
        setBingos(eventData.event.bingos.map((b) => ({ id: b.id, title: b.title })))
      } else {
        setBingos([])
      }
    } catch (error) {
      console.error("Error loading bingos:", error)
      toast({
        title: "Error",
        description: "Failed to load bingo boards",
        variant: "destructive",
      })
    }
  }

  const handleEventChange = (eventId: string) => {
    setSelectedEventId(eventId)
    setSelectedBingoId("")
    loadBingos(eventId).then(() => console.log("Bingos loaded")).catch((error) => console.error("Error loading bingos:", error))
  }

  const handleBingoChange = (bingoId: string) => {
    setSelectedBingoId(bingoId)
    // Pre-fill template title with bingo title
    const selectedBingo = bingos.find((b) => b.id === bingoId)
    if (selectedBingo) {
      setTemplateData((prev) => ({ ...prev, title: selectedBingo.title }))
    }
  }

  const handleContinue = () => {
    if (!selectedBingoId) {
      toast({
        title: "Error",
        description: "Please select a bingo board",
        variant: "destructive",
      })
      return
    }
    setStep("template-details")
  }

  const handleSubmit = async () => {
    if (!templateData.title) {
      toast({
        title: "Error",
        description: "Please enter a title for your template",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      const result = await saveBingoAsTemplate(selectedBingoId, templateData)
      if (result.success) {
        toast({
          title: "Success",
          description: "Template created successfully",
        })
        setIsOpen(false)
        router.push(`/templates/${result.templateId}`)
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create template",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (open) {
      setStep("select-bingo")
      loadEvents().then(() => console.log("Events loaded")).catch((error) => console.error("Error loading events:", error))
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Template
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{step === "select-bingo" ? "Select a Bingo Board" : "Create Template"}</DialogTitle>
          <DialogDescription>
            {step === "select-bingo"
              ? "Choose one of your bingo boards to save as a template"
              : "Fill in the details for your new template"}
          </DialogDescription>
        </DialogHeader>

        {step === "select-bingo" ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="event">Event</Label>
              <Select value={selectedEventId} onValueChange={handleEventChange}>
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

            <div className="space-y-2">
              <Label htmlFor="bingo">Bingo Board</Label>
              <Select
                value={selectedBingoId}
                onValueChange={handleBingoChange}
                disabled={!selectedEventId || bingos.length === 0}
              >
                <SelectTrigger id="bingo">
                  <SelectValue
                    placeholder={
                      !selectedEventId
                        ? "Select an event first"
                        : bingos.length === 0
                          ? "No bingo boards found"
                          : "Select a bingo board"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {bingos.map((bingo) => (
                    <SelectItem key={bingo.id} value={bingo.id}>
                      {bingo.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button onClick={handleContinue} disabled={!selectedBingoId}>
                Continue
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={templateData.title}
                onChange={(e) => setTemplateData((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Template title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={templateData.description}
                onChange={(e) => setTemplateData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Describe your template"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={templateData.category}
                onChange={(e) => setTemplateData((prev) => ({ ...prev, category: e.target.value }))}
                placeholder="e.g., PvM, Skilling, Questing"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma separated)</Label>
              <Input
                id="tags"
                value={templateData.tags}
                onChange={(e) => setTemplateData((prev) => ({ ...prev, tags: e.target.value }))}
                placeholder="e.g., boss, raids, ironman"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isPublic"
                checked={templateData.isPublic}
                onCheckedChange={(checked) => setTemplateData((prev) => ({ ...prev, isPublic: checked }))}
              />
              <Label htmlFor="isPublic">Make this template public</Label>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("select-bingo")} disabled={isLoading}>
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Template"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

