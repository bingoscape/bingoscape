import { getServerAuthSession } from "@/server/auth"
import { getEventById, getUserRegistrationStatus } from "@/app/actions/events"
import { notFound, redirect } from "next/navigation"
import { RegistrationStatus } from "@/components/registration-status"

export default async function EventRegistrationStatusPage({ params }: { params: { id: string } }) {
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    redirect(`/sign-in?callbackUrl=/events/${params.id}/status`)
  }

  const eventData = await getEventById(params.id)
  if (!eventData) {
    notFound()
  }

  // Check if the user is already a participant
  if (eventData.userRole) {
    // If they're already a participant, redirect to the event page
    redirect(`/events/${params.id}`)
  }

  // Get the registration status
  const registrationStatus = await getUserRegistrationStatus(params.id)

  // If they haven't requested to join, redirect to the event page
  if (registrationStatus.status === "not_requested") {
    redirect(`/events/${params.id}`)
  }

  return (
    <div className="container mx-auto py-10">
      <RegistrationStatus
        eventId={params.id}
        eventTitle={eventData.event.title}
        status={registrationStatus.status}
        message={registrationStatus.message}
        responseMessage={registrationStatus.responseMessage}
      />
    </div>
  )
}

