"use client"

import type React from "react"

import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createEvent } from "@/app/actions/events"
import { toast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { GPInput } from "@/components/ui/gp-input"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CalendarIcon, Info } from "lucide-react"
import { format, differenceInDays, addDays } from "date-fns"
import { cn } from "@/lib/utils"
import type { DateRange } from "react-day-picker"

interface CreateEventModalProps {
  isOpen: boolean
  onClose: () => void
  onEventCreated?: () => void | Promise<void>
}

interface FormErrors {
  title?: string
  description?: string
  dateRange?: string
  registrationDeadline?: string
  minimumBuyIn?: string
  basePrizePool?: string
}

export function CreateEventModal({
  isOpen,
  onClose,
  onEventCreated,
}: CreateEventModalProps) {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [gameType, setGameType] = useState<"osrs" | "rs3">("osrs")
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [registrationDeadline, setRegistrationDeadline] = useState<
    Date | undefined
  >(undefined)
  const [minimumBuyIn, setMinimumBuyIn] = useState(0)
  const [basePrizePool, setBasePrizePool] = useState(0)
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})

  // Auto-set end date to start date + 7 days when start date is selected
  useEffect(() => {
    if (dateRange?.from && !dateRange?.to) {
      setDateRange({
        from: dateRange.from,
        to: addDays(dateRange.from, 7),
      })
    }
  }, [dateRange?.from, dateRange?.to])

  // Calculate event duration
  const eventDuration = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return null
    const days = differenceInDays(dateRange.to, dateRange.from) + 1
    return days === 1 ? "1 day" : `${days} days`
  }, [dateRange])

  // Validate form in real-time
  const validateForm = (): FormErrors => {
    const newErrors: FormErrors = {}

    // Title validation
    if (!title.trim()) {
      newErrors.title = "Title is required"
    } else if (title.trim().length < 3) {
      newErrors.title = "Title must be at least 3 characters"
    } else if (title.length > 100) {
      newErrors.title = "Title must be less than 100 characters"
    }

    // Date range validation
    if (!dateRange?.from || !dateRange?.to) {
      newErrors.dateRange = "Event start and end dates are required"
    } else if (dateRange.from > dateRange.to) {
      newErrors.dateRange = "End date must be after start date"
    }

    // Registration deadline validation
    if (registrationDeadline && dateRange?.from) {
      if (registrationDeadline >= dateRange.from) {
        newErrors.registrationDeadline =
          "Registration deadline must be before event start date"
      }
    }

    // Financial validation
    if (minimumBuyIn < 0) {
      newErrors.minimumBuyIn = "Buy-in cannot be negative"
    }

    if (basePrizePool < 0) {
      newErrors.basePrizePool = "Prize pool cannot be negative"
    }

    return newErrors
  }

  // Check if form is valid
  const isFormValid = useMemo(() => {
    const formErrors = validateForm()
    return Object.keys(formErrors).length === 0
  }, [title, dateRange, registrationDeadline, minimumBuyIn, basePrizePool])

  // Update errors on field changes
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      setErrors(validateForm())
    }
  }, [title, dateRange, registrationDeadline, minimumBuyIn, basePrizePool])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate form
    const formErrors = validateForm()
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors)
      toast({
        title: "Validation Error",
        description: "Please fix the errors in the form before submitting.",
        variant: "destructive",
      })
      return
    }

    if (!dateRange?.from || !dateRange?.to) {
      toast({
        title: "Missing required fields",
        description: "Please select event start and end dates.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    const formData = new FormData()
    formData.append("title", title.trim())
    formData.append("description", description.trim())
    formData.append("gameType", gameType)
    formData.append("startDate", dateRange.from.toISOString())
    formData.append("endDate", dateRange.to.toISOString())
    if (registrationDeadline) {
      formData.append(
        "registrationDeadline",
        registrationDeadline.toISOString()
      )
    }
    formData.append("minimumBuyIn", minimumBuyIn.toString())
    formData.append("basePrizePool", basePrizePool.toString())
    formData.append("requiresApproval", requiresApproval.toString())

    try {
      const result = await createEvent(formData)
      if (result.success) {
        toast({
          title: "Event created",
          description: "Your event has been created successfully.",
        })

        // Reset form
        setTitle("")
        setDescription("")
        setGameType("osrs")
        setDateRange(undefined)
        setRegistrationDeadline(undefined)
        setMinimumBuyIn(0)
        setBasePrizePool(0)
        setRequiresApproval(false)
        setErrors({})

        onClose()
        if (onEventCreated) {
          await onEventCreated()
        }
        router.refresh()
      } else {
        toast({
          title: "Error",
          description:
            result.error ?? "Failed to create event. Please try again.",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create event. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Event</DialogTitle>
            <DialogDescription>
              Set up a new bingo event for your community.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-6">
            {/* Event Details Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Event Details
                </h3>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Summer Bingo Challenge 2026"
                  maxLength={100}
                  className={cn(errors.title && "border-destructive")}
                />
                <div className="flex items-center justify-between">
                  {errors.title && (
                    <p className="text-sm text-destructive">{errors.title}</p>
                  )}
                  <p className="ml-auto text-xs text-muted-foreground">
                    {title.length}/100
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your event, rules, and what participants can expect..."
                  rows={4}
                  maxLength={500}
                  className="resize-none"
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Optional: Add details about your event
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {description.length}/500
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>
                  Game Type <span className="text-destructive">*</span>
                </Label>
                <RadioGroup
                  value={gameType}
                  onValueChange={(value) =>
                    setGameType(value as "osrs" | "rs3")
                  }
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="osrs" id="osrs" />
                    <Label
                      htmlFor="osrs"
                      className="cursor-pointer font-normal"
                    >
                      Old School RuneScape (OSRS)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="rs3" id="rs3" />
                    <Label htmlFor="rs3" className="cursor-pointer font-normal">
                      RuneScape 3 (RS3)
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            {/* Schedule Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Schedule
                </h3>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="space-y-2">
                <Label>
                  Event Duration <span className="text-destructive">*</span>
                </Label>
                <DateRangePicker
                  value={dateRange}
                  onChange={setDateRange}
                  placeholder="Select start and end dates"
                  fromDate={today}
                  error={errors.dateRange}
                />
                {eventDuration && !errors.dateRange && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Info className="h-3.5 w-3.5" />
                    <span>Event will run for {eventDuration}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="registrationDeadline">
                  Registration Deadline
                </Label>
                <Popover modal={true}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !registrationDeadline && "text-muted-foreground",
                        errors.registrationDeadline &&
                          "border-destructive focus-visible:ring-destructive"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {registrationDeadline ? (
                        format(registrationDeadline, "PPP")
                      ) : (
                        <span>Optional: Set registration cutoff</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={registrationDeadline}
                      onSelect={setRegistrationDeadline}
                      fromDate={today}
                      toDate={dateRange?.from}
                    />
                  </PopoverContent>
                </Popover>
                {errors.registrationDeadline && (
                  <p className="text-sm text-destructive">
                    {errors.registrationDeadline}
                  </p>
                )}
                {!errors.registrationDeadline && (
                  <p className="text-xs text-muted-foreground">
                    Optional: Prevent registrations after this date
                  </p>
                )}
              </div>
            </div>

            {/* Prizes & Settings Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Prizes & Settings
                </h3>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="minimumBuyIn">Minimum Buy-In</Label>
                <GPInput
                  id="minimumBuyIn"
                  value={minimumBuyIn}
                  onChange={setMinimumBuyIn}
                  error={errors.minimumBuyIn}
                />
                {!errors.minimumBuyIn && (
                  <p className="text-xs text-muted-foreground">
                    Minimum gold required for participants to join
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="basePrizePool">Base Prize Pool</Label>
                <GPInput
                  id="basePrizePool"
                  value={basePrizePool}
                  onChange={setBasePrizePool}
                  error={errors.basePrizePool}
                />
                {!errors.basePrizePool && (
                  <p className="text-xs text-muted-foreground">
                    Starting prize pool (grows with buy-ins and donations)
                  </p>
                )}
              </div>

              <div className="flex items-start space-x-3 rounded-lg border p-4">
                <Checkbox
                  id="requiresApproval"
                  checked={requiresApproval}
                  onCheckedChange={(checked) => setRequiresApproval(!!checked)}
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <label
                    htmlFor="requiresApproval"
                    className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Require Admin Approval
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Manually approve each registration request before allowing
                    participation
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !isFormValid}>
              {isSubmitting ? "Creating..." : "Create Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
