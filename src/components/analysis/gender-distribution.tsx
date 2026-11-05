
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Pie, PieChart } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useFirestore, useCollection } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Student, SubjectScore, AcademicRecord } from '@/lib/types';
import { calculateScores } from '@/lib/grading';


const defaultScoreSettings = {
  test1: 100,
  test2: 100,
  groupWork: 50,
  project: 50,
  classExercises: 20,
  homeWork: 20,
  exam: 100,
};

export function GenderDistribution() {
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
        const maleStudents = students.filter(s => s.gender === 'Male').map(s => s.id);
        const femaleStudents = students.filter(s => s.gender === 'Female').map(s => s.id);
        
        const maleScores: number[] = [];
        const femaleScores: number[] = [];

        academicRecords.forEach(record => {
            if (maleStudents.includes(record.studentId)) {
                record.scores.forEach(score => maleScores.push(calculateScores(score, scoreSettings).total));
            } else if (femaleStudents.includes(record.studentId)) {
                 record.scores.forEach(score => femaleScores.push(calculateScores(score, scoreSettings).total));
            }
        });
        
        const maleAverage = maleScores.length > 0 ? maleScores.reduce((a, b) => a + b, 0) / maleScores.length : 0;
        const femaleAverage = femaleScores.length > 0 ? femaleScores.reduce((a, b) => a + b, 0) / femaleScores.length : 0;
        
        return [
            { gender: 'Male', averageScore: Math.round(maleAverage), fill: 'hsl(var(--chart-1))' },
            { gender: 'Female', averageScore: Math.round(femaleAverage), fill: 'hsl(var(--chart-3))' },
        ];
    }, [students, academicRecords, scoreSettings]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance by Gender</CardTitle>
        <CardDescription>Average scores for male and female students</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer config={{}} className="mx-auto aspect-square h-[250px]">
          <PieChart>
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="averageScore" />} />
            <Pie data={chartData} dataKey="averageScore" nameKey="gender" innerRadius={60} strokeWidth={5} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
