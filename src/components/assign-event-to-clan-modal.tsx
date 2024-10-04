'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { assignEventToClan } from '@/app/actions/events'

type Clan = {
  id: string;
  name: string;
};

type AssignEventToClanModalProps = {
  eventId: string;
  clans: Clan[];
};

export default function AssignEventToClanModal({ eventId, clans }: AssignEventToClanModalProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedClanId, setSelectedClanId] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async () => {
    if (!selectedClanId) {
      toast({
        title: "Error",
        description: "Please select a clan",
        variant: "destructive",
      })
      return
    }

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
        <Button variant="outline" className='w-full'>Assign to Clan</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Assign Event to Clan</DialogTitle>
          <DialogDescription>Choose a clan to assign this event to.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Select onValueChange={(value) => setSelectedClanId(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select a clan" />
            </SelectTrigger>
            <SelectContent>
              {clans.map((clan) => (
                <SelectItem key={clan.id} value={clan.id}>{clan.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? "Assigning..." : "Assign Event"}
        </Button>
      </DialogContent>
    </Dialog>
  )
}

