"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { joinEventViaInvite } from "@/app/actions/events"
import { useSession, signIn } from "next-auth/react"
import { Loader2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"

export default function JoinEventPage({ params }: { params: { inviteCode: string } }) {
    const [isJoining, setIsJoining] = useState(false)
    const router = useRouter()
    const { data: session, status } = useSession()
    const { inviteCode } = params

    useEffect(() => {
        // If user is not authenticated, redirect to login
        if (status === "unauthenticated") {
            // Use the current URL as the callback URL
            const callbackUrl = `/events/join/${inviteCode}`
            signIn(undefined, { callbackUrl })
        }
    }, [inviteCode, status])

    const handleJoinEvent = async () => {
        setIsJoining(true)
        try {
            const event = await joinEventViaInvite(inviteCode)
            toast({
                title: "Joined event",
                description: `You have successfully joined the event: ${event.title}`,
            })
            router.push(`/events/${event.id}`)
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

    // Show loading state while checking authentication
    if (status === "loading") {
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

    return (
        <div className="container mx-auto py-10">
            <Card className="max-w-md mx-auto">
                <CardHeader>
                    <CardTitle>Join Event</CardTitle>
                    <CardDescription>You&apos;ve been invited to join an event!</CardDescription>
                </CardHeader>
                <CardContent>
                    <p>Click the button below to accept the invitation and join the event.</p>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleJoinEvent} disabled={isJoining} className="w-full">
                        {isJoining ? "Joining..." : "Join Event"}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}

