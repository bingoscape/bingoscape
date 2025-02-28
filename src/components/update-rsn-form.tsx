'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "@/hooks/use-toast"
import { updateProfile } from '@/app/actions/profile'

interface User {
  id: string
  name: string | null
  email: string | null
  image: string | null
  runescapeName: string | null
}

export function UpdateRsnForm({ user }: { user: User }) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    const formData = new FormData(e.currentTarget)

    try {
      const result = await updateProfile(formData)
      if (result.success) {
        toast({
          title: "Profile updated",
          description: "Your profile has been successfully updated.",
        })
        router.refresh()
      } else {
        throw new Error(result.error ?? "Failed to update profile")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Profile</CardTitle>
        <CardDescription>Update your profile information here.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="id" value={user.id} />

          <div className="flex items-center space-x-4">
            <Avatar className="w-20 h-20">
              <AvatarImage src={user.image ?? undefined} alt={user.name ?? ''} />
              <AvatarFallback>{user.name?.[0] ?? 'U'}</AvatarFallback>
            </Avatar>
          </div>

          <div>
            <Label htmlFor="runescapeName">RuneScape Name</Label>
            <Input id="runescapeName" name="runescapeName" defaultValue={user.runescapeName ?? ''} />
          </div>

          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Updating..." : "Update Profile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
