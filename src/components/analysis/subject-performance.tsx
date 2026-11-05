
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
import { useFirestore, useCollection } from '@/firebase';
import { collection } from 'firebase/firestore';
import { subjects, type AcademicRecord } from '@/lib/types';
import type { SubjectScore } from '@/lib/types';
import { calculateScores } from '@/lib/grading';

const chartConfig = {
  averageScore: {
    label: 'Average Score',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig;

const defaultScoreSettings = {
  test1: 100,
  test2: 100,
  groupWork: 50,
  project: 50,
  classExercises: 20,
  homeWork: 20,
  exam: 100,
};

export function SubjectPerformance() {
    const firestore = useFirestore();
    const [scoreSettings, setScoreSettings] = useState(defaultScoreSettings);
    
    const academicRecordsQuery = useMemo(() => collection(firestore, 'academicRecords'), [firestore]);
    const { data: academicRecords, loading: recordsLoading } = useCollection<AcademicRecord>(academicRecordsQuery);

    useEffect(() => {
        const updateData = () => {
            const savedScoreSettings = localStorage.getItem('score-settings');
            if (savedScoreSettings) {
                try {
                    setScoreSettings(JSON.parse(savedScoreSettings));
                } catch (error) {
                    console.error("Failed to parse score settings from storage", error);
                }
            }
        };
        updateData();
        window.addEventListener('storage_change', updateData);
        return () => window.removeEventListener('storage_change', updateData);
    }, []);

    const chartData = useMemo(() => {
        const allScores: { subject: string, total: number }[] = [];
        academicRecords.forEach(record => {
            record.scores.forEach(score => {
                const { total } = calculateScores(score, scoreSettings);
                allScores.push({ subject: score.subject, total });
            });
        });

        return subjects.map(subject => {
            const subjectScores = allScores.filter(s => s.subject === subject);
            if (subjectScores.length === 0) return { subject, averageScore: 0 };
            const averageScore = subjectScores.reduce((acc, score) => acc + score.total, 0) / subjectScores.length;
            return { subject, averageScore: Math.round(averageScore) };
        });
    }, [academicRecords, scoreSettings]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subject Performance</CardTitle>
        <CardDescription>Average scores by subject across all classes</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart data={chartData} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="subject"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <YAxis />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="averageScore" fill="var(--color-averageScore)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
