"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import type { JoinClanResponse } from "@/app/api/clans/join/route"
import { Loader2 } from "lucide-react"
import { useSession, signIn } from "next-auth/react"

function JoinClanContent({ inviteCode }: { inviteCode: string | null }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const { data: session, status } = useSession()

  useEffect(() => {
    if (!inviteCode) {
      toast({
        title: "Invalid invite link",
        description: "The invite link is invalid or has expired.",
        variant: "destructive",
      })
      router.push("/")
      return
    }

    // If user is not authenticated, redirect to login
    if (status === "unauthenticated") {
      // Use the current URL as the callback URL
      const callbackUrl = `/clans/join?code=${inviteCode}`
      signIn(undefined, { callbackUrl })
        .then(() => console.log("Signed in"))
        .catch((err) => console.error("Sign in failed", err))
    }
  }, [inviteCode, router, status])

  const handleJoin = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/clans/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inviteCode }),
      })
      const data = (await response.json()) as JoinClanResponse
      if (response.ok) {
        toast({
          title: "Joined clan",
          description: `You have successfully joined ${data.clanName}.`,
        })
        router.push("/clans")
      } else {
        throw new Error(data.error ?? "Could not join clan")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to join clan. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
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

  if (!inviteCode) {
    return null
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Join Clan</CardTitle>
        <CardDescription>You&apos;ve been invited to join a clan!</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Click the button below to accept the invitation and join the clan.</p>
      </CardContent>
      <CardFooter>
        <Button onClick={handleJoin} disabled={isLoading} className="w-full">
          {isLoading ? "Joining..." : "Join Clan"}
        </Button>
      </CardFooter>
    </Card>
  )
}

function JoinClanWrapper() {
  const searchParams = useSearchParams()
  const inviteCode = searchParams.get("code")

  return <JoinClanContent inviteCode={inviteCode} />
}

export default function JoinClanPage() {
  return (
    <div className="container mx-auto py-10">
      <Suspense
        fallback={
          <div className="flex justify-center items-center h-[50vh]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        }
      >
        <JoinClanWrapper />
      </Suspense>
    </div>
  )
}

