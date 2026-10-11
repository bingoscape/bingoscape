import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function SuperAdminNotFound() {
  return (
    <div className="osrs-panel mx-auto max-w-lg space-y-4 rounded-sm p-6 text-center">
      <h1 className="osrs-heading text-primary text-2xl">Not found</h1>
      <p className="text-muted-foreground text-sm">
        That record does not exist, or it was deleted.
      </p>
      <Button asChild>
        <Link href="/super-admin">Back to overview</Link>
      </Button>
    </div>
  )
}
