"use client"

import { createContext, useCallback, useContext, useTransition } from "react"
import { useRouter } from "next/navigation"
import type React from "react"

import { cn } from "@/lib/utils"

interface AdminTableNav {
  pending: boolean
  navigate: (href: string) => void
}

const AdminTableNavContext = createContext<AdminTableNav | null>(null)

export function useAdminTableNav(): AdminTableNav {
  const ctx = useContext(AdminTableNavContext)
  if (!ctx) {
    throw new Error("useAdminTableNav must be used inside <AdminTableFrame>")
  }
  return ctx
}

/**
 * Shares one `useTransition` between the search box and pagination so the
 * table can show a busy state while the next server render is streaming in.
 */
export function AdminTableFrame({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const navigate = useCallback(
    (href: string) => {
      startTransition(() => {
        router.push(href)
      })
    },
    [router]
  )

  return (
    <AdminTableNavContext.Provider value={{ pending, navigate }}>
      <div
        aria-busy={pending}
        className={cn(
          "space-y-3 transition-opacity motion-reduce:transition-none",
          pending && "opacity-60",
          className
        )}
      >
        {children}
        <p role="status" className="sr-only">
          {pending ? "Loading results" : ""}
        </p>
      </div>
    </AdminTableNavContext.Provider>
  )
}
