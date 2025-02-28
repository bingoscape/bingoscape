"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Pencil, Check } from "lucide-react"

interface ProgressSliderProps {
  goalId: string
  teamId: string
  currentValue: number
  maxValue: number
  onUpdateProgress: (goalId: string, teamId: string, newValue: number) => void
}

export function ProgressSlider({ goalId, teamId, currentValue, maxValue, onUpdateProgress }: ProgressSliderProps) {
  const [localValue, setLocalValue] = useState(currentValue)
  const [isEditing, setIsEditing] = useState(false)
  const [inputValue, setInputValue] = useState(currentValue.toString())

  useEffect(() => {
    setLocalValue(currentValue)
    setInputValue(currentValue.toString())
  }, [currentValue])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  const handleInputBlur = () => {
    const newValue = Math.min(Math.max(Number.parseInt(inputValue) || 0, 0), maxValue)
    setLocalValue(newValue)
    setInputValue(newValue.toString())
    setIsEditing(false)
    if (newValue !== currentValue) {
      onUpdateProgress(goalId, teamId, newValue)
    }
  }

  return (
    <div className="space-y-2">
      <Slider
        value={[localValue]}
        min={0}
        max={maxValue}
        step={1}
        onValueChange={(value) => {
          setLocalValue(value[0]!)
          setInputValue(value[0]!.toString())
        }}
        onValueCommit={(value) => {
          if (value[0] !== currentValue) {
            onUpdateProgress(goalId, teamId, value[0]!)
          }
        }}
        className="w-full"
      />
      <div className="flex items-center justify-end space-x-2">
        {isEditing ? (
          <Input
            type="number"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            className="w-20 text-right"
            min={0}
            max={maxValue}
          />
        ) : (
          <div className="text-sm w-20 text-right">{localValue}</div>
        )}
        <div className="text-sm">/ {maxValue}</div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsEditing(!isEditing)}
          aria-label={isEditing ? "Confirm edit" : "Edit value"}
        >
          {isEditing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}


