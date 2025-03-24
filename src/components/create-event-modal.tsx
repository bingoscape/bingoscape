"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { createEvent } from "@/app/actions/events"
import formatRunescapeGold from "@/lib/formatRunescapeGold"

export function CreateEventModal() {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [buyIn, setBuyIn] = useState(0)
  const [basePool, setBasePool] = useState(0)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    const formData = new FormData(e.currentTarget)

    try {
      const result = await createEvent(formData)
      if (result.success) {
        setOpen(false)
        toast({
          title: "Event created",
          description: "Your new event has been successfully created.",
        })
        router.refresh()
      } else {
        throw new Error(result.error ?? "Failed to create event")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create New Event</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Event</DialogTitle>
          <DialogDescription>Create a new event for your OSRS Bingo. Fill out the details below.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Event Title</Label>
            <Input id="title" name="title" required />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" />
          </div>
          <div>
            <Label htmlFor="basePrizePool">Base Prizepool</Label>
            <Input
              id="basePrizePool"
              name="basePrizePool"
              type="number"
              required
              onChange={(e) => setBasePool(Number.parseInt(e.target.value))}
              min={0}
              defaultValue={0}
            />
            <span className="text-sm font-medium">({formatRunescapeGold(basePool)} GP)</span>
          </div>
          <div>
            <Label htmlFor="minimumBuyIn">Buy In</Label>
            <Input
              id="minimumBuyIn"
              name="minimumBuyIn"
              type="number"
              required
              onChange={(e) => setBuyIn(Number.parseInt(e.target.value))}
              min={0}
              defaultValue={0}
            />
            <span className="text-sm font-medium">({formatRunescapeGold(buyIn)} GP)</span>
          </div>
          <div>
            <Label htmlFor="startDate">Start Date</Label>
            <Input id="startDate" name="startDate" type="date" required />
          </div>
          <div>
            <Label htmlFor="endDate">End Date</Label>
            <Input id="endDate" name="endDate" type="date" required />
          </div>
          <div>
            <Label htmlFor="registrationDeadline">Registration Deadline</Label>
            <Input id="registrationDeadline" name="registrationDeadline" type="datetime-local" />
            <p className="text-xs text-muted-foreground mt-1">
              If set, users won&apos;t be able to join after this date. Leave empty for no deadline.
            </p>
          </div>
          <div>
            <Label htmlFor="basePrizePool">Base Prizepool</Label>
          </div>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Creating..." : "Create Event"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

