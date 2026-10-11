"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"

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
import {
  TemplateDetailsFields,
  toTemplateInput,
  type TemplateDetailsValue,
} from "@/components/template-details-fields"
import { saveBingoAsTemplate } from "@/app/actions/templates"
import { toast } from "@/hooks/use-toast"
import { templateDetailsSchema } from "@/lib/template-input"
import { BINGO_TYPE_LABELS, formatBoardSize } from "@/lib/template-labels"
import type { ManageableEvent } from "@/server/queries/manageable-events"

interface CreateTemplateButtonProps {
  /** Events the user manages, with their boards (loaded by the page). */
  events: ManageableEvent[]
  categorySuggestions: string[]
  className?: string
  variant?: "default" | "outline" | "secondary"
}

const EMPTY_DETAILS: TemplateDetailsValue = {
  title: "",
  description: "",
  category: "",
  tags: [],
  isPublic: true,
}

export function CreateTemplateButton({
  events,
  categorySuggestions,
  className,
  variant = "default",
}: CreateTemplateButtonProps) {
  const router = useRouter()
  const eventsWithBoards = events.filter((event) => event.boards.length > 0)

  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [eventId, setEventId] = useState("")
  const [bingoId, setBingoId] = useState("")
  const [details, setDetails] = useState<TemplateDetailsValue>(EMPTY_DETAILS)
  const [titleTouched, setTitleTouched] = useState(false)
  const [pending, setPending] = useState(false)

  const selectedEvent = eventsWithBoards.find((event) => event.id === eventId)
  const selectedBoard = selectedEvent?.boards.find(
    (board) => board.id === bingoId
  )

  const selectBoard = (event: ManageableEvent | undefined, boardId: string) => {
    setBingoId(boardId)
    const board = event?.boards.find((b) => b.id === boardId)
    if (board && !titleTouched) {
      setDetails((previous) => ({ ...previous, title: board.title }))
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (pending) return
    setIsOpen(open)
    if (!open) return

    // Forms start fresh every time they open.
    setStep(1)
    setDetails(EMPTY_DETAILS)
    setTitleTouched(false)
    const onlyEvent =
      eventsWithBoards.length === 1 ? eventsWithBoards[0] : undefined
    setEventId(onlyEvent?.id ?? "")
    const onlyBoard =
      onlyEvent?.boards.length === 1 ? onlyEvent.boards[0] : undefined
    setBingoId(onlyBoard?.id ?? "")
    if (onlyBoard) {
      setDetails({ ...EMPTY_DETAILS, title: onlyBoard.title })
    }
  }

  const handleEventChange = (nextEventId: string) => {
    setEventId(nextEventId)
    const event = eventsWithBoards.find((e) => e.id === nextEventId)
    const onlyBoard = event?.boards.length === 1 ? event.boards[0] : undefined
    if (onlyBoard) {
      selectBoard(event, onlyBoard.id)
    } else {
      setBingoId("")
    }
  }

  const handleSubmit = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()

    if (step === 1) {
      if (!bingoId) return
      setStep(2)
      return
    }

    const input = toTemplateInput(details)
    const validation = templateDetailsSchema.safeParse(input)
    if (!validation.success) {
      toast({
        title: "Check the template details",
        description: validation.error.issues[0]?.message,
        variant: "destructive",
      })
      return
    }

    setPending(true)
    try {
      const result = await saveBingoAsTemplate(bingoId, input)
      if (!result.success) {
        throw new Error(result.error ?? "Failed to create template")
      }
      toast({
        title: "Template created",
        description: details.isPublic
          ? "It is now public in the gallery."
          : "Only you can see it.",
      })
      setIsOpen(false)
      router.push(`/templates/${result.templateId}`)
    } catch (error) {
      toast({
        title: "Couldn't create the template",
        description:
          error instanceof Error ? error.message : "Failed to create template",
        variant: "destructive",
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant={variant} className={className}>
          <Plus aria-hidden="true" />
          Create template
        </Button>
      </DialogTrigger>
      <ResponsiveDialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? "Choose a board" : "Describe your template"}
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium">Step {step} of 2.</span>{" "}
            {step === 1
              ? "Pick one of your boards to share as a template. The board is copied, so later changes to it won't affect the template."
              : "Tell others what this board is for."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <ResponsiveDialogBody>
            {step === 1 ? (
              eventsWithBoards.length === 0 ? (
                <div className="osrs-slot space-y-3 rounded-sm p-4 text-sm">
                  <p className="font-medium">
                    {events.length === 0
                      ? "You don't manage any events yet."
                      : "None of your events have a board yet."}
                  </p>
                  <p className="text-muted-foreground">
                    Templates are made from a board in an event you run or
                    manage.
                  </p>
                  <Button asChild variant="outline">
                    <Link href="/">
                      {events.length === 0
                        ? "Create an event"
                        : "Go to your events"}
                    </Link>
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="create-template-event">Event</Label>
                    <Select value={eventId} onValueChange={handleEventChange}>
                      <SelectTrigger id="create-template-event">
                        <SelectValue placeholder="Select an event" />
                      </SelectTrigger>
                      <SelectContent>
                        {eventsWithBoards.map((event) => (
                          <SelectItem key={event.id} value={event.id}>
                            {event.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create-template-board">Board</Label>
                    <Select
                      value={bingoId}
                      onValueChange={(id) => selectBoard(selectedEvent, id)}
                      disabled={!selectedEvent}
                    >
                      <SelectTrigger id="create-template-board">
                        <SelectValue
                          placeholder={
                            selectedEvent
                              ? "Select a board"
                              : "Select an event first"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedEvent?.boards.map((board) => (
                          <SelectItem key={board.id} value={board.id}>
                            {board.title} ·{" "}
                            {formatBoardSize(board.rows, board.columns)}{" "}
                            {BINGO_TYPE_LABELS[board.bingoType]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <p className="text-muted-foreground text-sm">
                    Templates carry the board only: tiles, goals, tiers and
                    pattern bonuses. Rules, prizes and buy-ins are not copied.
                  </p>
                </>
              )
            ) : (
              <>
                {selectedBoard ? (
                  <p className="text-muted-foreground text-sm">
                    From {selectedBoard.title} (
                    {formatBoardSize(selectedBoard.rows, selectedBoard.columns)}{" "}
                    {BINGO_TYPE_LABELS[selectedBoard.bingoType]})
                  </p>
                ) : null}
                <TemplateDetailsFields
                  idPrefix="create-template"
                  value={details}
                  autoFocusTitle
                  disabled={pending}
                  categorySuggestions={categorySuggestions}
                  onChange={(next) => {
                    if (next.title !== details.title) setTitleTouched(true)
                    setDetails(next)
                  }}
                />
              </>
            )}
          </ResponsiveDialogBody>

          <ResponsiveDialogFooter>
            {step === 1 ? (
              <>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={!bingoId}>
                  Continue
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? (
                    <>
                      <Spinner aria-hidden="true" />
                      Creating…
                    </>
                  ) : (
                    "Create template"
                  )}
                </Button>
              </>
            )}
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </Dialog>
  )
}
