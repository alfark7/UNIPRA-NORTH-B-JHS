
'use client';

import { useState, useEffect, useMemo } from 'react';
import { ArrowUp, ArrowDown, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useCollection } from '@/firebase';
import { collection } from 'firebase/firestore';
import { subjects, type AcademicRecord } from '@/lib/types';
import type { SubjectScore } from '@/lib/types';
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

export function PerformanceSummary() {
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

    const analysisData = useMemo(() => {
        const allScores: { subject: string, total: number }[] = [];
        academicRecords.forEach(record => {
            record.scores.forEach(score => {
                const { total } = calculateScores(score, scoreSettings);
                allScores.push({ subject: score.subject, total });
            });
        });

        if (allScores.length === 0) {
            return {
                overallAverage: 0,
                passRate: 0,
                bestSubject: 'N/A',
                worstSubject: 'N/A'
            };
        }

        const overallAverage = allScores.reduce((acc, score) => acc + score.total, 0) / allScores.length;
        const passRate = (allScores.filter(s => s.total >= 50).length / allScores.length) * 100;

        const subjectAverages = subjects.map(subject => {
            const subjectScores = allScores.filter(s => s.subject === subject);
            if (subjectScores.length === 0) return { subject, average: 0 };
            const average = subjectScores.reduce((acc, score) => acc + score.total, 0) / subjectScores.length;
            return { subject, average };
        });

        subjectAverages.sort((a, b) => b.average - a.average);
        
        const bestSubject = subjectAverages[0]?.subject || 'N/A';
        const worstSubject = subjectAverages[subjectAverages.length - 1]?.subject || 'N/A';
        
        return {
            overallAverage: Math.round(overallAverage),
            passRate: Math.round(passRate),
            bestSubject,
            worstSubject
        };

    }, [academicRecords, scoreSettings]);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Average</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysisData.overallAverage}%</div>
            <p className="text-xs text-muted-foreground">Across all subjects and students</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysisData.passRate}%</div>
            <p className="text-xs text-muted-foreground">Students with average score &gt;= 50%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Best Performing Subject</CardTitle>
            <ArrowUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysisData.bestSubject}</div>
            <p className="text-xs text-muted-foreground">Highest average score</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Worst Performing Subject</CardTitle>
            <ArrowDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysisData.worstSubject}</div>
            <p className="text-xs text-muted-foreground">Lowest average score</p>
          </CardContent>
        </Card>
    </div>
  );
}
