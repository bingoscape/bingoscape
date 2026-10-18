"use client"

import { useId, useState } from "react"
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

const TIMEZONES = Intl.supportedValuesOf("timeZone")

interface TimezoneSelectProps {
  id?: string
  value: string
  onValueChange: (timezone: string) => void
}

export function TimezoneSelect({
  id,
  value,
  onValueChange,
}: TimezoneSelectProps) {
  const [open, setOpen] = useState(false)
  const listId = useId()

  return (
    // modal so the list can scroll and be dismissed inside a Dialog
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          className="w-full min-w-0 justify-between font-normal"
        >
          <span className="truncate">{value || "Select timezone"}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        id={listId}
        className="w-(--radix-popover-trigger-width) max-w-[calc(100vw-1rem)] p-0"
        align="start"
        collisionPadding={8}
      >
        <Command>
          <CommandInput placeholder="Search timezone..." />
          <CommandList>
            <CommandEmpty>No timezone found.</CommandEmpty>
            <CommandGroup>
              {TIMEZONES.map((tz) => (
                <CommandItem
                  key={tz}
                  value={tz}
                  onSelect={() => {
                    onValueChange(tz)
                    setOpen(false)
                  }}
                  className="min-h-11 md:min-h-0"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === tz ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {tz}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
