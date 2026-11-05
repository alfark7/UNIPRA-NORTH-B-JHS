
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Upload, Download, FileSpreadsheet, Save } from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, doc, setDoc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { Student, SubjectScore, AcademicRecord } from '@/lib/types';
import { subjects, academicYears, terms } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { calculateScores } from '@/lib/grading';
import { 
  exportAcademicScoresToExcel, 
  downloadAcademicScoresTemplateExcel, 
  type ParsedScoreRow 
} from '@/lib/excel';
import { AcademicImportDialog } from './academic-import-dialog';

const defaultScoreSettings = {
  test1: 100,
  test2: 100,
  groupWork: 50,
  project: 50,
  classExercises: 20,
  homeWork: 20,
  exam: 100,
};

export function ScoreEntry() {
  const firestore = useFirestore();
  const studentsQuery = useMemo(() => collection(firestore, 'students'), [firestore]);
  const academicRecordsQuery = useMemo(() => collection(firestore, 'academicRecords'), [firestore]);

  const { data: students, loading: studentsLoading } = useCollection<Student>(studentsQuery);
  const { data: allAcademicRecords } = useCollection<AcademicRecord>(academicRecordsQuery);
  
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedStream, setSelectedStream] = useState<string>('');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('');
  const [selectedTerm, setSelectedTerm] = useState<number | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [scores, setScores] = useState<Partial<SubjectScore>[]>([]);
  const { toast } = useToast();
  const [scoreSettings, setScoreSettings] = useState(defaultScoreSettings);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const classLevels = Array.from(new Set(students.map(s => s.class)));
  const streams = Array.from(new Set(students.map(s => s.stream).filter(Boolean))) as string[];

  const handleExport = () => {
    exportAcademicScoresToExcel(allAcademicRecords || [], students, {
      className: selectedClass,
      stream: selectedStream,
      academicYear: selectedAcademicYear,
      term: selectedTerm ?? undefined,
      subject: selectedSubject,
      scoreSettings,
    });
    toast({
      title: 'Export Successful',
      description: 'Student academic scores have been exported to Excel.',
    });
  };

  const handleDownloadTemplate = () => {
    downloadAcademicScoresTemplateExcel({
      students,
      selectedClass,
      selectedStream,
      selectedSubject,
      selectedAcademicYear,
      selectedTerm: selectedTerm ?? undefined,
    });
    toast({
      title: 'Template Downloaded',
      description: 'Excel template for score entry has been downloaded.',
    });
  };

  const handleBatchImportScores = async (parsedList: ParsedScoreRow[]) => {
    if (!parsedList || parsedList.length === 0) return;

    try {
      const academicRecordsRef = collection(firestore, 'academicRecords');
      const existingSnapshot = await getDocs(academicRecordsRef);

      const recordMap = new Map<string, { id: string; scores: SubjectScore[]; isNew: boolean }>();

      existingSnapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as AcademicRecord;
        const key = `${data.studentId}___${data.academicYear}___${data.term}`;
        recordMap.set(key, {
          id: docSnap.id,
          scores: [...(data.scores || [])],
          isNew: false,
        });
      });

      const affectedKeys = new Set<string>();

      parsedList.forEach((item) => {
        if (!item.studentId) return;
        const key = `${item.studentId}___${item.academicYear}___${item.term}`;
        affectedKeys.add(key);

        const newSubjectScore: SubjectScore = {
          subject: item.subject,
          test1: item.test1,
          test2: item.test2,
          groupWork: item.groupWork,
          project: item.project,
          classExercises: item.classExercises,
          homeWork: item.homeWork,
          classScore: item.classScore,
          exam: item.exam,
          examScore: item.examScore,
          total: item.total,
          grade: item.grade,
          remark: item.remark,
        };

        if (recordMap.has(key)) {
          const existing = recordMap.get(key)!;
          let scoreExists = false;
          const updatedScores = existing.scores.map((s) => {
            if (s.subject.toLowerCase() === item.subject.toLowerCase()) {
              scoreExists = true;
              return newSubjectScore;
            }
            return s;
          });
          if (!scoreExists) {
            updatedScores.push(newSubjectScore);
          }
          existing.scores = updatedScores;
        } else {
          const newDocRef = doc(academicRecordsRef);
          recordMap.set(key, {
            id: newDocRef.id,
            scores: [newSubjectScore],
            isNew: true,
          });
        }
      });

      const keysArray = Array.from(affectedKeys);
      const CHUNK_SIZE = 400;

      for (let i = 0; i < keysArray.length; i += CHUNK_SIZE) {
        const chunk = keysArray.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(firestore);

        for (const key of chunk) {
          const [studentId, academicYear, termStr] = key.split('___');
          const recordInfo = recordMap.get(key)!;
          const docRef = doc(firestore, 'academicRecords', recordInfo.id);

          const recordData: AcademicRecord = {
            studentId,
            academicYear,
            term: Number(termStr),
            scores: recordInfo.scores,
          };

          batch.set(docRef, recordData, { merge: true });
        }

        await batch.commit();
      }

      toast({
        title: 'Scores Imported',
        description: `Successfully imported ${parsedList.length} scores for ${affectedKeys.size} students.`,
      });
    } catch (serverError: any) {
      console.error('Error importing academic scores batch:', serverError);
      const permissionError = new FirestorePermissionError({
        path: 'academicRecords',
        operation: 'write',
      });
      errorEmitter.emit('permission-error', permissionError);
      toast({
        variant: 'destructive',
        title: 'Import Failed',
        description: serverError?.message || 'Could not import scores to Firestore.',
      });
      throw serverError;
    }
  };

  useEffect(() => {
    const savedScoreSettings = localStorage.getItem('score-settings');
    if (savedScoreSettings) {
      try {
        setScoreSettings(JSON.parse(savedScoreSettings));
      } catch (error) {
        console.error("Failed to parse score settings from storage", error);
      }
    }
  }, []);
  
  const resetSelections = () => {
    setSelectedStudentId(null);
    setScores([]);
  };

  const handleClassChange = (value: string) => {
    setSelectedClass(value);
    setSelectedStream('');
    setSelectedSubject('');
    resetSelections();
  };

  const handleStreamChange = (value: string) => {
    setSelectedStream(value);
    setSelectedSubject('');
    resetSelections();
  };
  
  const handleSubjectChange = (value: string) => {
    setSelectedSubject(value);
    if (value) {
        setScores(
            [{ 
                subject: value, 
                test1: 0,
                test2: 0,
                groupWork: 0, 
                project: 0, 
                classExercises: 0,
                homeWork: 0,
                exam: 0, 
                classScore: 0,
                examScore: 0,
                total: 0,
                grade: 'N/A',
                remark: 'N/A'
            }]
        )
    } else {
        setScores([]);
    }
    setSelectedStudentId(null);
  }

  const handleScoreChange = (subject: string, type: keyof Omit<SubjectScore, 'subject' | 'total' | 'grade' | 'classScore' | 'examScore' | 'remark'>, value: string) => {
    const numericValue = parseInt(value) || 0;
    
    setScores(prevScores => 
      prevScores.map(score => {
        if (score.subject === subject) {
            const updatedScore = { ...score, [type]: numericValue };
            const {classScore, examScore, total, grade, remark} = calculateScores(updatedScore, scoreSettings);
            return {...updatedScore, classScore, examScore, total, grade: grade ?? 'N/A', remark: remark ?? 'N/A'};
        }
        return score;
      })
    );
  };
  
  const handleSave = async () => {
    if (!selectedStudentId || !selectedAcademicYear || !selectedTerm || !selectedSubject) {
      toast({
        variant: 'destructive',
        title: 'Selection Incomplete',
        description: 'Please select all fields before saving scores.',
      });
      return;
    }

    const newScore = scores[0];
    const academicRecordsRef = collection(firestore, 'academicRecords');
    const q = query(academicRecordsRef, 
        where('studentId', '==', selectedStudentId), 
        where('academicYear', '==', selectedAcademicYear), 
        where('term', '==', selectedTerm)
    );

    try {
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
          const studentRecordDoc = querySnapshot.docs[0];
          const studentRecord = studentRecordDoc.data() as AcademicRecord;
          
          let scoreExists = false;
          const updatedScores = studentRecord.scores.map(s => {
              if (s.subject === selectedSubject) {
                  scoreExists = true;
                  return { ...s, ...newScore };
              }
              return s;
          });

          if (!scoreExists) {
              updatedScores.push(newScore as SubjectScore);
          }

          const docRef = doc(firestore, 'academicRecords', studentRecordDoc.id);
          await setDoc(docRef, { scores: updatedScores }, { merge: true });

      } else {
          const newRecord: AcademicRecord = {
              studentId: selectedStudentId,
              academicYear: selectedAcademicYear,
              term: selectedTerm,
              scores: [newScore as SubjectScore],
          };
          
          await addDoc(academicRecordsRef, newRecord);
      }
      
      toast({
        title: 'Scores Saved',
        description: `Scores for ${students.find(s => s.id === selectedStudentId)?.firstName} have been saved.`,
      });
    } catch (serverError) {
        console.error("Error saving academic record:", serverError);
        const permissionError = new FirestorePermissionError({
            path: 'academicRecords',
            operation: 'write',
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({
          variant: 'destructive',
          title: 'Save Failed',
          description: 'You do not have permission to save or update academic scores.',
        });
    }
  };

  const filteredStudents = students.filter(s => 
    (!selectedClass || s.class === selectedClass) &&
    (!selectedStream || s.stream === selectedStream)
  );
  const selectedStudent = students.find(s => s.id === selectedStudentId);

  return (
    <div className="space-y-6">
      {/* Header bar matching students directory pattern */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-headline font-semibold md:text-3xl">Academics</h1>
          <p className="text-muted-foreground">Enter, import, export, and manage student subject scores.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setIsImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Import
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          <Button 
            variant="outline" 
            onClick={handleDownloadTemplate}
            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300"
          >
            <Download className="mr-2 h-4 w-4" /> Download Excel Template
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Score Entry</CardTitle>
            <CardDescription>Select class, stream, student, academic year, term, and subject to enter scores.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)} className="h-8 text-xs">
              <Upload className="mr-1.5 h-3.5 w-3.5" /> Import
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} className="h-8 text-xs">
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="h-8 text-xs">
              <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> Template
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          <div>
            <Label htmlFor="class-select">Class</Label>
            <Select value={selectedClass} onValueChange={handleClassChange}>
                <SelectTrigger id="class-select">
                <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                {classLevels.map((level) => (
                    <SelectItem key={level} value={level}>{level}</SelectItem>
                ))}
                </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="stream-select">Stream</Label>
            <Select value={selectedStream} onValueChange={handleStreamChange} disabled={!selectedClass}>
                <SelectTrigger id="stream-select">
                <SelectValue placeholder="Select a stream" />
                </SelectTrigger>
                <SelectContent>
                {streams.map((stream) => (
                    <SelectItem key={stream} value={stream}>{stream}</SelectItem>
                ))}
                </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="academic-year-select">Academic Year</Label>
            <Select value={selectedAcademicYear} onValueChange={setSelectedAcademicYear}>
                <SelectTrigger id="academic-year-select"><SelectValue placeholder="Select Year" /></SelectTrigger>
                <SelectContent>
                {academicYears.map((year) => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
                </SelectContent>
            </Select>
          </div>
           <div>
            <Label htmlFor="term-select">Term</Label>
            <Select value={selectedTerm?.toString()} onValueChange={(v) => setSelectedTerm(Number(v))}>
                <SelectTrigger id="term-select"><SelectValue placeholder="Select Term" /></SelectTrigger>
                <SelectContent>
                {terms.map((term) => (
                    <SelectItem key={term} value={String(term)}>Term {term}</SelectItem>
                ))}
                </SelectContent>
            </Select>
          </div>
           <div>
            <Label htmlFor="subject-select">Subject</Label>
            <Select value={selectedSubject} onValueChange={handleSubjectChange} disabled={!selectedStream}>
                <SelectTrigger id="subject-select">
                <SelectValue placeholder="Select a subject" />
                </SelectTrigger>
                <SelectContent>
                {subjects.map((subject) => (
                    <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                ))}
                </SelectContent>
            </Select>
          </div>
           <div>
            <Label htmlFor="student-select">Student</Label>
            <Select value={selectedStudentId || ''} onValueChange={setSelectedStudentId} disabled={!selectedSubject}>
                <SelectTrigger id="student-select">
                <SelectValue placeholder="Select a student" />
                </SelectTrigger>
                <SelectContent>
                {filteredStudents.map((student: Student) => (
                    <SelectItem key={student.id} value={student.id}>
                    {student.firstName} {student.lastName}
                    </SelectItem>
                ))}
                </SelectContent>
            </Select>
           </div>
        </div>

        {selectedStudent && scores.length > 0 && (
          <div>
            <h3 className="mb-4 text-lg font-medium">
              Entering scores for: {selectedStudent.firstName} {selectedStudent.lastName}
            </h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Test 1 ({scoreSettings.test1})</TableHead>
                    <TableHead>Test 2 ({scoreSettings.test2})</TableHead>
                    <TableHead>Group Work ({scoreSettings.groupWork})</TableHead>
                    <TableHead>Project ({scoreSettings.project})</TableHead>
                    <TableHead>Class Ex. ({scoreSettings.classExercises})</TableHead>
                    <TableHead>Home Work ({scoreSettings.homeWork})</TableHead>
                    <TableHead>Class Score (50%)</TableHead>
                    <TableHead>Exam ({scoreSettings.exam})</TableHead>
                    <TableHead>Exam Score (50%)</TableHead>
                    <TableHead>Total (100%)</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Remark</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scores.map((score, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{score.subject}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max={scoreSettings.test1}
                          value={score.test1 ?? 0}
                          onChange={(e) => handleScoreChange(score.subject!, 'test1', e.target.value)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max={scoreSettings.test2}
                          value={score.test2 ?? 0}
                          onChange={(e) => handleScoreChange(score.subject!, 'test2', e.target.value)}
                          className="w-24"
                        />
                      </TableCell>
                       <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max={scoreSettings.groupWork}
                          value={score.groupWork ?? 0}
                          onChange={(e) => handleScoreChange(score.subject!, 'groupWork', e.target.value)}
                          className="w-24"
                        />
                      </TableCell>
                       <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max={scoreSettings.project}
                          value={score.project ?? 0}
                          onChange={(e) => handleScoreChange(score.subject!, 'project', e.target.value)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max={scoreSettings.classExercises}
                          value={score.classExercises ?? 0}
                          onChange={(e) => handleScoreChange(score.subject!, 'classExercises', e.target.value)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max={scoreSettings.homeWork}
                          value={score.homeWork ?? 0}
                          onChange={(e) => handleScoreChange(score.subject!, 'homeWork', e.target.value)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell className="font-semibold">{score.classScore ?? 0}</TableCell>
                       <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max={scoreSettings.exam}
                          value={score.exam ?? 0}
                          onChange={(e) => handleScoreChange(score.subject!, 'exam', e.target.value)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell className="font-semibold">{score.examScore ?? 0}</TableCell>
                      <TableCell className="font-semibold">{score.total ?? 0}</TableCell>
                      <TableCell className="font-semibold">{score.grade ?? 'N/A'}</TableCell>
                      <TableCell className="font-semibold">{score.remark ?? 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setIsImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Import
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          <Button 
            variant="outline" 
            onClick={handleDownloadTemplate}
            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300"
          >
            <Download className="mr-2 h-4 w-4" /> Download Excel Template
          </Button>
        </div>
        <Button onClick={handleSave} disabled={!selectedStudentId} className="sm:w-auto">
          <Save className="mr-2 h-4 w-4" /> Save Scores
        </Button>
      </CardFooter>
    </Card>

    <AcademicImportDialog
      isOpen={isImportOpen}
      onClose={() => setIsImportOpen(false)}
      existingStudents={students}
      scoreSettings={scoreSettings}
      defaultContext={{
        class: selectedClass,
        stream: selectedStream,
        academicYear: selectedAcademicYear,
        term: selectedTerm ?? undefined,
        subject: selectedSubject,
      }}
      onConfirmImport={handleBatchImportScores}
    />
  </div>
);
}
