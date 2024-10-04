'use client'

import { useState } from 'react'
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
import { formatRunescapeGold } from '@/lib/utils'
import { Label } from "@/components/ui/label"

interface Event {
  id: string
  title: string
  description: string | null
  startDate: Date
  endDate: Date
  minimumBuyIn: number
  basePrizePool: number
}

export function EditEventModal({ event }: { event: Event }) {
  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState({
    title: event.title,
    description: event.description ?? '',
    startDate: event.startDate.toISOString().split('T')[0]!,
    endDate: event.endDate.toISOString().split('T')[0]!,
    minimumBuyIn: event.minimumBuyIn,
    basePrizePool: event.basePrizePool,
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: name === 'minimumBuyIn' || name === 'basePrizePool' ? Number(value) : value }))
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
          <DialogDescription>
            Make changes to your event here. Click save when you are done.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Event Title"
            />
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
            <Input
              id="startDate"
              name="startDate"
              type="date"
              value={formData.startDate}
              onChange={handleChange}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              name="endDate"
              type="date"
              value={formData.endDate}
              onChange={handleChange}
            />
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
            <p className="text-sm text-muted-foreground">
              {formatRunescapeGold(formData.minimumBuyIn)} GP
            </p>
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
            <p className="text-sm text-muted-foreground">
              {formatRunescapeGold(formData.basePrizePool)} GP
            </p>
          </div>
          <Button type="submit">Save Changes</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
