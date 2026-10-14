"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { EventTeamPoints } from "@/server/queries/stats"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js"
import { Bar } from "react-chartjs-2"

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface BingoBreakdownChartProps {
  data: EventTeamPoints[]
  bingoSummary: {
    bingoId: string
    title: string
    totalPossibleXP: number
    completionRate: number
  }[]
  title: string
}

export function BingoBreakdownChart({
  data,
  bingoSummary,
  title,
}: BingoBreakdownChartProps) {
  // Create a stacked bar chart showing each team's XP breakdown by bingo
  const bingoTitles = bingoSummary.map((b) => b.title)
  const colors = [
    "rgba(255, 152, 31, 0.7)",
    "rgba(79, 210, 60, 0.7)",
    "rgba(43, 196, 232, 0.7)",
    "rgba(240, 88, 74, 0.7)",
    "rgba(207, 143, 224, 0.7)",
    "rgba(216, 201, 160, 0.7)",
  ]

  const datasets = bingoTitles.map((bingoTitle, index) => ({
    label: bingoTitle,
    data: data.map((team) => {
      const bingoData = team.bingoBreakdown.find(
        (b) => b.bingoTitle === bingoTitle
      )
      return bingoData ? bingoData.xp : 0
    }),
    backgroundColor: colors[index % colors.length],
    borderColor: colors[index % colors.length]?.replace("0.5", "1"),
    borderWidth: 1,
  }))

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "top" as const,
      },
      title: {
        display: true,
        text: title,
      },
      tooltip: {
        callbacks: {
          /* eslint-disable  @typescript-eslint/no-explicit-any */

          label: (context: any) =>
            `${context.dataset.label}: ${Math.round(context.parsed.y).toLocaleString()} XP`,
        },
      },
    },
    scales: {
      x: {
        stacked: true,
      },
      y: {
        stacked: true,
        beginAtZero: true,
        title: {
          display: true,
          text: "XP",
        },
        ticks: {
          callback: (value: string | number) => {
            if (typeof value === "number") {
              return Math.round(value).toLocaleString()
            }
            return value
          },
        },
      },
    },
  }

  const chartData = {
    labels: data.map((item) => item.name),
    datasets: datasets,
  }

  return (
    <Card className="h-full w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-[400px]">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground">No data available</p>
          </div>
        ) : (
          <Bar options={chartOptions} data={chartData} />
        )}
      </CardContent>
    </Card>
  )
}
