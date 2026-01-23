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
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { updateEvent } from "@/app/actions/events"
import { toast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import type { Event } from "@/app/actions/events"

interface EditEventModalProps {
  event: Event
  isOpen: boolean
  onClose: () => void
}

export function EditEventModal({
  event,
  isOpen,
  onClose,
}: EditEventModalProps) {
  const [title, setTitle] = useState(event.title)
  const [description, setDescription] = useState(event.description ?? "")
  const [startDate, setStartDate] = useState<Date>(new Date(event.startDate))
  const [endDate, setEndDate] = useState<Date>(new Date(event.endDate))
  const [registrationDeadline, setRegistrationDeadline] = useState<
    Date | undefined
  >(
    event.registrationDeadline
      ? new Date(event.registrationDeadline)
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
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        registrationDeadline: registrationDeadline
          ? registrationDeadline.toISOString()
          : null,
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
    } catch (error) {
      console.error("Failed to update event:", error)
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
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Edit Event</DialogTitle>
          <DialogDescription>
            Make changes to your event here. Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="col-span-3"
              required
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="startDate" className="text-right">
              Start Date
            </Label>
            <div className="col-span-3">
              <Popover modal={true}>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? (
                      format(startDate, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="endDate" className="text-right">
              End Date
            </Label>
            <div className="col-span-3">
              <Popover modal={true}>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? (
                      format(endDate, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="registrationDeadline" className="text-right">
              Registration Deadline
            </Label>
            <div className="col-span-3">
              <Popover modal={true}>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !registrationDeadline && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {registrationDeadline ? (
                      format(registrationDeadline, "PPP")
                    ) : (
                      <span>Optional</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={registrationDeadline}
                    onSelect={setRegistrationDeadline}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="minimumBuyIn" className="text-right">
              Minimum Buy-In
            </Label>
            <Input
              id="minimumBuyIn"
              type="number"
              value={minimumBuyIn}
              onChange={(e) => setMinimumBuyIn(Number(e.target.value))}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="basePrizePool" className="text-right">
              Base Prize Pool
            </Label>
            <Input
              id="basePrizePool"
              type="number"
              value={basePrizePool}
              onChange={(e) => setBasePrizePool(Number(e.target.value))}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="isLocked" className="text-right">
              Lock Registration
            </Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isLocked"
                checked={isLocked}
                onCheckedChange={(checked) => setIsLocked(!!checked)}
              />
              <label
                htmlFor="isLocked"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Prevent new registrations
              </label>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="isPublic" className="text-right">
              Public Event
            </Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isPublic"
                checked={isPublic}
                onCheckedChange={(checked) => setIsPublic(!!checked)}
              />
              <label
                htmlFor="isPublic"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Visible in public listings
              </label>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="requiresApproval" className="text-right">
              Require Approval
            </Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="requiresApproval"
                checked={requiresApproval}
                onCheckedChange={(checked) => setRequiresApproval(!!checked)}
              />
              <label
                htmlFor="requiresApproval"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Require admin approval for registrations
              </label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
