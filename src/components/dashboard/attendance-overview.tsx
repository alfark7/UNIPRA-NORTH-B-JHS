
"use client"

import { useMemo } from "react";
import { TrendingUp } from "lucide-react"
import { Pie, PieChart } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Skeleton } from "../ui/skeleton";
import type { Attendance } from "@/lib/types";

interface AttendanceOverviewProps {
    attendance: Attendance[];
    totalStudents: number;
    loading: boolean;
}

export function AttendanceOverview({ attendance, totalStudents, loading }: AttendanceOverviewProps) {
  const chartData = useMemo(() => {
    if (totalStudents === 0) {
        return [
            { status: "Present", value: 0, fill: "hsl(var(--chart-1))" },
            { status: "Absent", value: 0, fill: "hsl(var(--destructive))" },
            { status: "Late", value: 0, fill: "hsl(var(--chart-4))" },
        ];
    }
    const presentCount = attendance.filter(att => att.status === 'Present').length;
    const lateCount = attendance.filter(att => att.status === 'Late').length;
    const absentCount = totalStudents - presentCount - lateCount;

    return [
      { status: "Present", value: presentCount, fill: "hsl(var(--chart-1))" },
      { status: "Absent", value: absentCount, fill: "hsl(var(--destructive))" },
      { status: "Late", value: lateCount, fill: "hsl(var(--chart-4))" },
    ]
  }, [attendance, totalStudents]);


  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>Attendance Overview</CardTitle>
        <CardDescription>Today's attendance summary</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        {loading ? <Skeleton className="h-[200px] w-[200px] rounded-full mx-auto" /> : (
            <ChartContainer
            config={{}}
            className="mx-auto aspect-square h-[200px]"
            >
            <PieChart>
                <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
                />
                <Pie
                data={chartData}
                dataKey="value"
                nameKey="status"
                innerRadius={60}
                strokeWidth={5}
                />
            </PieChart>
            </ChartContainer>
        )}
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 font-medium leading-none">
          Attendance is up by 5% this month <TrendingUp className="h-4 w-4" />
        </div>
        <div className="leading-none text-muted-foreground">
          Showing total attendance for today
        </div>
      </CardFooter>
    </Card>
  )
}
