"use client"

import { useState } from "react"
import type React from "react"
import { useRouter } from "next/navigation"
import { formatInTimeZone, fromZonedTime } from "date-fns-tz"

import { deleteEvent, updateEvent } from "@/app/actions/super-admin"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { safeTimeZone } from "@/lib/super-admin-format"
import {
  eventDeleteImpact,
  type EventImpactCounts,
} from "@/lib/super-admin-impact"
import { AdminCombobox } from "./admin-combobox"
import {
  AdminEditDialog,
  EditDialogFooter,
  useEditDialog,
} from "./admin-edit-dialog"
import { FormError, FormField } from "./admin-form-field"
import { useClanOptions } from "./clan-options-context"
import { ConfirmDestructiveDialog } from "./confirm-destructive-dialog"
import { EntityActions } from "./entity-actions"
import { runAdminAction } from "./run-admin-action"

export interface EventActionsEvent {
  id: string
  title: string
  description: string | null
  startDate: Date
  endDate: Date
  timezone: string
  locked: boolean
  public: boolean
  clanId: string | null
}

interface EventActionsProps {
  event: EventActionsEvent
  counts: EventImpactCounts
  variant: "menu" | "buttons"
  redirectAfterDelete?: string
}

const INPUT_FORMAT = "yyyy-MM-dd'T'HH:mm"

export function EventActions({
  event,
  counts,
  variant,
  redirectAfterDelete,
}: EventActionsProps) {
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null)
  const router = useRouter()

  return (
    <EntityActions
      subject={event.title}
      noun="event"
      variant={variant}
      onEdit={() => setDialog("edit")}
      onDelete={() => setDialog("delete")}
    >
      <AdminEditDialog
        open={dialog === "edit"}
        onOpenChange={(open) => setDialog(open ? "edit" : null)}
        title="Edit event"
        description={`Update settings for ${event.title}.`}
      >
        <EventEditForm event={event} />
      </AdminEditDialog>
      <ConfirmDestructiveDialog
        open={dialog === "delete"}
        onOpenChange={(open) => setDialog(open ? "delete" : null)}
        title="Delete event"
        description={`Permanently delete the event ${event.title} and everything inside it.`}
        confirmText={event.title}
        impact={eventDeleteImpact(counts)}
        confirmLabel="Delete event"
        successTitle="Event deleted"
        successDescription={`${event.title} was permanently deleted.`}
        onConfirm={() =>
          runAdminAction(
            () => deleteEvent(event.id),
            "Could not delete the event."
          )
        }
        onSuccess={() => {
          if (redirectAfterDelete) router.push(redirectAfterDelete)
        }}
      />
    </EntityActions>
  )
}

function EventEditForm({ event }: { event: EventActionsEvent }) {
  const { pending, setPending, close } = useEditDialog()
  const { toast } = useToast()
  const { options: clanOptions, truncated } = useClanOptions()
  // The wall-clock times mean "in the event's timezone", the same zone every other page shows them in.
  const timeZone = safeTimeZone(event.timezone)
  const initialStart = formatInTimeZone(event.startDate, timeZone, INPUT_FORMAT)
  const initialEnd = formatInTimeZone(event.endDate, timeZone, INPUT_FORMAT)

  const [title, setTitle] = useState(event.title)
  const [description, setDescription] = useState(event.description ?? "")
  const [start, setStart] = useState(initialStart)
  const [end, setEnd] = useState(initialEnd)
  const [clanId, setClanId] = useState<string | null>(event.clanId)
  const [locked, setLocked] = useState(event.locked)
  const [isPublic, setIsPublic] = useState(event.public)
  const [errors, setErrors] = useState<{
    title?: string
    description?: string
    start?: string
    end?: string
  }>({})
  const [formError, setFormError] = useState<string | null>(null)

  // Keep the stored instant when a field was not touched (the input only has minute precision).
  const startDate =
    start === initialStart ? event.startDate : fromZonedTime(start, timeZone)
  const endDate =
    end === initialEnd ? event.endDate : fromZonedTime(end, timeZone)

  const handleSubmit = async (formEvent: React.FormEvent) => {
    formEvent.preventDefault()
    const next: typeof errors = {}
    if (!title.trim()) next.title = "Title is required."
    else if (title.trim().length > 255)
      next.title = "Title must be 255 characters or fewer."
    if (description.length > 1000) {
      next.description = "Description must be 1000 characters or fewer."
    }
    if (!start || Number.isNaN(startDate.getTime()))
      next.start = "Enter a start date and time."
    if (!end || Number.isNaN(endDate.getTime()))
      next.end = "Enter an end date and time."
    if (!next.start && !next.end && endDate <= startDate) {
      next.end = "The end must be after the start."
    }
    setErrors(next)
    setFormError(null)
    if (Object.keys(next).length > 0) return

    setPending(true)
    const result = await runAdminAction(
      () =>
        updateEvent(event.id, {
          title: title.trim(),
          description: description.trim() || null,
          startDate,
          endDate,
          locked,
          public: isPublic,
          clanId,
        }),
      "Could not update the event. Nothing was changed."
    )
    setPending(false)

    if (!result.success) {
      setFormError(result.error ?? null)
      toast({
        title: "Could not update event",
        description: result.error,
        variant: "destructive",
      })
      return
    }
    toast({ title: "Event updated", description: "Changes were saved." })
    close()
  }

  const zoneHint = `Times are in the event's timezone (${timeZone}).`

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <FormField label="Title" required error={errors.title}>
        {(props) => (
          <Input
            {...props}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={pending}
            autoComplete="off"
          />
        )}
      </FormField>
      <FormField label="Description" error={errors.description}>
        {(props) => (
          <Textarea
            {...props}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            disabled={pending}
          />
        )}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Start" required error={errors.start} hint={zoneHint}>
          {(props) => (
            <Input
              {...props}
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              disabled={pending}
            />
          )}
        </FormField>
        <FormField label="End" required error={errors.end}>
          {(props) => (
            <Input
              {...props}
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              disabled={pending}
            />
          )}
        </FormField>
      </div>
      <FormField
        label="Clan"
        hint={
          truncated
            ? "Showing the first 500 clans alphabetically; search to narrow down."
            : undefined
        }
      >
        {(props) => (
          <AdminCombobox
            {...props}
            value={clanId}
            onChange={setClanId}
            options={clanOptions}
            emptyLabel="No clan"
            placeholder="Select clan"
            searchPlaceholder="Search clans…"
            disabled={pending}
          />
        )}
      </FormField>
      <div className="flex items-center gap-3">
        <Switch
          id={`${event.id}-locked`}
          checked={locked}
          onCheckedChange={setLocked}
          disabled={pending}
        />
        <Label htmlFor={`${event.id}-locked`}>
          Locked (registration closed)
        </Label>
      </div>
      <div className="flex items-center gap-3">
        <Switch
          id={`${event.id}-public`}
          checked={isPublic}
          onCheckedChange={setIsPublic}
          disabled={pending}
        />
        <Label htmlFor={`${event.id}-public`}>
          Public (visible without signing in)
        </Label>
      </div>
      <FormError message={formError} />
      <EditDialogFooter submitLabel="Save changes" pendingLabel="Saving…" />
    </form>
  )
}
