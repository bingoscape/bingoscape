'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"

export default function JoinClanPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const inviteCode = searchParams.get('code')

  useEffect(() => {
    if (!inviteCode) {
      toast({
        title: "Invalid invite link",
        description: "The invite link is invalid or has expired.",
        variant: "destructive",
      })
      router.push('/')
    }
  }, [inviteCode, router])

  const handleJoin = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/clans/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inviteCode }),
      })
      const data = await response.json()
      if (response.ok) {
        toast({
          title: "Joined clan",
          description: `You have successfully joined ${data.clanName}.`,
        })
        router.push('/clans')
      } else {
        throw new Error(data.error)
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

  if (!inviteCode) {
    return null
  }

  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Join Clan</CardTitle>
          <CardDescription>You've been invited to join a clan!</CardDescription>
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
    </div>
  )
}

