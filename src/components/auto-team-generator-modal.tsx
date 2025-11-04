/* eslint-disable */
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/hooks/use-toast"
import { createTeam, addUserToTeam } from "@/app/actions/team"
import { canUseBalancedGeneration, generateBalancedTeams } from "@/app/actions/team-balancing"
import { calculateMetadataCoverage } from "@/app/actions/player-metadata"
import { Loader2, Users, Sparkles, Shuffle, Info } from "lucide-react"

type Participant = {
  id: string
  name: string | null
  runescapeName: string | null
  image: string | null
}

type Team = {
  id: string
  name: string
  teamMembers: any[]
}

interface AutoTeamGeneratorModalProps {
  isOpen: boolean
  onClose: () => void
  eventId: string
  participants: Participant[]
  existingTeams: Team[]
  onTeamsGenerated: () => Promise<void>
}

export function AutoTeamGeneratorModal({
  isOpen,
  onClose,
  eventId,
  participants,
  existingTeams,
  onTeamsGenerated,
}: AutoTeamGeneratorModalProps) {
  const [generationMethod, setGenerationMethod] = useState<"teamSize" | "teamCount">("teamSize")
  const [teamSize, setTeamSize] = useState(5)
  const [teamCount, setTeamCount] = useState(2)
  const [teamNamePrefix, setTeamNamePrefix] = useState("Team")
  const [isGenerating, setIsGenerating] = useState(false)

  // Balanced generation state
  const [generationMode, setGenerationMode] = useState<"random" | "balanced">("random")
  const [canUseBalanced, setCanUseBalanced] = useState(false)
  const [metadataCoverage, setMetadataCoverage] = useState(0)
  const [loadingCoverage, setLoadingCoverage] = useState(false)
  const [weights, setWeights] = useState({
    ehp: 0.2,
    ehb: 0.2,
    timezone: 0.2,
    dailyHours: 0.2,
    skillLevel: 0.2,
  })

  // Check if balanced generation is available when modal opens
  useEffect(() => {
    if (isOpen) {
      void checkBalancedAvailability()
    }
  }, [isOpen, eventId])

  const checkBalancedAvailability = async () => {
    setLoadingCoverage(true)
    try {
      const [canUse, coverage] = await Promise.all([
        canUseBalancedGeneration(eventId),
        calculateMetadataCoverage(eventId),
      ])
      setCanUseBalanced(canUse)
      setMetadataCoverage(coverage)

      // Auto-select balanced mode if available
      if (canUse && generationMode === "random") {
        setGenerationMode("balanced")
      }
    } catch (error) {
      console.error("Error checking balanced availability:", error)
    } finally {
      setLoadingCoverage(false)
    }
  }

  // Get unassigned participants
  const unassignedParticipants = participants.filter(
    (p) => !existingTeams.some((team) => team.teamMembers.some((m) => m.user.id === p.id)),
  )

  const handleGenerate = async () => {
    if (unassignedParticipants.length === 0) {
      toast({
        title: "No participants available",
        description: "There are no unassigned participants to add to teams.",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)

    try {
      if (generationMode === "balanced") {
        // Use balanced generation algorithm
        const result = await generateBalancedTeams(eventId, {
          generationMethod,
          teamSize: generationMethod === "teamSize" ? teamSize : undefined,
          teamCount: generationMethod === "teamCount" ? teamCount : undefined,
          teamNamePrefix,
          weights,
        })

        await onTeamsGenerated()

        toast({
          title: "Balanced teams generated",
          description: `Successfully created ${result.teamsCreated} balanced teams with ${result.participantsAssigned} participants. Balance score: ${result.objectiveScore.toFixed(3)} (lower is better)`,
        })
      } else {
        // Use random generation (existing logic)
        const shuffledParticipants = [...unassignedParticipants].sort(() => Math.random() - 0.5)

        let numberOfTeams = 0
        if (generationMethod === "teamSize") {
          numberOfTeams = Math.ceil(shuffledParticipants.length / teamSize)
        } else {
          numberOfTeams = teamCount
        }

        const createdTeams: string[] = []
        for (let i = 0; i < numberOfTeams; i++) {
          const teamName = `${teamNamePrefix} ${existingTeams.length + i + 1}`
          const team = await createTeam(eventId, teamName)
          createdTeams.push(team!.id)
        }

        for (let i = 0; i < shuffledParticipants.length; i++) {
          const teamIndex = generationMethod === "teamSize" ? Math.floor(i / teamSize) : i % numberOfTeams

          if (teamIndex < createdTeams.length) {
            await addUserToTeam(createdTeams[teamIndex]!, shuffledParticipants[i]!.id)
          }
        }

        await onTeamsGenerated()

        toast({
          title: "Teams generated",
          description: `Successfully created ${createdTeams.length} teams with ${shuffledParticipants.length} participants.`,
        })
      }

      onClose()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate teams. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Auto-Generate Teams</DialogTitle>
          <DialogDescription>
            Automatically create and assign participants to teams using random or balanced algorithms.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={generationMode} onValueChange={(value) => setGenerationMode(value as "random" | "balanced")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="random" className="flex items-center gap-2">
              <Shuffle className="h-4 w-4" />
              Random
            </TabsTrigger>
            <TabsTrigger value="balanced" disabled={!canUseBalanced} className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Balanced
              {canUseBalanced && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {metadataCoverage}%
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Data Coverage Info */}
          {loadingCoverage ? (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking data coverage...
            </div>
          ) : !canUseBalanced && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-950">
              <Info className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                  Balanced mode unavailable
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  Only {metadataCoverage}% of participants have metadata. At least 50% required for balanced generation.
                </p>
              </div>
            </div>
          )}

          <TabsContent value="random" className="space-y-4 mt-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <Shuffle className="inline h-4 w-4 mr-1" />
                Random mode shuffles participants and distributes them evenly across teams.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="balanced" className="space-y-4 mt-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
              <p className="text-sm text-green-900 dark:text-green-100">
                <Sparkles className="inline h-4 w-4 mr-1" />
                Balanced mode uses player metadata to create skill-balanced teams with snake draft algorithm.
              </p>
            </div>

            {/* Weight Sliders */}
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Balancing Weights</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setWeights({ ehp: 0.2, ehb: 0.2, timezone: 0.2, dailyHours: 0.2, skillLevel: 0.2 })}
                >
                  Reset
                </Button>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">EHP (Efficient Hours Played)</Label>
                    <span className="text-sm font-medium">{(weights.ehp * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    value={[weights.ehp * 100]}
                    onValueChange={([value]) => setWeights((prev) => ({ ...prev, ehp: value! / 100 }))}
                    max={100}
                    step={5}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">EHB (Efficient Hours Bossed)</Label>
                    <span className="text-sm font-medium">{(weights.ehb * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    value={[weights.ehb * 100]}
                    onValueChange={([value]) => setWeights((prev) => ({ ...prev, ehb: value! / 100 }))}
                    max={100}
                    step={5}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Timezone Overlap</Label>
                    <span className="text-sm font-medium">{(weights.timezone * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    value={[weights.timezone * 100]}
                    onValueChange={([value]) => setWeights((prev) => ({ ...prev, timezone: value! / 100 }))}
                    max={100}
                    step={5}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Daily Hours Available</Label>
                    <span className="text-sm font-medium">{(weights.dailyHours * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    value={[weights.dailyHours * 100]}
                    onValueChange={([value]) => setWeights((prev) => ({ ...prev, dailyHours: value! / 100 }))}
                    max={100}
                    step={5}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Skill Level</Label>
                    <span className="text-sm font-medium">{(weights.skillLevel * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    value={[weights.skillLevel * 100]}
                    onValueChange={([value]) => setWeights((prev) => ({ ...prev, skillLevel: value! / 100 }))}
                    max={100}
                    step={5}
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Generation Method</Label>
            <RadioGroup
              value={generationMethod}
              onValueChange={(value) => setGenerationMethod(value as "teamSize" | "teamCount")}
              className="flex flex-col space-y-1"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="teamSize" id="teamSize" />
                <Label htmlFor="teamSize">By Team Size (members per team)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="teamCount" id="teamCount" />
                <Label htmlFor="teamCount">By Number of Teams</Label>
              </div>
            </RadioGroup>
          </div>

          {generationMethod === "teamSize" ? (
            <div className="space-y-2">
              <Label htmlFor="teamSize">Members per Team</Label>
              <Input
                id="teamSize"
                type="number"
                min={1}
                value={teamSize}
                onChange={(e) => setTeamSize(Number.parseInt(e.target.value) || 1)}
              />
              <p className="text-sm text-muted-foreground">
                This will create approximately {Math.ceil(unassignedParticipants.length / teamSize)} teams
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="teamCount">Number of Teams</Label>
              <Input
                id="teamCount"
                type="number"
                min={1}
                value={teamCount}
                onChange={(e) => setTeamCount(Number.parseInt(e.target.value) || 1)}
              />
              <p className="text-sm text-muted-foreground">
                Each team will have approximately {Math.ceil(unassignedParticipants.length / teamCount)} members
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="teamNamePrefix">Team Name Prefix</Label>
            <Input
              id="teamNamePrefix"
              value={teamNamePrefix}
              onChange={(e) => setTeamNamePrefix(e.target.value)}
              placeholder="Team"
            />
            <p className="text-sm text-muted-foreground">
              Teams will be named like: {teamNamePrefix} 1, {teamNamePrefix} 2, etc.
            </p>
          </div>

          <div className="bg-secondary/30 p-3 rounded-md">
            <p className="text-sm font-medium">Summary</p>
            <p className="text-sm">
              {unassignedParticipants.length} unassigned participants will be distributed into
              {generationMethod === "teamSize"
                ? ` ${Math.ceil(unassignedParticipants.length / teamSize)} teams of ${teamSize} members each`
                : ` ${teamCount} teams with approximately ${Math.ceil(unassignedParticipants.length / teamCount)} members each`}
              .
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isGenerating}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating || unassignedParticipants.length === 0}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                {generationMode === "balanced" ? (
                  <Sparkles className="mr-2 h-4 w-4" />
                ) : (
                  <Shuffle className="mr-2 h-4 w-4" />
                )}
                Generate {generationMode === "balanced" ? "Balanced" : "Random"} Teams
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

