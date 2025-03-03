"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { StatsChart } from "./stats-chart"
import type { Team } from "@/app/actions/events"
import { getAllTeamPointsAndTotal } from "@/app/actions/stats"
import type { StatsData } from "@/app/actions/stats"

interface StatsDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  userRole: string
  currentTeamId?: string
  teams: Team[]
  bingoId: string
}

export function StatsDialog({ isOpen, onOpenChange, userRole, currentTeamId, teams, bingoId }: StatsDialogProps) {
  const [statsData, setStatsData] = useState<StatsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true)

      const fetchData = async () => {
        try {
          const data = await getAllTeamPointsAndTotal(bingoId)
          setStatsData(data)
          setIsLoading(false)
        } catch (error) {
          console.error("Error fetching stats data:", error)
          setIsLoading(false)
        }
      }

      fetchData()
        .then(() => console.log("Stats data fetched"))
        .catch(() => console.log("Error fetching stats data"))
    }
  }, [isOpen, bingoId])

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Team Statistics</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4">
            {statsData && (
              <>
                <div className="h-80 w-full">
                  <StatsChart
                    data={statsData.teamPoints}
                    totalPossibleXP={statsData.totalPossibleXP}
                    title="Team XP Comparison"
                  />
                </div>
                <div className="text-center mt-4">
                  <p className="text-sm text-muted-foreground">Total Possible XP: {statsData.totalPossibleXP}</p>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}


