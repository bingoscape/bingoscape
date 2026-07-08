"use client"

import React from "react"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { updateEvent } from "@/app/actions/events"
import { toast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { cn } from "@/lib/utils"
import type { Event } from "@/app/actions/events"

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
      await updateEvent(event.id, {
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
      toast({
        title: "Event updated",
        description: "Your event has been updated successfully.",
      })
      onClose()
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to update event. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex h-[600px] max-w-4xl overflow-hidden border-0 p-0">
        {/* Sidebar Navigation */}
        <div className="flex w-64 flex-col border-r bg-muted/30 p-4">
          <DialogHeader className="mb-6 text-left">
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription className="text-xs">
              Manage your event settings
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            {TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                    activeTab === tab.id
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="relative flex flex-1 flex-col overflow-hidden bg-background">
          <div className="flex-1 overflow-y-auto p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {activeTab === "overview" && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium">Overview</h3>
                      <p className="text-sm text-muted-foreground">
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
                        <Select value={timezone} onValueChange={setTimezone}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select timezone" />
                          </SelectTrigger>
                          <SelectContent>
                            {Intl.supportedValuesOf("timeZone").map((tz) => (
                              <SelectItem key={tz} value={tz}>
                                {tz}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "schedule" && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium">Schedule</h3>
                      <p className="text-sm text-muted-foreground">
                        Manage when your event runs.
                      </p>
                    </div>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
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
                        <p className="text-xs text-muted-foreground">
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
                      <p className="text-sm text-muted-foreground">
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
                      <p className="text-sm text-muted-foreground">
                        Control who can see and join your event.
                      </p>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-start space-x-4 rounded-xl border bg-muted/10 p-4 transition-colors hover:bg-muted/30">
                        <Checkbox
                          id="isPublic"
                          checked={isPublic}
                          onCheckedChange={(checked: boolean) =>
                            setIsPublic(!!checked)
                          }
                          className="mt-1"
                        />
                        <div className="space-y-1">
                          <Label
                            htmlFor="isPublic"
                            className="flex cursor-pointer items-center gap-2 text-base font-medium"
                          >
                            <Eye className="h-4 w-4 text-muted-foreground" />
                            Public Event
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            When enabled, this event will be visible in public
                            listings for anyone to see.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-4 rounded-xl border bg-muted/10 p-4 transition-colors hover:bg-muted/30">
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
                            className="flex cursor-pointer items-center gap-2 text-base font-medium"
                          >
                            <CheckSquare className="h-4 w-4 text-muted-foreground" />
                            Require Approval
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Users can request to join, but an admin must approve
                            their registration.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-4 rounded-xl border border-destructive/20 bg-destructive/5 p-4 transition-colors hover:bg-destructive/10">
                        <Checkbox
                          id="isLocked"
                          checked={isLocked}
                          onCheckedChange={(checked: boolean) =>
                            setIsLocked(!!checked)
                          }
                          className="mt-1"
                        />
                        <div className="space-y-1">
                          <Label
                            htmlFor="isLocked"
                            className="flex cursor-pointer items-center gap-2 text-base font-medium text-destructive"
                          >
                            <Lock className="h-4 w-4" />
                            Lock Registration
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Prevent all new registrations, even if the
                            registration deadline hasn&apos;t passed.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Fixed Footer */}
          <div className="relative z-10 flex justify-end gap-2 border-t bg-background p-4">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
