import { getEventById, getRegistrationRequests, getPendingRegistrationCount } from "@/app/actions/events"
import { RegistrationRequestsTable } from "@/components/registration-requests-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Users } from "lucide-react"

export default async function EventRegistrationsPage({
  params,
}: {
  params: { id: string }
}) {
  const eventData = await getEventById(params.id)

  if (!eventData) {
    redirect("/events")
  }

  // Check if user has permission to view this page
  if (eventData.userRole !== "admin" && eventData.userRole !== "management") {
    redirect(`/events/${params.id}`)
  }

  // Get all registration requests
  const registrationRequests = await getRegistrationRequests(params.id)
  const pendingCount = await getPendingRegistrationCount(params.id)

  return (
    <div className="container mx-auto py-10">
      <div className="flex flex-col lg:flex-row justify-between mb-6 space-y-5 lg:space-y-0">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href={`/events/${params.id}`}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">Registration Requests</h1>
          </div>
          <p className="text-muted-foreground">
            {eventData.event.title}
            {pendingCount > 0 && (
              <span className="ml-2 font-medium text-amber-600">
                • {pendingCount} pending {pendingCount === 1 ? "request" : "requests"}
              </span>
            )}
          </p>
        </div>
        <div>
          <Link href={`/events/${params.id}`}>
            <Button variant="outline" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Back to Event
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">Manage Registration Requests</CardTitle>
          <CardDescription>Review and manage user registration requests for this event.</CardDescription>
        </CardHeader>
        <CardContent>
          <RegistrationRequestsTable requests={registrationRequests} eventId={params.id} />
        </CardContent>
      </Card>
    </div>
  )
}

