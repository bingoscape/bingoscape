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
  const [rows, setRows] = useState(5)
  const [columns, setColumns] = useState(5)
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
            <Input id="codephrase" name="codephrase" value={generateOSRSCodePhrase()} required />
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
              <Input
                id="rows"
                name="rows"
                type="number"
                min="1"
                max="10"
                value={rows}
                onChange={(e) => setRows(parseInt(e.target.value) || 1)}
                required
              />
              {bingoType === "progression" && (
                <p className="text-sm text-muted-foreground mt-1">Each row becomes a progression tier</p>
              )}
            </div>
            <div>
              <Label htmlFor="columns">Number of Columns</Label>
              <Input
                id="columns"
                name="columns"
                type="number"
                min="1"
                max="10"
                value={columns}
                onChange={(e) => setColumns(parseInt(e.target.value) || 1)}
                required
              />
            </div>
          </div>

          {bingoType === "standard" && (
            <div className="border rounded-lg p-4 space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2">Pattern Bonuses (Optional)</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Award extra XP when teams complete full rows, columns, or diagonals
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Row Bonuses</Label>
                  {Array.from({ length: rows }).map((_, rowIndex) => (
                    <div key={`row-${rowIndex}`} className="flex items-center gap-2 mb-2">
                      <Label htmlFor={`rowBonus-${rowIndex}`} className="min-w-[80px] text-sm">
                        Row {rowIndex + 1}:
                      </Label>
                      <Input
                        id={`rowBonus-${rowIndex}`}
                        name={`rowBonus-${rowIndex}`}
                        type="number"
                        min="0"
                        defaultValue={0}
                        placeholder="Bonus XP"
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">XP</span>
                    </div>
                  ))}
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">Column Bonuses</Label>
                  {Array.from({ length: columns }).map((_, colIndex) => (
                    <div key={`col-${colIndex}`} className="flex items-center gap-2 mb-2">
                      <Label htmlFor={`columnBonus-${colIndex}`} className="min-w-[80px] text-sm">
                        Column {colIndex + 1}:
                      </Label>
                      <Input
                        id={`columnBonus-${colIndex}`}
                        name={`columnBonus-${colIndex}`}
                        type="number"
                        min="0"
                        defaultValue={0}
                        placeholder="Bonus XP"
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">XP</span>
                    </div>
                  ))}
                </div>

                {rows === columns && (
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Diagonal Bonuses (Square Board Only)</Label>
                    <div className="flex items-center gap-2 mb-2">
                      <Label htmlFor="mainDiagonalBonus" className="min-w-[120px] text-sm">
                        Main Diagonal:
                      </Label>
                      <Input
                        id="mainDiagonalBonus"
                        name="mainDiagonalBonus"
                        type="number"
                        min="0"
                        defaultValue={0}
                        placeholder="Bonus XP"
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">XP</span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <Label htmlFor="antiDiagonalBonus" className="min-w-[120px] text-sm">
                        Anti-Diagonal:
                      </Label>
                      <Input
                        id="antiDiagonalBonus"
                        name="antiDiagonalBonus"
                        type="number"
                        min="0"
                        defaultValue={0}
                        placeholder="Bonus XP"
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">XP</span>
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium mb-2 block">Complete Board Bonus</Label>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="completeBoardBonus" className="min-w-[120px] text-sm">
                      Full Board:
                    </Label>
                    <Input
                      id="completeBoardBonus"
                      name="completeBoardBonus"
                      type="number"
                      min="0"
                      defaultValue={0}
                      placeholder="Bonus XP"
                      className="w-32"
                    />
                    <span className="text-sm text-muted-foreground">XP</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 ml-[136px]">
                    Awarded when all tiles are completed
                  </p>
                </div>
              </div>
            </div>
          )}

          <Button type="submit">Create Bingo</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
