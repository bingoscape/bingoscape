"use client"

import { SessionProvider } from "next-auth/react"
import type React from "react"

export const AuthProvider = ({ children }: Readonly<{ children: React.ReactNode }>) => {
  return <SessionProvider>{children}</SessionProvider>
}

