'use client';

import { PerformanceSummary } from '@/components/analysis/performance-summary';
import { SubjectPerformance } from '@/components/analysis/subject-performance';
import { ClassComparison } from '@/components/analysis/class-comparison';
import { GenderDistribution } from '@/components/analysis/gender-distribution';
import { CustomReportBuilder } from '@/components/analysis/custom-report-builder';
import { BroadsheetAnalysis } from '@/components/analysis/broadsheet-analysis';
import { GradeDistributionAnalysis } from '@/components/analysis/grade-distribution-analysis';
import { TopStudents } from '@/components/analysis/top-students';

export default function AnalysisPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-headline font-semibold md:text-3xl">Performance Analysis</h1>
        <p className="text-muted-foreground">
          An overview of academic performance across the school.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
            <PerformanceSummary />
        </div>
        <div className="lg:col-span-1">
            <TopStudents />
        </div>
      </div>
      <CustomReportBuilder />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SubjectPerformance />
        <ClassComparison />
      </div>
       <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GenderDistribution />
      </div>
      <BroadsheetAnalysis />
      <GradeDistributionAnalysis />
    </div>
  );
}
