'use client';

import { useMemo } from 'react';
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Award,
  Sparkles,
  BarChart3,
  X,
  SlidersHorizontal,
  TrendingUp,
  Layers,
  Star,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BeceCandidate,
  BeceSubjectKey,
  BECE_ELECTIVE_SUBJECTS,
  calculateElectivePerformance,
  calculateAllElectivesSummary,
  ElectivePerformanceMetrics,
} from '@/lib/bece-data';

export type ElectiveGradeFilterType =
  | 'all'
  | 'best2_only'
  | 'distinction'
  | 'credit'
  | 'pass'
  | 'fail'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9';

interface BeceElectiveFilterCardProps {
  candidates: BeceCandidate[];
  selectedElective: 'all' | BeceSubjectKey;
  onSelectElective: (elective: 'all' | BeceSubjectKey) => void;
  gradeFilter: ElectiveGradeFilterType;
  onSelectGradeFilter: (filter: ElectiveGradeFilterType) => void;
  focusMode: boolean;
  onToggleFocusMode: (focus: boolean) => void;
  filteredCount: number;
  totalCount: number;
  onResetFilters: () => void;
}

export function BeceElectiveFilterCard({
  candidates,
  selectedElective,
  onSelectElective,
  gradeFilter,
  onSelectGradeFilter,
  focusMode,
  onToggleFocusMode,
  filteredCount,
  totalCount,
  onResetFilters,
}: BeceElectiveFilterCardProps) {
  // Calculate performance metrics for all electives
  const allElectivesMetrics = useMemo(() => {
    return calculateAllElectivesSummary(candidates);
  }, [candidates]);

  // Current selected elective metrics
  const activeMetrics = useMemo<ElectivePerformanceMetrics | null>(() => {
    if (selectedElective === 'all') return null;
    return calculateElectivePerformance(candidates, selectedElective);
  }, [candidates, selectedElective]);

  // Max count in active grade distribution for scaling bar heights
  const maxGradeCount = useMemo(() => {
    if (!activeMetrics) return 1;
    const max = Math.max(...activeMetrics.gradeDistribution.map((g) => g.count));
    return max > 0 ? max : 1;
  }, [activeMetrics]);

  // Find top performing elective overall
  const topElective = useMemo(() => {
    if (allElectivesMetrics.length === 0) return null;
    return [...allElectivesMetrics].sort((a, b) => b.passPercent - a.passPercent)[0];
  }, [allElectivesMetrics]);

  return (
    <Card className="border border-border shadow-sm overflow-hidden bg-card transition-all print:hidden">
      {/* Top Elective Selector Bar */}
      <div className="bg-slate-50 dark:bg-slate-900/60 p-4 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Layers className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
                Elective Subjects Filter &amp; Visualizer
                {selectedElective !== 'all' && (
                  <Badge variant="outline" className="text-[11px] font-mono border-primary/40 text-primary">
                    Active
                  </Badge>
                )}
              </h2>
              <p className="text-xs text-muted-foreground">
                Filter candidates and visualize score distributions across the 6 BECE elective subjects
              </p>
            </div>
          </div>

          {/* Quick Clear Button if filter active */}
          {(selectedElective !== 'all' || gradeFilter !== 'all') && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground font-mono">
                {filteredCount} of {totalCount} candidates
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={onResetFilters}
                className="h-7 text-xs px-2.5 gap-1 border-rose-300 text-rose-600 dark:border-rose-800 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                <X className="h-3 w-3" />
                Clear Elective Filters
              </Button>
            </div>
          )}
        </div>

        {/* Elective Selection Pills */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-slate-200/70 dark:border-slate-800">
          <Button
            variant={selectedElective === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onSelectElective('all')}
            className={`h-8 text-xs font-semibold gap-1.5 transition-all ${
              selectedElective === 'all'
                ? 'shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            All Subjects
          </Button>

          {BECE_ELECTIVE_SUBJECTS.map((sub) => {
            const metrics = allElectivesMetrics.find((m) => m.subject.key === sub.key);
            const isSelected = selectedElective === sub.key;

            return (
              <Button
                key={sub.key}
                variant={isSelected ? 'default' : 'outline'}
                size="sm"
                onClick={() => onSelectElective(sub.key)}
                className={`h-8 text-xs font-semibold gap-1.5 transition-all ${
                  isSelected
                    ? 'shadow-sm ring-2 ring-primary/20'
                    : 'text-muted-foreground hover:text-foreground bg-background hover:bg-muted/50'
                }`}
              >
                <span>{sub.code}</span>
                <span className="hidden md:inline font-normal text-[11px] opacity-80">
                  {sub.name.split(' ')[0]}
                </span>
                {metrics && (
                  <span
                    className={`text-[10px] px-1 py-0.2 rounded font-mono font-bold ${
                      isSelected
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : metrics.passPercent >= 85
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {metrics.passPercent}%
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      </div>

      <CardContent className="p-4 sm:p-5">
        {/* VIEW 1: Specific Elective Selected */}
        {selectedElective !== 'all' && activeMetrics ? (
          <div className="space-y-5">
            {/* Subject Detail Header & Controls */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3 border-b">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-foreground">
                    {activeMetrics.subject.name} ({activeMetrics.subject.code})
                  </h3>
                  <Badge variant="secondary" className="text-xs font-semibold">
                    Elective Subject
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Detailed grade breakdown and candidate filtering for {activeMetrics.subject.name}
                </p>
              </div>

              {/* View options & Grade Filter Dropdown */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Focus mode toggle */}
                <Button
                  variant={focusMode ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => onToggleFocusMode(!focusMode)}
                  className={`h-8 text-xs gap-1.5 ${
                    focusMode
                      ? 'bg-primary/10 text-primary border-primary/30 font-semibold'
                      : 'text-muted-foreground'
                  }`}
                  title={
                    focusMode
                      ? 'Show all 10 subjects in the table'
                      : 'Focus only on core subjects and this elective'
                  }
                >
                  {focusMode ? (
                    <>
                      <Eye className="h-3.5 w-3.5" />
                      Focus View Active
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3.5 w-3.5" />
                      Focus On This Elective
                    </>
                  )}
                </Button>

                {/* Grade Filter Select */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">
                    Grade Filter:
                  </span>
                  <Select
                    value={gradeFilter}
                    onValueChange={(val) => onSelectGradeFilter(val as ElectiveGradeFilterType)}
                  >
                    <SelectTrigger className="h-8 w-44 text-xs font-medium">
                      <SelectValue placeholder="Filter by Grade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Grades (1–9)</SelectItem>
                      <SelectItem value="best2_only">Counted in Best 6 (★ Top 2)</SelectItem>
                      <SelectItem value="distinction">Distinction (Grades 1–2)</SelectItem>
                      <SelectItem value="credit">Credit (Grades 3–6)</SelectItem>
                      <SelectItem value="pass">Pass (Grades 1–6)</SelectItem>
                      <SelectItem value="fail">Weak / Fail (Grades 7–9)</SelectItem>
                      <SelectItem value="1">Grade 1 (Highest)</SelectItem>
                      <SelectItem value="2">Grade 2</SelectItem>
                      <SelectItem value="3">Grade 3</SelectItem>
                      <SelectItem value="4">Grade 4</SelectItem>
                      <SelectItem value="5">Grade 5</SelectItem>
                      <SelectItem value="6">Grade 6</SelectItem>
                      <SelectItem value="7">Grade 7</SelectItem>
                      <SelectItem value="8">Grade 8</SelectItem>
                      <SelectItem value="9">Grade 9 (Lowest)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* KPI Metrics for this Elective */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg border bg-slate-50/50 dark:bg-slate-900/30">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
                  Pass Rate (1–6)
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {activeMetrics.passPercent}%
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {activeMetrics.passCount}/{activeMetrics.totalCandidates}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg border bg-slate-50/50 dark:bg-slate-900/30">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
                  Average Grade
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl font-bold font-mono text-foreground">
                    {activeMetrics.averageGrade}
                  </span>
                  <span className="text-[11px] text-muted-foreground">on 1–9 scale</span>
                </div>
              </div>

              <div className="p-3 rounded-lg border bg-slate-50/50 dark:bg-slate-900/30">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
                  Distinction (1–2)
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl font-bold font-mono text-primary">
                    {activeMetrics.distinctionPercent}%
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {activeMetrics.distinctionCount} candidates
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg border bg-slate-50/50 dark:bg-slate-900/30">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
                  <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                  Best 6 Contributor
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
                    {activeMetrics.bestSixContributionPercent}%
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {activeMetrics.bestSixContributionCount} candidates
                  </span>
                </div>
              </div>
            </div>

            {/* Interactive Histogram / Grade Distribution Chart */}
            <div className="p-4 rounded-xl border bg-card">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Grade Distribution &amp; Interactive Filtering (Grades 1 to 9)
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Click any grade bar below to filter candidates instantly
                </span>
              </div>

              {/* Distribution Bars */}
              <div className="grid grid-cols-9 gap-1.5 sm:gap-2 pt-6 pb-2 items-end h-40">
                {activeMetrics.gradeDistribution.map((item) => {
                  const isSelected = gradeFilter === String(item.grade);
                  const heightPercent = Math.max(
                    Math.round((item.count / maxGradeCount) * 100),
                    8
                  );

                  let barBg = 'bg-blue-500 dark:bg-blue-600';
                  let textColor = 'text-blue-700 dark:text-blue-300';
                  if (item.grade <= 2) {
                    barBg = 'bg-emerald-500 dark:bg-emerald-600';
                    textColor = 'text-emerald-700 dark:text-emerald-300';
                  } else if (item.grade >= 7) {
                    barBg = 'bg-rose-500 dark:bg-rose-600';
                    textColor = 'text-rose-700 dark:text-rose-300';
                  }

                  return (
                    <button
                      key={item.grade}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          onSelectGradeFilter('all');
                        } else {
                          onSelectGradeFilter(String(item.grade) as ElectiveGradeFilterType);
                        }
                      }}
                      className={`group relative flex flex-col items-center justify-end h-full rounded-md p-1 transition-all focus:outline-none ${
                        isSelected
                          ? 'ring-2 ring-primary ring-offset-2 bg-primary/10'
                          : 'hover:bg-muted/70'
                      }`}
                      title={`Grade ${item.grade}: ${item.count} candidates (${item.percent}%). Click to filter.`}
                    >
                      {/* Count & Percent Label above bar */}
                      <div className="flex flex-col items-center mb-1 text-center">
                        <span className="font-mono font-bold text-xs text-foreground group-hover:scale-110 transition-transform">
                          {item.count}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground hidden sm:inline">
                          {item.percent}%
                        </span>
                      </div>

                      {/* Bar Pillar */}
                      <div className="w-full flex justify-center h-20 items-end">
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full max-w-[28px] rounded-t-md transition-all ${barBg} ${
                            isSelected ? 'opacity-100 ring-1 ring-white/50' : 'opacity-85 group-hover:opacity-100'
                          }`}
                        />
                      </div>

                      {/* Grade Badge bottom */}
                      <div className="mt-2 w-full text-center">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-mono font-bold ${
                            isSelected
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground group-hover:text-foreground'
                          }`}
                        >
                          G{item.grade}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Interactive Quick Band Filter Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-muted-foreground font-medium text-[11px] mr-1">
                    Quick Bands:
                  </span>
                  <Button
                    variant={gradeFilter === 'all' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-6 text-[11px] px-2"
                    onClick={() => onSelectGradeFilter('all')}
                  >
                    All Grades
                  </Button>
                  <Button
                    variant={gradeFilter === 'best2_only' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-6 text-[11px] px-2 gap-1 text-amber-600 dark:text-amber-400"
                    onClick={() => onSelectGradeFilter('best2_only')}
                  >
                    <Star className="h-3 w-3 fill-amber-500" />
                    Top 2 Contributor
                  </Button>
                  <Button
                    variant={gradeFilter === 'distinction' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-6 text-[11px] px-2 text-emerald-600 dark:text-emerald-400"
                    onClick={() => onSelectGradeFilter('distinction')}
                  >
                    Distinction (1–2)
                  </Button>
                  <Button
                    variant={gradeFilter === 'credit' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-6 text-[11px] px-2 text-blue-600 dark:text-blue-400"
                    onClick={() => onSelectGradeFilter('credit')}
                  >
                    Credit (3–6)
                  </Button>
                  <Button
                    variant={gradeFilter === 'fail' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-6 text-[11px] px-2 text-rose-600 dark:text-rose-400"
                    onClick={() => onSelectGradeFilter('fail')}
                  >
                    Weak (7–9)
                  </Button>
                </div>

                {gradeFilter !== 'all' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSelectGradeFilter('all')}
                    className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                  >
                    Reset Grade Band ✕
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* VIEW 2: All Electives Overview & Comparison Cards */
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  BECE Elective Subjects Performance Overview
                </h3>
                <p className="text-xs text-muted-foreground">
                  Select any elective subject below to filter the candidate result sheet and visualize focused performance
                </p>
              </div>

              {topElective && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="font-semibold">Top Elective:</span> {topElective.subject.name} ({topElective.passPercent}% Pass)
                </div>
              )}
            </div>

            {/* Grid of 6 Electives Comparison Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {allElectivesMetrics.map((item) => {
                return (
                  <div
                    key={item.subject.key}
                    onClick={() => onSelectElective(item.subject.key)}
                    className="group p-3.5 rounded-lg border bg-card hover:border-primary/50 hover:shadow-sm cursor-pointer transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className="font-mono font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                            {item.subject.code}
                          </span>
                          <h4 className="text-xs font-semibold text-muted-foreground line-clamp-1">
                            {item.subject.name}
                          </h4>
                        </div>
                        <Badge
                          variant="secondary"
                          className="font-mono text-xs font-bold shrink-0 bg-primary/10 text-primary"
                        >
                          {item.passPercent}% Pass
                        </Badge>
                      </div>

                      {/* Mini Metric Rows */}
                      <div className="grid grid-cols-3 gap-2 py-2 border-y text-xs text-muted-foreground">
                        <div>
                          <span className="text-[10px] uppercase block">Avg Grade</span>
                          <span className="font-mono font-bold text-foreground">
                            {item.averageGrade}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase block">Distinctions</span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {item.distinctionCount}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase block">Best 6 Rank</span>
                          <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                            {item.bestSixContributionCount}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 text-xs">
                      <span className="text-[11px] text-muted-foreground">
                        {item.passCount} of {item.totalCandidates} passed
                      </span>
                      <span className="text-primary font-semibold text-[11px] group-hover:underline flex items-center gap-1">
                        Filter by {item.subject.code} →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
