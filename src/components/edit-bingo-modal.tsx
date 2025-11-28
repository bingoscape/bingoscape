"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { updateBingo, getBingoWithPatternBonuses } from "@/app/actions/bingo"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Edit, Loader2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PatternBonusSchematicEditor } from "./pattern-bonus-schematic-editor"

interface Bingo {
  id: string
  title: string
  description: string | null
  visible: boolean
  locked: boolean
  codephrase: string
}

interface EditBingoModalProps {
  bingo: Bingo
  isOpen: boolean
  onClose: () => void
}

interface BingoPatternData {
  bingoType: "standard" | "progression"
  rows: number
  columns: number
  mainDiagonalBonusXP: number
  antiDiagonalBonusXP: number
  completeBoardBonusXP: number
  rowBonuses: Array<{ rowIndex: number; bonusXP: number }>
  columnBonuses: Array<{ columnIndex: number; bonusXP: number }>
}

export function EditBingoModal({ bingo, isOpen, onClose }: EditBingoModalProps) {
  const [formData, setFormData] = useState({
    title: bingo.title,
    description: bingo.description ?? "",
    visible: bingo.visible,
    locked: bingo.locked,
    codephrase: bingo.codephrase,
  })

  const [patternData, setPatternData] = useState<BingoPatternData | null>(null)
  const [isLoadingPattern, setIsLoadingPattern] = useState(false)
  const [rowBonuses, setRowBonuses] = useState<Record<number, number>>({})
  const [columnBonuses, setColumnBonuses] = useState<Record<number, number>>({})
  const [mainDiagonalBonus, setMainDiagonalBonus] = useState(0)
  const [antiDiagonalBonus, setAntiDiagonalBonus] = useState(0)
  const [completeBoardBonus, setCompleteBoardBonus] = useState(0)

  // Fetch pattern bonus data when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsLoadingPattern(true)
      void getBingoWithPatternBonuses(bingo.id).then((result) => {
        if (result.success && result.data) {
          const data = result.data
          setPatternData({
            bingoType: data.bingoType,
            rows: data.rows,
            columns: data.columns,
            mainDiagonalBonusXP: data.mainDiagonalBonusXP,
            antiDiagonalBonusXP: data.antiDiagonalBonusXP,
            completeBoardBonusXP: data.completeBoardBonusXP,
            rowBonuses: data.rowBonuses,
            columnBonuses: data.columnBonuses,
          })

          // Initialize pattern bonus state
          const rowBonusMap: Record<number, number> = {}
          for (let i = 0; i < data.rows; i++) {
            const bonus = data.rowBonuses.find((rb) => rb.rowIndex === i)
            rowBonusMap[i] = bonus?.bonusXP ?? 0
          }
          setRowBonuses(rowBonusMap)

          const columnBonusMap: Record<number, number> = {}
          for (let i = 0; i < data.columns; i++) {
            const bonus = data.columnBonuses.find((cb) => cb.columnIndex === i)
            columnBonusMap[i] = bonus?.bonusXP ?? 0
          }
          setColumnBonuses(columnBonusMap)

          setMainDiagonalBonus(data.mainDiagonalBonusXP)
          setAntiDiagonalBonus(data.antiDiagonalBonusXP)
          setCompleteBoardBonus(data.completeBoardBonusXP)
        }
        setIsLoadingPattern(false)
      })
    }
  }, [isOpen, bingo.id])

  // Sync formData with bingo prop changes when switching boards
  useEffect(() => {
    setFormData({
      title: bingo.title,
      description: bingo.description ?? "",
      visible: bingo.visible,
      locked: bingo.locked,
      codephrase: bingo.codephrase,
    })
  }, [bingo])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData((prev) => ({ ...prev, [name]: checked }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const updateData = {
        ...formData,
        patternBonuses:
          patternData?.bingoType === "standard"
            ? {
                rowBonuses,
                columnBonuses,
                mainDiagonalBonus,
                antiDiagonalBonus,
                completeBoardBonus,
              }
            : undefined,
      }

      const result = await updateBingo(bingo.id, updateData)
      if (result.success) {
        toast({
          title: "Success",
          description: "Bingo updated successfully",
        })
        onClose()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error(error)
      toast({
        title: "Error",
        description: "Failed to update bingo",
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Edit Bingo</DialogTitle>
          <DialogDescription>Make changes to your bingo here. Click save when you are done.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" value={formData.title} onChange={handleChange} placeholder="Bingo Title" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Bingo Description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="codephrase">Codephrase</Label>
              <Input
                id="codephrase"
                name="codephrase"
                value={formData.codephrase}
                onChange={handleChange}
                placeholder="Codephrase"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="visible">Visible to Participants</Label>
              <Switch
                id="visible"
                checked={formData.visible}
                onCheckedChange={(checked) => handleSwitchChange("visible", checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="locked">Locked (Prevent Submissions)</Label>
              <Switch
                id="locked"
                checked={formData.locked}
                onCheckedChange={(checked) => handleSwitchChange("locked", checked)}
              />
            </div>

            {/* Pattern Bonuses Section - Only for Standard Bingos */}
            {isLoadingPattern && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2 text-sm text-muted-foreground">Loading pattern bonuses...</span>
              </div>
            )}

            {!isLoadingPattern && patternData && patternData.bingoType === "standard" && (
              <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Pattern Bonuses (Bonus XP)</h3>
                  <span className="text-xs text-muted-foreground">
                    {patternData.rows}x{patternData.columns} Board
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Hover over inputs to see affected tiles.
                </p>

                <PatternBonusSchematicEditor
                  rows={patternData.rows}
                  columns={patternData.columns}
                  rowBonuses={rowBonuses}
                  columnBonuses={columnBonuses}
                  mainDiagonalBonus={mainDiagonalBonus}
                  antiDiagonalBonus={antiDiagonalBonus}
                  completeBoardBonus={completeBoardBonus}
                  onRowBonusChange={(index, value) => setRowBonuses(prev => ({ ...prev, [index]: value }))}
                  onColumnBonusChange={(index, value) => setColumnBonuses(prev => ({ ...prev, [index]: value }))}
                  onMainDiagonalChange={setMainDiagonalBonus}
                  onAntiDiagonalChange={setAntiDiagonalBonus}
                  onCompleteBoardChange={setCompleteBoardBonus}
                />
              </div>
            )}

            <Button type="submit" className="w-full">
              Save Changes
            </Button>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
