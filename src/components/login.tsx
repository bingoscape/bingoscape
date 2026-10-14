"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { DiscordLogoIcon } from "@radix-ui/react-icons"
import { signIn, signOut, useSession } from "next-auth/react"
import Link from "next/link"
import { safeCallbackUrl } from "@/lib/safe-callback-url"

export function LoginCard() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  })

  // Where to go after signing in (set by the proxy / protected pages).
  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"))

  // Check if user just registered
  const justRegistered = searchParams.get("registered") === "true"

  const handleCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const result = await signIn("credentials", {
        username: formData.username,
        password: formData.password,
        redirect: false,
      })

      if (result?.error) {
        setError(
          result.error === "RATE_LIMITED"
            ? "Too many sign-in attempts. Please wait a few minutes and try again."
            : "Invalid username or password"
        )
      } else if (result?.ok) {
        router.push(callbackUrl)
        router.refresh()
      }
    } catch (err) {
      setError("An unexpected error occurred")
      console.error("Sign in error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  if (session) {
    return (
      <Card className="w-full max-w-[400px]">
        <CardHeader>
          <CardTitle>Welcome, {session.user?.name}!</CardTitle>
          <CardDescription>You are currently signed in.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center">Signed in as {session.user?.email}</p>
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={() => signOut()}>
            Sign out
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-[400px]">
      <CardHeader>
        <CardTitle>Welcome</CardTitle>
        <CardDescription>Sign in to your account</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {justRegistered && (
          <div
            role="status"
            className="rounded-sm border border-success bg-success/15 p-3 text-sm text-success"
          >
            Account created successfully! Please sign in below.
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-sm border border-danger bg-destructive/15 p-3 text-sm text-danger"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleCredentialsSignIn} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              placeholder="your_username"
              value={formData.username}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, username: e.target.value }))
                if (error) setError(null)
              }}
              required
              disabled={isLoading}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, password: e.target.value }))
                if (error) setError(null)
              }}
              required
              disabled={isLoading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>

        <div className="grid gap-2">
          <Button
            onClick={() => void signIn("discord", { callbackUrl })}
            className="w-full"
            variant="outline"
          >
            <DiscordLogoIcon aria-hidden="true" className="mr-2 h-4 w-4" />
            Discord
          </Button>
          <Button
            onClick={() => void signIn("google")}
            className="w-full"
            variant="outline"
            disabled
          >
            <svg
              className="mr-2 h-4 w-4"
              aria-hidden="true"
              focusable="false"
              data-prefix="fab"
              data-icon="google"
              role="img"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 488 512"
            >
              <path
                fill="currentColor"
                d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"
              ></path>
            </svg>
            Google
          </Button>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="font-medium text-primary underline-offset-4 hover:underline">
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
