"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { updateEvent } from "@/app/actions/events"
import { toast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { GPInput } from "@/components/ui/gp-input"
import {
  CalendarIcon,
  Info,
  Coins,
  Shield,
  Eye,
  Lock,
  CheckSquare,
} from "lucide-react"
import { format } from "date-fns"
import { toZonedTime, fromZonedTime } from "date-fns-tz"
import { TimezoneSelect } from "@/components/timezone-select"
import { SettingsDialogLayout } from "@/components/settings-dialog-layout"
import type { Event } from "@/types/model"

interface EditEventModalProps {
  event: Event
  isOpen: boolean
  onClose: () => void
}

const TABS = [
  { id: "overview", label: "Overview", icon: Info },
  { id: "schedule", label: "Schedule", icon: CalendarIcon },
  { id: "financials", label: "Financials", icon: Coins },
  { id: "access", label: "Access & Rules", icon: Shield },
]

export function EditEventModal({
  event,
  isOpen,
  onClose,
}: EditEventModalProps) {
  const [activeTab, setActiveTab] = useState("overview")
  const [title, setTitle] = useState(event.title)
  const [description, setDescription] = useState(event.description ?? "")
  const [timezone, setTimezone] = useState(
    event.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
  )

  const [startDate, setStartDate] = useState<Date>(
    event.startDate
      ? toZonedTime(new Date(event.startDate), event.timezone || "UTC")
      : new Date()
  )
  const [endDate, setEndDate] = useState<Date>(
    event.endDate
      ? toZonedTime(new Date(event.endDate), event.timezone || "UTC")
      : new Date()
  )
  const [registrationDeadline, setRegistrationDeadline] = useState<
    Date | undefined
  >(
    event.registrationDeadline
      ? toZonedTime(
          new Date(event.registrationDeadline),
          event.timezone || "UTC"
        )
      : undefined
  )
  const [minimumBuyIn, setMinimumBuyIn] = useState(event.minimumBuyIn)
  const [basePrizePool, setBasePrizePool] = useState(event.basePrizePool)
  const [isLocked, setIsLocked] = useState(event.locked)
  const [isPublic, setIsPublic] = useState(event.public)
  const [requiresApproval, setRequiresApproval] = useState(
    event.requiresApproval || false
  )

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      const result = await updateEvent(event.id, {
        title,
        description,
        startDate: fromZonedTime(
          format(startDate, "yyyy-MM-dd'T'HH:mm:ss"),
          timezone
        ).toISOString(),
        endDate: fromZonedTime(
          format(endDate, "yyyy-MM-dd'T'HH:mm:ss"),
          timezone
        ).toISOString(),
        registrationDeadline: registrationDeadline
          ? fromZonedTime(
              format(registrationDeadline, "yyyy-MM-dd'T'HH:mm:ss"),
              timezone
            ).toISOString()
          : null,
        timezone,
        minimumBuyIn,
        basePrizePool,
        locked: isLocked,
        public: isPublic,
        requiresApproval,
      })
      if (!result.success) throw new Error(result.error)
      toast({
        title: "Event updated",
        description: "Your event has been updated successfully.",
      })
      onClose()
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update event. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <SettingsDialogLayout
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Event"
      description="Manage your event settings"
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
    >
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium">Overview</h3>
            <p className="text-muted-foreground text-sm">
              Basic details about your event.
            </p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Event Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Event Timezone</Label>
              <TimezoneSelect
                id="timezone"
                value={timezone}
                onValueChange={setTimezone}
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === "schedule" && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium">Schedule</h3>
            <p className="text-muted-foreground text-sm">
              Manage when your event runs.
            </p>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <DateTimePicker
                  date={startDate}
                  setDate={(d) => d && setStartDate(d)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <DateTimePicker
                  date={endDate}
                  setDate={(d) => d && setEndDate(d)}
                  fromDate={startDate}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Registration Deadline</Label>
              <DateTimePicker
                date={registrationDeadline}
                setDate={setRegistrationDeadline}
                placeholder="Optional"
                toDate={startDate}
              />
              <p className="text-muted-foreground text-xs">
                Players cannot join the event after this date.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === "financials" && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium">Financials</h3>
            <p className="text-muted-foreground text-sm">
              Manage the prize pool and entry fees.
            </p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Minimum Buy-In</Label>
              <GPInput
                id="minimumBuyIn"
                value={minimumBuyIn}
                onChange={setMinimumBuyIn}
              />
            </div>
            <div className="space-y-2">
              <Label>Base Prize Pool</Label>
              <GPInput
                id="basePrizePool"
                value={basePrizePool}
                onChange={setBasePrizePool}
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === "access" && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium">Access & Rules</h3>
            <p className="text-muted-foreground text-sm">
              Control who can see and join your event.
            </p>
          </div>
          <div className="space-y-4">
            <div className="bg-muted/10 hover:bg-muted/30 relative flex items-start space-x-4 rounded-xl border p-4 transition-colors">
              <Checkbox
                id="isPublic"
                checked={isPublic}
                onCheckedChange={(checked: boolean) => setIsPublic(!!checked)}
                className="mt-1"
              />
              <div className="space-y-1">
                <Label
                  htmlFor="isPublic"
                  className="flex cursor-pointer items-center gap-2 text-base font-medium after:absolute after:inset-0 after:content-['']"
                >
                  <Eye className="text-muted-foreground h-4 w-4" />
                  Public Event
                </Label>
                <p className="text-muted-foreground text-sm">
                  When enabled, this event will be visible in public listings
                  for anyone to see.
                </p>
              </div>
            </div>

            <div className="bg-muted/10 hover:bg-muted/30 relative flex items-start space-x-4 rounded-xl border p-4 transition-colors">
              <Checkbox
                id="requiresApproval"
                checked={requiresApproval}
                onCheckedChange={(checked: boolean) =>
                  setRequiresApproval(!!checked)
                }
                className="mt-1"
              />
              <div className="space-y-1">
                <Label
                  htmlFor="requiresApproval"
                  className="flex cursor-pointer items-center gap-2 text-base font-medium after:absolute after:inset-0 after:content-['']"
                >
                  <CheckSquare className="text-muted-foreground h-4 w-4" />
                  Require Approval
                </Label>
                <p className="text-muted-foreground text-sm">
                  Users can request to join, but an admin must approve their
                  registration.
                </p>
              </div>
            </div>

            <div className="border-destructive/20 bg-destructive/5 hover:bg-destructive/10 relative flex items-start space-x-4 rounded-xl border p-4 transition-colors">
              <Checkbox
                id="isLocked"
                checked={isLocked}
                onCheckedChange={(checked: boolean) => setIsLocked(!!checked)}
                className="mt-1"
              />
              <div className="space-y-1">
                <Label
                  htmlFor="isLocked"
                  className="text-danger flex cursor-pointer items-center gap-2 text-base font-medium after:absolute after:inset-0 after:content-['']"
                >
                  <Lock className="h-4 w-4" />
                  Lock Registration
                </Label>
                <p className="text-muted-foreground text-sm">
                  Prevent all new registrations, even if the registration
                  deadline hasn&apos;t passed.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </SettingsDialogLayout>
  )
}
