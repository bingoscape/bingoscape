 
"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { getUserRegistrationStatus } from "@/app/actions/events"
import { RegistrationStatus } from "@/components/registration-status"
import { Loader2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export default function StatusPage() {
  const params = useParams()
  const eventId = params?.id as string
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [registrationData, setRegistrationData] = useState<{
    status: "not_requested" | "pending" | "approved" | "rejected"
    message?: string
    responseMessage?: string
    eventTitle?: string
  } | null>(null)

  useEffect(() => {
    async function fetchRegistrationStatus() {
      try {
        const status = await getUserRegistrationStatus(eventId)
        setRegistrationData(status)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch registration status")
      } finally {
        setLoading(false)
      }
    }

    fetchRegistrationStatus().then(() => console.log("Registration status fetched")).catch(err => console.error(err))
  }, [eventId])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin" role="status" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!registrationData) {
    return (
      <div className="container mx-auto py-10">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Registration Found</AlertTitle>
          <AlertDescription>You have not registered for this event yet.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10">
      <RegistrationStatus
        eventId={eventId}
        eventTitle={registrationData.eventTitle ?? ""}
        status={registrationData.status}
        message={registrationData.message}
        responseMessage={registrationData.responseMessage}
      />
    </div>
  )
}

