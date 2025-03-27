"use client"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Clock3, XCircle } from "lucide-react"
import Link from "next/link"

interface RegistrationStatusProps {
  eventId: string
  eventTitle: string
  status: "not_requested" | "pending" | "approved" | "rejected"
  message?: string
  responseMessage?: string
}

export function RegistrationStatus({ eventId, eventTitle, status, message, responseMessage }: RegistrationStatusProps) {
  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Registration Status</CardTitle>
        <CardDescription>Your registration status for {eventTitle}</CardDescription>
      </CardHeader>
      <CardContent>
        {status === "pending" && (
          <div className="flex flex-col items-center space-y-4 py-4">
            <Clock3 className="h-16 w-16 text-amber-500" />
            <h3 className="text-xl font-semibold text-center">Registration Pending</h3>
            <p className="text-center text-muted-foreground">
              Your registration request is being reviewed by the event organizers. You&apos;ll be notified when a decision is
              made.
            </p>
            {message && (
              <div className="w-full mt-4 p-4 bg-muted rounded-md">
                <p className="font-semibold">Your message:</p>
                <p className="text-sm text-muted-foreground">{message}</p>
              </div>
            )}
          </div>
        )}

        {status === "approved" && (
          <div className="flex flex-col items-center space-y-4 py-4">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <h3 className="text-xl font-semibold text-center">Registration Approved</h3>
            <p className="text-center text-muted-foreground">
              Your registration has been approved. You can now participate in the event.
            </p>
            {responseMessage && (
              <div className="w-full mt-4 p-4 bg-muted rounded-md">
                <p className="font-semibold">Organizer message:</p>
                <p className="text-sm text-muted-foreground">{responseMessage}</p>
              </div>
            )}
          </div>
        )}

        {status === "rejected" && (
          <div className="flex flex-col items-center space-y-4 py-4">
            <XCircle className="h-16 w-16 text-red-500" />
            <h3 className="text-xl font-semibold text-center">Registration Declined</h3>
            <p className="text-center text-muted-foreground">
              Your registration request was declined by the event organizers.
            </p>
            {responseMessage && (
              <div className="w-full mt-4 p-4 bg-muted rounded-md">
                <p className="font-semibold">Reason:</p>
                <p className="text-sm text-muted-foreground">{responseMessage}</p>
              </div>
            )}
            {message && (
              <div className="w-full mt-4 p-4 bg-muted rounded-md">
                <p className="font-semibold">Your message:</p>
                <p className="text-sm text-muted-foreground">{message}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-center">
        <Link href={`/events/${eventId}`}>
          <Button variant="outline">View Event</Button>
        </Link>
      </CardFooter>
    </Card>
  )
}

