"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { joinEvent, requestToJoinEvent } from "@/app/actions/events"
import { toast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

interface JoinEventButtonProps {
  eventId: string
  registrationStatus: {
    isOpen: boolean
    reason?: string
    canOverride: boolean
    requiresApproval?: boolean
  }
  requiresApproval?: boolean
  className?: string
}

export function JoinEventButton({ eventId, registrationStatus, requiresApproval, className }: JoinEventButtonProps) {
  const [isJoining, setIsJoining] = useState(false)
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [requestMessage, setRequestMessage] = useState("")
  const router = useRouter()

  const handleJoinEvent = async (override = false) => {
    setIsJoining(true)
    try {
      await joinEvent(eventId, override)
      toast({
        title: "Success",
        description: "You have successfully joined the event",
      })
      router.refresh()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to join event",
        variant: "destructive",
      })
    } finally {
      setIsJoining(false)
    }
  }

  const handleRequestSubmit = async () => {
    setIsJoining(true)
    try {
      await requestToJoinEvent(eventId, requestMessage)
      toast({
        title: "Request submitted",
        description: "Your registration request has been submitted for review.",
      })
      setShowRequestForm(false)
      router.push(`/events/${eventId}/status`)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit request",
        variant: "destructive",
      })
    } finally {
      setIsJoining(false)
    }
  }

  const handleJoinClick = () => {
    if (requiresApproval) {
      setShowRequestForm(true)
    } else {
      handleJoinEvent(false)
    }
  }

  if (showRequestForm) {
    return (
      <div className="space-y-4">
        <Textarea
          placeholder="Why do you want to join this event? (Optional)"
          value={requestMessage}
          onChange={(e) => setRequestMessage(e.target.value)}
          className="h-24"
        />
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => setShowRequestForm(false)} disabled={isJoining}>
            Cancel
          </Button>
          <Button onClick={handleRequestSubmit} disabled={isJoining}>
            {isJoining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isJoining ? "Submitting..." : "Submit Request"}
          </Button>
        </div>
      </div>
    )
  }

  if (!registrationStatus.isOpen) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">{registrationStatus.reason}</p>
        {registrationStatus.canOverride && (
          <Button onClick={() => handleJoinEvent(true)} disabled={isJoining} className={className}>
            {isJoining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isJoining ? "Joining..." : "Override and Join Event"}
          </Button>
        )}
      </div>
    )
  }

  return (
    <Button onClick={handleJoinClick} disabled={isJoining} className={className}>
      {isJoining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {isJoining ? "Processing..." : requiresApproval ? "Request to Join Event" : "Join Event"}
    </Button>
  )
}

