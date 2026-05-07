import { unauthorized } from "next/navigation"
import { getServerAuthSession } from "@/server/auth"
import { getUserRegistrationStatus } from "@/app/actions/events"
import { RegistrationStatus } from "@/components/registration-status"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export default async function StatusPage(props: {
  params: Promise<{ id: string }>
}) {
  const { id: eventId } = await props.params

  const session = await getServerAuthSession()
  if (!session?.user) {
    unauthorized()
  }

  const registrationData = await getUserRegistrationStatus(eventId)

  if (!registrationData || registrationData.status === "not_requested") {
    return (
      <div className="container mx-auto py-10">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Registration Found</AlertTitle>
          <AlertDescription>
            You have not registered for this event yet.
          </AlertDescription>
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
