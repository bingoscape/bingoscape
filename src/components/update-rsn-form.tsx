"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "@/hooks/use-toast"
import { updateProfile } from "@/app/actions/profile"
import { useAction } from "next-safe-action/hooks"

interface User {
  id: string
  name: string | null
  email: string | null
  image: string | null
  runescapeName: string | null
}

export function UpdateRsnForm({ user }: { user: User }) {
  const { update } = useSession()
  const [rsn, setRsn] = useState(user.runescapeName ?? "")

  const { execute, isExecuting } = useAction(updateProfile, {
    onSuccess: ({ data }) => {
      if (data?.success) {
        update()
        toast({
          title: "Profile updated",
          description: "Your profile has been successfully updated.",
        })
      }
    },
    onError: ({ error }) => {
      toast({
        title: "Error",
        description: error.serverError || "Failed to update profile",
        variant: "destructive",
      })
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Profile</CardTitle>
        <CardDescription>Update your profile information here.</CardDescription>
      </CardHeader>
      <CardContent>
        <form 
          action={() => {
            execute({ id: user.id, runescapeName: rsn })
          }} 
          className="space-y-6"
        >
          <div className="flex items-center space-x-4">
            <Avatar className="h-20 w-20">
              <AvatarImage
                src={user.image ?? undefined}
                alt={user.name ?? ""}
              />
              <AvatarFallback>{user.name?.[0] ?? "U"}</AvatarFallback>
            </Avatar>
            <div className="text-sm text-muted-foreground">
              Profile picture is synced with Discord.
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="runescapeName">RuneScape Name</Label>
            <Input
              id="runescapeName"
              name="runescapeName"
              value={rsn}
              onChange={(e) => setRsn(e.target.value)}
              placeholder="e.g., Zezima"
              pattern="^[a-zA-Z0-9 ]{1,12}$"
              title="Maximum 12 characters, alphanumeric and spaces only"
            />
            <p className="text-sm text-muted-foreground">
              Maximum 12 characters, alphanumeric and spaces only.
            </p>
          </div>

          <Button type="submit" disabled={isExecuting}>
            {isExecuting ? "Updating..." : "Update Profile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
