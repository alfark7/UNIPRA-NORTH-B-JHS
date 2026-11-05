
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirestore, useCollection } from '@/firebase';
import { collection } from 'firebase/firestore';
import { subjects, academicYears, terms } from '@/lib/types';
import type { Student, SubjectScore, AcademicRecord } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Printer, FileDown } from 'lucide-react';
import { exportToExcel } from '@/lib/excel';
import { calculateScores, getGrade } from '@/lib/grading';

const defaultScoreSettings = {
  test1: 100,
  test2: 100,
  groupWork: 50,
  project: 50,
  classExercises: 20,
  homeWork: 20,
  exam: 100,
};

type BroadsheetData = {
    studentId: string;
    studentName: string;
    admissionNumber: string;
    scores: { [subject: string]: number | null };
    totalScore: number;
    averageScore: number;
    aggregateScore: number | null;
    rank: number;
}[];

export function BroadsheetAnalysis() {
    const firestore = useFirestore();
    const studentsQuery = useMemo(() => collection(firestore, 'students'), [firestore]);
    const academicRecordsQuery = useMemo(() => collection(firestore, 'academicRecords'), [firestore]);

    const { data: students, loading: studentsLoading } = useCollection<Student>(studentsQuery);
    const { data: allAcademicRecords, loading: recordsLoading } = useCollection<AcademicRecord>(academicRecordsQuery);
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [selectedStream, setSelectedStream] = useState<string>('');
    const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('');
    const [selectedTerm, setSelectedTerm] = useState<number | null>(null);
    const [showBroadsheet, setShowBroadsheet] = useState(false);
    const [broadsheetData, setBroadsheetData] = useState<BroadsheetData>([]);
    const [scoreSettings, setScoreSettings] = useState(defaultScoreSettings);

    const { toast } = useToast();

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

    const classLevels = useMemo(() => Array.from(new Set(students.map(s => s.class))), [students]);
    const streams = useMemo(() => Array.from(new Set(students.map(s => s.stream).filter(Boolean))) as string[], [students]);


    const handleGenerateBroadsheet = () => {
        if (!selectedClass || !selectedTerm || !selectedAcademicYear) {
            toast({
                variant: 'destructive',
                title: 'Selection Incomplete',
                description: 'Please select a class, academic year, and a term.',
            });
            return;
        }

        const filteredStudents = students.filter(s =>
            s.class === selectedClass &&
            ((!selectedStream || selectedStream === 'all') ? true : s.stream === selectedStream)
        );

        if (filteredStudents.length === 0) {
            toast({
                title: 'No Students Found',
                description: 'No students match the selected class and stream.',
            });
            setBroadsheetData([]);
            setShowBroadsheet(true);
            return;
        }

        const studentScores = filteredStudents.map(student => {
            const studentRecord = allAcademicRecords.find(r => r.studentId === student.id && r.academicYear === selectedAcademicYear && r.term === selectedTerm);
            const subjectScores: { [subject: string]: number | null } = {};
            let totalScore = 0;
            let subjectsWithScores = 0;

            subjects.forEach(subject => {
                const score = studentRecord?.scores.find(s => s.subject === subject);
                if (score) {
                    const { total } = calculateScores(score, scoreSettings);
                    subjectScores[subject] = total;
                    totalScore += total;
                    subjectsWithScores++;
                } else {
                    subjectScores[subject] = null;
                }
            });
            
            const averageScore = subjectsWithScores > 0 ? totalScore / subjectsWithScores : 0;
            
            const coreSubjects = ['Mathematics', 'English', 'Science', 'Social Studies'];
            const scoresWithGrades = studentRecord?.scores
                .map(score => {
                    const { total } = calculateScores(score, scoreSettings);
                    const grade = getGrade(total);
                    const gradeNum = grade ? parseInt(grade, 10) : Infinity;
                    return { subject: score.subject, grade: gradeNum };
                })
                .filter(s => s && !isNaN(s.grade) && s.grade !== Infinity) || [];

            const coreSubjectGrades = scoresWithGrades.filter(s => coreSubjects.includes(s.subject!));
            const otherSubjectGrades = scoresWithGrades.filter(s => !coreSubjects.includes(s.subject!));
    
            otherSubjectGrades.sort((a, b) => a.grade - b.grade);
    
            const bestTwoOtherGrades = otherSubjectGrades.slice(0, 2);
            
            const allGradesForAggregate = [...coreSubjectGrades, ...bestTwoOtherGrades];
    
            let aggregateScore: number | null = null;
            if (allGradesForAggregate.length >= 6) {
                aggregateScore = allGradesForAggregate.reduce((sum, s) => sum + s.grade, 0);
            }

            return {
                studentId: student.id,
                studentName: `${student.firstName} ${student.lastName}`,
                admissionNumber: student.admissionNumber,
                scores: subjectScores,
                totalScore,
                averageScore: Math.round(averageScore),
                aggregateScore
            };
        });

        const sortedStudents = studentScores.sort((a, b) => b.totalScore - a.totalScore);
        
        const rankedData = sortedStudents.map((student, index) => ({
            ...student,
            rank: index + 1,
        }));

        setBroadsheetData(rankedData);
        setShowBroadsheet(true);
    };

    const handlePrint = () => {
        window.print();
    };

    const handleExport = () => {
        const dataForExport = broadsheetData.map(d => ({
            Rank: d.rank,
            'Student Name': d.studentName,
            'Admission No': d.admissionNumber,
            ...d.scores,
            'Total Score': d.totalScore,
            'Average Score': d.averageScore,
            'Aggregate Score': d.aggregateScore,
        }));
        exportToExcel(dataForExport, `broadsheet_${selectedClass}_${selectedStream || 'all'}_term_${selectedTerm}`);
        toast({ title: 'Export Successful', description: 'Broadsheet data has been exported to Excel.' });
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Broadsheet Analysis</CardTitle>
                <CardDescription>Generate a broadsheet for a specific class, stream, academic year and term.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <div>
                        <Label htmlFor="class-select-broadsheet">Class</Label>
                        <Select value={selectedClass} onValueChange={setSelectedClass}>
                            <SelectTrigger id="class-select-broadsheet"><SelectValue placeholder="Select class" /></SelectTrigger>
                            <SelectContent>{classLevels.map((level) => <SelectItem key={level} value={level}>{level}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="stream-select-broadsheet">Stream</Label>
                        <Select value={selectedStream} onValueChange={setSelectedStream} disabled={!selectedClass}>
                            <SelectTrigger id="stream-select-broadsheet"><SelectValue placeholder="Select stream (optional)" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Streams</SelectItem>
                                {streams.map((stream) => <SelectItem key={stream} value={stream}>{stream}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="academic-year-select-broadsheet">Academic Year</Label>
                        <Select value={selectedAcademicYear} onValueChange={setSelectedAcademicYear}>
                            <SelectTrigger id="academic-year-select-broadsheet"><SelectValue placeholder="Select Year" /></SelectTrigger>
                            <SelectContent>{academicYears.map((year) => <SelectItem key={year} value={year}>{year}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                     <div>
                        <Label htmlFor="term-select-broadsheet">Term</Label>
                        <Select value={selectedTerm?.toString() || ''} onValueChange={(val) => setSelectedTerm(Number(val))}>
                            <SelectTrigger id="term-select-broadsheet"><SelectValue placeholder="Select term" /></SelectTrigger>
                            <SelectContent>{terms.map((term) => <SelectItem key={term} value={term.toString()}>Term {term}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </div>
                <Button onClick={handleGenerateBroadsheet}>Generate Broadsheet</Button>
            </CardContent>

            {showBroadsheet && (
                <CardFooter className="flex-col items-start gap-4">
                     <div className="w-full flex justify-between items-center print:hidden">
                        <h3 className="text-lg font-semibold">
                            Broadsheet for {selectedClass} {!selectedStream || selectedStream === 'all' ? 'All Streams' : selectedStream} - {selectedAcademicYear} Term {selectedTerm}
                        </h3>
                        <div className="flex gap-2">
                             <Button variant="outline" onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Print</Button>
                            <Button variant="outline" onClick={handleExport}><FileDown className="mr-2 h-4 w-4" /> Export to Excel</Button>
                        </div>
                    </div>
                    <div className="w-full overflow-x-auto printable-report">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Rank</TableHead>
                                    <TableHead>Student Name</TableHead>
                                    <TableHead>Adm. No</TableHead>
                                    {subjects.map(subject => <TableHead key={subject} className="text-center">{subject.replace(/ and /g, ' & ').replace(/Religious|Moral|Studies/g, (match) => match[0])}</TableHead>)}
                                    <TableHead className="text-center font-bold">Total</TableHead>
                                    <TableHead className="text-center font-bold">Average</TableHead>
                                    <TableHead className="text-center font-bold">Aggregate</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {broadsheetData.length > 0 ? broadsheetData.map(row => (
                                    <TableRow key={row.studentId}>
                                        <TableCell className="font-bold">{row.rank}</TableCell>
                                        <TableCell>{row.studentName}</TableCell>
                                        <TableCell>{row.admissionNumber}</TableCell>
                                        {subjects.map(subject => (
                                            <TableCell key={subject} className="text-center">
                                                {row.scores[subject] ?? '-'}
                                            </TableCell>
                                        ))}
                                        <TableCell className="text-center font-bold">{row.totalScore}</TableCell>
                                        <TableCell className="text-center font-bold">{row.averageScore}</TableCell>
                                        <TableCell className="text-center font-bold">{row.aggregateScore ?? 'N/A'}</TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={subjects.length + 6} className="text-center text-muted-foreground">
                                            No data to display.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardFooter>
            )}
        </Card>
    )
}
