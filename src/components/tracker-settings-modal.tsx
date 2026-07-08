"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  linkWiseOldManCompetition,
  createWiseOldManCompetition,
  unlinkWiseOldManCompetition,
  syncTrackerProgress,
} from "@/app/actions/tracker"
import { fetchCompetitionFromWOM } from "@/app/actions/wiseoldman"
import { getMetricName, getWikiIconUrl } from "@/lib/osrs-metrics"
import {
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  RefreshCw,
  Unlink,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import Image from "next/image"

interface TrackerSettingsModalProps {
  bingoId: string
  womCompetitionId?: number | null
  womVerificationCode?: string | null
  isOpen: boolean
  onClose: () => void
}

const METRICS = [
  "overall",
  "attack",
  "defence",
  "strength",
  "hitpoints",
  "ranged",
  "prayer",
  "magic",
  "cooking",
  "woodcutting",
  "fletching",
  "fishing",
  "firemaking",
  "crafting",
  "smithing",
  "mining",
  "herblore",
  "agility",
  "thieving",
  "slayer",
  "farming",
  "runecrafting",
  "hunter",
  "construction",
  "ehp",
  "ehb",
]

export function TrackerSettingsModal({
  bingoId,
  womCompetitionId,
  womVerificationCode,
  isOpen,
  onClose,
}: TrackerSettingsModalProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Link Existing state
  const [competitionId, setCompetitionId] = useState("")
  const [verificationCode, setVerificationCode] = useState("")

  // Create New state
  const [metric, setMetric] = useState("overall")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  // Overview state
  const [stats, setStats] = useState<{
    participantCount: number
    metric: string
    participations: { progress: { gained: number } }[]
  } | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(false)
  const [showCode, setShowCode] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    if (isOpen && womCompetitionId) {
      setIsLoadingStats(true)
      fetchCompetitionFromWOM(womCompetitionId)
        .then((result) => {
          if (result.success && result.data) {
            setStats(
              result.data as {
                participantCount: number
                metric: string
                participations: { progress: { gained: number } }[]
              }
            )
          }
        })
        .finally(() => setIsLoadingStats(false))
    }
  }, [isOpen, womCompetitionId])

  const handleUnlink = async () => {
    setIsSubmitting(true)
    try {
      const result = await unlinkWiseOldManCompetition(bingoId)
      if (result.success) {
        toast({ title: "Success", description: "Competition unlinked." })
        onClose()
        router.refresh()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to unlink.",
          variant: "destructive",
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSync = async () => {
    setIsSyncing(true)

    const { id, update } = toast({
      title: (
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Syncing Tracker Data...</span>
        </div>
      ),
      description:
        "Fetching progress from WiseOldMan. This may take a few seconds.",
      duration: 60000,
    })

    try {
      const result = await syncTrackerProgress(bingoId)
      if (result.success) {
        update({
          id,
          title: "Sync complete",
          description: "Tracker progress synced successfully!",
          variant: "default",
          duration: 5000,
        })
        router.refresh()
      } else {
        update({
          id,
          title: "Sync failed",
          description: result.error || "Failed to sync progress.",
          variant: "destructive",
          duration: 5000,
        })
      }
    } finally {
      setIsSyncing(false)
    }
  }

  const handleCopyCode = () => {
    if (womVerificationCode) {
      navigator.clipboard.writeText(womVerificationCode)
      toast({
        title: "Copied",
        description: "Verification code copied to clipboard.",
      })
    }
  }

  const handleLinkExisting = async () => {
    if (!competitionId) {
      toast({
        title: "Error",
        description: "Competition ID is required",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const result = await linkWiseOldManCompetition(
        bingoId,
        parseInt(competitionId),
        verificationCode
      )
      if (result.success) {
        toast({
          title: "Success",
          description: "WiseOldMan competition linked successfully.",
        })
        onClose()
        router.refresh()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to link competition.",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Error",
        description: "An error occurred.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateNew = async () => {
    setIsSubmitting(true)
    try {
      const parsedStartsAt = startDate ? new Date(startDate) : undefined
      const parsedEndsAt = endDate ? new Date(endDate) : undefined
      const result = await createWiseOldManCompetition(
        bingoId,
        metric,
        parsedStartsAt,
        parsedEndsAt
      )
      if (result.success) {
        toast({
          title: "Success",
          description: `WiseOldMan competition created! ID: ${result.womCompetitionId}`,
        })
        onClose()
        router.refresh()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to create competition.",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Error",
        description: "An error occurred.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Tracker Settings (WiseOldMan)</DialogTitle>
          <DialogDescription>
            {womCompetitionId
              ? "Manage your linked WiseOldMan competition."
              : "Link this bingo board to a WiseOldMan competition to automatically track team progress."}
          </DialogDescription>
        </DialogHeader>

        {womCompetitionId ? (
          <div className="space-y-6 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  Competition ID:{" "}
                  <span className="font-bold">{womCompetitionId}</span>
                </p>
                {womVerificationCode && (
                  <div className="mt-2 flex items-center gap-2">
                    <p className="text-sm font-medium">Code: </p>
                    <code className="rounded bg-muted px-2 py-1 text-xs">
                      {showCode ? womVerificationCode : "••••••••"}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setShowCode(!showCode)}
                    >
                      {showCode ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleCopyCode}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(
                    `https://wiseoldman.net/competitions/${womCompetitionId}`,
                    "_blank"
                  )
                }
              >
                <ExternalLink className="mr-2 h-4 w-4" /> View
              </Button>
            </div>

            <div className="rounded-lg bg-muted/50 p-4">
              <h4 className="mb-2 font-semibold">Live Statistics</h4>
              {isLoadingStats ? (
                <p className="animate-pulse text-sm text-muted-foreground">
                  Fetching stats...
                </p>
              ) : stats ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Participants
                    </p>
                    <p className="text-lg font-bold">
                      {stats.participantCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Metric</p>
                    <p className="text-lg font-bold capitalize">
                      {stats.metric}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">
                      Total Gained
                    </p>
                    <p className="text-2xl font-bold text-green-600">
                      {stats.participations
                        ?.reduce(
                          (
                            acc: number,
                            p: { progress?: { gained?: number } }
                          ) => acc + (p.progress?.gained || 0),
                          0
                        )
                        .toLocaleString()}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Could not load stats.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleUnlink}
                disabled={isSubmitting}
              >
                <Unlink className="mr-2 h-4 w-4" /> Unlink
              </Button>
              <Button onClick={handleSync} disabled={isSyncing}>
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`}
                />
                Sync Now
              </Button>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="link" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="link">Link Existing</TabsTrigger>
              <TabsTrigger value="create">Create &amp; Sync New</TabsTrigger>
            </TabsList>

            <TabsContent value="link" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="competitionId">Competition ID</Label>
                <Input
                  id="competitionId"
                  placeholder="e.g. 12345"
                  value={competitionId}
                  onChange={(e) => setCompetitionId(e.target.value)}
                  type="number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="verificationCode">
                  Verification Code (Optional)
                </Label>
                <Input
                  id="verificationCode"
                  placeholder="Needed to update/manage the competition later"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                />
              </div>
              <Button
                onClick={handleLinkExisting}
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? "Linking..." : "Link Competition"}
              </Button>
            </TabsContent>

            <TabsContent value="create" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Metric</Label>
                <Select value={metric} onValueChange={setMetric}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a metric" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {METRICS.map((m) => (
                      <SelectItem key={m} value={m}>
                        <div className="flex items-center gap-2">
                          <Image
                            src={getWikiIconUrl(m)}
                            alt={m}
                            width={16}
                            height={16}
                            className="object-contain"
                            unoptimized
                            onError={(e) => {
                              e.currentTarget.style.display = "none"
                            }}
                          />
                          <span>{getMetricName(m)}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date & Time</Label>
                  <Input
                    id="startDate"
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date & Time</Label>
                  <Input
                    id="endDate"
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Leave blank to use the event&apos;s start and end dates.
              </p>
              <p className="text-sm text-muted-foreground">
                This will create a new WiseOldMan competition matching your
                event dates, bringing in all participants who have their
                RuneScape name linked.
              </p>
              <Button
                onClick={handleCreateNew}
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? "Creating..." : "Create Competition"}
              </Button>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
