
'use client';

import { Activity, BookOpen, Users } from 'lucide-react';
import { useMemo } from 'react';
import { useCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PerformanceChart } from '@/components/dashboard/performance-chart';
import { AttendanceOverview } from '@/components/dashboard/attendance-overview';
import type { Student, Teacher, Attendance } from '@/lib/types';
import { format } from 'date-fns';

export default function DashboardPage() {
  const firestore = useFirestore();

  const studentsQuery = useMemo(() => collection(firestore, 'students'), [firestore]);
  const teachersQuery = useMemo(() => collection(firestore, 'teachers'), [firestore]);
  
  const today = new Date();
  const dateStr = format(today, 'yyyy-MM-dd');
  const attendanceQuery = useMemo(() => query(collection(firestore, 'attendance'), where('date', '==', dateStr)), [firestore, dateStr]);
  
  const { data: students, loading: studentsLoading } = useCollection<Student>(studentsQuery);
  const { data: teachers, loading: teachersLoading } = useCollection<Teacher>(teachersQuery);
  const { data: todayAttendance, loading: attendanceLoading } = useCollection<Attendance>(attendanceQuery);

  const totalStudents = students.length;
  const totalTeachers = teachers.length;

  const attendancePercentage = useMemo(() => {
    if (students.length === 0) return 0;
    const presentCount = todayAttendance.filter(att => att.status === 'Present' || att.status === 'Late').length;
    return Math.round((presentCount / students.length) * 100);
  }, [todayAttendance, students]);


  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Students
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{studentsLoading ? '...' : totalStudents}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Teachers
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teachersLoading ? '...' : totalTeachers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Overall Attendance
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{attendanceLoading ? '...' : `${attendancePercentage}%`}</div>
            <p className="text-xs text-muted-foreground">
              Today's attendance
            </p>
          </CardContent>
        </Card>
        <Card className="bg-primary text-primary-foreground">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Current Term
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Term 2, 2024</div>
            <p className="text-xs text-muted-foreground text-primary-foreground/80">
              Ends in 4 weeks
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="lg:col-span-4">
          <PerformanceChart />
        </div>
        <div className="lg:col-span-3">
          <AttendanceOverview attendance={todayAttendance} totalStudents={totalStudents} loading={attendanceLoading} />
        </div>
      </div>
    </div>
  );
}
