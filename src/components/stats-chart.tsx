"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { TeamPoints } from "@/app/actions/stats"
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js"
import { Bar } from "react-chartjs-2"

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface StatsChartProps {
  data: TeamPoints[]
  totalPossibleXP: number
  title: string
}

export function StatsChart({ data, totalPossibleXP, title }: StatsChartProps) {
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
          label: (context: any) => `XP: ${Math.round(context.parsed.y)}`,
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
          callback: (value: number) => Math.round(value),
        },
      },
    },
  }

  const chartData = {
    labels: data.map((item) => item.name),
    datasets: [
      {
        data: data.map((item) => item.xp),
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
      <CardContent className="h-[300px]">
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


