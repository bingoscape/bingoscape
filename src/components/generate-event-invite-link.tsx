'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/hooks/use-toast"
import { generateEventInviteLink } from "@/app/actions/events"
import { UUID } from "crypto"

export function GenerateEventInviteLink({ eventId }: { eventId: UUID }) {
  const [inviteLink, setInviteLink] = useState<string | null>(null)

  const handleGenerateInvite = async () => {
    try {
      const invite = await generateEventInviteLink(eventId) // Replace 'userId' with actual user ID
      const link = `${window.location.origin}/events/join/${invite.inviteCode}`
      setInviteLink(link)
      toast({
        title: "Invite link generated",
        description: "The invite link has been created successfully.",
      })
    } catch (error) {
      console.log(error)
      toast({
        title: "Error",
        description: "Failed to generate invite link.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-4">
      <Button onClick={handleGenerateInvite}>Generate Invite Link</Button>
      {inviteLink && (
        <div className="flex items-center space-x-2">
          <Input value={inviteLink} readOnly />
          <Button onClick={() => navigator.clipboard.writeText(inviteLink)}>Copy</Button>
        </div>
      )}
    </div>
  )
}
