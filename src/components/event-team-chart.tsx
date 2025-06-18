"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { EventTeamPoints } from "@/app/actions/stats"
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js"
import { Bar } from "react-chartjs-2"

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface EventTeamChartProps {
  data: EventTeamPoints[]
  totalPossibleXP: number
  title: string
}

export function EventTeamChart({ data, totalPossibleXP, title }: EventTeamChartProps) {
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: title,
      },
      tooltip: {
        callbacks: {
          /* eslint-disable  @typescript-eslint/no-explicit-any */
          /* eslint-disable  @typescript-eslint/no-unsafe-argument */
          /* eslint-disable  @typescript-eslint/no-unsafe-member-access */
          label: (context: any) => `XP: ${Math.round(context.parsed.y).toLocaleString()}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: totalPossibleXP,
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
    datasets: [
      {
        data: data.map((item) => item.totalXP),
        backgroundColor: "rgba(53, 162, 235, 0.5)",
        borderColor: "rgb(53, 162, 235)",
        borderWidth: 1,
      },
    ],
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
