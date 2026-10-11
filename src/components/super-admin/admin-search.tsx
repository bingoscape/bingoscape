"use client"

import { useState } from "react"
import { Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { buildListHref, type HrefState } from "@/lib/admin-list-params"
import { useAdminTableNav } from "./admin-table-frame"

interface AdminSearchProps {
  basePath: string
  /** Current URL state, so tab / filter / sort survive a new search. */
  state: HrefState
  label: string
  placeholder: string
  inputId: string
}

/** Labeled search that writes `?q=` and resets to page 1. Remount (via `key`) when `q` changes. */
export function AdminSearch({
  basePath,
  state,
  label,
  placeholder,
  inputId,
}: AdminSearchProps) {
  const { navigate } = useAdminTableNav()
  const [value, setValue] = useState(state.q ?? "")

  const go = (q: string) =>
    navigate(buildListHref(basePath, state, { q: q.trim(), page: 1 }))

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
        go(value)
      }}
      className="flex gap-2"
    >
      <Label htmlFor={inputId} className="sr-only">
        {label}
      </Label>
      <div className="relative min-w-0 flex-1">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          id={inputId}
          name="q"
          type="text"
          inputMode="search"
          autoComplete="off"
          enterKeyHint="search"
          value={value}
          maxLength={100}
          placeholder={placeholder}
          onChange={(event) => setValue(event.target.value)}
          className="pr-10 pl-9"
        />
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Clear search"
            className="absolute top-0 right-0 h-10 w-10"
            onClick={() => {
              setValue("")
              if (state.q) go("")
            }}
          >
            <X aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      <Button type="submit" variant="secondary">
        Search
      </Button>
    </form>
  )
}
