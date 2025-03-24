"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { joinEvent } from "@/app/actions/events"
import { toast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { LockOpen } from "lucide-react"

interface RegistrationOverrideButtonProps {
  eventId: string
  reason: string
}

export function RegistrationOverrideButton({ eventId, reason }: RegistrationOverrideButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleOverride = async () => {
    setIsLoading(true)
    try {
      await joinEvent(eventId, true) // Pass true to override registration restrictions
      toast({
        title: "Success",
        description: "You have joined the event",
      })
      router.refresh()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to join event",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mt-4 p-4 border rounded-md bg-muted/50">
      <p className="text-sm text-muted-foreground mb-2">{reason}</p>
      <Button onClick={handleOverride} disabled={isLoading} variant="outline" className="w-full">
        <LockOpen className="h-4 w-4 mr-2" />
        {isLoading ? "Processing..." : "Override and Join Anyway (Admin Only)"}
      </Button>
    </div>
  )
}

