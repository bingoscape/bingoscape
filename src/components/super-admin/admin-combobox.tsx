"use client"

import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { SelectOption } from "@/lib/super-admin-format"

interface AdminComboboxProps {
  id?: string
  value: string | null
  onChange: (value: string | null) => void
  options: SelectOption[]
  /** Label of the "nothing selected" entry, e.g. "No clan". Omit to require a value. */
  emptyLabel?: string
  placeholder: string
  searchPlaceholder?: string
  disabled?: boolean
  "aria-describedby"?: string
  "aria-invalid"?: boolean
}

/**
 * Searchable single-select fed entirely by props (no client fetching).
 * "No value" is `null`, never a magic string.
 */
export function AdminCombobox({
  id,
  value,
  onChange,
  options,
  emptyLabel,
  placeholder,
  searchPlaceholder = "Search…",
  disabled,
  ...aria
}: AdminComboboxProps) {
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.value === value)

  const choose = (next: string | null) => {
    onChange(next)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          disabled={disabled}
          className="w-full justify-between font-normal"
          {...aria}
        >
          <span
            className={cn(
              "truncate",
              !selected && !emptyLabel && "text-muted-foreground"
            )}
          >
            {selected?.label ??
              (value === null && emptyLabel ? emptyLabel : placeholder)}
          </span>
          <ChevronsUpDown className="opacity-60" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) p-0"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup>
              {emptyLabel ? (
                <CommandItem
                  value={`__none__ ${emptyLabel}`}
                  onSelect={() => choose(null)}
                >
                  <Check
                    className={cn(
                      "h-4 w-4",
                      value === null ? "opacity-100" : "opacity-0"
                    )}
                    aria-hidden="true"
                  />
                  {emptyLabel}
                </CommandItem>
              ) : null}
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.hint ?? ""} ${option.value}`}
                  onSelect={() => choose(option.value)}
                >
                  <Check
                    className={cn(
                      "h-4 w-4",
                      option.value === value ? "opacity-100" : "opacity-0"
                    )}
                    aria-hidden="true"
                  />
                  <span className="truncate">{option.label}</span>
                  {option.hint ? (
                    <span className="text-muted-foreground ml-auto truncate text-xs">
                      {option.hint}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
