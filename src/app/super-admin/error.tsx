"use client"

import { useEffect } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function SuperAdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Super admin view failed", error)
  }, [error])

  return (
    <div
      role="alert"
      className="osrs-panel mx-auto max-w-lg space-y-4 rounded-sm p-6 text-center"
    >
      <h1 className="osrs-heading text-primary text-2xl">
        Something went wrong
      </h1>
      <p className="text-muted-foreground text-sm">
        This view could not be loaded. Nothing was changed. You can retry, or go
        back to the overview.
        {error.digest ? (
          <>
            {" "}
            Reference: <span className="font-mono">{error.digest}</span>
          </>
        ) : null}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/super-admin">Back to overview</Link>
        </Button>
      </div>
    </div>
  )
}
