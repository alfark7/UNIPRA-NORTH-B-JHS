
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
import { useFirestore, useCollection } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Student, SubjectScore, AcademicRecord } from '@/lib/types';
import { calculateScores } from '@/lib/grading';

const chartConfig = {
  averageScore: {
    label: 'Average Score',
    color: 'hsl(var(--chart-2))',
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

export function ClassComparison() {
    const firestore = useFirestore();
    const [scoreSettings, setScoreSettings] = useState(defaultScoreSettings);

    const studentsQuery = useMemo(() => collection(firestore, 'students'), [firestore]);
    const academicRecordsQuery = useMemo(() => collection(firestore, 'academicRecords'), [firestore]);

    const { data: students, loading: studentsLoading } = useCollection<Student>(studentsQuery);
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
        const classLevels = Array.from(new Set(students.map(s => s.class)));

        return classLevels.map(classLevel => {
            const classStudents = students.filter(s => s.class === classLevel);
            const studentIds = classStudents.map(s => s.id);
            
            const classScores: number[] = [];
            academicRecords.forEach(record => {
                if (studentIds.includes(record.studentId)) {
                    record.scores.forEach(score => {
                        const { total } = calculateScores(score, scoreSettings);
                        classScores.push(total);
                    });
                }
            });

            const averageScore = classScores.length > 0
                ? classScores.reduce((acc, score) => acc + score, 0) / classScores.length
                : 0;

            return { class: classLevel, averageScore: Math.round(averageScore) };
        });
    }, [students, academicRecords, scoreSettings]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Class Performance Comparison</CardTitle>
        <CardDescription>Average scores for each class level</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart data={chartData} layout="vertical" accessibilityLayer>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" />
            <YAxis dataKey="class" type="category" tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="averageScore" fill="var(--color-averageScore)" radius={4} layout="vertical" />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
