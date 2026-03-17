"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { EventTeamPoints } from "@/app/actions/stats"
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js"
import { Bar } from "react-chartjs-2"

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface BingoBreakdownChartProps {
  data: EventTeamPoints[]
  bingoSummary: { bingoId: string; title: string; totalPossibleXP: number; completionRate: number }[]
  title: string
}

export function BingoBreakdownChart({ data, bingoSummary, title }: BingoBreakdownChartProps) {
  // Create a stacked bar chart showing each team's XP breakdown by bingo
  const bingoTitles = bingoSummary.map((b) => b.title)
  const colors = [
    "rgba(255, 99, 132, 0.5)",
    "rgba(54, 162, 235, 0.5)",
    "rgba(255, 205, 86, 0.5)",
    "rgba(75, 192, 192, 0.5)",
    "rgba(153, 102, 255, 0.5)",
    "rgba(255, 159, 64, 0.5)",
  ]

  const datasets = bingoTitles.map((bingoTitle, index) => ({
    label: bingoTitle,
    data: data.map((team) => {
      const bingoData = team.bingoBreakdown.find((b) => b.bingoTitle === bingoTitle)
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
           
           
          label: (context: any) => `${context.dataset.label}: ${Math.round(context.parsed.y).toLocaleString()} XP`,
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
    <Card className="w-full h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-[400px]">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">No data available</p>
          </div>
        ) : (
          <Bar options={chartOptions} data={chartData} />
        )}
      </CardContent>
    </Card>
  )
}
