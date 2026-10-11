"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { assignEventToClan } from "@/app/actions/events"
import { Button } from "@/components/ui/button"
import {
  Dialog,
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
import {
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
} from "@/components/responsive-dialog"
import { toast } from "@/hooks/use-toast"

type Clan = {
  id: string
  name: string
}

type AssignEventToClanModalProps = {
  eventId: string
  clans: Clan[]
}

export default function AssignEventToClanModal({
  eventId,
  clans,
}: AssignEventToClanModalProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedClanId, setSelectedClanId] = useState("")
  const router = useRouter()

  const handleOpenChange = (next: boolean) => {
    if (isLoading) return
    // Start from an empty selection every time the dialog opens.
    if (next) setSelectedClanId("")
    setOpen(next)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedClanId) return

    setIsLoading(true)
    try {
      await assignEventToClan(eventId, selectedClanId)
      setOpen(false)
      toast({
        title: "Event assigned",
        description: "The event has been successfully assigned to the clan.",
      })
      router.refresh()
    } catch (error) {
      toast({
        title: "Couldn't assign event",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          Assign to Clan
        </Button>
      </DialogTrigger>
      <ResponsiveDialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Assign Event to Clan</DialogTitle>
          <DialogDescription>
            Choose a clan to assign this event to.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <ResponsiveDialogBody>
            <div className="space-y-2">
              <Label htmlFor="assign-clan">Clan</Label>
              <Select value={selectedClanId} onValueChange={setSelectedClanId}>
                <SelectTrigger id="assign-clan">
                  <SelectValue placeholder="Select a clan" />
                </SelectTrigger>
                <SelectContent>
                  {clans.map((clan) => (
                    <SelectItem key={clan.id} value={clan.id}>
                      {clan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </ResponsiveDialogBody>
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !selectedClanId}>
              {isLoading ? "Assigning…" : "Assign Event"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </Dialog>
  )
}
