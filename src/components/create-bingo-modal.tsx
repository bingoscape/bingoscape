'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createBingo } from '@/app/actions/bingo'
import { Textarea } from './ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import generateOSRSCodePhrase from '@/lib/codephraseGenerator'

interface CreateBingoModalProps {
  eventId: string
  isOpen: boolean
  onClose: () => void
}

export function CreateBingoModal({ eventId, isOpen, onClose }: CreateBingoModalProps) {
  const [error, setError] = useState<string | null>(null)
  const [bingoType, setBingoType] = useState<"standard" | "progression">("standard")
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.append('eventId', eventId)
    formData.append('bingoType', bingoType)

    try {
      await createBingo(formData)
      onClose()
      router.refresh()
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError('An unknown error occurred')
      }
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Create New Board</DialogTitle>
          <DialogDescription>Set up the basic structure for your new bingo game. Tiles will be automatically created.</DialogDescription>
        </DialogHeader>
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required />
          </div>
          <div>
            <Label htmlFor="codephrase">Codephrase</Label>
            <Input id="codephrase" name="codephrase" defaultValue={generateOSRSCodePhrase()} required />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" className="max-w-full" />
          </div>

          <div>
            <Label htmlFor="bingoType">Bingo Type</Label>
            <Select value={bingoType} onValueChange={(value: "standard" | "progression") => setBingoType(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select bingo type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard Bingo</SelectItem>
                <SelectItem value="progression">Progression Bingo</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-1">
              {bingoType === "standard" 
                ? "Traditional bingo where all tiles are available from the start" 
                : "Progression-based bingo where teams unlock tiers by completing previous ones"
              }
            </p>
          </div>

          {bingoType === "progression" && (
            <div>
              <Label htmlFor="tiersUnlockRequirement">XP Required to Unlock Next Tier</Label>
              <Input 
                id="tiersUnlockRequirement" 
                name="tiersUnlockRequirement" 
                type="number" 
                min="1" 
                max="100" 
                defaultValue={5} 
                required 
              />
              <p className="text-sm text-muted-foreground mt-1">
                Amount of XP (weight) that must be earned in each tier before the next tier unlocks
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="rows">Number of Rows</Label>
              <Input id="rows" name="rows" type="number" min="1" max="10" defaultValue={5} required />
              {bingoType === "progression" && (
                <p className="text-sm text-muted-foreground mt-1">Each row becomes a progression tier</p>
              )}
            </div>
            <div>
              <Label htmlFor="columns">Number of Columns</Label>
              <Input id="columns" name="columns" type="number" min="1" max="10" defaultValue={5} required />
            </div>
          </div>

          <Button type="submit">Create Bingo</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
