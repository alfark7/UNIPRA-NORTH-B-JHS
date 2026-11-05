'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Teacher, Attendance, Student } from '@/lib/types';
import { exportReport } from '@/lib/excel';
import {
  BeceCandidate,
  BECE_ACADEMIC_YEARS,
  calculateBeceAnalysis,
  getInitialBeceCandidates,
} from '@/lib/bece-data';
import {
  exportBeceToPdf,
  exportBeceAnalysisToExcel,
} from '@/lib/bece-excel';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { startOfMonth, endOfMonth, subMonths, startOfToday } from 'date-fns';
import { Award, CheckCircle2, XCircle, TrendingUp, Download, FileSpreadsheet, FileText } from 'lucide-react';

export function CustomReportBuilder() {
  const [reportCategory, setReportCategory] = useState('bece');
  const [beceYear, setBeceYear] = useState('2025/2026');
  const [timePeriod, setTimePeriod] = useState('current_month');
  const [format, setFormat] = useState('pdf');
  const { toast } = useToast();

  const firestore = useFirestore();

  // Teachers, Attendance, Students queries
  const teachersQuery = useMemo(() => collection(firestore, 'teachers'), [firestore]);
  const attendanceQuery = useMemo(() => collection(firestore, 'attendance'), [firestore]);
  const studentsQuery = useMemo(() => collection(firestore, 'students'), [firestore]);

  const { data: teachers } = useCollection<Teacher>(teachersQuery);
  const { data: attendance } = useCollection<Attendance>(attendanceQuery);
  const { data: students } = useCollection<Student>(studentsQuery);

  // BECE Candidates query for selected year
  const beceQuery = useMemo(() => {
    return query(collection(firestore, 'beceRecords'), where('academicYear', '==', beceYear));
  }, [firestore, beceYear]);

  const { data: rawBeceCandidates, loading: beceLoading } = useCollection<BeceCandidate>(beceQuery);

  // Effective BECE candidates (using PDF data fallback if DB empty for 2025/2026)
  const beceCandidates = useMemo(() => {
    if (rawBeceCandidates.length > 0) return rawBeceCandidates;
    if (beceYear === '2025/2026') return getInitialBeceCandidates('2025/2026');
    return [];
  }, [rawBeceCandidates, beceYear]);

  // Calculated analysis for BECE
  const beceAnalysis = useMemo(() => {
    return calculateBeceAnalysis(beceCandidates);
  }, [beceCandidates]);

  const handleBuildReport = () => {
    const now = startOfToday();

    if (reportCategory === 'bece') {
      if (beceCandidates.length === 0) {
        toast({
          title: `No BECE candidates found for ${beceYear}`,
          description: 'Please add or import BECE candidates on the BECE Academic performance page first.',
          variant: 'destructive',
        });
        return;
      }

      if (format === 'pdf') {
        exportBeceToPdf(beceCandidates, beceYear, beceAnalysis);
        toast({
          title: 'BECE Report Generated (PDF)',
          description: `Downloaded comprehensive candidate list and subject pass/fail analysis for ${beceYear}.`,
        });
      } else if (format === 'excel') {
        exportBeceAnalysisToExcel(beceAnalysis, beceYear);
        toast({
          title: 'BECE Analysis Generated (Excel)',
          description: `Downloaded subject pass/fail analysis and key findings spreadsheet for ${beceYear}.`,
        });
      } else if (format === 'csv') {
        const csvRows = beceAnalysis.subjectAnalysis.map((s) => ({
          'Subject': s.subjectName,
          'Code': s.code,
          'Pass Count': s.passCount,
          'Pass %': `${s.passPercent}%`,
          'Fail Count': s.failCount,
          'Fail %': `${s.failPercent}%`,
        }));
        exportReport(csvRows, `UNIPRA_NORTH_JHS_BECE_ANALYSIS_${beceYear.replace(/[^a-zA-Z0-9]/g, '_')}.csv`, true);
        toast({
          title: 'BECE Analysis Generated (CSV)',
          description: `Exported BECE subject analysis as CSV for ${beceYear}.`,
        });
      }
      return;
    }

    const timePeriodFilters: { [key: string]: (dateStr: string) => boolean } = {
      current_month: (recordDate) => {
        const date = new Date(recordDate);
        return date >= startOfMonth(now) && date <= endOfMonth(now);
      },
      last_month: (recordDate) => {
        const lastMonth = subMonths(now, 1);
        const date = new Date(recordDate);
        return date >= startOfMonth(lastMonth) && date <= endOfMonth(lastMonth);
      },
      current_term: (recordDate) => {
        return new Date(recordDate) >= subMonths(now, 3);
      },
      last_term: (recordDate) => {
        const date = new Date(recordDate);
        const threeMonthsAgo = subMonths(now, 3);
        const sixMonthsAgo = subMonths(now, 6);
        return date >= sixMonthsAgo && date < threeMonthsAgo;
      },
    };

    const generatePdf = (title: string, head: string[][], body: any[][], fileName: string) => {
      const doc = new jsPDF();
      doc.text(title, 14, 16);
      (doc as any).autoTable({
        head: head,
        body: body,
        startY: 20,
      });
      doc.save(fileName);
    };

    if (reportCategory === 'attendance') {
      if (attendance.length === 0) {
        toast({ title: 'No attendance data available to generate a report.', variant: 'destructive' });
        return;
      }

      const filterFn = timePeriodFilters[timePeriod] || (() => true);
      const filteredAttendance = attendance.filter((rec) => filterFn(rec.date));

      if (filteredAttendance.length === 0) {
        toast({
          title: 'No attendance data for the selected period.',
          description: 'Try selecting a different time period.',
          variant: 'destructive',
        });
        return;
      }

      const studentMap = new Map(students.map((s) => [s.id, `${s.firstName} ${s.lastName}`]));
      const reportData = filteredAttendance.map((rec) => ({
        Date: rec.date,
        'Student Name': studentMap.get(rec.studentId) || 'Unknown Student',
        Status: rec.status,
        Time: rec.time || 'N/A',
      }));

      const headers = Object.keys(reportData[0]);
      const body = reportData.map(Object.values);

      if (format === 'pdf') {
        generatePdf('Attendance Report', [headers], body, 'attendance-report.pdf');
      } else if (format === 'excel') {
        exportReport(reportData, 'attendance_report.xlsx');
      } else if (format === 'csv') {
        exportReport(reportData, 'attendance_report.csv', true);
      }
      toast({ title: 'Attendance Report Generated Successfully' });
    } else if (reportCategory === 'teachers') {
      if (teachers.length === 0) {
        toast({ title: 'No teacher data available to generate a report.', variant: 'destructive' });
        return;
      }

      const reportData = teachers.map((t) => ({
        'Staff ID': t.staffId,
        'First Name': t.firstName,
        'Last Name': t.lastName,
        Email: t.email,
        Phone: t.phone,
        Role: t.role,
        Rank: t.rank,
        Subjects: t.subjects.join(', '),
      }));

      const headers = Object.keys(reportData[0]);
      const body = reportData.map(Object.values);

      if (format === 'pdf') {
        generatePdf('Teachers Report', [headers], body, 'teachers-report.pdf');
      } else if (format === 'excel') {
        exportReport(reportData, 'teachers_report.xlsx');
      } else if (format === 'csv') {
        exportReport(reportData, 'teachers_report.csv', true);
      }
      toast({ title: 'Teachers Report Generated Successfully' });
    }
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Custom Report Builder
            </CardTitle>
            <CardDescription>
              Create and export analytical reports tailored to your school academic needs
            </CardDescription>
          </div>
          {reportCategory === 'bece' && (
            <Badge variant="outline" className="w-fit bg-primary/10 text-primary border-primary/20 text-xs">
              UNIPRA NORTH JHS BECE Analysis Active
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Controls Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="report-category">Report Category</Label>
            <Select value={reportCategory} onValueChange={setReportCategory}>
              <SelectTrigger id="report-category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bece">BECE Academic Performance Analysis</SelectItem>
                <SelectItem value="attendance">Attendance Records</SelectItem>
                <SelectItem value="teachers">Teachers Information</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {reportCategory === 'bece' ? (
            <div>
              <Label htmlFor="bece-year">BECE Academic Year</Label>
              <Select value={beceYear} onValueChange={setBeceYear}>
                <SelectTrigger id="bece-year">
                  <SelectValue placeholder="Select BECE year" />
                </SelectTrigger>
                <SelectContent>
                  {BECE_ACADEMIC_YEARS.map((yr) => (
                    <SelectItem key={yr} value={yr}>
                      {yr} Academic Year
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Select year to analyze candidates</p>
            </div>
          ) : (
            <div>
              <Label htmlFor="time-period">Time Period</Label>
              <Select value={timePeriod} onValueChange={setTimePeriod} disabled={reportCategory !== 'attendance'}>
                <SelectTrigger id="time-period">
                  <SelectValue placeholder="Select time period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current_month">Current Month</SelectItem>
                  <SelectItem value="last_month">Last Month</SelectItem>
                  <SelectItem value="current_term">Current Term (Last 3 Months)</SelectItem>
                  <SelectItem value="last_term">Last Term (3-6 Months Ago)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Applicable to attendance reports only.</p>
            </div>
          )}

          <div>
            <Label htmlFor="format">Export Format</Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger id="format">
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF Analysis Document</SelectItem>
                <SelectItem value="excel">Excel Spreadsheet (.xlsx)</SelectItem>
                <SelectItem value="csv">CSV File (.csv)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={handleBuildReport} className="gap-2">
            <Download className="h-4 w-4" />
            Build & Download Report
          </Button>
          {reportCategory === 'bece' && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  exportBeceToPdf(beceCandidates, beceYear, beceAnalysis);
                }}
                className="gap-2"
              >
                <FileText className="h-4 w-4 text-rose-600" />
                Quick PDF Export
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  exportBeceAnalysisToExcel(beceAnalysis, beceYear);
                }}
                className="gap-2"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                Quick Excel Analysis
              </Button>
            </>
          )}
        </div>

        {/* BECE Interactive Analysis Display directly in the Custom Builder */}
        {reportCategory === 'bece' && (
          <div className="space-y-6 pt-4 border-t">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="font-semibold text-lg text-foreground">
                  BECE Results Analysis Preview — {beceYear} Academic Year
                </h3>
                <p className="text-sm text-muted-foreground">
                  UNIPRA NORTH JHS Candidate Pass &amp; Fail Statistical Breakdown as per official records
                </p>
              </div>
              <Badge variant="secondary" className="font-mono text-xs w-fit">
                {beceCandidates.length} Total Candidates
              </Badge>
            </div>

            {/* Overall Statistics Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-lg border bg-card">
                <p className="text-xs font-medium text-muted-foreground">Total Candidates</p>
                <p className="text-2xl font-bold mt-1">{beceAnalysis.totalCandidates}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Enrolled for examination</p>
              </div>

              <div className="p-3.5 rounded-lg border bg-card">
                <p className="text-xs font-medium text-muted-foreground">Subject Entries</p>
                <p className="text-2xl font-bold mt-1">{beceAnalysis.totalSubjectEntries.toLocaleString()}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">10 subjects per student</p>
              </div>

              <div className="p-3.5 rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Total Passes (1–6)</p>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                  {beceAnalysis.totalPasses.toLocaleString()}
                </p>
                <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {beceAnalysis.overallPassPercent}% Overall Pass Rate
                </p>
              </div>

              <div className="p-3.5 rounded-lg border bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-rose-800 dark:text-rose-300">Total Failures (7–9)</p>
                  <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                </div>
                <p className="text-2xl font-bold text-rose-700 dark:text-rose-400 mt-1">
                  {beceAnalysis.totalFailures.toLocaleString()}
                </p>
                <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
                  {beceAnalysis.overallFailPercent}% Overall Fail Rate
                </p>
              </div>
            </div>

            {/* Subject Pass & Fail Analysis Table as in PDF */}
            <div className="rounded-lg border overflow-hidden">
              <div className="bg-muted/50 px-4 py-3 border-b flex items-center justify-between">
                <h4 className="font-semibold text-sm">Subject Pass &amp; Fail Analysis (Grades 1–6 = Pass, 7–9 = Fail)</h4>
                <span className="text-xs text-muted-foreground">Source: BECE broadsheet</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/20 text-muted-foreground text-xs text-left">
                      <th className="py-2.5 px-3 font-semibold text-center w-12">No.</th>
                      <th className="py-2.5 px-3 font-semibold">Subject</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Code</th>
                      <th className="py-2.5 px-3 font-semibold text-center text-emerald-700 dark:text-emerald-400">Pass (Grades 1–6)</th>
                      <th className="py-2.5 px-3 font-semibold text-center text-emerald-700 dark:text-emerald-400">Pass %</th>
                      <th className="py-2.5 px-3 font-semibold text-center text-rose-700 dark:text-rose-400">Fail (Grades 7–9)</th>
                      <th className="py-2.5 px-3 font-semibold text-center text-rose-700 dark:text-rose-400">Fail %</th>
                      <th className="py-2.5 px-3 font-semibold w-40">Pass Progress</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs">
                    {beceAnalysis.subjectAnalysis.map((sub) => (
                      <tr key={sub.subjectKey} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2 px-3 text-center text-muted-foreground font-mono">{sub.no}</td>
                        <td className="py-2 px-3 font-medium text-foreground">{sub.subjectName}</td>
                        <td className="py-2 px-3 text-center">
                          <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
                            {sub.code}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-center font-semibold text-emerald-700 dark:text-emerald-400">
                          {sub.passCount}
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-emerald-700 dark:text-emerald-400">
                          {sub.passPercent}%
                        </td>
                        <td className="py-2 px-3 text-center font-semibold text-rose-600 dark:text-rose-400">
                          {sub.failCount}
                        </td>
                        <td className="py-2 px-3 text-center text-rose-600 dark:text-rose-400">
                          {sub.failPercent}%
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <Progress value={sub.passPercent} className="h-2 flex-1" />
                            <span className="text-[10px] text-muted-foreground font-mono w-9 text-right">
                              {sub.passPercent}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Best Performing Subjects Ranking */}
            <div>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-primary" />
                Best Performing Subjects Ranking
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                {beceAnalysis.bestPerformingSubjects.map((b) => (
                  <div
                    key={b.subjectName}
                    className="p-2.5 rounded-lg border bg-card flex flex-col justify-between hover:shadow-xs transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                        Rank #{b.rank}
                      </span>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {b.passPercent}%
                      </span>
                    </div>
                    <p className="text-xs font-medium truncate" title={b.subjectName}>
                      {b.subjectName}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Fail: {b.failPercent}%
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
