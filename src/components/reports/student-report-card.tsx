'use client';

import React from 'react';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Student, AcademicRecord, SubjectScore } from '@/lib/types';
import { subjects } from '@/lib/types';
import { calculateScores, getGradeRemark } from '@/lib/grading';

interface StudentReportCardProps {
  student: Student;
  academicRecord?: AcademicRecord;
  attendanceSummary?: { present: number; total: number } | null;
  position?: number | null;
  totalScore?: number | null;
  maxScore?: number | null;
  totalStudentsInClass?: number;
  aggregateScore?: number | null;
  selectedAcademicYear: string;
  selectedTerm: number | null;
  vacationDate?: Date;
  reopeningDate?: Date;
  schoolName: string;
  schoolLogoUrl: string;
  headTeacherSignature?: string | null;
  scoreSettings: {
    test1: number;
    test2: number;
    groupWork: number;
    project: number;
    classExercises: number;
    homeWork: number;
    exam: number;
  };
  isBatch?: boolean;
  isLast?: boolean;
}

export function StudentReportCard({
  student,
  academicRecord,
  attendanceSummary,
  position,
  totalScore,
  maxScore,
  totalStudentsInClass,
  aggregateScore,
  selectedAcademicYear,
  selectedTerm,
  vacationDate,
  reopeningDate,
  schoolName,
  schoolLogoUrl,
  headTeacherSignature,
  scoreSettings,
  isBatch = false,
  isLast = false,
}: StudentReportCardProps) {
  const studentInitials = `${student.firstName?.[0] || ''}${student.lastName?.[0] || ''}`.toUpperCase() || 'ST';
  const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim().toUpperCase();
  const classStreamDisplay = `${student.class || ''} ${student.stream ? `Stream ${student.stream}` : ''}`.trim();

  return (
    <div
      className={`printable-report printable-report-card bg-white text-black text-xs p-4 sm:p-5 border border-black rounded-lg shadow-sm print:shadow-none print:rounded-none print:border-black print:p-3 relative ${
        isBatch && !isLast ? 'page-break-after mb-8 print:mb-0' : 'mb-4 print:mb-0'
      }`}
      style={isBatch && !isLast ? { pageBreakAfter: 'always', breakAfter: 'page' } : {}}
      data-student-id={student.id}
    >
      {/* Header with School Logo, School Name, and Student Avatar */}
      <div className="flex justify-between items-center mb-3 border-b border-black pb-2">
        <div className="flex-shrink-0 w-20 h-20 flex items-center justify-center">
          {schoolLogoUrl ? (
            <img
              src={schoolLogoUrl}
              alt="School Logo"
              className="max-h-16 max-w-16 object-contain"
              crossOrigin="anonymous"
            />
          ) : (
            <div className="w-16 h-16 border border-black rounded flex items-center justify-center font-bold text-xs">
              UP JHS
            </div>
          )}
        </div>

        <div className="text-center flex-grow px-3">
          <h1 className="text-base sm:text-lg font-bold tracking-tight uppercase leading-snug">
            {schoolName || 'UNIVERSITY PRACTICE JUNIOR HIGH SCHOOL'}
          </h1>
          <p className="font-bold text-xs tracking-wider uppercase text-neutral-800">
            CONTINUOUS ASSESSMENT & END OF TERM REPORT CARD
          </p>
        </div>

        <div className="flex-shrink-0 w-20 h-20 flex items-center justify-end">
          {student.avatar ? (
            <img
              src={student.avatar}
              alt={`${fullName} photo`}
              className="w-16 h-20 object-cover border-2 border-black rounded-sm"
              crossOrigin="anonymous"
            />
          ) : (
            <div className="w-16 h-20 border-2 border-black rounded-sm flex flex-col items-center justify-center bg-gray-100 text-gray-700 font-bold text-xs">
              <span>{studentInitials}</span>
              <span className="text-[9px] font-normal mt-0.5">PHOTO</span>
            </div>
          )}
        </div>
      </div>

      {/* Student Demographics and Term Info */}
      <div className="grid grid-cols-2 gap-x-6 mb-3 text-[11px] leading-relaxed border-b border-black pb-2">
        <div className="space-y-0.5">
          <p>
            <span className="font-bold">STUDENT'S NAME:</span> {fullName}
          </p>
          <p>
            <span className="font-bold">GRADE / CLASS:</span> {classStreamDisplay || 'JHS'}
          </p>
          <p>
            <span className="font-bold">NUMBER ON ROLL:</span> {totalStudentsInClass || 0}
          </p>
          <p>
            <span className="font-bold">ADMISSION NO:</span> {student.admissionNumber || 'N/A'}
          </p>
        </div>
        <div className="space-y-0.5 text-left">
          <p>
            <span className="font-bold">ACADEMIC YEAR:</span> {selectedAcademicYear || 'N/A'}
          </p>
          <p>
            <span className="font-bold">TERM:</span> {selectedTerm ? `TERM ${selectedTerm}` : 'N/A'}
          </p>
          <p>
            <span className="font-bold">VACATION DATE:</span>{' '}
            {vacationDate ? vacationDate.toLocaleDateString('en-GB') : '[Not Set]'}
          </p>
          <p>
            <span className="font-bold">RE-OPENING DATE:</span>{' '}
            {reopeningDate ? reopeningDate.toLocaleDateString('en-GB') : '[Not Set]'}
          </p>
        </div>
      </div>

      {/* Subject Scores Table */}
      <table className="w-full border-collapse border border-black mb-3 text-[11px] leading-tight">
        <thead>
          <tr className="bg-gray-100 print:bg-gray-100">
            <th className="border border-black p-1 text-left font-bold w-[34%]">SUBJECTS</th>
            <th className="border border-black p-1 text-center font-bold w-[13%]">CLASS (50%)</th>
            <th className="border border-black p-1 text-center font-bold w-[13%]">EXAM (50%)</th>
            <th className="border border-black p-1 text-center font-bold w-[14%]">TOTAL (100%)</th>
            <th className="border border-black p-1 text-center font-bold w-[10%]">GRADE</th>
            <th className="border border-black p-1 text-center font-bold w-[16%]">REMARK</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((subject) => {
            const score = academicRecord?.scores?.find((s) => s.subject === subject);
            const calculated = score ? calculateScores(score, scoreSettings) : null;
            return (
              <tr key={subject} className="hover:bg-gray-50/50">
                <td className="border border-black px-1.5 py-0.5 font-medium">{subject.toUpperCase()}</td>
                <td className="border border-black p-0.5 text-center">
                  {calculated ? calculated.classScore : '-'}
                </td>
                <td className="border border-black p-0.5 text-center">
                  {calculated ? calculated.examScore : '-'}
                </td>
                <td className="border border-black p-0.5 text-center font-semibold">
                  {calculated ? calculated.total : '-'}
                </td>
                <td className="border border-black p-0.5 text-center font-bold">
                  {calculated ? calculated.grade : '-'}
                </td>
                <td className="border border-black p-0.5 text-center text-[10px]">
                  {calculated ? getGradeRemark(calculated.grade) : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Attendance, Overall Score, Position & Aggregate */}
      <div className="grid grid-cols-3 gap-3 mb-3 text-[11px] border border-black p-2 bg-gray-50/40 print:bg-transparent">
        <div className="space-y-1">
          <p>
            <span className="font-bold">ATTENDANCE:</span>{' '}
            {attendanceSummary ? `${attendanceSummary.present} / ${attendanceSummary.total} days` : 'N/A'}
          </p>
          <p>
            <span className="font-bold">CONDUCT:</span> {student.conduct || 'Satisfactory'}
          </p>
          <p>
            <span className="font-bold">INTEREST:</span> {student.interest || 'Keen & Attentive'}
          </p>
        </div>
        <div className="col-span-2 grid grid-cols-2 gap-x-3 gap-y-1 pl-2 border-l border-black">
          <p>
            <span className="font-bold">TOTAL SCORE:</span>{' '}
            {totalScore !== null && totalScore !== undefined ? `${totalScore} / ${maxScore || 1000}` : 'N/A'}
          </p>
          <p>
            <span className="font-bold">POSITION:</span>{' '}
            <span className="font-bold underline">
              {position !== null && position !== undefined ? `${position}${getOrdinalSuffix(position)}` : 'N/A'}
            </span>
          </p>
          <p>
            <span className="font-bold">BEST-6 AGGREGATE:</span>{' '}
            <span className="font-bold">
              {aggregateScore !== null && aggregateScore !== undefined ? aggregateScore : 'N/A'}
            </span>
          </p>
          <p>
            <span className="font-bold">COHORT ROLL:</span> {totalStudentsInClass || 0} Students
          </p>
        </div>
      </div>

      {/* Remarks Section */}
      <div className="space-y-1.5 mb-3 text-[11px] border-b border-black pb-2">
        <p className="leading-tight">
          <span className="font-bold">CLASS TEACHER'S REMARK:</span>{' '}
          <span className="italic">{student.classTeacherRemark || 'Good performance, keep striving for excellence.'}</span>
        </p>
        <p className="leading-tight">
          <span className="font-bold">HEAD TEACHER'S REMARK:</span>{' '}
          <span className="italic">{student.headTeacherRemark || 'Commendable effort. Encouraged to maintain this standard.'}</span>
        </p>
      </div>

      {/* Promotion and Signature */}
      <div className="flex justify-between items-end mb-2 text-[11px]">
        <div>
          <p className="font-bold">
            PROMOTED TO: <span className="underline ml-1">_________________________</span>
          </p>
        </div>
        <div className="text-center min-w-[150px]">
          {headTeacherSignature ? (
            <img
              src={headTeacherSignature}
              alt="Head Teacher Signature"
              className="h-9 mx-auto object-contain"
              crossOrigin="anonymous"
            />
          ) : (
            <div className="h-6" />
          )}
          <p className="border-t border-black pt-0.5 font-bold text-[10px]">HEAD TEACHER SIGNATURE</p>
        </div>
      </div>

      {/* Grading Key Footer */}
      <div className="text-[10px] text-center border-t border-black pt-1 mt-1 text-gray-800">
        <p className="font-bold text-[9px] uppercase tracking-wider mb-0.5">BECE / WAEC GRADING SYSTEM</p>
        <div className="grid grid-cols-3 gap-x-2 leading-tight">
          <p><strong>Grade 1:</strong> 90%-100% (Highest)</p>
          <p><strong>Grade 2:</strong> 80%-89% (Higher)</p>
          <p><strong>Grade 3:</strong> 70%-79% (High)</p>
          <p><strong>Grade 4:</strong> 60%-69% (Above Average)</p>
          <p><strong>Grade 5:</strong> 55%-59% (Average)</p>
          <p><strong>Grade 6:</strong> 50%-54% (Below Average)</p>
          <p><strong>Grade 7:</strong> 45%-49% (Low)</p>
          <p><strong>Grade 8:</strong> 40%-44% (Lower)</p>
          <p><strong>Grade 9:</strong> 0%-39% (Lowest)</p>
        </div>
      </div>
    </div>
  );
}

function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
