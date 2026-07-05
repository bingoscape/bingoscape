"use client"

import type React from "react"
import { useState, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
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
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { GPInput } from "@/components/ui/gp-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CalendarIcon, Info, ArrowRight, ArrowLeft, Swords, Shield, Rocket, CheckCircle2 } from "lucide-react"
import { format, differenceInDays, addDays } from "date-fns"
import { fromZonedTime } from "date-fns-tz"
import { cn } from "@/lib/utils"
import type { DateRange } from "react-day-picker"

interface CreateEventModalProps {
  isOpen: boolean
  onClose: () => void
  onEventCreated?: () => void | Promise<void>
}

interface FormErrors {
  title?: string
  startDate?: string
  endDate?: string
  registrationDeadline?: string
  minimumBuyIn?: string
  basePrizePool?: string
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 20 : -20,
    opacity: 0,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 20 : -20,
    opacity: 0,
  }),
}

export function CreateEventModal({
  isOpen,
  onClose,
  onEventCreated,
}: CreateEventModalProps) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(1)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [gameType, setGameType] = useState<"osrs" | "rs3">("osrs")
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [registrationDeadline, setRegistrationDeadline] = useState<Date | undefined>(undefined)
  const [minimumBuyIn, setMinimumBuyIn] = useState(0)
  const [basePrizePool, setBasePrizePool] = useState(0)
  const [timezone, setTimezone] = useState<string>(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  )
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})

  const totalSteps = 4

  // Reset step on close
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep(1)
        setDirection(1)
      }, 300)
    }
  }, [isOpen])

  // Auto-set end date to start date + 7 days when start date is selected
  useEffect(() => {
    if (startDate && !endDate) {
      setEndDate(addDays(startDate, 7))
    }
  }, [startDate, endDate])

  const eventDuration = useMemo(() => {
    if (!startDate || !endDate) return null
    const days = differenceInDays(endDate, startDate) + 1
    return days === 1 ? "1 day" : `${days} days`
  }, [startDate, endDate])

  const validateStep = (currentStep: number): boolean => {
    const newErrors: FormErrors = {}
    let isValid = true

    if (currentStep === 1) {
      if (!title.trim()) {
        newErrors.title = "Title is required"
        isValid = false
      } else if (title.trim().length < 3) {
        newErrors.title = "Title must be at least 3 characters"
        isValid = false
      }
    } else if (currentStep === 2) {
      if (!startDate) {
        newErrors.startDate = "Event start date is required"
        isValid = false
      }
      if (!endDate) {
        newErrors.endDate = "Event end date is required"
        isValid = false
      }
      if (registrationDeadline && startDate) {
        if (registrationDeadline >= startDate) {
          newErrors.registrationDeadline = "Registration deadline must be before event start date"
          isValid = false
        }
      }
    } else if (currentStep === 3) {
      if (minimumBuyIn < 0) {
        newErrors.minimumBuyIn = "Buy-in cannot be negative"
        isValid = false
      }
      if (basePrizePool < 0) {
        newErrors.basePrizePool = "Prize pool cannot be negative"
        isValid = false
      }
    }

    setErrors(newErrors)
    return isValid
  }

  const handleNext = () => {
    if (validateStep(step)) {
      setDirection(1)
      setStep((prev) => Math.min(prev + 1, totalSteps))
    }
  }

  const handleBack = () => {
    setDirection(-1)
    setStep((prev) => Math.max(prev - 1, 1))
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!validateStep(3)) return // Ensure all fields are valid
    if (!startDate || !endDate) return

    setIsSubmitting(true)
    const formData = new FormData()
    formData.append("title", title.trim())
    formData.append("description", description.trim())
    formData.append("gameType", gameType)
    formData.append("startDate", fromZonedTime(format(startDate, "yyyy-MM-dd'T'HH:mm:ss"), timezone).toISOString())
    formData.append("endDate", fromZonedTime(format(endDate, "yyyy-MM-dd'T'HH:mm:ss"), timezone).toISOString())
    if (registrationDeadline) {
      formData.append(
        "registrationDeadline",
        fromZonedTime(format(registrationDeadline, "yyyy-MM-dd'T'HH:mm:ss"), timezone).toISOString()
      )
    }
    formData.append("timezone", timezone)
    formData.append("minimumBuyIn", minimumBuyIn.toString())
    formData.append("basePrizePool", basePrizePool.toString())
    formData.append("requiresApproval", requiresApproval.toString())

    try {
      const result = await createEvent(formData)
      if (result.success) {
        toast({ title: "Event created", description: "Your event has been created successfully." })
        setTitle("")
        setDescription("")
        setGameType("osrs")
        setStartDate(undefined)
        setEndDate(undefined)
        setRegistrationDeadline(undefined)
        setMinimumBuyIn(0)
        setBasePrizePool(0)
        setRequiresApproval(false)
        setErrors({})
        onClose()
        if (onEventCreated) await onEventCreated()
        router.refresh()
      } else {
        toast({ title: "Error", description: result.error ?? "Failed to create event. Please try again.", variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to create event. Please try again.", variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] sm:max-w-[600px] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create New Event</DialogTitle>
          <DialogDescription>
            Step {step} of {totalSteps}: {
              step === 1 ? "Identity & Theme" :
              step === 2 ? "Scheduling & Time" :
              step === 3 ? "Financials & Rules" :
              "Review & Launch"
            }
          </DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        <div className="w-full bg-muted h-2 rounded-full overflow-hidden my-4 relative">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: "25%" }}
            animate={{ width: `${(step / totalSteps) * 100}%` }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        </div>

        <div className="flex-1 relative min-h-[350px]">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute inset-0 overflow-y-auto px-1 py-2 space-y-6"
            >
              {step === 1 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="title">Event Title <span className="text-destructive">*</span></Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., Summer Bingo Challenge 2026"
                      maxLength={100}
                      className={cn(errors.title && "border-destructive")}
                    />
                    {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe your event, rules, and what participants can expect..."
                      rows={3}
                      maxLength={500}
                      className="resize-none"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Game Type <span className="text-destructive">*</span></Label>
                    <div className="grid grid-cols-2 gap-4">
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          "border-2 rounded-xl p-4 cursor-pointer transition-colors relative overflow-hidden group",
                          gameType === 'osrs' ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                        )}
                        onClick={() => setGameType('osrs')}
                      >
                        {gameType === 'osrs' && (
                          <div className="absolute top-2 right-2 text-primary">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                        )}
                        <Swords className={cn("w-8 h-8 mb-3", gameType === 'osrs' ? "text-primary" : "text-muted-foreground")} />
                        <h4 className="font-semibold text-sm">Old School RuneScape</h4>
                        <p className="text-xs text-muted-foreground mt-1">The classic 2007 experience</p>
                      </motion.div>
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          "border-2 rounded-xl p-4 cursor-pointer transition-colors relative overflow-hidden group",
                          gameType === 'rs3' ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                        )}
                        onClick={() => setGameType('rs3')}
                      >
                        {gameType === 'rs3' && (
                          <div className="absolute top-2 right-2 text-primary">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                        )}
                        <Shield className={cn("w-8 h-8 mb-3", gameType === 'rs3' ? "text-primary" : "text-muted-foreground")} />
                        <h4 className="font-semibold text-sm">RuneScape 3</h4>
                        <p className="text-xs text-muted-foreground mt-1">The modern evolution</p>
                      </motion.div>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label>Event Timezone</Label>
                    <Select value={timezone} onValueChange={setTimezone}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        {Intl.supportedValuesOf("timeZone").map((tz) => (
                          <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Date <span className="text-destructive">*</span></Label>
                      <DateTimePicker
                        date={startDate}
                        setDate={setStartDate}
                        fromDate={today}
                        error={errors.startDate}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date <span className="text-destructive">*</span></Label>
                      <DateTimePicker
                        date={endDate}
                        setDate={setEndDate}
                        fromDate={startDate || today}
                        error={errors.endDate}
                      />
                    </div>
                  </div>
                  
                  {eventDuration && !errors.startDate && !errors.endDate && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Info className="h-3.5 w-3.5" />
                      <span>Event will run for {eventDuration}</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="registrationDeadline">Registration Deadline</Label>
                    <DateTimePicker
                      date={registrationDeadline}
                      setDate={setRegistrationDeadline}
                      fromDate={today}
                      toDate={startDate}
                      placeholder="Optional: Set registration cutoff"
                      error={errors.registrationDeadline}
                    />
                    {errors.registrationDeadline && <p className="text-sm text-destructive">{errors.registrationDeadline}</p>}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="minimumBuyIn">Minimum Buy-In</Label>
                    <GPInput
                      id="minimumBuyIn"
                      value={minimumBuyIn}
                      onChange={setMinimumBuyIn}
                      error={errors.minimumBuyIn}
                    />
                    <p className="text-xs text-muted-foreground">Minimum gold required to participate</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="basePrizePool">Base Prize Pool</Label>
                    <GPInput
                      id="basePrizePool"
                      value={basePrizePool}
                      onChange={setBasePrizePool}
                      error={errors.basePrizePool}
                    />
                    <p className="text-xs text-muted-foreground">Starting prize pool before entry fees</p>
                  </div>

                  <div className="flex items-start space-x-3 rounded-xl border p-4 bg-muted/20">
                    <Checkbox
                      id="requiresApproval"
                      checked={requiresApproval}
                      onCheckedChange={(checked) => setRequiresApproval(!!checked)}
                      className="mt-0.5"
                    />
                    <div className="space-y-1">
                      <label htmlFor="requiresApproval" className="cursor-pointer text-sm font-medium leading-none">
                        Require Admin Approval
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Manually approve each registration request
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-6">
                  <div className="bg-muted/30 p-6 rounded-xl border space-y-4">
                    <h3 className="font-semibold text-lg">{title || "Untitled Event"}</h3>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Game Type</p>
                        <div className="flex items-center gap-2 font-medium">
                          {gameType === 'osrs' ? <Swords className="w-4 h-4 text-primary" /> : <Shield className="w-4 h-4 text-primary" />}
                          {gameType === 'osrs' ? 'Old School RuneScape' : 'RuneScape 3'}
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Schedule</p>
                        <p className="font-medium">
                          {startDate ? format(startDate, "MMM d, yyyy h:mm a") : "TBD"} - {endDate ? format(endDate, "MMM d, yyyy h:mm a") : "TBD"}
                        </p>
                      </div>

                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Buy-In</p>
                        <p className="font-medium text-yellow-500 flex items-center gap-1">
                          {minimumBuyIn.toLocaleString()} GP
                        </p>
                      </div>

                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Approval</p>
                        <p className="font-medium">{requiresApproval ? "Required" : "Open"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">
                      Ready to launch your event? You can always edit these settings later.
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <DialogFooter className="mt-8 flex items-center sm:justify-between w-full">
          <Button
            type="button"
            variant="ghost"
            onClick={step === 1 ? onClose : handleBack}
            disabled={isSubmitting}
            className="flex items-center gap-2"
          >
            {step === 1 ? "Cancel" : <><ArrowLeft className="w-4 h-4" /> Back</>}
          </Button>

          {step < totalSteps ? (
            <Button type="button" onClick={handleNext} className="flex items-center gap-2">
              Next Step <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isSubmitting ? "Launching..." : "Launch Event"}
              {!isSubmitting && <Rocket className="w-4 h-4" />}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
