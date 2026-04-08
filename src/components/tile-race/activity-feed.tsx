"use client"

import { useEffect, useState } from "react"
import { getRaceActivityLogs } from "@/app/actions/bingo"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Activity } from "lucide-react"

export function ActivityFeed({ bingoId }: { bingoId: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [logs, setLogs] = useState<any[]>([])

  useEffect(() => {
    const fetchLogs = async () => {
      const { success, logs: newLogs } = await getRaceActivityLogs(bingoId)
      if (success && newLogs) setLogs(newLogs)
    }

    fetchLogs()
    const interval = setInterval(fetchLogs, 10000)
    return () => clearInterval(interval)
  }, [bingoId])

  return (
    <Card className="flex h-full max-h-[500px] flex-col">
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5" />
          Activity Feed
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full p-4 pt-0">
          <div className="space-y-4">
            {logs.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No activity yet
              </p>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="border-l-2 border-primary py-1 pl-4 text-sm"
                >
                  <p className="text-foreground">{log.message}</p>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
