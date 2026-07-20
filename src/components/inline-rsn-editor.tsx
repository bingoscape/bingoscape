"use client"

import { useState, useRef, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useAction } from "next-safe-action/hooks"
import { updateProfile } from "@/app/actions/profile"
import { toast } from "@/hooks/use-toast"
import { Pencil, Check, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface InlineRsnEditorProps {
  userId: string
  initialRsn: string | null
  fallbackName: string
}

export function InlineRsnEditor({ userId, initialRsn, fallbackName }: InlineRsnEditorProps) {
  const { update } = useSession()
  const [isEditing, setIsEditing] = useState(false)
  const [rsn, setRsn] = useState(initialRsn ?? "")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
    }
  }, [isEditing])

  const { execute, isExecuting } = useAction(updateProfile, {
    onSuccess: ({ data }) => {
      if (data?.success) {
        update()
        setIsEditing(false)
        toast({
          title: "Profile updated",
          description: "Your RuneScape name has been successfully updated.",
        })
      }
    },
    onError: ({ error }) => {
      toast({
        title: "Error",
        description: error.serverError || "Failed to update profile",
        variant: "destructive",
      })
    }
  })

  const handleSave = () => {
    execute({ id: userId, runescapeName: rsn })
  }

  const handleCancel = () => {
    setRsn(initialRsn ?? "")
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          value={rsn}
          onChange={(e) => setRsn(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave()
            if (e.key === "Escape") handleCancel()
          }}
          className="h-10 text-xl font-bold tracking-tight w-64"
          placeholder="e.g., Zezima"
          disabled={isExecuting}
        />
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={handleSave} 
          disabled={isExecuting}
          className="h-8 w-8 text-green-500 hover:text-green-600 hover:bg-green-500/10"
        >
          {isExecuting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        </Button>
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={handleCancel} 
          disabled={isExecuting}
          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 group">
      <h2 className="text-4xl font-bold tracking-tight">
        {rsn || fallbackName}
      </h2>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-4 w-4 text-muted-foreground" />
              <span className="sr-only">Edit RuneScape Name</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Edit RuneScape Name</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
