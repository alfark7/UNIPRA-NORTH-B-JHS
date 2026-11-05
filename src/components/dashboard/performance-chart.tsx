
'use client';

import { useMemo, useState, useEffect } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from '@/components/ui/chart';
import { useCollection, useFirestore } from '@/firebase';
import { collection } from 'firebase/firestore';
import { subjects, type AcademicRecord, type SubjectScore } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { calculateScores } from '@/lib/grading';

const chartConfig = {
  average: {
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

export function PerformanceChart() {
  const firestore = useFirestore();
  const [scoreSettings, setScoreSettings] = useState(defaultScoreSettings);

  const academicRecordsQuery = useMemo(() => collection(firestore, 'academicRecords'), [firestore]);
  const { data: academicRecords, loading: recordsLoading } = useCollection<AcademicRecord>(academicRecordsQuery);

  useEffect(() => {
    const updateSettings = () => {
      const savedScoreSettings = localStorage.getItem('score-settings');
      if (savedScoreSettings) {
        try {
          setScoreSettings(JSON.parse(savedScoreSettings));
        } catch (error) {
          console.error("Failed to parse score settings from storage", error);
        }
      }
    };
    updateSettings();
    window.addEventListener('storage_change', updateSettings);
    return () => window.removeEventListener('storage_change', updateSettings);
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
      if (subjectScores.length === 0) return { subject, average: 0 };
      const averageScore = subjectScores.reduce((acc, score) => acc + score.total, 0) / subjectScores.length;
      return { subject: subject.slice(0, 10), average: Math.round(averageScore) };
    });
  }, [academicRecords, scoreSettings]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Class Performance</CardTitle>
        <CardDescription>Average scores by subject across all classes</CardDescription>
      </CardHeader>
      <CardContent>
        {recordsLoading ? <Skeleton className="h-[300px] w-full" /> : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <BarChart data={chartData} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="subject"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
              />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="average" fill="var(--color-average)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
