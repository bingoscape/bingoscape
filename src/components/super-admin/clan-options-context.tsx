"use client"

import { createContext, useContext } from "react"
import type React from "react"

import type { SelectOption } from "@/lib/super-admin-format"

interface ClanOptions {
  options: SelectOption[]
  truncated: boolean
}

const ClanOptionsContext = createContext<ClanOptions>({
  options: [],
  truncated: false,
})

/**
 * Hands the (capped) clan list to every event row's edit form once, instead of
 * serialising it into each row's props or fetching it from the browser.
 */
export function ClanOptionsProvider({
  options,
  truncated,
  children,
}: ClanOptions & { children: React.ReactNode }) {
  return (
    <ClanOptionsContext.Provider value={{ options, truncated }}>
      {children}
    </ClanOptionsContext.Provider>
  )
}

export function useClanOptions(): ClanOptions {
  return useContext(ClanOptionsContext)
}
