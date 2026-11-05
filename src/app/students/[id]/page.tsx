
'use client';

import { useState, useEffect, useMemo } from 'react';
import { notFound, useParams } from 'next/navigation';
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User, Phone, Mail, GraduationCap, Award, Calendar as CalendarIcon, Users } from 'lucide-react';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { subjects as allSubjects, type SubjectScore, type AcademicRecord, type Student } from '@/lib/types';
import { calculateScores, getGradeRemark } from '@/lib/grading';


const defaultScoreSettings = {
  test1: 100,
  test2: 100,
  groupWork: 50,
  project: 50,
  classExercises: 20,
  homeWork: 20,
  exam: 100,
};

export default function StudentDetailPage() {
  const params = useParams<{ id: string }>();
  const firestore = useFirestore();
  const [scoreSettings, setScoreSettings] = useState(defaultScoreSettings);
  
  const studentDocRef = useMemo(() => doc(firestore, 'students', params.id), [firestore, params.id]);
  const { data: student, loading: studentLoading } = useDoc<Student>(studentDocRef);

  const academicRecordsQuery = useMemo(() => 
    query(collection(firestore, 'academicRecords'), where('studentId', '==', params.id)),
    [firestore, params.id]
  );
  const { data: studentAcademicRecords, loading: recordsLoading } = useCollection<AcademicRecord>(academicRecordsQuery);


  useEffect(() => {
    const handleStorageChange = () => {
      const savedScoreSettings = localStorage.getItem('score-settings');
      if (savedScoreSettings) {
        try {
          setScoreSettings(JSON.parse(savedScoreSettings));
        } catch (error) {
          console.error("Failed to parse score settings from storage", error);
        }
      }
    };
    
    handleStorageChange();
    window.addEventListener('storage_change', handleStorageChange);
    return () => window.removeEventListener('storage_change', handleStorageChange);
  }, []);
  
  const terms = Array.from(new Set(studentAcademicRecords.map(r => r.term))).sort();

  if (studentLoading) {
      return <div>Loading...</div>
  }

  if (!student) {
    notFound();
  }
  

  const DetailItem = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: string | React.ReactNode }) => (
    <div className="flex items-start gap-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-col items-center text-center gap-4 p-6 sm:flex-row sm:text-left">
          <Avatar className="h-24 w-24">
            <AvatarImage src={student.avatar} alt={`${student.firstName} ${student.lastName}`} />
            <AvatarFallback className="text-3xl">
              {student.firstName[0]}{student.lastName[0]}
            </AvatarFallback>
          </Avatar>
          <div className="grid gap-1">
            <CardTitle className="text-3xl">{student.firstName} {student.lastName}</CardTitle>
            <CardDescription className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <Badge variant="outline">{student.class}</Badge>
              {student.stream && <Badge variant="secondary">{student.stream}</Badge>}
              <Badge variant="default">{student.section}</Badge>
              <span>{student.email}</span>
            </CardDescription>
          </div>
        </CardHeader>
      </Card>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <DetailItem icon={User} label="Full Name" value={`${student.firstName} ${student.lastName}`} />
            <DetailItem 
              icon={CalendarIcon} 
              label="Date of Birth" 
              value={(() => {
                if (!student.dateOfBirth) return 'N/A';
                try {
                  const d = new Date(student.dateOfBirth);
                  return isNaN(d.getTime()) ? student.dateOfBirth : format(d, 'MMMM d, yyyy');
                } catch {
                  return student.dateOfBirth;
                }
              })()} 
            />
            <DetailItem icon={Users} label="Gender" value={student.gender} />
            <DetailItem icon={GraduationCap} label="Admission Number" value={student.admissionNumber} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Guardian Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <DetailItem icon={User} label="Guardian Name" value={student.guardianName} />
            <DetailItem icon={Phone} label="Guardian Phone" value={student.guardianPhone} />
            <DetailItem icon={Mail} label="Contact Email" value={student.email} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Academic Standing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <DetailItem icon={GraduationCap} label="Class" value={student.class} />
            <DetailItem icon={Award} label="Stream" value={student.stream || 'N/A'} />
            <DetailItem icon={Users} label="Section" value={student.section} />
          </CardContent>
        </Card>
      </div>

        <Tabs defaultValue="performance" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="performance">Performance</TabsTrigger>
                <TabsTrigger value="remarks">Remarks</TabsTrigger>
            </TabsList>
            <TabsContent value="performance">
                <Card className="lg:col-span-3">
                    <CardHeader>
                    <CardTitle>Termly Performance</CardTitle>
                    <CardDescription>
                        Detailed academic scores for each term.
                    </CardDescription>
                    </CardHeader>
                    <CardContent>
                    {studentAcademicRecords.length > 0 ? (
                        <Tabs defaultValue={`term-${terms[0]}`}>
                        <TabsList>
                            {terms.map(term => (
                                <TabsTrigger key={`term-trigger-${term}`} value={`term-${term}`}>Term {term}</TabsTrigger>
                            ))}
                        </TabsList>
                        {terms.map(term => {
                            const termScores = studentAcademicRecords.find(r => r.term === term)?.scores || [];
                            return (
                            <TabsContent key={`term-content-${term}`} value={`term-${term}`}>
                                <div className="overflow-x-auto">
                                    <Table>
                                    <TableHeader>
                                        <TableRow>
                                        <TableHead>Subject</TableHead>
                                        <TableHead>Test 1</TableHead>
                                        <TableHead>Test 2</TableHead>
                                        <TableHead>Group Work</TableHead>
                                        <TableHead>Project</TableHead>
                                        <TableHead>Class Ex.</TableHead>
                                        <TableHead>Home Work</TableHead>
                                        <TableHead>Exam</TableHead>
                                        <TableHead className="font-semibold">Total</TableHead>
                                        <TableHead className="font-semibold">Grade</TableHead>
                                        <TableHead className="font-semibold">Remark</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {allSubjects.map(subject => {
                                            const score = termScores.find(s => s.subject === subject);
                                            const calculated = score ? calculateScores(score, scoreSettings) : null;
                                            return (
                                                <TableRow key={subject}>
                                                    <TableCell className="font-medium">{subject}</TableCell>
                                                    <TableCell>{score ? score.test1 : <span className="text-muted-foreground">-</span>}</TableCell>
                                                    <TableCell>{score ? score.test2 : <span className="text-muted-foreground">-</span>}</TableCell>
                                                    <TableCell>{score ? score.groupWork : <span className="text-muted-foreground">-</span>}</TableCell>
                                                    <TableCell>{score ? score.project : <span className="text-muted-foreground">-</span>}</TableCell>
                                                    <TableCell>{score ? score.classExercises : <span className="text-muted-foreground">-</span>}</TableCell>
                                                    <TableCell>{score ? score.homeWork : <span className="text-muted-foreground">-</span>}</TableCell>
                                                    <TableCell>{score ? score.exam : <span className="text-muted-foreground">-</span>}</TableCell>
                                                    <TableCell className="font-semibold">{calculated ? calculated.total : <span className="text-muted-foreground">-</span>}</TableCell>
                                                    <TableCell className="font-semibold">{calculated ? calculated.grade : <span className="text-muted-foreground">-</span>}</TableCell>
                                                    <TableCell className="font-medium">{calculated ? getGradeRemark(calculated.grade) : <span className="text-muted-foreground">-</span>}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                    </Table>
                                </div>
                            </TabsContent>
                            )
                        })}
                        </Tabs>
                    ) : (
                        <div className="text-center text-sm text-muted-foreground p-8">
                        No academic records found for this student.
                        </div>
                    )}
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="remarks">
                <Card>
                    <CardHeader>
                        <CardTitle>Student Remarks</CardTitle>
                        <CardDescription>Conduct, interest, and teacher's comments for the current term.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <h3 className="font-semibold text-lg">Conduct</h3>
                            <p className="text-muted-foreground text-sm">{student.conduct || 'No conduct remarks available.'}</p>
                        </div>
                         <div className="space-y-2">
                            <h3 className="font-semibold text-lg">Interest</h3>
                            <p className="text-muted-foreground text-sm">{student.interest || 'No interest remarks available.'}</p>
                        </div>
                         <div className="space-y-2">
                            <h3 className="font-semibold text-lg">Class Teacher's Remark</h3>
                            <p className="text-muted-foreground text-sm">{student.classTeacherRemark || 'No class teacher remark available.'}</p>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    </div>
  );
}
