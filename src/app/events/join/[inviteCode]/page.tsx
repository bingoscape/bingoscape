/* eslint-disable */
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { joinEventViaInvite, getUserRegistrationStatus } from "@/app/actions/events"
import { useSession, signIn } from "next-auth/react"
import { Loader2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { RegistrationStatus } from "@/components/registration-status"
import Link from "next/link"

// Modify the JoinEventPage component to handle previously removed participants
export default function JoinEventPage({ params }: { params: { inviteCode: string } }) {
    const [isJoining, setIsJoining] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [event, setEvent] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const [registrationStatus, setRegistrationStatus] = useState<{
        status: "not_requested" | "pending" | "approved" | "rejected"
        message?: string
        responseMessage?: string
    } | null>(null)
    const router = useRouter()
    const { data: session, status } = useSession()
    const { inviteCode } = params

    useEffect(() => {
        // If user is not authenticated, redirect to login
        if (status === "unauthenticated") {
            // Use the current URL as the callback URL
            const callbackUrl = `/events/join/${inviteCode}`
            signIn(undefined, { callbackUrl })
                .then(() => console.log("Signed in"))
                .catch((err) => console.error("Sign in failed", err))
        }
    }, [inviteCode, status])

    useEffect(() => {
        // Check if the user is already registered for this event
        async function checkEventAndRegistration() {
            if (status !== "authenticated") return

            try {
                // First, get the event details without joining
                const response = await fetch(`/api/events/invite/${inviteCode}`, {
                    method: "GET",
                })

                if (!response.ok) {
                    const errorData = await response.json()
                    throw new Error(errorData.error || "Failed to fetch event details")
                }

                const eventData = await response.json()
                setEvent(eventData)

                // Now check if the user is already registered
                const regStatus = await getUserRegistrationStatus(eventData.id)
                setRegistrationStatus(regStatus)

                // If already approved, redirect to event page
                if (regStatus.status === "approved") {
                    router.push(`/events/${eventData.id}`)
                }
            } catch (error) {
                setError(error instanceof Error ? error.message : "Failed to check registration status")
                toast({
                    title: "Error",
                    description: error instanceof Error ? error.message : "Failed to check registration status",
                    variant: "destructive",
                })
            } finally {
                setIsLoading(false)
            }
        }

        checkEventAndRegistration()
            .then(() => console.log("Checked event and registration"))
            .catch((err) => console.error("Failed to check event and registration", err))
    }, [inviteCode, status, router])

    const handleJoinEvent = async () => {
        setIsJoining(true)
        try {
            const event = await joinEventViaInvite(inviteCode)

            if (event.pendingApproval) {
                toast({
                    title: "Registration submitted",
                    description: "Your registration request has been submitted for review.",
                })
                // Refresh the registration status
                const regStatus = await getUserRegistrationStatus(event.id)
                setRegistrationStatus(regStatus)
            } else {
                toast({
                    title: "Joined event",
                    description: `You have successfully joined the event: ${event.title}`,
                })
                router.push(`/events/${event.id}`)
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : "Failed to join event")
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to join event",
                variant: "destructive",
            })
        } finally {
            setIsJoining(false)
        }
    }

    // Show loading state while checking authentication
    if (status === "loading" || isLoading) {
        return (
            <div className="flex justify-center items-center h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        )
    }

    // Don't render the join UI if not authenticated (will redirect to login)
    if (status === "unauthenticated") {
        return (
            <div className="flex justify-center items-center h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="ml-2">Redirecting to login...</p>
            </div>
        )
    }

    // If we have an error, show it
    if (error) {
        return (
            <div className="container mx-auto py-10">
                <Card className="max-w-md mx-auto">
                    <CardHeader>
                        <CardTitle>Error</CardTitle>
                        <CardDescription>There was a problem with your invite link</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-destructive">{error}</p>
                    </CardContent>
                    <CardFooter>
                        <Button asChild variant="outline" className="w-full">
                            <Link href="/">Return to Home</Link>
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    // If we have a registration status that's not "not_requested", show the status
    if (registrationStatus && registrationStatus.status !== "not_requested" && event) {
        return (
            <div className="container mx-auto py-10">
                <RegistrationStatus
                    eventId={event.id}
                    eventTitle={event.title}
                    status={registrationStatus.status}
                    message={registrationStatus.message}
                    responseMessage={registrationStatus.responseMessage}
                />
            </div>
        )
    }

    return (
        <div className="container mx-auto py-10">
            <Card className="max-w-md mx-auto">
                <CardHeader>
                    <CardTitle>Join Event</CardTitle>
                    <CardDescription>
                        {event ? `You've been invited to join ${event.title}!` : "You've been invited to join an event!"}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p>Click the button below to accept the invitation and join the event.</p>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleJoinEvent} disabled={isJoining} className="w-full">
                        {isJoining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {isJoining ? "Joining..." : "Join Event"}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}

