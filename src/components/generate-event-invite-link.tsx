'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/hooks/use-toast"
import { generateEventInviteLink } from "@/app/actions/events"
import { type UUID } from "crypto"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Link } from "lucide-react"

export function GenerateEventInviteLink({ eventId, children }: { eventId: UUID, children: React.ReactNode }) {
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const handleGenerateInvite = async () => {
    try {
      const invite = await generateEventInviteLink(eventId)
      if (!invite) {
        throw new Error("No invite has been created")
      }
      const link = `${window.location.origin}/events/join/${invite.inviteCode}`
      setInviteLink(link)
      toast({
        title: "Invite link generated",
        description: "The invite link has been created successfully.",
      })
    } catch (error) {
      console.error(error)
      toast({
        title: "Error",
        description: "Failed to generate invite link.",
        variant: "destructive",
      })
    }
  }

  const handleCopy = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink)
        .then(() =>
          toast({
            title: "Copied",
            description: "Invite link copied to clipboard.",
          })
        ).catch(err => console.error(err))
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">
          {children}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Generate Invite Link</DialogTitle>
          <DialogDescription>
            Create an invite link for this event. The link can be shared with others to join the event.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Button onClick={handleGenerateInvite} className="w-full">
            <Link className="mr-2 h-4 w-4" />
            Generate Invite Link
          </Button>
          {inviteLink && (
            <div className="flex items-center space-x-2">
              <Input value={inviteLink} readOnly />
              <Button onClick={handleCopy}>Copy</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
