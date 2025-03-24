"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { updateEvent } from "@/app/actions/events"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Edit } from "lucide-react"
import formatRunescapeGold from "@/lib/formatRunescapeGold"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

interface Event {
  id: string
  title: string
  description: string | null
  startDate: Date
  endDate: Date
  registrationDeadline: Date | null
  minimumBuyIn: number | undefined
  basePrizePool: number | undefined
  public: boolean | undefined
}

export function EditEventModal({ event }: { event: Event }) {
  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState({
    title: event.title,
    description: event.description ?? "",
    startDate: event.startDate.toISOString().split("T")[0]!,
    endDate: event.endDate.toISOString().split("T")[0]!,
    registrationDeadline: event.registrationDeadline
      ? new Date(event.registrationDeadline).toISOString().slice(0, 16)
      : "",
    minimumBuyIn: event.minimumBuyIn!,
    basePrizePool: event.basePrizePool!,
    public: event.public ?? false,
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === "minimumBuyIn" || name === "basePrizePool" ? Number(value) : value,
    }))
  }

  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData((prev) => ({ ...prev, [name]: checked }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await updateEvent(event.id, formData)
      toast({
        title: "Success",
        description: "Event updated successfully",
      })
      setIsOpen(false)
    } catch (error) {
      console.error(error)
      toast({
        title: "Error",
        description: "Failed to update event",
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Edit className="mr-2 h-4 w-4" />
          Edit Event
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Event</DialogTitle>
          <DialogDescription>Make changes to your event here. Click save when you are done.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" value={formData.title} onChange={handleChange} placeholder="Event Title" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Event Description"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <Input id="startDate" name="startDate" type="date" value={formData.startDate} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <Input id="endDate" name="endDate" type="date" value={formData.endDate} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="registrationDeadline">Registration Deadline</Label>
            <Input
              id="registrationDeadline"
              name="registrationDeadline"
              type="datetime-local"
              value={formData.registrationDeadline}
              onChange={handleChange}
            />
            <p className="text-xs text-muted-foreground">
              If set, users won't be able to join after this date. Leave empty to allow registration until the event
              ends.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="minimumBuyIn">Minimum Buy-In</Label>
            <Input
              id="minimumBuyIn"
              name="minimumBuyIn"
              type="number"
              value={formData.minimumBuyIn}
              onChange={handleChange}
              placeholder="Minimum Buy-In"
            />
            <p className="text-sm text-muted-foreground">{formatRunescapeGold(formData.minimumBuyIn)} GP</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="basePrizePool">Base Prize Pool</Label>
            <Input
              id="basePrizePool"
              name="basePrizePool"
              type="number"
              value={formData.basePrizePool}
              onChange={handleChange}
              placeholder="Base Prize Pool"
            />
            <p className="text-sm text-muted-foreground">{formatRunescapeGold(formData.basePrizePool)} GP</p>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="public">Publicly Accessible</Label>
            <Switch
              id="public"
              name="public"
              checked={formData.public}
              onCheckedChange={(checked) => handleSwitchChange("public", checked)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            When enabled, this event will be viewable by anyone with the link, even without logging in.
          </p>
          <Button type="submit">Save Changes</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

