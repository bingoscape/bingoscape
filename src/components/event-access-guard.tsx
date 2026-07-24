import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { isRegistrationOpen, getUserRegistrationStatus } from "@/app/actions/events"
import { JoinEventButton } from "@/components/join-event-button"
import { RegistrationStatus } from "@/components/registration-status"
import { getEventById } from "@/server/queries/events"

export async function EventAccessGuard({ eventId }: { eventId: string }) {
  const data = await getEventById(eventId)
  if (!data) return null

  const { event } = data
  const registrationStatus = await getUserRegistrationStatus(eventId)
  const regOpenStatus = await isRegistrationOpen(eventId)

  return (
    <Card className="mx-auto mb-8 max-w-2xl">
      <CardHeader>
        <CardTitle>Event Access Restricted</CardTitle>
        <CardDescription>
          You are not a participant in this event: {event.title}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {registrationStatus.status !== "not_requested" ? (
          <RegistrationStatus
            eventId={event.id}
            eventTitle={event.title}
            status={registrationStatus.status}
            message={registrationStatus.message}
            responseMessage={registrationStatus.responseMessage}
          />
        ) : (
          <div className="space-y-4">
            <p>You need to join this event to view its details.</p>
            <JoinEventButton
              eventId={event.id}
              registrationStatus={regOpenStatus}
              requiresApproval={event.requiresApproval}
            />
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" asChild>
          <Link href="/">Return to Home</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
