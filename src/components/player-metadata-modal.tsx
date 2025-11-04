"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { getPlayerMetadata, updatePlayerMetadata, fetchWOMDataForPlayer } from "@/app/actions/player-metadata"
import { Loader2, User, Download } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface PlayerMetadataModalProps {
  isOpen: boolean
  onClose: () => void
  eventId: string
  userId: string
  userName: string | null
  runescapeName: string | null
  onMetadataUpdated?: () => void
}

const COMMON_TIMEZONES = [
  { value: "America/Los_Angeles", label: "Pacific (US/Canada)" },
  { value: "America/Denver", label: "Mountain (US/Canada)" },
  { value: "America/Chicago", label: "Central (US/Canada)" },
  { value: "America/New_York", label: "Eastern (US/Canada)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Central Europe (CET/CEST)" },
  { value: "Europe/Berlin", label: "Berlin (CET/CEST)" },
  { value: "Australia/Sydney", label: "Sydney (AEDT/AEST)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
]

const SKILL_LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "expert", label: "Expert" },
]

export function PlayerMetadataModal({
  isOpen,
  onClose,
  eventId,
  userId,
  userName,
  runescapeName,
  onMetadataUpdated,
}: PlayerMetadataModalProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)
  const [formData, setFormData] = useState({
    ehp: "",
    ehb: "",
    combatLevel: "",
    totalLevel: "",
    timezone: "",
    dailyHoursAvailable: "",
    skillLevel: "",
    notes: "",
    womPlayerData: "",
  })

  useEffect(() => {
    if (isOpen) {
      void loadMetadata()
    }
  }, [isOpen, userId, eventId])

  const loadMetadata = async () => {
    setLoading(true)
    try {
      const metadata = await getPlayerMetadata(userId, eventId)
      if (metadata) {
        setFormData({
          ehp: metadata.ehp?.toString() ?? "",
          ehb: metadata.ehb?.toString() ?? "",
          combatLevel: metadata.combatLevel?.toString() ?? "",
          totalLevel: metadata.totalLevel?.toString() ?? "",
          timezone: metadata.timezone ?? "",
          dailyHoursAvailable: metadata.dailyHoursAvailable?.toString() ?? "",
          skillLevel: metadata.skillLevel ?? "",
          notes: metadata.notes ?? "",
          womPlayerData: metadata.womPlayerData ?? "",
        })
        setLastFetched(metadata.lastFetchedFromWOM)
      } else {
        // Reset form for new metadata
        setFormData({
          ehp: "",
          ehb: "",
          combatLevel: "",
          totalLevel: "",
          timezone: "",
          dailyHoursAvailable: "",
          skillLevel: "",
          notes: "",
          womPlayerData: "",
        })
        setLastFetched(null)
      }
    } catch (error) {
      console.error("Error loading metadata:", error)
      toast({
        title: "Error",
        description: "Failed to load player metadata",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updatePlayerMetadata(userId, eventId, {
        ehp: formData.ehp ? parseFloat(formData.ehp) : null,
        ehb: formData.ehb ? parseFloat(formData.ehb) : null,
        combatLevel: formData.combatLevel ? parseInt(formData.combatLevel) : null,
        totalLevel: formData.totalLevel ? parseInt(formData.totalLevel) : null,
        timezone: formData.timezone || null,
        dailyHoursAvailable: formData.dailyHoursAvailable
          ? parseFloat(formData.dailyHoursAvailable)
          : null,
        skillLevel: formData.skillLevel
          ? (formData.skillLevel as "beginner" | "intermediate" | "advanced" | "expert")
          : null,
        notes: formData.notes || null,
        womPlayerData: formData.womPlayerData || null,
        lastFetchedFromWOM: lastFetched,
      })

      toast({
        title: "Success",
        description: "Player metadata updated successfully",
      })

      onMetadataUpdated?.()
      onClose()
    } catch (error) {
      console.error("Error saving metadata:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save metadata",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleFetchFromWOM = async () => {
    if (!runescapeName) {
      toast({
        title: "Error",
        description: "No RuneScape name available for this player",
        variant: "destructive",
      })
      return
    }

    setFetching(true)
    try {
      const result = await fetchWOMDataForPlayer(userId, eventId, runescapeName)

      if (result.success && result.data) {
        // Update form with fetched data
        setFormData((prev) => ({
          ...prev,
          ehp: result.data!.ehp.toString(),
          ehb: result.data!.ehb.toString(),
          combatLevel: result.data!.combatLevel.toString(),
          totalLevel: result.data!.totalLevel.toString(),
          womPlayerData: JSON.stringify(result.data),
        }))
        setLastFetched(new Date())

        toast({
          title: "Success",
          description: `Fetched data for ${runescapeName} - EHP: ${result.data.ehp.toFixed(1)}, EHB: ${result.data.ehb.toFixed(1)}, Combat: ${result.data.combatLevel}, Total: ${result.data.totalLevel}`,
        })
      } else {
        toast({
          title: "Error",
          description: result.error ?? "Failed to fetch player data",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error fetching WOM data:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch player data",
        variant: "destructive",
      })
    } finally {
      setFetching(false)
    }
  }

  const handleNumberInput = (field: string, value: string) => {
    // Allow empty string or valid numbers
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setFormData((prev) => ({ ...prev, [field]: value }))
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Edit Player Metadata
          </DialogTitle>
          <DialogDescription>
            Configure balancing attributes for{" "}
            <span className="font-semibold">
              {runescapeName ?? userName ?? "Unknown Player"}
            </span>{" "}
            in this event
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            {/* WiseOldMan Fetch Section */}
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold">WiseOldMan Data</h4>
                  <p className="text-xs text-muted-foreground">
                    {runescapeName
                      ? `Fetch current stats for ${runescapeName}`
                      : "No RuneScape name set for this player"}
                  </p>
                  {lastFetched && (
                    <p className="text-xs text-muted-foreground">
                      Last fetched: {formatDistanceToNow(lastFetched, { addSuffix: true })}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleFetchFromWOM}
                  disabled={!runescapeName || fetching || saving}
                >
                  {fetching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Fetching...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Fetch Data
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* EHP/EHB Section */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ehp">
                  EHP (Efficient Hours Played)
                </Label>
                <Input
                  id="ehp"
                  type="text"
                  placeholder="0.0"
                  value={formData.ehp}
                  onChange={(e) => handleNumberInput("ehp", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Player&apos;s efficiency metric for skilling
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ehb">
                  EHB (Efficient Hours Bossed)
                </Label>
                <Input
                  id="ehb"
                  type="text"
                  placeholder="0.0"
                  value={formData.ehb}
                  onChange={(e) => handleNumberInput("ehb", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Player&apos;s efficiency metric for bossing
                </p>
              </div>
            </div>

            {/* Combat & Total Level Section */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="combatLevel">Combat Level</Label>
                <Input
                  id="combatLevel"
                  type="text"
                  placeholder="3"
                  value={formData.combatLevel}
                  onChange={(e) => handleNumberInput("combatLevel", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Player&apos;s combat level (3-126)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="totalLevel">Total Level</Label>
                <Input
                  id="totalLevel"
                  type="text"
                  placeholder="32"
                  value={formData.totalLevel}
                  onChange={(e) => handleNumberInput("totalLevel", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Total skill level (32-2277)
                </p>
              </div>
            </div>

            {/* Timezone Section */}
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={formData.timezone}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, timezone: value }))
                }
              >
                <SelectTrigger id="timezone">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Player&apos;s local timezone for activity scheduling
              </p>
            </div>

            {/* Daily Hours & Skill Level */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dailyHours">
                  Daily Hours Available
                </Label>
                <Input
                  id="dailyHours"
                  type="text"
                  placeholder="0.0"
                  value={formData.dailyHoursAvailable}
                  onChange={(e) =>
                    handleNumberInput("dailyHoursAvailable", e.target.value)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Average hours/day player can participate
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="skillLevel">Skill Level</Label>
                <Select
                  value={formData.skillLevel}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, skillLevel: value }))
                  }
                >
                  <SelectTrigger id="skillLevel">
                    <SelectValue placeholder="Select skill level" />
                  </SelectTrigger>
                  <SelectContent>
                    {SKILL_LEVELS.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Perceived player skill/experience level
                </p>
              </div>
            </div>

            {/* Notes Section */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Management Only)</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes about this player..."
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Internal notes visible only to management
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Metadata"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
