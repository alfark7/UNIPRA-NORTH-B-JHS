
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Trophy, Medal } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useCollection } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Student, AcademicRecord } from '@/lib/types';
import { calculateScores } from '@/lib/grading';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const defaultScoreSettings = {
  test1: 100,
  test2: 100,
  groupWork: 50,
  project: 50,
  classExercises: 20,
  homeWork: 20,
  exam: 100,
};

export function TopStudents() {
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

    const topStudents = useMemo(() => {
        if (students.length === 0 || academicRecords.length === 0) return [];

        const studentAverages = students.map(student => {
            const studentRecords = academicRecords.filter(r => r.studentId === student.id);
            if (studentRecords.length === 0) return { ...student, average: 0 };

            let totalScore = 0;
            let totalSubjects = 0;

            studentRecords.forEach(record => {
                record.scores.forEach(score => {
                    const { total } = calculateScores(score, scoreSettings);
                    totalScore += total;
                    totalSubjects++;
                });
            });

            const average = totalSubjects > 0 ? totalScore / totalSubjects : 0;
            return { ...student, average: Math.round(average) };
        });

        return studentAverages
            .sort((a, b) => b.average - a.average)
            .slice(0, 5);
    }, [students, academicRecords, scoreSettings]);

    if (studentsLoading || recordsLoading) {
        return <Card className="h-[400px] flex items-center justify-center">Loading...</Card>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Top Performing Students
                </CardTitle>
                <CardDescription>Top 5 students based on overall average across all terms</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {topStudents.length > 0 ? topStudents.map((student, index) => (
                        <div key={student.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={student.avatar} alt={student.firstName} />
                                        <AvatarFallback>{student.firstName[0]}{student.lastName[0]}</AvatarFallback>
                                    </Avatar>
                                    {index < 3 && (
                                        <div className="absolute -top-1 -right-1 bg-background rounded-full p-0.5">
                                            <Medal className={`h-4 w-4 ${
                                                index === 0 ? 'text-yellow-500' : 
                                                index === 1 ? 'text-slate-400' : 
                                                'text-amber-600'
                                            }`} />
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <p className="text-sm font-medium leading-none">{student.firstName} {student.lastName}</p>
                                    <p className="text-xs text-muted-foreground">{student.class} {student.stream}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold">{student.average}%</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Average</p>
                            </div>
                        </div>
                    )) : (
                        <p className="text-center text-muted-foreground py-8">No performance data available yet.</p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
