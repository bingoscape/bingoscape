"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { CheckCircle2, Calendar } from "lucide-react"
import { updateTile } from "@/app/actions/bingo"
import { getWomEvents } from "@/app/actions/wom-integration"
import type { Tile } from "@/app/actions/events"
import type { WomVerificationConfig, WomEvent } from "@/types/wom-types"

interface AutoVerifyTileModalProps {
  tile: Tile
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  eventId?: string
}

export function AutoVerifyTileModal({ tile, isOpen, onClose, onSave, eventId }: AutoVerifyTileModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [womEvents, setWomEvents] = useState<WomEvent[]>([])
  const [isLoadingEvents, setIsLoadingEvents] = useState(false)
  const [verificationConfig, setVerificationConfig] = useState<WomVerificationConfig>(
    tile.womVerificationConfig || {
      enabled: false,
      type: "skill",
      metric: "overall",
      threshold: 0,
      comparison: "greater_than",
      measureType: "level",
      verifyMode: "event_gains",
    },
  )

  // Fetch WOM events when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchWomEvents()
    }
  }, [isOpen])

  const fetchWomEvents = async () => {
    setIsLoadingEvents(true)
    try {
      const events = await getWomEvents()
      setWomEvents(events)
    } catch (error) {
      console.error("Failed to fetch WOM events:", error)
    } finally {
      setIsLoadingEvents(false)
    }
  }

  const handleSave = async () => {
    setIsLoading(true)
    try {
      await updateTile(tile.id, {
        womVerificationConfig: verificationConfig,
      })
      onSave()
    } catch (error) {
      console.error("Failed to update tile:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const updateConfig = (key: keyof WomVerificationConfig, value: any) => {
    setVerificationConfig((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Auto-Verification Settings</DialogTitle>
          <DialogDescription>
            Configure how this tile can be automatically verified using Wise Old Man data
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-verify">Enable Auto-Verification</Label>
              <p className="text-sm text-muted-foreground">
                Allow players to automatically complete this tile based on their stats
              </p>
            </div>
            <Switch
              id="auto-verify"
              checked={verificationConfig.enabled}
              onCheckedChange={(checked) => updateConfig("enabled", checked)}
            />
          </div>

          {verificationConfig.enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="verify-mode">Verification Mode</Label>
                <Select
                  value={verificationConfig.verifyMode}
                  onValueChange={(value) => updateConfig("verifyMode", value as "total" | "event_gains")}
                >
                  <SelectTrigger id="verify-mode">
                    <SelectValue placeholder="Select verification mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total">Total Stats (All-time)</SelectItem>
                    <SelectItem value="event_gains">Event Gains (During event period only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {verificationConfig.verifyMode === "event_gains" && (
                <div className="space-y-2">
                  <Label htmlFor="wom-event">Wise Old Man Event</Label>
                  <Select
                    value={verificationConfig.womEventId?.toString() || ""}
                    onValueChange={(value) => updateConfig("womEventId", value ? Number.parseInt(value) : undefined)}
                  >
                    <SelectTrigger id="wom-event" className="flex items-center">
                      <Calendar className="mr-2 h-4 w-4" />
                      <SelectValue placeholder={isLoadingEvents ? "Loading events..." : "Select WOM event"} />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingEvents ? (
                        <SelectItem value="" disabled>
                          Loading events...
                        </SelectItem>
                      ) : womEvents.length > 0 ? (
                        womEvents.map((event) => (
                          <SelectItem key={event.id} value={event.id.toString()}>
                            {event.title} ({event.status})
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="" disabled>
                          No events found
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Select a Wise Old Man event to track player progress within that timeframe.
                    {!verificationConfig.womEventId && (
                      <span className="text-amber-500 block mt-1">
                        If no event is selected, the Bingoscape event timeframe will be used.
                      </span>
                    )}
                  </p>
                </div>
              )}

              <Tabs
                defaultValue={verificationConfig.type}
                onValueChange={(value) => updateConfig("type", value as "skill" | "boss" | "activity")}
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="skill">Skills</TabsTrigger>
                  <TabsTrigger value="boss">Bosses</TabsTrigger>
                  <TabsTrigger value="activity">Activities</TabsTrigger>
                </TabsList>
                <TabsContent value="skill" className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="skill-metric">Skill</Label>
                    <Select value={verificationConfig.metric} onValueChange={(value) => updateConfig("metric", value)}>
                      <SelectTrigger id="skill-metric">
                        <SelectValue placeholder="Select skill" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="overall">Overall</SelectItem>
                        <SelectItem value="attack">Attack</SelectItem>
                        <SelectItem value="defence">Defence</SelectItem>
                        <SelectItem value="strength">Strength</SelectItem>
                        <SelectItem value="hitpoints">Hitpoints</SelectItem>
                        <SelectItem value="ranged">Ranged</SelectItem>
                        <SelectItem value="prayer">Prayer</SelectItem>
                        <SelectItem value="magic">Magic</SelectItem>
                        <SelectItem value="cooking">Cooking</SelectItem>
                        <SelectItem value="woodcutting">Woodcutting</SelectItem>
                        <SelectItem value="fletching">Fletching</SelectItem>
                        <SelectItem value="fishing">Fishing</SelectItem>
                        <SelectItem value="firemaking">Firemaking</SelectItem>
                        <SelectItem value="crafting">Crafting</SelectItem>
                        <SelectItem value="smithing">Smithing</SelectItem>
                        <SelectItem value="mining">Mining</SelectItem>
                        <SelectItem value="herblore">Herblore</SelectItem>
                        <SelectItem value="agility">Agility</SelectItem>
                        <SelectItem value="thieving">Thieving</SelectItem>
                        <SelectItem value="slayer">Slayer</SelectItem>
                        <SelectItem value="farming">Farming</SelectItem>
                        <SelectItem value="runecrafting">Runecrafting</SelectItem>
                        <SelectItem value="hunter">Hunter</SelectItem>
                        <SelectItem value="construction">Construction</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="measure-type">Measure</Label>
                    <Select
                      value={verificationConfig.measureType}
                      onValueChange={(value) => updateConfig("measureType", value)}
                    >
                      <SelectTrigger id="measure-type">
                        <SelectValue placeholder="Select measure" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="level">Level</SelectItem>
                        <SelectItem value="experience">Experience</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                <TabsContent value="boss" className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="boss-metric">Boss</Label>
                    <Select value={verificationConfig.metric} onValueChange={(value) => updateConfig("metric", value)}>
                      <SelectTrigger id="boss-metric">
                        <SelectValue placeholder="Select boss" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="abyssal_sire">Abyssal Sire</SelectItem>
                        <SelectItem value="alchemical_hydra">Alchemical Hydra</SelectItem>
                        <SelectItem value="barrows_chests">Barrows Chests</SelectItem>
                        <SelectItem value="bryophyta">Bryophyta</SelectItem>
                        <SelectItem value="callisto">Callisto</SelectItem>
                        <SelectItem value="cerberus">Cerberus</SelectItem>
                        <SelectItem value="chambers_of_xeric">Chambers of Xeric</SelectItem>
                        <SelectItem value="chambers_of_xeric_challenge_mode">Chambers of Xeric (CM)</SelectItem>
                        <SelectItem value="chaos_elemental">Chaos Elemental</SelectItem>
                        <SelectItem value="chaos_fanatic">Chaos Fanatic</SelectItem>
                        <SelectItem value="commander_zilyana">Commander Zilyana</SelectItem>
                        <SelectItem value="corporeal_beast">Corporeal Beast</SelectItem>
                        <SelectItem value="crazy_archaeologist">Crazy Archaeologist</SelectItem>
                        <SelectItem value="dagannoth_prime">Dagannoth Prime</SelectItem>
                        <SelectItem value="dagannoth_rex">Dagannoth Rex</SelectItem>
                        <SelectItem value="dagannoth_supreme">Dagannoth Supreme</SelectItem>
                        <SelectItem value="deranged_archaeologist">Deranged Archaeologist</SelectItem>
                        <SelectItem value="general_graardor">General Graardor</SelectItem>
                        <SelectItem value="giant_mole">Giant Mole</SelectItem>
                        <SelectItem value="grotesque_guardians">Grotesque Guardians</SelectItem>
                        <SelectItem value="hespori">Hespori</SelectItem>
                        <SelectItem value="kalphite_queen">Kalphite Queen</SelectItem>
                        <SelectItem value="king_black_dragon">King Black Dragon</SelectItem>
                        <SelectItem value="kraken">Kraken</SelectItem>
                        <SelectItem value="kreearra">Kree'arra</SelectItem>
                        <SelectItem value="kril_tsutsaroth">K'ril Tsutsaroth</SelectItem>
                        <SelectItem value="mimic">Mimic</SelectItem>
                        <SelectItem value="nex">Nex</SelectItem>
                        <SelectItem value="nightmare">Nightmare</SelectItem>
                        <SelectItem value="phosanis_nightmare">Phosani's Nightmare</SelectItem>
                        <SelectItem value="obor">Obor</SelectItem>
                        <SelectItem value="sarachnis">Sarachnis</SelectItem>
                        <SelectItem value="scorpia">Scorpia</SelectItem>
                        <SelectItem value="skotizo">Skotizo</SelectItem>
                        <SelectItem value="tempoross">Tempoross</SelectItem>
                        <SelectItem value="the_gauntlet">The Gauntlet</SelectItem>
                        <SelectItem value="the_corrupted_gauntlet">The Corrupted Gauntlet</SelectItem>
                        <SelectItem value="theatre_of_blood">Theatre of Blood</SelectItem>
                        <SelectItem value="theatre_of_blood_hard_mode">Theatre of Blood Hard Mode</SelectItem>
                        <SelectItem value="thermonuclear_smoke_devil">Thermonuclear Smoke Devil</SelectItem>
                        <SelectItem value="tombs_of_amascut">Tombs of Amascut</SelectItem>
                        <SelectItem value="tombs_of_amascut_expert">Tombs of Amascut Expert</SelectItem>
                        <SelectItem value="tzkal_zuk">TzKal-Zuk</SelectItem>
                        <SelectItem value="tztok_jad">TzTok-Jad</SelectItem>
                        <SelectItem value="venenatis">Venenatis</SelectItem>
                        <SelectItem value="vetion">Vet'ion</SelectItem>
                        <SelectItem value="vorkath">Vorkath</SelectItem>
                        <SelectItem value="wintertodt">Wintertodt</SelectItem>
                        <SelectItem value="zalcano">Zalcano</SelectItem>
                        <SelectItem value="zulrah">Zulrah</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="measure-type">Measure</Label>
                    <Select
                      value={verificationConfig.measureType}
                      onValueChange={(value) => updateConfig("measureType", value)}
                    >
                      <SelectTrigger id="measure-type">
                        <SelectValue placeholder="Select measure" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kills">Kills</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                <TabsContent value="activity" className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="activity-metric">Activity</Label>
                    <Select value={verificationConfig.metric} onValueChange={(value) => updateConfig("metric", value)}>
                      <SelectTrigger id="activity-metric">
                        <SelectValue placeholder="Select activity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="league_points">League Points</SelectItem>
                        <SelectItem value="bounty_hunter_hunter">Bounty Hunter (Hunter)</SelectItem>
                        <SelectItem value="bounty_hunter_rogue">Bounty Hunter (Rogue)</SelectItem>
                        <SelectItem value="clue_scrolls_all">Clue Scrolls (All)</SelectItem>
                        <SelectItem value="clue_scrolls_beginner">Clue Scrolls (Beginner)</SelectItem>
                        <SelectItem value="clue_scrolls_easy">Clue Scrolls (Easy)</SelectItem>
                        <SelectItem value="clue_scrolls_medium">Clue Scrolls (Medium)</SelectItem>
                        <SelectItem value="clue_scrolls_hard">Clue Scrolls (Hard)</SelectItem>
                        <SelectItem value="clue_scrolls_elite">Clue Scrolls (Elite)</SelectItem>
                        <SelectItem value="clue_scrolls_master">Clue Scrolls (Master)</SelectItem>
                        <SelectItem value="last_man_standing">Last Man Standing</SelectItem>
                        <SelectItem value="soul_wars_zeal">Soul Wars Zeal</SelectItem>
                        <SelectItem value="guardians_of_the_rift">Guardians of the Rift</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="measure-type">Measure</Label>
                    <Select
                      value={verificationConfig.measureType}
                      onValueChange={(value) => updateConfig("measureType", value)}
                    >
                      <SelectTrigger id="measure-type">
                        <SelectValue placeholder="Select measure" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="score">Score</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="space-y-2">
                <Label htmlFor="comparison">Comparison</Label>
                <Select
                  value={verificationConfig.comparison}
                  onValueChange={(value) => updateConfig("comparison", value)}
                >
                  <SelectTrigger id="comparison">
                    <SelectValue placeholder="Select comparison" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="greater_than">Greater than</SelectItem>
                    <SelectItem value="greater_than_equal">Greater than or equal</SelectItem>
                    <SelectItem value="equal">Equal to</SelectItem>
                    <SelectItem value="less_than">Less than</SelectItem>
                    <SelectItem value="less_than_equal">Less than or equal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="threshold">Threshold Value</Label>
                <Input
                  id="threshold"
                  type="number"
                  value={verificationConfig.threshold}
                  onChange={(e) => updateConfig("threshold", Number.parseInt(e.target.value) || 0)}
                />
              </div>

              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Auto-Verification Preview</AlertTitle>
                <AlertDescription>
                  This tile will be automatically verified when a player's{" "}
                  <span className="font-medium capitalize">{verificationConfig.metric.replace("_", " ")}</span>{" "}
                  {verificationConfig.measureType}{" "}
                  {verificationConfig.verifyMode === "event_gains" ? "gained during the event" : "total"} is{" "}
                  {verificationConfig.comparison === "greater_than" && "greater than"}
                  {verificationConfig.comparison === "greater_than_equal" && "greater than or equal to"}
                  {verificationConfig.comparison === "equal" && "equal to"}
                  {verificationConfig.comparison === "less_than" && "less than"}
                  {verificationConfig.comparison === "less_than_equal" && "less than or equal to"}{" "}
                  <span className="font-medium">{verificationConfig.threshold}</span>.
                </AlertDescription>
              </Alert>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Configuration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

