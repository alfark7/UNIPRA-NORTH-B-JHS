'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, useCollection } from '@/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { Student, SubjectScore, GenerateStudentRemarksOutput, AcademicRecord, Attendance } from '@/lib/types';
import { subjects, academicYears, terms } from '@/lib/types';
import { calculateScores } from '@/lib/grading';
import { RemarkGenerator } from '@/components/ai/remark-generator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Printer, FileDown, Users, Search, Award, CheckCircle2, AlertCircle, ArrowLeft, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { EditableRemark } from '@/components/editable-remark';
import { conductOptions, interestOptions, teacherRemarkOptions } from '@/lib/remarks-options';
import { StudentReportCard } from '@/components/reports/student-report-card';

const defaultScoreSettings = {
  test1: 100,
  test2: 100,
  groupWork: 50,
  project: 50,
  classExercises: 20,
  homeWork: 20,
  exam: 100,
};

export default function ReportsPage() {
    const firestore = useFirestore();

    const studentsQuery = useMemo(() => collection(firestore, 'students'), [firestore]);
    const academicRecordsQuery = useMemo(() => collection(firestore, 'academicRecords'), [firestore]);
    const attendanceQuery = useMemo(() => collection(firestore, 'attendance'), [firestore]);
    
    const { data: students, setData: setStudents, loading: studentsLoading } = useCollection<Student>(studentsQuery);
    const { data: allAcademicRecords, loading: recordsLoading } = useCollection<AcademicRecord>(academicRecordsQuery);
    const { data: allAttendanceRecords, loading: attendanceLoading } = useCollection<Attendance>(attendanceQuery);

    const [selectedClass, setSelectedClass] = useState<string>('');
    const [selectedStream, setSelectedStream] = useState<string>('');
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>(academicYears[0] || '2024/2025');
    const [selectedTerm, setSelectedTerm] = useState<number | null>(1);
    
    // View mode: single student or stream batch reports
    const [reportViewMode, setReportViewMode] = useState<'single' | 'stream_batch'>('single');
    const [showReport, setShowReport] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    const [batchSearchQuery, setBatchSearchQuery] = useState('');

    const [schoolName, setSchoolName] = useState('University Practice Junior High School');
    const [vacationDate, setVacationDate] = useState<Date | undefined>();
    const [reopeningDate, setReopeningDate] = useState<Date | undefined>();
    const [headTeacherName, setHeadTeacherName] = useState('');
    const [headTeacherSignature, setHeadTeacherSignature] = useState<string | null>(null);
    const [scoreSettings, setScoreSettings] = useState(defaultScoreSettings);

    const defaultSchoolLogo = PlaceHolderImages.find(img => img.id === 'school_logo');
    const [schoolLogoUrl, setSchoolLogoUrl] = useState(defaultSchoolLogo?.imageUrl || '');

    const { toast } = useToast();

    useEffect(() => {
        const updateSettings = () => {
            const savedSchoolName = localStorage.getItem('school-name');
            if (savedSchoolName) setSchoolName(savedSchoolName);

            const savedVacationDate = localStorage.getItem('vacation-date');
            if (savedVacationDate) setVacationDate(new Date(savedVacationDate));

            const savedReopeningDate = localStorage.getItem('reopening-date');
            if (savedReopeningDate) setReopeningDate(new Date(savedReopeningDate));
            
            const savedHeadTeacherName = localStorage.getItem('head-teacher-name');
            if (savedHeadTeacherName) setHeadTeacherName(savedHeadTeacherName);

            const savedSignature = localStorage.getItem('head-teacher-signature');
            if (savedSignature) setHeadTeacherSignature(savedSignature);

            const savedLogo = localStorage.getItem('school-logo');
            if (savedLogo) setSchoolLogoUrl(savedLogo);

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

        return () => {
            window.removeEventListener('storage_change', updateSettings);
        };
    }, []);

    // Unique class levels
    const classLevels = useMemo(() => {
        const levels = Array.from(new Set(students.map(s => s.class).filter(Boolean)));
        return levels.sort();
    }, [students]);

    // Available streams
    const availableStreams = useMemo(() => {
        const rawStreams = Array.from(new Set(students.map(s => s.stream).filter(Boolean))) as string[];
        if (rawStreams.length > 0) return rawStreams.sort();
        return ['A', 'B', 'C'];
    }, [students]);

    // Students matching selected class and stream
    const filteredStudents = useMemo(() => {
        return students.filter(s => 
            (!selectedClass || selectedClass === 'ALL_CLASSES' || s.class === selectedClass) &&
            (!selectedStream || s.stream === selectedStream)
        );
    }, [selectedClass, selectedStream, students]);

    // All students in the selected stream (for stream-wide batch reporting)
    const streamStudents = useMemo(() => {
        if (!selectedStream) return [];
        return students.filter(s => 
            (!selectedClass || selectedClass === 'ALL_CLASSES' || s.class === selectedClass) &&
            (s.stream === selectedStream || (!s.stream && selectedStream === 'A'))
        );
    }, [students, selectedClass, selectedStream]);

    const selectedStudent = useMemo(() => {
        if (!selectedStudentId || selectedStudentId === 'ALL_STREAM') return null;
        return students.find(s => s.id === selectedStudentId);
    }, [selectedStudentId, students]);

    // Helper to calculate best-six aggregate for an academic record
    const calculateAggregateForRecord = (record: AcademicRecord | undefined) => {
        if (!record || !record.scores || record.scores.length === 0) return null;
        const coreSubjects = ['Mathematics', 'English', 'Science', 'Social Studies'];

        const scoresWithGrades = record.scores
            .map(score => {
                const { grade } = calculateScores(score, scoreSettings);
                const gradeNum = grade ? parseInt(grade, 10) : Infinity;
                return { subject: score.subject, grade: gradeNum };
            })
            .filter(s => !isNaN(s.grade) && s.grade !== Infinity);

        const coreSubjectGrades = scoresWithGrades.filter(s => 
            coreSubjects.some(cs => s.subject?.toLowerCase().includes(cs.toLowerCase()))
        );
        const otherSubjectGrades = scoresWithGrades.filter(s => 
            !coreSubjects.some(cs => s.subject?.toLowerCase().includes(cs.toLowerCase()))
        );

        otherSubjectGrades.sort((a, b) => a.grade - b.grade);
        const bestTwoOtherGrades = otherSubjectGrades.slice(0, 2);

        const allGradesForAggregate = [...coreSubjectGrades, ...bestTwoOtherGrades];
        if (allGradesForAggregate.length < 6) return null;

        return allGradesForAggregate.reduce((sum, s) => sum + s.grade, 0);
    };

    // Precalculate cohort statistics and individual student rankings in stream
    const streamCohortStats = useMemo(() => {
        if (!selectedStream || !selectedAcademicYear || !selectedTerm) {
            return {
                rankMap: new Map<string, { position: number | null; totalScore: number; maxScore: number; record?: AcademicRecord; aggregate: number | null }>(),
                studentsWithRecordsCount: 0,
                averageTotalScore: 0,
                highestTotalScore: 0,
                averageAggregate: 'N/A',
            };
        }

        const cohort = streamStudents;
        const rankMap = new Map<string, { position: number | null; totalScore: number; maxScore: number; record?: AcademicRecord; aggregate: number | null }>();
        const scoredList: { studentId: string; totalScore: number; hasRecord: boolean; record?: AcademicRecord; aggregate: number | null }[] = [];

        cohort.forEach(student => {
            const record = allAcademicRecords.find(
                r => r.studentId === student.id && r.academicYear === selectedAcademicYear && r.term === selectedTerm
            );
            if (record && record.scores && record.scores.length > 0) {
                const totalScore = record.scores.reduce((acc, score) => {
                    const { total } = calculateScores(score, scoreSettings);
                    return acc + (total || 0);
                }, 0);
                const aggregate = calculateAggregateForRecord(record);
                scoredList.push({ studentId: student.id, totalScore, hasRecord: true, record, aggregate });
            } else {
                scoredList.push({ studentId: student.id, totalScore: 0, hasRecord: false, record: undefined, aggregate: null });
            }
        });

        // Sort descending by total score to calculate stream rank
        const sorted = [...scoredList].sort((a, b) => b.totalScore - a.totalScore);
        
        let recordedCount = 0;
        let sumTotal = 0;
        let highestScore = 0;
        let sumAgg = 0;
        let aggCount = 0;

        sorted.forEach((item, index) => {
            if (item.hasRecord) {
                recordedCount++;
                sumTotal += item.totalScore;
                if (item.totalScore > highestScore) highestScore = item.totalScore;
                if (item.aggregate !== null) {
                    sumAgg += item.aggregate;
                    aggCount++;
                }
            }
            rankMap.set(item.studentId, {
                position: item.hasRecord ? index + 1 : null,
                totalScore: item.totalScore,
                maxScore: subjects.length * 100,
                record: item.record,
                aggregate: item.aggregate,
            });
        });

        return {
            rankMap,
            studentsWithRecordsCount: recordedCount,
            averageTotalScore: recordedCount > 0 ? Math.round(sumTotal / recordedCount) : 0,
            highestTotalScore: highestScore,
            averageAggregate: aggCount > 0 ? (sumAgg / aggCount).toFixed(1) : 'N/A',
        };
    }, [streamStudents, selectedStream, selectedAcademicYear, selectedTerm, allAcademicRecords, scoreSettings]);

    // Attendance helper for any student
    const getStudentAttendance = (studentId: string) => {
        const studentAttendanceRecords = allAttendanceRecords.filter(r => r.studentId === studentId);
        if (studentAttendanceRecords.length === 0) return null;
        const presentCount = studentAttendanceRecords.filter(r => r.status === 'Present').length;
        return { present: presentCount, total: studentAttendanceRecords.length };
    };

    // Single student selected record & stats
    const selectedRecord = useMemo(() => {
        if (!selectedStudentId || !selectedTerm || !selectedAcademicYear || selectedStudentId === 'ALL_STREAM') return null;
        return allAcademicRecords.find(r => r.studentId === selectedStudentId && r.academicYear === selectedAcademicYear && r.term === selectedTerm);
    }, [selectedStudentId, selectedTerm, selectedAcademicYear, allAcademicRecords]);

    const singleStudentStats = useMemo(() => {
        if (!selectedStudentId || selectedStudentId === 'ALL_STREAM') return { position: null, totalScore: null, maxScore: subjects.length * 100, aggregate: null };
        const cached = streamCohortStats.rankMap.get(selectedStudentId);
        if (cached) return cached;
        return { position: null, totalScore: null, maxScore: subjects.length * 100, aggregate: calculateAggregateForRecord(selectedRecord || undefined) };
    }, [selectedStudentId, streamCohortStats, selectedRecord]);

    const singleAttendanceSummary = useMemo(() => {
        if (!selectedStudentId || selectedStudentId === 'ALL_STREAM') return null;
        return getStudentAttendance(selectedStudentId);
    }, [selectedStudentId, allAttendanceRecords]);

    const performanceSummary = useMemo(() => {
        if (!selectedRecord || !selectedStudent) return '';
        const summary = selectedRecord.scores.map(score => {
            const { total } = calculateScores(score, scoreSettings);
            return `${score.subject}: ${total}%`;
        }).join(', ');
        return `For Term ${selectedTerm}, ${selectedStudent.firstName} achieved the following scores: ${summary}.`;
    }, [selectedRecord, selectedStudent, selectedTerm, scoreSettings]);

    const behaviorSummary = useMemo(() => {
        if (!selectedStudent) return '';
        let summary = '';
        if (singleAttendanceSummary) {
            const { present, total } = singleAttendanceSummary;
            const absent = total - present;
            summary += `${selectedStudent.firstName} was present for ${present} out of ${total} school days this term. They were absent for ${absent} days. `;
        }
        if (selectedStudent.conduct) {
            summary += `Conduct: ${selectedStudent.conduct}. `;
        }
        if (selectedStudent.interest) {
            summary += `Interests: ${selectedStudent.interest}.`;
        }
        return summary;
    }, [singleAttendanceSummary, selectedStudent]);

    // Handle single report generation
    const handleGenerateReport = () => {
        if (selectedStudentId === 'ALL_STREAM') {
            handlePreviewAllStream();
            return;
        }

        if (selectedStudentId && selectedTerm && selectedAcademicYear) {
            const record = allAcademicRecords.find(r => r.studentId === selectedStudentId && r.academicYear === selectedAcademicYear && r.term === selectedTerm);
            setReportViewMode('single');
            setShowReport(true);
            if (!record) {
                toast({
                    variant: 'destructive',
                    title: 'Partial Record Notice',
                    description: 'No academic scores have been recorded for this student yet for the selected term.',
                });
            }
        }
    };

    // Handle previewing all reports for the stream
    const handlePreviewAllStream = () => {
        if (!selectedStream || !selectedAcademicYear || !selectedTerm) {
            toast({
                variant: 'destructive',
                title: 'Selection Incomplete',
                description: 'Please select a Stream, Academic Year, and Term to view all student reports.',
            });
            return;
        }

        if (streamStudents.length === 0) {
            toast({
                variant: 'destructive',
                title: 'No Students Found',
                description: `No students were found in Stream ${selectedStream}.`,
            });
            return;
        }

        setReportViewMode('stream_batch');
        setShowReport(true);
    };

    // Handle printing all students from selected stream, year, and term
    const handlePrintAllStudents = () => {
        if (!selectedStream || !selectedAcademicYear || !selectedTerm) {
            toast({
                variant: 'destructive',
                title: 'Selection Required',
                description: 'Please select Stream, Academic Year, and Term before printing all students.',
            });
            return;
        }

        if (streamStudents.length === 0) {
            toast({
                variant: 'destructive',
                title: 'No Students in Stream',
                description: `There are no students assigned to Stream ${selectedStream}.`,
            });
            return;
        }

        // Switch to batch mode so all student cards are in DOM
        setReportViewMode('stream_batch');
        setShowReport(true);
        setIsPrinting(true);

        toast({
            title: 'Preparing Batch Print',
            description: `Sending report cards for ${streamStudents.length} students in Stream ${selectedStream} to print dialog...`,
        });

        // Allow DOM to finish rendering all report card elements before invoking print
        setTimeout(() => {
            window.print();
            setIsPrinting(false);
        }, 300);
    };

    // Filtered batch students for preview search
    const displayedStreamStudents = useMemo(() => {
        if (!batchSearchQuery.trim()) return streamStudents;
        const query = batchSearchQuery.toLowerCase().trim();
        return streamStudents.filter(s =>
            `${s.firstName} ${s.lastName}`.toLowerCase().includes(query) ||
            s.admissionNumber?.toLowerCase().includes(query)
        );
    }, [streamStudents, batchSearchQuery]);

    const handleClassChange = (value: string) => {
        setSelectedClass(value);
        setSelectedStudentId(null);
        setShowReport(false);
    };

    const handleStreamChange = (value: string) => {
        setSelectedStream(value);
        setSelectedStudentId(null);
        setShowReport(false);
    };

    const handleStudentChange = (value: string) => {
        setSelectedStudentId(value);
        if (value === 'ALL_STREAM') {
            setReportViewMode('stream_batch');
        } else {
            setReportViewMode('single');
        }
        setShowReport(false);
    };
    
    const handleAcademicYearChange = (value: string) => {
        setSelectedAcademicYear(value);
        setShowReport(false);
    };

    const handleTermChange = (value: string) => {
        setSelectedTerm(parseInt(value, 10));
        setShowReport(false);
    };

    const handleRemarkChange = (field: 'conduct' | 'interest' | 'classTeacherRemark' | 'headTeacherRemark', value: string) => {
        if (!selectedStudent) return;
    
        const updatedStudents = students.map(s => 
            s.id === selectedStudent.id ? { ...s, [field]: value } : s
        );
        setStudents(updatedStudents);

        const studentDocRef = doc(firestore, 'students', selectedStudent.id);
        setDoc(studentDocRef, { [field]: value }, { merge: true }).catch(async (serverError: any) => {
            console.error("Error updating student remark:", serverError);
            const errMsg = String(serverError?.message || '');
            if (errMsg.includes('Missing or insufficient permissions') || serverError?.code === 'permission-denied') {
              const permissionError = new FirestorePermissionError({
                  path: studentDocRef.path,
                  operation: 'update',
                  requestResourceData: { [field]: value },
              });
              errorEmitter.emit('permission-error', permissionError);
            }
        });
    };

    const handleRemarksGenerated = (remarks: GenerateStudentRemarksOutput) => {
        handleRemarkChange('classTeacherRemark', remarks.teacherRemark);
        handleRemarkChange('headTeacherRemark', remarks.headTeacherRemark);
    };
    
    // Print current view (single or all)
    const handlePrint = () => {
        if (reportViewMode === 'stream_batch') {
            handlePrintAllStudents();
            return;
        }

        const reportElement = document.querySelector('.printable-report');
        if (!reportElement || !selectedStudent) {
            toast({
                variant: 'destructive',
                title: 'Print Failed',
                description: 'Please generate a report before printing.',
            });
            return;
        }

        setIsPrinting(true);
        setTimeout(() => {
            window.print();
            setIsPrinting(false);
        }, 150);
    };

    // Single student PDF export
    const handleExportPdf = () => {
        const reportElement = document.querySelector('.printable-report');
        if (!reportElement || !selectedStudent) {
            toast({
                variant: 'destructive',
                title: 'Export Failed',
                description: 'Please generate a report before exporting.',
            });
            return;
        }

        setIsExporting(true);

        html2canvas(reportElement as HTMLElement, {
            scale: 2,
            useCORS: true,
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: 'a4'
            });
    
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgProps = pdf.getImageProperties(imgData);

            const margin = 10;
            const effectiveWidth = pdfWidth - (margin * 2);
            const effectiveHeight = pdfHeight - (margin * 2);

            const ratio = Math.min(effectiveWidth / imgProps.width, effectiveHeight / imgProps.height);
            const imgFinalWidth = imgProps.width * ratio;
            const imgFinalHeight = imgProps.height * ratio;

            const x = (pdfWidth - imgFinalWidth) / 2;
            const y = (pdfHeight - imgFinalHeight) / 2;
    
            pdf.addImage(imgData, 'PNG', x, y, imgFinalWidth, imgFinalHeight);
            pdf.save(`Report-Card-${selectedStudent.firstName}-${selectedStudent.lastName}.pdf`);
        }).catch(err => {
            console.error("Could not generate PDF", err);
            toast({
                variant: "destructive",
                title: "Export Failed",
                description: "An error occurred while exporting the report to PDF.",
            });
        }).finally(() => {
            setIsExporting(false);
        });
    };

    // Multi-page batch PDF export for all students in stream
    const handleExportAllPdf = async () => {
        if (!selectedStream || !selectedAcademicYear || !selectedTerm) {
            toast({
                variant: 'destructive',
                title: 'Selection Required',
                description: 'Please select Stream, Academic Year, and Term before exporting.',
            });
            return;
        }

        if (reportViewMode !== 'stream_batch') {
            setReportViewMode('stream_batch');
            setShowReport(true);
        }

        setIsExporting(true);
        toast({
            title: 'Generating Batch PDF',
            description: `Exporting multi-page PDF for ${streamStudents.length} students. Please wait...`,
        });

        try {
            const cards = document.querySelectorAll('.printable-report-card');
            if (!cards || cards.length === 0) {
                throw new Error('No printable report cards found to export.');
            }

            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: 'a4',
            });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const margin = 8;
            const effectiveWidth = pdfWidth - margin * 2;
            const effectiveHeight = pdfHeight - margin * 2;

            for (let i = 0; i < cards.length; i++) {
                const cardEl = cards[i] as HTMLElement;
                const canvas = await html2canvas(cardEl, {
                    scale: 1.8,
                    useCORS: true,
                    logging: false,
                });
                const imgData = canvas.toDataURL('image/png');
                const imgProps = pdf.getImageProperties(imgData);
                const ratio = Math.min(effectiveWidth / imgProps.width, effectiveHeight / imgProps.height);
                const imgFinalWidth = imgProps.width * ratio;
                const imgFinalHeight = imgProps.height * ratio;
                const x = (pdfWidth - imgFinalWidth) / 2;
                const y = (pdfHeight - imgFinalHeight) / 2;

                if (i > 0) {
                    pdf.addPage();
                }
                pdf.addImage(imgData, 'PNG', x, y, imgFinalWidth, imgFinalHeight);
            }

            const streamFilename = `UP_JHS_Report_Cards_${selectedClass || 'All'}_Stream_${selectedStream}_${selectedAcademicYear.replace('/', '-')}_Term_${selectedTerm}.pdf`;
            pdf.save(streamFilename);
            toast({
                title: 'Batch PDF Exported',
                description: `Successfully exported ${cards.length} student report cards to ${streamFilename}.`,
            });
        } catch (err: any) {
            console.error('Failed to export batch PDF:', err);
            toast({
                variant: 'destructive',
                title: 'PDF Export Failed',
                description: err?.message || 'Error compiling batch PDF. You can also use Print -> Save as PDF.',
            });
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 print:block">
            {/* Page Header */}
            <div className="print:hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-headline font-semibold md:text-3xl">Report Cards</h1>
                    <p className="text-muted-foreground text-sm">
                        Generate, preview, and print individual or batch end-of-term student report cards by stream.
                    </p>
                </div>

                {/* Quick Print All Shortcut Header Button */}
                {selectedStream && selectedAcademicYear && selectedTerm && (
                    <div className="flex items-center gap-2">
                        <Button 
                            onClick={handlePrintAllStudents} 
                            disabled={isPrinting || streamStudents.length === 0}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm"
                        >
                            <Printer className="mr-2 h-4 w-4" />
                            {isPrinting ? 'Opening Print Dialog...' : `Print All in Stream (${streamStudents.length})`}
                        </Button>
                    </div>
                )}
            </div>
            
            {/* Filter and Selection Card */}
            <Card className="print:hidden border-slate-200 dark:border-slate-800 shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <CardTitle className="text-lg">Report Card Selection & Batch Controls</CardTitle>
                            <CardDescription>
                                Select stream, year, and term to print reports for all students, or select an individual student.
                            </CardDescription>
                        </div>
                        {selectedStream && (
                            <Badge variant="outline" className="self-start sm:self-auto bg-primary/5 text-primary border-primary/20 font-medium px-3 py-1">
                                <Users className="w-3.5 h-3.5 mr-1.5" />
                                {streamStudents.length} Students in Stream {selectedStream}
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    {/* Class Selector */}
                    <div>
                        <Label htmlFor="class-select" className="text-xs font-semibold uppercase text-muted-foreground">Class (Optional)</Label>
                        <Select value={selectedClass} onValueChange={handleClassChange}>
                            <SelectTrigger id="class-select" className="mt-1">
                                <SelectValue placeholder="All Classes" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL_CLASSES">All Classes</SelectItem>
                                {classLevels.map((level) => (
                                    <SelectItem key={level} value={level}>{level}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Stream Selector */}
                    <div>
                        <Label htmlFor="stream-select" className="text-xs font-semibold uppercase text-primary">
                            Stream *
                        </Label>
                        <Select value={selectedStream} onValueChange={handleStreamChange}>
                            <SelectTrigger id="stream-select" className="mt-1 border-primary/40 focus:ring-primary">
                                <SelectValue placeholder="Select Stream" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableStreams.map((stream) => (
                                    <SelectItem key={stream} value={stream} className="font-medium">
                                        Stream {stream}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Academic Year Selector */}
                    <div>
                        <Label htmlFor="academic-year-select" className="text-xs font-semibold uppercase text-primary">
                            Academic Year *
                        </Label>
                        <Select value={selectedAcademicYear} onValueChange={handleAcademicYearChange}>
                            <SelectTrigger id="academic-year-select" className="mt-1">
                                <SelectValue placeholder="Select Year" />
                            </SelectTrigger>
                            <SelectContent>
                                {academicYears.map((year) => (
                                    <SelectItem key={year} value={year}>{year}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Term Selector */}
                    <div>
                        <Label htmlFor="term-select" className="text-xs font-semibold uppercase text-primary">
                            Term *
                        </Label>
                        <Select value={selectedTerm?.toString() || ''} onValueChange={handleTermChange}>
                            <SelectTrigger id="term-select" className="mt-1">
                                <SelectValue placeholder="Select Term" />
                            </SelectTrigger>
                            <SelectContent>
                                {terms.map((term) => (
                                    <SelectItem key={term} value={term.toString()}>Term {term}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Student Selector (With 'All Students in Stream' option) */}
                    <div>
                        <Label htmlFor="student-select" className="text-xs font-semibold uppercase text-muted-foreground">
                            Student (or All)
                        </Label>
                        <Select value={selectedStudentId || ''} onValueChange={handleStudentChange}>
                            <SelectTrigger id="student-select" className="mt-1">
                                <SelectValue placeholder={selectedStream ? "All Students / Single" : "Select Student"} />
                            </SelectTrigger>
                            <SelectContent className="max-h-72">
                                {selectedStream && (
                                    <SelectItem value="ALL_STREAM" className="font-semibold text-primary bg-primary/5">
                                        👥 All Students in Stream ({streamStudents.length})
                                    </SelectItem>
                                )}
                                {filteredStudents.map((student: Student) => (
                                    <SelectItem key={student.id} value={student.id}>
                                        {student.firstName} {student.lastName} ({student.admissionNumber})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>

                <CardFooter className="pt-2 pb-4 flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {selectedStream && selectedAcademicYear && selectedTerm ? (
                            <span className="flex items-center text-emerald-600 dark:text-emerald-400 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                Ready to print: Stream {selectedStream} ({streamStudents.length} students), {selectedAcademicYear} Term {selectedTerm}
                            </span>
                        ) : (
                            <span className="flex items-center text-amber-600 dark:text-amber-400">
                                <AlertCircle className="w-3.5 h-3.5 mr-1" />
                                Please select Stream, Academic Year, and Term to enable batch printing.
                            </span>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Single Student Generate Button */}
                        {selectedStudentId && selectedStudentId !== 'ALL_STREAM' && (
                            <Button 
                                variant="outline" 
                                onClick={handleGenerateReport}
                                disabled={!selectedTerm || !selectedAcademicYear}
                            >
                                Generate Single Report
                            </Button>
                        )}

                        {/* Preview Stream Reports Button */}
                        <Button
                            variant="outline"
                            onClick={handlePreviewAllStream}
                            disabled={!selectedStream || !selectedAcademicYear || !selectedTerm || streamStudents.length === 0}
                            className="flex items-center gap-1.5"
                        >
                            <Eye className="w-4 h-4 text-muted-foreground" />
                            Preview Stream ({streamStudents.length})
                        </Button>

                        {/* Primary: PRINT ALL STUDENTS REPORT */}
                        <Button 
                            onClick={handlePrintAllStudents} 
                            disabled={!selectedStream || !selectedAcademicYear || !selectedTerm || isPrinting || streamStudents.length === 0}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm flex items-center gap-2"
                        >
                            <Printer className="w-4 h-4" />
                            <span>Print All Students Report</span>
                            <span className="bg-primary-foreground/20 text-primary-foreground px-1.5 py-0.5 rounded text-xs">
                                {streamStudents.length}
                            </span>
                        </Button>
                    </div>
                </CardFooter>
            </Card>

            {/* BATCH REPORT VIEW (All Students from Selected Stream, Year, and Term) */}
            {showReport && reportViewMode === 'stream_batch' && (
                <div className="space-y-6">
                    {/* Stream Batch Summary & Action Toolbar (Hidden on Print) */}
                    <div className="print:hidden bg-slate-900 text-slate-100 p-4 rounded-xl shadow-md space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 font-semibold">
                                        Batch Print Mode
                                    </Badge>
                                    <h2 className="text-xl font-bold tracking-tight text-white">
                                        Stream {selectedStream} Student Reports
                                    </h2>
                                </div>
                                <p className="text-xs text-slate-300 mt-1">
                                    {selectedClass && selectedClass !== 'ALL_CLASSES' ? `${selectedClass} • ` : ''}
                                    Academic Year: <span className="font-semibold text-white">{selectedAcademicYear}</span> • 
                                    Term: <span className="font-semibold text-white">{selectedTerm}</span>
                                </p>
                            </div>

                            {/* Batch Action Buttons */}
                            <div className="flex flex-wrap items-center gap-2">
                                <Button 
                                    onClick={handlePrintAllStudents} 
                                    disabled={isPrinting || isExporting}
                                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold shadow"
                                >
                                    <Printer className="mr-2 h-4 w-4" />
                                    {isPrinting ? 'Printing All...' : `Print All Reports (${displayedStreamStudents.length})`}
                                </Button>
                                
                                <Button 
                                    variant="outline" 
                                    onClick={handleExportAllPdf} 
                                    disabled={isPrinting || isExporting}
                                    className="bg-slate-800 text-slate-100 border-slate-700 hover:bg-slate-700"
                                >
                                    <FileDown className="mr-2 h-4 w-4" />
                                    {isExporting ? 'Exporting PDF...' : 'Export All to PDF'}
                                </Button>

                                {selectedStudent && (
                                    <Button 
                                        variant="ghost" 
                                        onClick={() => setReportViewMode('single')}
                                        className="text-slate-300 hover:text-white hover:bg-slate-800"
                                    >
                                        <ArrowLeft className="mr-1.5 h-4 w-4" />
                                        Back to Single View
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Stream Statistics Bar */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800 text-xs">
                            <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                                <span className="text-slate-400 block">Total Students in Stream</span>
                                <span className="text-lg font-bold text-white">{streamStudents.length}</span>
                            </div>
                            <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                                <span className="text-slate-400 block">Records Recorded</span>
                                <span className="text-lg font-bold text-emerald-400">
                                    {streamCohortStats.studentsWithRecordsCount} / {streamStudents.length}
                                </span>
                            </div>
                            <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                                <span className="text-slate-400 block">Cohort Top Score</span>
                                <span className="text-lg font-bold text-amber-300">
                                    {streamCohortStats.highestTotalScore || 'N/A'} pts
                                </span>
                            </div>
                            <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                                <span className="text-slate-400 block">Avg Best-6 Aggregate</span>
                                <span className="text-lg font-bold text-blue-300">
                                    {streamCohortStats.averageAggregate}
                                </span>
                            </div>
                        </div>

                        {/* Quick Student Filter in Preview */}
                        <div className="relative pt-1">
                            <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Filter preview by student name or admission number..."
                                value={batchSearchQuery}
                                onChange={(e) => setBatchSearchQuery(e.target.value)}
                                className="pl-9 bg-slate-800/90 border-slate-700 text-white placeholder:text-slate-400 h-9 text-xs"
                            />
                            {batchSearchQuery && (
                                <span className="text-[11px] text-slate-400 mt-1 block">
                                    Showing {displayedStreamStudents.length} of {streamStudents.length} students
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Batch Printable Report Cards List */}
                    <div id="printable-stream-batch-reports" className="space-y-8 print:space-y-0">
                        {displayedStreamStudents.map((student, index) => {
                            const cached = streamCohortStats.rankMap.get(student.id);
                            const record = cached?.record;
                            const att = getStudentAttendance(student.id);

                            return (
                                <div key={student.id} className="relative group">
                                    {/* Preview header tag on screen, hidden on print */}
                                    <div className="print:hidden flex items-center justify-between text-xs text-muted-foreground mb-1.5 px-1">
                                        <span className="font-semibold text-foreground">
                                            #{index + 1} • {student.firstName} {student.lastName} ({student.admissionNumber})
                                        </span>
                                        <div className="flex items-center gap-2">
                                            {cached?.position && (
                                                <Badge variant="secondary" className="text-[10px] py-0">
                                                    Rank: {cached.position}
                                                </Badge>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 text-[11px] px-2"
                                                onClick={() => {
                                                    setSelectedStudentId(student.id);
                                                    setReportViewMode('single');
                                                }}
                                            >
                                                Edit Remarks
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Report Card */}
                                    <StudentReportCard
                                        student={student}
                                        academicRecord={record}
                                        attendanceSummary={att}
                                        position={cached?.position}
                                        totalScore={cached?.totalScore}
                                        maxScore={cached?.maxScore}
                                        totalStudentsInClass={streamStudents.length}
                                        aggregateScore={cached?.aggregate}
                                        selectedAcademicYear={selectedAcademicYear}
                                        selectedTerm={selectedTerm}
                                        vacationDate={vacationDate}
                                        reopeningDate={reopeningDate}
                                        schoolName={schoolName}
                                        schoolLogoUrl={schoolLogoUrl}
                                        headTeacherSignature={headTeacherSignature}
                                        scoreSettings={scoreSettings}
                                        isBatch={true}
                                        isLast={index === displayedStreamStudents.length - 1}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* SINGLE STUDENT VIEW */}
            {showReport && reportViewMode === 'single' && selectedStudent && (
                <>
                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                        <div className="flex items-center gap-2">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setReportViewMode('stream_batch')}
                                disabled={!selectedStream}
                            >
                                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                                View All in Stream ({streamStudents.length})
                            </Button>
                            <Badge variant="outline" className="text-xs">
                                Individual Mode: {selectedStudent.firstName} {selectedStudent.lastName}
                            </Badge>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Print Single */}
                            <Button onClick={handlePrint} disabled={isPrinting || isExporting}>
                                <Printer className="mr-2 h-4 w-4" /> 
                                {isPrinting ? 'Printing...' : 'Print This Report'}
                            </Button>

                            {/* Export Single to PDF */}
                            <Button variant="outline" onClick={handleExportPdf} disabled={isPrinting || isExporting}>
                                <FileDown className="mr-2 h-4 w-4" />
                                {isExporting ? 'Exporting...' : 'Export to PDF'}
                            </Button>

                            {/* Print All in Stream Quick Action */}
                            {selectedStream && (
                                <Button 
                                    onClick={handlePrintAllStudents} 
                                    disabled={isPrinting || isExporting || streamStudents.length === 0}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                                >
                                    <Printer className="mr-1.5 h-4 w-4" />
                                    Print All in Stream ({streamStudents.length})
                                </Button>
                            )}
                        </div>
                    </div>
                    
                    {/* AI Remark Generator */}
                    <div className="remark-generator-wrapper my-2 print:hidden">
                        <RemarkGenerator 
                            studentName={`${selectedStudent.firstName} ${selectedStudent.lastName}`}
                            performanceSummary={performanceSummary}
                            behaviorSummary={behaviorSummary}
                            onRemarksGenerated={handleRemarksGenerated}
                        />
                    </div>

                    {/* Edit Remarks & Comments Card */}
                    <Card className="my-2 print:hidden">
                        <CardHeader className="py-3">
                            <CardTitle className="text-base">Edit Remarks & Comments</CardTitle>
                            <CardDescription className="text-xs">
                                General conduct, interests and teacher's comments for {selectedStudent.firstName}. Changes save automatically.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid md:grid-cols-2 gap-4 text-sm pb-4">
                            <EditableRemark
                                label="Conduct"
                                value={selectedStudent.conduct || ''}
                                onChange={(value) => handleRemarkChange('conduct', value)}
                                options={conductOptions}
                            />
                            <EditableRemark
                                label="Interest"
                                value={selectedStudent.interest || ''}
                                onChange={(value) => handleRemarkChange('interest', value)}
                                options={interestOptions}
                            />
                            <EditableRemark
                                label="Class Teacher's Remark"
                                value={selectedStudent.classTeacherRemark || ''}
                                onChange={(value) => handleRemarkChange('classTeacherRemark', value)}
                                options={teacherRemarkOptions}
                                isTextarea
                            />
                            <EditableRemark
                                label="Head Teacher's Remark"
                                value={selectedStudent.headTeacherRemark || ''}
                                onChange={(value) => handleRemarkChange('headTeacherRemark', value)}
                                options={teacherRemarkOptions}
                                isTextarea
                            />
                        </CardContent>
                    </Card>

                    {/* Single Student Printable Report Card */}
                    <StudentReportCard
                        student={selectedStudent}
                        academicRecord={selectedRecord || undefined}
                        attendanceSummary={singleAttendanceSummary}
                        position={singleStudentStats.position}
                        totalScore={singleStudentStats.totalScore}
                        maxScore={singleStudentStats.maxScore}
                        totalStudentsInClass={streamStudents.length || filteredStudents.length}
                        aggregateScore={singleStudentStats.aggregate}
                        selectedAcademicYear={selectedAcademicYear}
                        selectedTerm={selectedTerm}
                        vacationDate={vacationDate}
                        reopeningDate={reopeningDate}
                        schoolName={schoolName}
                        schoolLogoUrl={schoolLogoUrl}
                        headTeacherSignature={headTeacherSignature}
                        scoreSettings={scoreSettings}
                        isBatch={false}
                    />
                </>
            )}
        </div>
    );
}
