"use client"

import { useState } from "react"
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
import { toast } from "@/hooks/use-toast"
import { createTeam, addUserToTeam } from "@/app/actions/team"
import { Loader2 } from "lucide-react"

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
      // Shuffle the participants for random assignment
      const shuffledParticipants = [...unassignedParticipants].sort(() => Math.random() - 0.5)

      // Calculate how many teams to create
      let numberOfTeams = 0
      if (generationMethod === "teamSize") {
        numberOfTeams = Math.ceil(shuffledParticipants.length / teamSize)
      } else {
        numberOfTeams = teamCount
      }

      // Create the teams
      const createdTeams: string[] = []
      for (let i = 0; i < numberOfTeams; i++) {
        const teamName = `${teamNamePrefix} ${existingTeams.length + i + 1}`
        const team = await createTeam(eventId, teamName)
        createdTeams.push(team.id)
      }

      // Distribute participants among teams
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

      onClose()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate teams. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Auto-Generate Teams</DialogTitle>
          <DialogDescription>Automatically create and assign participants to teams.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
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
              "Generate Teams"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

