
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
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { exportGradeAnalysisToExcel } from '@/lib/excel';
import { getGrade, calculateScores } from '@/lib/grading';

const defaultScoreSettings = {
  test1: 100,
  test2: 100,
  groupWork: 50,
  project: 50,
  classExercises: 20,
  homeWork: 20,
  exam: 100,
};

type GradeDistribution = {
    [subject: string]: {
        gradeCounts: { [grade: string]: number };
        totalMarks: number;
        totalCandidates: number;
    };
};

export function GradeDistributionAnalysis() {
    const firestore = useFirestore();
    const studentsQuery = useMemo(() => collection(firestore, 'students'), [firestore]);
    const academicRecordsQuery = useMemo(() => collection(firestore, 'academicRecords'), [firestore]);

    const { data: students, loading: studentsLoading } = useCollection<Student>(studentsQuery);
    const { data: allAcademicRecords, loading: recordsLoading } = useCollection<AcademicRecord>(academicRecordsQuery);
    
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [selectedStream, setSelectedStream] = useState<string>('');
    const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('');
    const [selectedTerm, setSelectedTerm] = useState<number | null>(null);
    const [showAnalysis, setShowAnalysis] = useState(false);
    const [analysisData, setAnalysisData] = useState<GradeDistribution | null>(null);
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

    const handleGenerateAnalysis = () => {
        if (!selectedClass || !selectedTerm || !selectedAcademicYear) {
            toast({
                variant: 'destructive',
                title: 'Selection Incomplete',
                description: 'Please select a class, academic year and a term.',
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
            setAnalysisData(null);
            setShowAnalysis(true);
            return;
        }
        
        const studentIds = filteredStudents.map(s => s.id);
        const termRecords = allAcademicRecords.filter(r => studentIds.includes(r.studentId) && r.academicYear === selectedAcademicYear && r.term === selectedTerm);

        const data: GradeDistribution = subjects.reduce((acc, subject) => {
            acc[subject] = {
                gradeCounts: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0 },
                totalMarks: 0,
                totalCandidates: 0,
            };
            return acc;
        }, {} as GradeDistribution);

        termRecords.forEach(record => {
            record.scores.forEach(score => {
                if (subjects.includes(score.subject)) {
                    const { total } = calculateScores(score, scoreSettings);
                    const grade = getGrade(total);

                    if (grade) {
                        data[score.subject].gradeCounts[grade]++;
                    }
                    data[score.subject].totalMarks += total;
                    if(score.exam || score.test1 || score.test2) {
                        data[score.subject].totalCandidates++;
                    }
                }
            });
        });

        setAnalysisData(data);
        setShowAnalysis(true);
    };
    
    const grades = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

    const summaryData = useMemo(() => {
        if (!analysisData) return null;

        const summary: { [subject: string]: any } = {};

        subjects.forEach(subject => {
            const subjectData = analysisData[subject];
            if (subjectData) {
                const grade1to6 = grades.slice(0, 6).reduce((acc, grade) => acc + subjectData.gradeCounts[grade], 0);
                const grade7to9 = grades.slice(6, 9).reduce((acc, grade) => acc + subjectData.gradeCounts[grade], 0);
                
                summary[subject] = {
                    totalMarks: subjectData.totalMarks,
                    grade1to6,
                    numGrade1: subjectData.gradeCounts['1'],
                    grade7to9,
                    percentage: subjectData.totalCandidates > 0 ? Math.round((grade1to6 / subjectData.totalCandidates) * 100) : 0,
                    totalCandidates: subjectData.totalCandidates
                };
            }
        });
        return summary;

    }, [analysisData]);


    const handlePrint = () => {
        window.print();
    };

    const handleExportExcel = () => {
        if (!analysisData || !summaryData) {
            toast({
                variant: 'destructive',
                title: 'Export Failed',
                description: 'Please generate the analysis first.',
            });
            return;
        }
    
        const gradeCountData = grades.map(grade => {
            const row: { [key: string]: any } = { 'GRADE COUNT': `GRADE ${grade}` };
            subjects.forEach(subject => {
                row[shortSubjectName(subject)] = analysisData[subject]?.gradeCounts[grade] ?? 0;
            });
            return row;
        });
        gradeCountData.push({
            'GRADE COUNT': 'TOTAL',
            ...subjects.reduce((acc, subject) => {
                acc[shortSubjectName(subject)] = analysisData[subject]?.totalCandidates ?? 0;
                return acc;
            }, {} as { [key: string]: number })
        });
    
        const statsData = [
            { STATISTICS: 'TOTAL MARK', ...subjects.reduce((acc, s) => { acc[shortSubjectName(s)] = summaryData[s]?.totalMarks; return acc; }, {} as any) },
            { STATISTICS: 'GRADE 1-6 (PASS)', ...subjects.reduce((acc, s) => { acc[shortSubjectName(s)] = summaryData[s]?.grade1to6; return acc; }, {} as any) },
            { STATISTICS: 'NO. OF GRADE 1s', ...subjects.reduce((acc, s) => { acc[shortSubjectName(s)] = summaryData[s]?.numGrade1; return acc; }, {} as any) },
            { STATISTICS: 'GRADE 7-9 (FAIL)', ...subjects.reduce((acc, s) => { acc[shortSubjectName(s)] = summaryData[s]?.grade7to9; return acc; }, {} as any) },
            { STATISTICS: 'PASS PERCENTAGE (%)', ...subjects.reduce((acc, s) => { acc[shortSubjectName(s)] = summaryData[s]?.percentage; return acc; }, {} as any) },
            { STATISTICS: 'TOTAL CANDIDATES', ...subjects.reduce((acc, s) => { acc[shortSubjectName(s)] = summaryData[s]?.totalCandidates; return acc; }, {} as any) },
        ];
        
        exportGradeAnalysisToExcel(
            gradeCountData,
            statsData,
            `Grade-Analysis-${selectedClass}-${selectedStream || 'all'}-Term-${selectedTerm}`
        );
    
        toast({
            title: 'Export Successful',
            description: 'Grade analysis has been exported to Excel.',
        });
    };

    const handleExportPdf = () => {
        const reportElement = document.querySelector('.printable-report');
        if (!reportElement) {
            toast({
                variant: 'destructive',
                title: 'Export Failed',
                description: 'Please generate a report before exporting.',
            });
            return;
        }

        html2canvas(reportElement as HTMLElement, {
            scale: 2,
            useCORS: true,
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'l',
                unit: 'mm',
                format: 'a3'
            });
    
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgProps = pdf.getImageProperties(imgData);

            const margin = 10; // 10mm margin
            const effectiveWidth = pdfWidth - (margin * 2);
            const effectiveHeight = pdfHeight - (margin * 2);

            const ratio = Math.min(effectiveWidth / imgProps.width, effectiveHeight / imgProps.height);
            
            const imgFinalWidth = imgProps.width * ratio;
            const imgFinalHeight = imgProps.height * ratio;

            const x = (pdfWidth - imgFinalWidth) / 2;
            const y = (pdfHeight - imgFinalHeight) / 2;
    
            pdf.addImage(imgData, 'PNG', x, y, imgFinalWidth, imgFinalHeight);
            pdf.save(`Grade-Analysis-${selectedClass}-${selectedStream || 'all'}-Term-${selectedTerm}.pdf`);
        }).catch(err => {
            console.error("Could not generate PDF", err);
            toast({
                variant: "destructive",
                title: "Export Failed",
                description: "An error occurred while exporting the report to PDF.",
            });
        });
    };

    const shortSubjectName = (subject: string) => {
        const mapping: { [key: string]: string } = {
            'Mathematics': 'MATHS',
            'English': 'ENGLISH',
            'Science': 'SCIENCE',
            'Social Studies': 'SOC. STUD.',
            'Computing': 'COMPUTING',
            'Ghanaian Language': 'GH. LANG.',
            'Creative Art': 'C. ART',
            'Career Technology': 'C. TECH',
            'French': 'FRENCH',
            'Religious and Moral Studies': 'RME',
        };
        return mapping[subject] || subject;
    }


    return (
        <Card>
            <CardHeader>
                <CardTitle>Grade Distribution Analysis</CardTitle>
                <CardDescription>Generate a summary of grade distribution for a specific class, academic year, and term.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <div>
                        <Label htmlFor="class-select-dist">Class</Label>
                        <Select value={selectedClass} onValueChange={setSelectedClass}>
                            <SelectTrigger id="class-select-dist"><SelectValue placeholder="Select class" /></SelectTrigger>
                            <SelectContent>{classLevels.map((level) => <SelectItem key={level} value={level}>{level}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="stream-select-dist">Stream</Label>
                        <Select value={selectedStream} onValueChange={setSelectedStream} disabled={!selectedClass}>
                            <SelectTrigger id="stream-select-dist"><SelectValue placeholder="Select stream (optional)" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Streams</SelectItem>
                                {streams.map((stream) => <SelectItem key={stream} value={stream}>{stream}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                     <div>
                        <Label htmlFor="academic-year-select-dist">Academic Year</Label>
                        <Select value={selectedAcademicYear} onValueChange={setSelectedAcademicYear}>
                            <SelectTrigger id="academic-year-select-dist"><SelectValue placeholder="Select Year" /></SelectTrigger>
                            <SelectContent>{academicYears.map((year) => <SelectItem key={year} value={year}>{year}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                     <div>
                        <Label htmlFor="term-select-dist">Term</Label>
                        <Select value={selectedTerm?.toString() || ''} onValueChange={(val) => setSelectedTerm(Number(val))}>
                            <SelectTrigger id="term-select-dist"><SelectValue placeholder="Select term" /></SelectTrigger>
                            <SelectContent>{terms.map((term) => <SelectItem key={term} value={term.toString()}>Term {term}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </div>
                <Button onClick={handleGenerateAnalysis}>Generate Analysis</Button>
            </CardContent>

            {showAnalysis && (
                <CardFooter className="flex-col items-start gap-4">
                     <div className="w-full flex justify-between items-center print:hidden">
                        <h3 className="text-lg font-semibold">
                            Grade Analysis for {selectedClass} {!selectedStream || selectedStream === 'all' ? '' : selectedStream} - {selectedAcademicYear} Term {selectedTerm}
                        </h3>
                        <div className="flex gap-2">
                             <Button variant="outline" onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Print</Button>
                             <Button variant="outline" onClick={handleExportExcel}><FileDown className="mr-2 h-4 w-4" /> Export to Excel</Button>
                             <Button variant="outline" onClick={handleExportPdf}><FileDown className="mr-2 h-4 w-4" /> Export to PDF</Button>
                        </div>
                    </div>
                    {analysisData ? (
                    <div className="w-full overflow-x-auto printable-report space-y-8">
                        <div>
                            <h4 className="font-bold text-center mb-2">ANALYSIS</h4>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>GRADE COUNT</TableHead>
                                        {subjects.map(subject => <TableHead key={subject} className="text-center">{shortSubjectName(subject)}</TableHead>)}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {grades.map(grade => (
                                        <TableRow key={grade}>
                                            <TableCell className="font-medium">GRADE {grade}</TableCell>
                                            {subjects.map(subject => (
                                                <TableCell key={subject} className="text-center">
                                                    {analysisData[subject]?.gradeCounts[grade] ?? 0}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                    <TableRow className="font-bold bg-muted">
                                        <TableCell>TOTAL</TableCell>
                                        {subjects.map(subject => (
                                             <TableCell key={subject} className="text-center">
                                                {analysisData[subject]?.totalCandidates ?? 0}
                                             </TableCell>
                                        ))}
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                        
                        {summaryData && (
                        <div>
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>STATISTICS</TableHead>
                                        {subjects.map(subject => <TableHead key={subject} className="text-center">{shortSubjectName(subject)}</TableHead>)}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow>
                                        <TableCell className="font-medium">TOTAL MARK</TableCell>
                                        {subjects.map(s => <TableCell key={s} className="text-center">{summaryData[s]?.totalMarks}</TableCell>)}
                                    </TableRow>
                                     <TableRow>
                                        <TableCell className="font-medium">GRADE 1-6 (PASS)</TableCell>
                                        {subjects.map(s => <TableCell key={s} className="text-center">{summaryData[s]?.grade1to6}</TableCell>)}
                                    </TableRow>
                                     <TableRow>
                                        <TableCell className="font-medium">NO. OF GRADE 1s</TableCell>
                                        {subjects.map(s => <TableCell key={s} className="text-center">{summaryData[s]?.numGrade1}</TableCell>)}
                                    </TableRow>
                                     <TableRow>
                                        <TableCell className="font-medium">GRADE 7-9 (FAIL)</TableCell>
                                        {subjects.map(s => <TableCell key={s} className="text-center">{summaryData[s]?.grade7to9}</TableCell>)}
                                    </TableRow>
                                     <TableRow>
                                        <TableCell className="font-medium">PASS PERCENTAGE (%)</TableCell>
                                        {subjects.map(s => <TableCell key={s} className="text-center">{summaryData[s]?.percentage}%</TableCell>)}
                                    </TableRow>
                                     <TableRow className="font-bold bg-muted">
                                        <TableCell>TOTAL CANDIDATES</TableCell>
                                        {subjects.map(s => <TableCell key={s} className="text-center">{summaryData[s]?.totalCandidates}</TableCell>)}
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                        )}
                    </div>
                    ) : (
                        <div className="text-center text-muted-foreground py-8">
                            No analysis data to display for the selected criteria.
                        </div>
                    )}
                </CardFooter>
            )}
        </Card>
    )
}
