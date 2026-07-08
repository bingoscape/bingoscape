"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { TimePicker } from "./time-picker"

interface DateTimePickerProps {
  date: Date | undefined
  setDate: (date: Date | undefined) => void
  fromDate?: Date
  toDate?: Date
  placeholder?: string
  error?: string
}

export function DateTimePicker({
  date,
  setDate,
  fromDate,
  toDate,
  placeholder = "Pick a date and time",
  error,
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            error && "border-destructive focus-visible:ring-destructive"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP 'at' p") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(newDate) => {
            if (newDate) {
              const current = date ? new Date(date) : new Date()
              newDate.setHours(current.getHours())
              newDate.setMinutes(current.getMinutes())
              newDate.setSeconds(current.getSeconds())
              setDate(newDate)
            } else {
              setDate(undefined)
            }
          }}
          fromDate={fromDate}
          toDate={toDate}
          initialFocus
        />
        <AnimatePresence>
          {date && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="border-t border-border p-3">
                <TimePicker date={date} setDate={setDate} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </PopoverContent>
    </Popover>
  )
}
