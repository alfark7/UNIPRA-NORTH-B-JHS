'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, where, query, getDocs, writeBatch, doc } from 'firebase/firestore';
import type { Student, Attendance } from '@/lib/types';
import { DatePicker } from '@/components/ui/date-picker';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

type AttendanceData = {
    studentId: string;
    status: 'Present' | 'Absent' | 'Late';
    time: string;
};

export default function AttendancePage() {
    const firestore = useFirestore();
    const studentsQuery = useMemo(() => collection(firestore, 'students'), [firestore]);
    const attendanceQuery = useMemo(() => collection(firestore, 'attendance'), [firestore]);
    const { data: students, loading: studentsLoading } = useCollection<Student>(studentsQuery);
    const { data: allAttendance, loading: attendanceLoading } = useCollection<Attendance>(attendanceQuery);

    const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [selectedStream, setSelectedStream] = useState<string>('');
    const [attendance, setAttendance] = useState<Map<string, AttendanceData>>(new Map());
    const { toast } = useToast();

    const classLevels = useMemo(() => Array.from(new Set(students.map(s => s.class))), [students]);
    const streams = useMemo(() => Array.from(new Set(students.map(s => s.stream).filter(Boolean))) as string[], [students]);

    const filteredStudents = useMemo(() => {
        return students.filter(s =>
            (!selectedClass || s.class === selectedClass) &&
            (!selectedStream || s.stream === selectedStream)
        );
    }, [selectedClass, selectedStream, students]);
    
    useEffect(() => {
        if (filteredStudents.length > 0 && selectedClass && selectedDate) {
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            const todaysAttendance = allAttendance.filter(att => att.date === dateStr);
            const newAttendance = new Map<string, AttendanceData>();

            filteredStudents.forEach(student => {
                const existingRecord = todaysAttendance.find(att => att.studentId === student.id);
                if (existingRecord) {
                    newAttendance.set(student.id, existingRecord as AttendanceData);
                } else {
                    const now = new Date();
                    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                    newAttendance.set(student.id, {
                        studentId: student.id,
                        status: 'Present',
                        time: currentTime,
                    });
                }
            });
            setAttendance(newAttendance);
        } else {
            setAttendance(new Map());
        }
    }, [filteredStudents, selectedClass, selectedStream, selectedDate, allAttendance]);


    const handleAttendanceChange = (studentId: string, status: 'Present' | 'Absent' | 'Late') => {
        setAttendance(prev => {
            const newAtt = new Map(prev);
            const studentAtt = newAtt.get(studentId);
            if(studentAtt) {
                newAtt.set(studentId, { ...studentAtt, status });
            }
            return newAtt;
        });
    };

    const handleTimeChange = (studentId: string, time: string) => {
        setAttendance(prev => {
             const newAtt = new Map(prev);
            const studentAtt = newAtt.get(studentId);
            if(studentAtt) {
                newAtt.set(studentId, { ...studentAtt, time });
            }
            return newAtt;
        });
    };
    
    const handleSaveAttendance = async () => {
        if (!selectedClass || !selectedStream) {
            toast({
                variant: 'destructive',
                title: 'Selection Incomplete',
                description: 'Please select a class and stream.',
            });
            return;
        }
        
        if (!selectedDate) {
            toast({
                variant: 'destructive',
                title: 'Date not selected',
                description: 'Please select a date.',
            });
            return;
        }

        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        
        try {
            const batch = writeBatch(firestore);
            const attendanceCol = collection(firestore, 'attendance');

            for (const [studentId, attendanceData] of attendance.entries()) {
                // Find if an attendance record already exists for this student on this day
                 const existingRecord = allAttendance.find(att => att.studentId === studentId && att.date === dateStr);

                const dataToSave = {
                    ...attendanceData,
                    date: dateStr,
                };

                if (existingRecord && 'id' in existingRecord) {
                    const docRef = doc(firestore, 'attendance', (existingRecord as any).id);
                    batch.set(docRef, dataToSave, { merge: true });
                } else {
                    const docRef = doc(attendanceCol); // new doc
                    batch.set(docRef, dataToSave);
                }
            }

            await batch.commit();

            toast({
                title: 'Attendance Saved',
                description: `Attendance for ${selectedClass} ${selectedStream} on ${format(selectedDate, 'PPP')} has been recorded.`,
            });
        } catch(e) {
            console.error("Error saving attendance:", e);
            const permissionError = new FirestorePermissionError({
                path: 'attendance',
                operation: 'write'
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({
                variant: 'destructive',
                title: 'Save failed',
                description: 'You do not have permission to save attendance records.',
            });
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-headline font-semibold md:text-3xl">Attendance</h1>
                <p className="text-muted-foreground">Track daily student attendance.</p>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Take Attendance</CardTitle>
                    <CardDescription>Select a date, class, and stream to take attendance.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div>
                            <Label htmlFor="date-picker">Date</Label>
                            <DatePicker date={selectedDate} setDate={setSelectedDate} />
                        </div>
                        <div>
                            <Label htmlFor="class-select">Class</Label>
                            <Select value={selectedClass} onValueChange={setSelectedClass}>
                                <SelectTrigger id="class-select"><SelectValue placeholder="Select class" /></SelectTrigger>
                                <SelectContent>{classLevels.map(level => <SelectItem key={level} value={level}>{level}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="stream-select">Stream</Label>
                            <Select value={selectedStream} onValueChange={setSelectedStream} disabled={!selectedClass}>
                                <SelectTrigger id="stream-select"><SelectValue placeholder="Select stream" /></SelectTrigger>
                                <SelectContent>{streams.map(stream => <SelectItem key={stream} value={stream}>{stream}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                    {filteredStudents.length > 0 && attendance.size > 0 && (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Student Name</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Arrival Time</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredStudents.map(student => {
                                        const studentAttendance = attendance.get(student.id);
                                        return (
                                            <TableRow key={student.id}>
                                                <TableCell className="font-medium">{student.firstName} {student.lastName}</TableCell>
                                                <TableCell>
                                                    <RadioGroup 
                                                        value={studentAttendance?.status || 'Present'} 
                                                        onValueChange={(value: 'Present' | 'Absent' | 'Late') => handleAttendanceChange(student.id, value)}
                                                        className="flex gap-4"
                                                    >
                                                        <div className="flex items-center space-x-2">
                                                            <RadioGroupItem value="Present" id={`${student.id}-present`} />
                                                            <Label htmlFor={`${student.id}-present`}>Present</Label>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <RadioGroupItem value="Absent" id={`${student.id}-absent`} />
                                                            <Label htmlFor={`${student.id}-absent`}>Absent</Label>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <RadioGroupItem value="Late" id={`${student.id}-late`} />
                                                            <Label htmlFor={`${student.id}-late`}>Late</Label>
                                                        </div>
                                                    </RadioGroup>
                                                </TableCell>
                                                <TableCell>
                                                    <Input 
                                                        type="time" 
                                                        value={studentAttendance?.time || ''}
                                                        onChange={(e) => handleTimeChange(student.id, e.target.value)}
                                                        disabled={studentAttendance?.status === 'Absent'}
                                                        className="w-32"
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
                <CardFooter>
                    <Button onClick={handleSaveAttendance} disabled={filteredStudents.length === 0}>Save Attendance</Button>
                </CardFooter>
            </Card>
        </div>
    );
}
