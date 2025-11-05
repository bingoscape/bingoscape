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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { toast } from "@/hooks/use-toast"
import { getPlayerMetadata, updatePlayerMetadata, updateOwnPlayerMetadata, fetchWOMDataForPlayer } from "@/app/actions/player-metadata"
import { Loader2, User, Download, Check, ChevronsUpDown, Lock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { getPopularTimezones, getTimezonesByRegion } from "@/lib/timezones"

interface PlayerMetadataModalProps {
  isOpen: boolean
  onClose: () => void
  eventId: string
  userId: string
  userName: string | null
  runescapeName: string | null
  onMetadataUpdated?: () => void
  isSelfEditing?: boolean // New prop to indicate if user is editing their own data
}

// Timezone data is now loaded from the comprehensive utilities module

export function PlayerMetadataModal({
  isOpen,
  onClose,
  eventId,
  userId,
  userName,
  runescapeName,
  onMetadataUpdated,
  isSelfEditing = false,
}: PlayerMetadataModalProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)
  const [timezoneOpen, setTimezoneOpen] = useState(false)
  const [formData, setFormData] = useState({
    ehp: "",
    ehb: "",
    combatLevel: "",
    totalLevel: "",
    timezone: "",
    dailyHoursAvailable: "",
    notes: "",
    womPlayerData: "",
  })

  // Load timezone data
  const popularTimezones = getPopularTimezones()
  const timezonesByRegion = getTimezonesByRegion()

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
      if (isSelfEditing) {
        // Use self-editing action (only timezone and dailyHoursAvailable)
        await updateOwnPlayerMetadata(eventId, {
          timezone: formData.timezone || null,
          dailyHoursAvailable: formData.dailyHoursAvailable
            ? parseFloat(formData.dailyHoursAvailable)
            : null,
        })
      } else {
        // Use admin action (all fields)
        await updatePlayerMetadata(userId, eventId, {
          ehp: formData.ehp ? parseFloat(formData.ehp) : null,
          ehb: formData.ehb ? parseFloat(formData.ehb) : null,
          combatLevel: formData.combatLevel ? parseInt(formData.combatLevel) : null,
          totalLevel: formData.totalLevel ? parseInt(formData.totalLevel) : null,
          timezone: formData.timezone || null,
          dailyHoursAvailable: formData.dailyHoursAvailable
            ? parseFloat(formData.dailyHoursAvailable)
            : null,
          notes: formData.notes || null,
          womPlayerData: formData.womPlayerData || null,
          lastFetchedFromWOM: lastFetched,
        })
      }

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
            {/* Info banner for self-editing */}
            {isSelfEditing && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <Lock className="inline h-4 w-4 mr-1" />
                  You can edit your timezone and availability. WiseOldMan stats (EHP, EHB, Combat, Total Level) are managed by event administrators.
                </p>
              </div>
            )}

            {/* WiseOldMan Fetch Section - Hidden for self-editing */}
            {!isSelfEditing && (
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
            )}

            {/* EHP/EHB Section - Read-only for self-editing */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ehp" className="flex items-center gap-2">
                  EHP (Efficient Hours Played)
                  {isSelfEditing && <Badge variant="secondary" className="text-xs"><Lock className="h-3 w-3 mr-1" />Admin Only</Badge>}
                </Label>
                <Input
                  id="ehp"
                  type="text"
                  placeholder="0.0"
                  value={formData.ehp}
                  onChange={(e) => handleNumberInput("ehp", e.target.value)}
                  disabled={isSelfEditing}
                  className={isSelfEditing ? "bg-muted" : ""}
                />
                <p className="text-xs text-muted-foreground">
                  Player&apos;s efficiency metric for skilling
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ehb" className="flex items-center gap-2">
                  EHB (Efficient Hours Bossed)
                  {isSelfEditing && <Badge variant="secondary" className="text-xs"><Lock className="h-3 w-3 mr-1" />Admin Only</Badge>}
                </Label>
                <Input
                  id="ehb"
                  type="text"
                  placeholder="0.0"
                  value={formData.ehb}
                  onChange={(e) => handleNumberInput("ehb", e.target.value)}
                  disabled={isSelfEditing}
                  className={isSelfEditing ? "bg-muted" : ""}
                />
                <p className="text-xs text-muted-foreground">
                  Player&apos;s efficiency metric for bossing
                </p>
              </div>
            </div>

            {/* Combat & Total Level Section - Read-only for self-editing */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="combatLevel" className="flex items-center gap-2">
                  Combat Level
                  {isSelfEditing && <Badge variant="secondary" className="text-xs"><Lock className="h-3 w-3 mr-1" />Admin Only</Badge>}
                </Label>
                <Input
                  id="combatLevel"
                  type="text"
                  placeholder="3"
                  value={formData.combatLevel}
                  onChange={(e) => handleNumberInput("combatLevel", e.target.value)}
                  disabled={isSelfEditing}
                  className={isSelfEditing ? "bg-muted" : ""}
                />
                <p className="text-xs text-muted-foreground">
                  Player&apos;s combat level (3-126)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="totalLevel" className="flex items-center gap-2">
                  Total Level
                  {isSelfEditing && <Badge variant="secondary" className="text-xs"><Lock className="h-3 w-3 mr-1" />Admin Only</Badge>}
                </Label>
                <Input
                  id="totalLevel"
                  type="text"
                  placeholder="32"
                  value={formData.totalLevel}
                  onChange={(e) => handleNumberInput("totalLevel", e.target.value)}
                  disabled={isSelfEditing}
                  className={isSelfEditing ? "bg-muted" : ""}
                />
                <p className="text-xs text-muted-foreground">
                  Total skill level (32-2277)
                </p>
              </div>
            </div>

            {/* Timezone Section */}
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Popover open={timezoneOpen} onOpenChange={setTimezoneOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="timezone"
                    variant="outline"
                    role="combobox"
                    aria-expanded={timezoneOpen}
                    className="w-full justify-between"
                  >
                    {formData.timezone ? (
                      (() => {
                        // Find the selected timezone to display its label and offset
                        const selectedTz = [...popularTimezones, ...timezonesByRegion.flatMap(r => r.timezones)]
                          .find(tz => tz.value === formData.timezone)
                        return selectedTz ? `${selectedTz.label} (${selectedTz.offset})` : formData.timezone
                      })()
                    ) : (
                      "Select timezone..."
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search timezones..." />
                    <CommandList>
                      <CommandEmpty>No timezone found.</CommandEmpty>

                      {/* Popular Timezones */}
                      <CommandGroup heading="Popular">
                        {popularTimezones.map((tz) => (
                          <CommandItem
                            key={tz.value}
                            value={`${tz.label} ${tz.value} ${tz.offset}`}
                            onSelect={() => {
                              setFormData((prev) => ({ ...prev, timezone: tz.value }))
                              setTimezoneOpen(false)
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.timezone === tz.value ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="flex-1">{tz.label}</span>
                            <span className="text-xs text-muted-foreground">{tz.offset}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>

                      <CommandSeparator />

                      {/* Timezones by Region */}
                      {timezonesByRegion.map((region) => (
                        <CommandGroup key={region.name} heading={region.name}>
                          {region.timezones.map((tz) => (
                            <CommandItem
                              key={tz.value}
                              value={`${tz.label} ${tz.value} ${tz.offset}`}
                              onSelect={() => {
                                setFormData((prev) => ({ ...prev, timezone: tz.value }))
                                setTimezoneOpen(false)
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.timezone === tz.value ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <span className="flex-1">{tz.label}</span>
                              <span className="text-xs text-muted-foreground">{tz.offset}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Player&apos;s local timezone for activity scheduling
              </p>
            </div>

            {/* Daily Hours */}
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

            {/* Notes Section - Hidden for self-editing */}
            {!isSelfEditing && (
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
            )}
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
