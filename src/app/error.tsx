"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"
import Link from "next/link"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="container mx-auto flex min-h-[50vh] items-center justify-center py-10">
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <CardTitle>Something went wrong</CardTitle>
          </div>
          <CardDescription>
            An unexpected error occurred. You can try again or return home.
          </CardDescription>
        </CardHeader>
        {error.digest && (
          <CardContent>
            <p className="font-mono text-xs text-muted-foreground">
              Error ID: {error.digest}
            </p>
          </CardContent>
        )}
        <CardFooter className="flex gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" asChild>
            <Link href="/">Return home</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
