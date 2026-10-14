/* eslint-disable */
"use client"

import { useState, useEffect, type ReactNode } from "react"
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
import {
  canUseBalancedGeneration,
  generateBalancedTeams,
} from "@/app/actions/team-balancing"
import { calculateMetadataCoverage } from "@/app/actions/player-metadata"
import { SA_PRESETS, estimateRuntime } from "@/lib/simulated-annealing-config"
import {
  Loader2,
  Sparkles,
  Shuffle,
  Info,
  ChevronDown,
  ChevronUp,
  HelpCircle,
} from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Radix tooltips only open on hover/focus, so tap toggles them for touch users.
function HelpHint({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Help"
            className="-m-2 p-2"
            onClick={() => setOpen((prev) => !prev)}
          >
            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{children}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

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
  const [generationMethod, setGenerationMethod] = useState<
    "teamSize" | "teamCount"
  >("teamSize")
  const [teamSize, setTeamSize] = useState(5)
  const [teamCount, setTeamCount] = useState(2)
  const [teamNamePrefix, setTeamNamePrefix] = useState("Team")
  const [isGenerating, setIsGenerating] = useState(false)

  // Balanced generation state
  const [generationMode, setGenerationMode] = useState<"random" | "balanced">(
    "random"
  )
  const [canUseBalanced, setCanUseBalanced] = useState(false)
  const [metadataCoverage, setMetadataCoverage] = useState(0)
  const [loadingCoverage, setLoadingCoverage] = useState(false)

  // Simulated Annealing configuration
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [configPreset, setConfigPreset] = useState<
    "small" | "medium" | "large" | "custom"
  >("medium")
  const [saConfig, setSaConfig] = useState({
    // Annealing schedule
    iterations: 20000,
    initialTemperature: 1.0,
    finalTemperature: 0.0001,

    // Termination
    randomSeed: undefined as number | undefined,
    stagnationLimit: 5000,

    // Variance weights (normalized to sum to 1.0)
    // Note: Team size is now enforced as a hard constraint
    varianceWeights: {
      timezone: 0.2, // 20%
      ehp: 0.2, // 20%
      ehb: 0.2, // 20%
      dailyHours: 0.2, // 20%
      skillLevel: 0.2, // 20%
    },

    // Move operators
    moves: {
      swapProbability: 0.7,
      moveProbability: 0.3,
    },
  })

  // Skill Mapping State
  const [skillMappingStrategy, setSkillMappingStrategy] = useState<
    "linear" | "exponential" | "fibonacci" | "custom"
  >("linear")
  const [customSkillMapping, setCustomSkillMapping] = useState({
    beginner: 1,
    intermediate: 2,
    advanced: 3,
    expert: 4,
    pvmgod: 5,
  })

  // Helper: Handle preset change
  const handlePresetChange = (
    preset: "small" | "medium" | "large" | "custom"
  ) => {
    setConfigPreset(preset)
    if (preset !== "custom") {
      const presetConfig = SA_PRESETS[preset]
      setSaConfig({
        iterations: presetConfig.annealing.iterations,
        initialTemperature: presetConfig.annealing.initialTemperature,
        finalTemperature: presetConfig.annealing.finalTemperature,
        randomSeed: undefined,
        stagnationLimit: presetConfig.termination.stagnationLimit ?? 5000,
        varianceWeights: {
          timezone: presetConfig.weights.timezoneVariance,
          ehp: presetConfig.weights.averageEHP,
          ehb: presetConfig.weights.averageEHB,
          dailyHours: presetConfig.weights.averageDailyHours,
          skillLevel: presetConfig.weights.skillLevel,
        },
        moves: {
          swapProbability: presetConfig.moves.swapProbability,
          moveProbability: presetConfig.moves.moveProbability,
        },
      })
    }
  }

  // Helper: Normalize variance weights to sum to 1.0
  // When one weight changes, proportionally adjust all others
  const normalizeWeights = (
    currentWeights: typeof saConfig.varianceWeights,
    changedKey: keyof typeof saConfig.varianceWeights,
    newValue: number
  ) => {
    // Clamp new value between 0 and 1
    const clampedValue = Math.max(0, Math.min(1, newValue))

    // Calculate sum of other weights
    const otherKeys = Object.keys(currentWeights).filter(
      (k) => k !== changedKey
    ) as Array<keyof typeof currentWeights>
    const otherSum = otherKeys.reduce(
      (sum, key) => sum + currentWeights[key],
      0
    )

    // If other weights sum to zero, distribute remaining equally
    if (otherSum === 0) {
      const remaining = 1.0 - clampedValue
      const perWeight = remaining / otherKeys.length
      const newWeights = { ...currentWeights }
      otherKeys.forEach((key) => {
        newWeights[key] = perWeight
      })
      newWeights[changedKey] = clampedValue
      return newWeights
    }

    // Proportionally scale other weights to maintain their relative ratios
    const remaining = 1.0 - clampedValue
    const scaleFactor = remaining / otherSum

    const newWeights = { ...currentWeights }
    otherKeys.forEach((key) => {
      newWeights[key] = currentWeights[key] * scaleFactor
    })
    newWeights[changedKey] = clampedValue

    return newWeights
  }

  // Helper: Update config value (automatically sets preset to custom)
  const updateConfig = (path: string, value: any) => {
    setConfigPreset("custom")

    // Special handling for variance weights to maintain sum = 1.0
    if (path.startsWith("varianceWeights.")) {
      const weightKey = path.split(
        "."
      )[1] as keyof typeof saConfig.varianceWeights
      setSaConfig((prev) => ({
        ...prev,
        varianceWeights: normalizeWeights(
          prev.varianceWeights,
          weightKey,
          value
        ),
      }))
      return
    }

    setSaConfig((prev) => {
      const keys = path.split(".")
      if (keys.length === 1) {
        return { ...prev, [keys[0]!]: value }
      } else if (keys.length === 2) {
        return {
          ...prev,
          [keys[0]!]: {
            ...(prev[keys[0]! as keyof typeof prev] as any),
            [keys[1]!]: value,
          },
        }
      }
      return prev
    })
  }

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
    (p) =>
      !existingTeams.some((team) =>
        team.teamMembers.some((m) => m.user.id === p.id)
      )
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
        // Use balanced generation algorithm with simulated annealing
        const activeSkillMapping = (() => {
          switch (skillMappingStrategy) {
            case "linear":
              return {
                beginner: 1,
                intermediate: 2,
                advanced: 3,
                expert: 4,
                pvmgod: 5,
              }
            case "exponential":
              return {
                beginner: 1,
                intermediate: 2,
                advanced: 4,
                expert: 8,
                pvmgod: 16,
              }
            case "fibonacci":
              return {
                beginner: 1,
                intermediate: 2,
                advanced: 3,
                expert: 5,
                pvmgod: 8,
              }
            case "custom":
              return customSkillMapping
          }
        })()

        const result = await generateBalancedTeams(eventId, {
          generationMethod,
          teamSize: generationMethod === "teamSize" ? teamSize : undefined,
          teamCount: generationMethod === "teamCount" ? teamCount : undefined,
          teamNamePrefix,
          simulatedAnnealing: {
            ...saConfig,
            skillLevelMapping: activeSkillMapping,
          },
        })

        if (!result.success || !result.data) {
          throw new Error(result.error || "Failed to generate balanced teams")
        }

        await onTeamsGenerated()

        toast({
          title: "Balanced teams generated",
          description: `Successfully created ${result.data.teamsCreated} balanced teams with ${result.data.participantsAssigned} participants. Balance score: ${result.data.objectiveScore.toFixed(3)} (lower is better)`,
        })
      } else {
        // Use random generation (existing logic)
        const shuffledParticipants = [...unassignedParticipants].sort(
          () => Math.random() - 0.5
        )

        let numberOfTeams = 0
        if (generationMethod === "teamSize") {
          numberOfTeams = Math.ceil(shuffledParticipants.length / teamSize)
        } else {
          numberOfTeams = teamCount
        }

        const createdTeams: string[] = []
        for (let i = 0; i < numberOfTeams; i++) {
          const teamName = `${teamNamePrefix} ${existingTeams.length + i + 1}`
          const teamRes = await createTeam(eventId, teamName)
          if (!teamRes.success) {
            throw new Error(teamRes.error || "Failed to create team")
          }
          if (!teamRes.data) throw new Error("Failed to create team")
          createdTeams.push(teamRes.data.id)
        }

        for (let i = 0; i < shuffledParticipants.length; i++) {
          const teamIndex =
            generationMethod === "teamSize"
              ? Math.floor(i / teamSize)
              : i % numberOfTeams

          if (teamIndex < createdTeams.length) {
            const addRes = await addUserToTeam(
              createdTeams[teamIndex]!,
              shuffledParticipants[i]!.id
            )
            if (!addRes?.success) {
              throw new Error(addRes?.error || "Failed to add user to team")
            }
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
        description:
          error instanceof Error
            ? error.message
            : "Failed to generate teams. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Auto-Generate Teams</DialogTitle>
          <DialogDescription>
            Automatically create and assign participants to teams using random
            or balanced algorithms.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={generationMode}
          onValueChange={(value) =>
            setGenerationMode(value as "random" | "balanced")
          }
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="random" className="flex items-center gap-2">
              <Shuffle className="h-4 w-4" />
              Random
            </TabsTrigger>
            <TabsTrigger
              value="balanced"
              disabled={!canUseBalanced}
              className="flex items-center gap-2"
            >
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
          ) : (
            !canUseBalanced && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-warning bg-warning/10 p-3 ">
                <Info className="mt-0.5 h-4 w-4 text-warning " />
                <div>
                  <p className="text-sm font-medium text-warning ">
                    Balanced mode unavailable
                  </p>
                  <p className="text-xs text-warning ">
                    Only {metadataCoverage}% of participants have metadata. At
                    least 50% required for balanced generation.
                  </p>
                </div>
              </div>
            )
          )}

          <TabsContent value="random" className="mt-4 space-y-4">
            <div className="rounded-lg border border-info bg-info/10 p-3 ">
              <p className="text-sm text-info ">
                <Shuffle className="mr-1 inline h-4 w-4" />
                Random mode shuffles participants and distributes them evenly
                across teams.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="balanced" className="mt-4 space-y-4">
            <div className="rounded-lg border border-success bg-success/10 p-3 ">
              <p className="text-sm text-success ">
                <Sparkles className="mr-1 inline h-4 w-4" />
                Balanced mode uses simulated annealing optimization with player
                metadata to create well-balanced teams.
              </p>
            </div>

            {/* Configuration Preset Selector */}
            <div className="space-y-2">
              <Label>Configuration Preset</Label>
              <Select value={configPreset} onValueChange={handlePresetChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">
                    Small Event (50-100 participants)
                  </SelectItem>
                  <SelectItem value="medium">
                    Medium Event (100-200 participants) - Recommended
                  </SelectItem>
                  <SelectItem value="large">
                    Large Event (200+ participants)
                  </SelectItem>
                  <SelectItem value="custom">Custom Configuration</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Presets automatically configure all optimization parameters for
                your event size.
              </p>
            </div>

            {/* Advanced Settings - Comprehensive */}
            <Collapsible
              open={showAdvancedSettings}
              onOpenChange={setShowAdvancedSettings}
            >
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Advanced Settings{configPreset === "custom" && " (Custom)"}
                  </span>
                  {showAdvancedSettings ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>

              <CollapsibleContent className="mt-4 space-y-4">
                {/* Annealing Schedule */}
                <div className="space-y-3 rounded-lg border p-4">
                  <Label className="text-base font-semibold">
                    Annealing Schedule
                  </Label>

                  {/* Iterations */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">Iterations</Label>
                        <HelpHint>
                              Number of optimization iterations. More iterations
                              = better balance but longer runtime.
                            </HelpHint>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {saConfig.iterations.toLocaleString()}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          ~{estimateRuntime(saConfig.iterations)}s
                        </Badge>
                      </div>
                    </div>
                    <Slider
                      value={[saConfig.iterations]}
                      onValueChange={([value]) =>
                        updateConfig("iterations", value!)
                      }
                      min={1000}
                      max={50000}
                      step={1000}
                    />
                  </div>

                  {/* Initial Temperature */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">Initial Temperature</Label>
                        <HelpHint>
                              Starting exploration level. Higher = more
                              exploration early.
                            </HelpHint>
                      </div>
                      <span className="text-sm font-medium">
                        {saConfig.initialTemperature.toFixed(1)}
                      </span>
                    </div>
                    <Slider
                      value={[saConfig.initialTemperature * 10]}
                      onValueChange={([value]) =>
                        updateConfig("initialTemperature", value! / 10)
                      }
                      min={1}
                      max={20}
                      step={1}
                    />
                  </div>

                  {/* Final Temperature */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">Final Temperature</Label>
                        <HelpHint>
                              Ending precision. Lower = finer adjustments at the
                              end.
                            </HelpHint>
                      </div>
                      <span className="text-sm font-medium">
                        {saConfig.finalTemperature.toFixed(4)}
                      </span>
                    </div>
                    <Slider
                      value={[saConfig.finalTemperature * 10000]}
                      onValueChange={([value]) =>
                        updateConfig("finalTemperature", value! / 10000)
                      }
                      min={1}
                      max={100}
                      step={1}
                    />
                  </div>
                </div>

                {/* Termination Criteria */}
                <div className="space-y-3 rounded-lg border p-4">
                  <Label className="text-base font-semibold">
                    Termination Criteria
                  </Label>

                  {/* Random Seed */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Random Seed (optional)</Label>
                      <HelpHint>
                            Set a number for reproducible results. Same seed =
                            same teams.
                          </HelpHint>
                    </div>
                    <Input
                      type="number"
                      placeholder="e.g., 12345 (leave empty for random)"
                      value={saConfig.randomSeed ?? ""}
                      onChange={(e) =>
                        updateConfig(
                          "randomSeed",
                          e.target.value ? parseInt(e.target.value) : undefined
                        )
                      }
                    />
                  </div>

                  {/* Stagnation Limit */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">Stagnation Limit</Label>
                        <HelpHint>
                              Stop early if no improvement for this many
                              iterations. Saves time.
                            </HelpHint>
                      </div>
                      <span className="text-sm font-medium">
                        {saConfig.stagnationLimit}
                      </span>
                    </div>
                    <Slider
                      value={[saConfig.stagnationLimit]}
                      onValueChange={([value]) =>
                        updateConfig("stagnationLimit", value!)
                      }
                      min={1000}
                      max={10000}
                      step={500}
                    />
                  </div>
                </div>

                {/* Variance Weights */}
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <Label className="text-base font-semibold">
                      Variance Weights
                    </Label>
                    <HelpHint>
                          Controls how much each metric contributes to team
                          balance optimization.
                        </HelpHint>
                  </div>

                  {/* Visual Balance Bar */}
                  <div className="mb-6 flex h-3 w-full overflow-hidden rounded-sm">
                    <div
                      className="bg-info"
                      style={{
                        width: `${saConfig.varianceWeights.timezone * 100}%`,
                      }}
                      title="Timezone"
                    />
                    <div
                      className="bg-success"
                      style={{
                        width: `${saConfig.varianceWeights.ehp * 100}%`,
                      }}
                      title="EHP"
                    />
                    <div
                      className="bg-chart-5"
                      style={{
                        width: `${saConfig.varianceWeights.ehb * 100}%`,
                      }}
                      title="EHB"
                    />
                    <div
                      className="bg-warning"
                      style={{
                        width: `${saConfig.varianceWeights.dailyHours * 100}%`,
                      }}
                      title="Daily Hours"
                    />
                    <div
                      className="bg-destructive"
                      style={{
                        width: `${saConfig.varianceWeights.skillLevel * 100}%`,
                      }}
                      title="Skill Level"
                    />
                  </div>

                  {/* Timezone Variance Weight */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Timezone Balance</Label>
                      <span className="text-sm font-medium">
                        {(saConfig.varianceWeights.timezone * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Slider
                      value={[saConfig.varianceWeights.timezone * 100]}
                      onValueChange={([value]) =>
                        updateConfig("varianceWeights.timezone", value! / 100)
                      }
                      min={0}
                      max={100}
                      step={1}
                    />
                  </div>

                  {/* EHP Variance Weight */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">EHP Balance</Label>
                      <span className="text-sm font-medium">
                        {(saConfig.varianceWeights.ehp * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Slider
                      value={[saConfig.varianceWeights.ehp * 100]}
                      onValueChange={([value]) =>
                        updateConfig("varianceWeights.ehp", value! / 100)
                      }
                      min={0}
                      max={100}
                      step={1}
                    />
                  </div>

                  {/* EHB Variance Weight */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">EHB Balance</Label>
                      <span className="text-sm font-medium">
                        {(saConfig.varianceWeights.ehb * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Slider
                      value={[saConfig.varianceWeights.ehb * 100]}
                      onValueChange={([value]) =>
                        updateConfig("varianceWeights.ehb", value! / 100)
                      }
                      min={0}
                      max={100}
                      step={1}
                    />
                  </div>

                  {/* Daily Hours Variance Weight */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Daily Hours Balance</Label>
                      <span className="text-sm font-medium">
                        {(saConfig.varianceWeights.dailyHours * 100).toFixed(1)}
                        %
                      </span>
                    </div>
                    <Slider
                      value={[saConfig.varianceWeights.dailyHours * 100]}
                      onValueChange={([value]) =>
                        updateConfig("varianceWeights.dailyHours", value! / 100)
                      }
                      min={0}
                      max={100}
                      step={1}
                    />
                  </div>

                  {/* Skill Level Variance Weight */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Skill Level Balance</Label>
                      <span className="text-sm font-medium">
                        {(saConfig.varianceWeights.skillLevel * 100).toFixed(1)}
                        %
                      </span>
                    </div>
                    <Slider
                      value={[saConfig.varianceWeights.skillLevel * 100]}
                      onValueChange={([value]) =>
                        updateConfig("varianceWeights.skillLevel", value! / 100)
                      }
                      min={0}
                      max={100}
                      step={1}
                    />
                  </div>

                  {/* Team Size Balance Note */}
                  <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                    <p className="font-medium">Team Size Balance</p>
                    <p className="mt-1">
                      Team size is automatically balanced as a hard constraint.
                      Focus on optimizing skill and timezone balance.
                    </p>
                  </div>
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  Weights must sum to 100%. Changing one weight proportionally
                  adjusts others.
                </p>

                {/* Categorical Skill Mapping Strategy */}
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">
                      Skill Level Mapping Strategy
                    </Label>
                    <HelpHint>
                          Determines the numerical gap between different
                          categorical skill levels during optimization.
                        </HelpHint>
                  </div>
                  <Select
                    value={skillMappingStrategy}
                    onValueChange={(value) =>
                      setSkillMappingStrategy(value as any)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="linear">
                        Linear [1, 2, 3, 4, 5]
                      </SelectItem>
                      <SelectItem value="exponential">
                        Exponential [1, 2, 4, 8, 16]
                      </SelectItem>
                      <SelectItem value="fibonacci">
                        Fibonacci [1, 2, 3, 5, 8]
                      </SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>

                  {skillMappingStrategy === "custom" && (
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                      <div className="space-y-1 text-center">
                        <Label className="text-xs">Beginner</Label>
                        <Input
                          type="number"
                          value={customSkillMapping.beginner}
                          onChange={(e) =>
                            setCustomSkillMapping((p) => ({
                              ...p,
                              beginner: Number(e.target.value),
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1 text-center">
                        <Label className="text-xs">Interm.</Label>
                        <Input
                          type="number"
                          value={customSkillMapping.intermediate}
                          onChange={(e) =>
                            setCustomSkillMapping((p) => ({
                              ...p,
                              intermediate: Number(e.target.value),
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1 text-center">
                        <Label className="text-xs">Advanced</Label>
                        <Input
                          type="number"
                          value={customSkillMapping.advanced}
                          onChange={(e) =>
                            setCustomSkillMapping((p) => ({
                              ...p,
                              advanced: Number(e.target.value),
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1 text-center">
                        <Label className="text-xs">Expert</Label>
                        <Input
                          type="number"
                          value={customSkillMapping.expert}
                          onChange={(e) =>
                            setCustomSkillMapping((p) => ({
                              ...p,
                              expert: Number(e.target.value),
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1 text-center">
                        <Label className="text-xs">God-tier</Label>
                        <Input
                          type="number"
                          value={customSkillMapping.pvmgod}
                          onChange={(e) =>
                            setCustomSkillMapping((p) => ({
                              ...p,
                              pvmgod: Number(e.target.value),
                            }))
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Move Operators */}
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">
                      Move Operators
                    </Label>
                    <HelpHint>
                          Probabilities of different move types during
                          optimization.
                        </HelpHint>
                  </div>

                  {/* Swap Probability */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Swap Probability</Label>
                      <span className="text-sm font-medium">
                        {saConfig.moves.swapProbability.toFixed(2)}
                      </span>
                    </div>
                    <Slider
                      value={[saConfig.moves.swapProbability * 100]}
                      onValueChange={([value]) => {
                        const swapProb = value! / 100
                        updateConfig("moves.swapProbability", swapProb)
                        updateConfig("moves.moveProbability", 1 - swapProb)
                      }}
                      min={0}
                      max={100}
                      step={5}
                    />
                    <p className="text-xs text-muted-foreground">
                      Swap two participants between teams
                    </p>
                  </div>

                  {/* Move Probability (auto-calculated) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-muted-foreground">
                        Move Probability (auto)
                      </Label>
                      <span className="text-sm font-medium text-muted-foreground">
                        {saConfig.moves.moveProbability.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Move one participant to another team
                    </p>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </TabsContent>
        </Tabs>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Generation Method</Label>
            <RadioGroup
              value={generationMethod}
              onValueChange={(value) =>
                setGenerationMethod(value as "teamSize" | "teamCount")
              }
              className="flex flex-col space-y-1"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="teamSize" id="teamSize" />
                <Label htmlFor="teamSize">
                  By Team Size (members per team)
                </Label>
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
                onChange={(e) =>
                  setTeamSize(Number.parseInt(e.target.value) || 1)
                }
              />
              <p className="text-sm text-muted-foreground">
                This will create approximately{" "}
                {Math.ceil(unassignedParticipants.length / teamSize)} teams
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
                onChange={(e) =>
                  setTeamCount(Number.parseInt(e.target.value) || 1)
                }
              />
              <p className="text-sm text-muted-foreground">
                Each team will have approximately{" "}
                {Math.ceil(unassignedParticipants.length / teamCount)} members
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
              Teams will be named like: {teamNamePrefix} 1, {teamNamePrefix} 2,
              etc.
            </p>
          </div>

          <div className="rounded-md bg-secondary/30 p-3">
            <p className="text-sm font-medium">Summary</p>
            <p className="text-sm">
              {unassignedParticipants.length} unassigned participants will be
              distributed into
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
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || unassignedParticipants.length === 0}
          >
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
                Generate {generationMode === "balanced" ? "Balanced" : "Random"}{" "}
                Teams
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
