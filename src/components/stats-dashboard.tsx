import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, Target, CheckCircle2 } from "lucide-react"

interface StatsDashboardProps {
  stats: {
    totalSubmissions: number
    approvedSubmissions: number
    approvalRate: number
  }
  metadata: {
    ehp: number | null
    ehb: number | null
  } | null
}

export function StatsDashboard({ stats, metadata }: StatsDashboardProps) {
  // A simplified placeholder for the heatmap in v1
  // A true GitHub-style graph requires a robust library (e.g., react-activity-calendar)
  const heatmapPlaceholder = Array.from({ length: 28 }).map((_, i) => {
    const isHigh = (i * 7) % 10 > 7
    const isMed = (i * 7) % 10 > 4
    return (
      <div 
        key={i} 
        className={`h-3 w-3 rounded-sm ${isHigh ? 'bg-primary/80' : isMed ? 'bg-primary/40' : 'bg-secondary'}`}
      />
    )
  })

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSubmissions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approvedSubmissions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approvalRate.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Activity Heatmap</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {heatmapPlaceholder}
            </div>
            <p className="text-xs text-muted-foreground mt-4">Past 28 days of activity (Preview)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Efficiency Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Efficient Hours Played (EHP)</span>
                  <span className="text-sm text-muted-foreground">{metadata?.ehp?.toFixed(1) ?? "—"}</span>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min((metadata?.ehp || 0) / 10, 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Efficient Hours Bossed (EHB)</span>
                  <span className="text-sm text-muted-foreground">{metadata?.ehb?.toFixed(1) ?? "—"}</span>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full" style={{ width: `${Math.min((metadata?.ehb || 0) / 10, 100)}%` }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
