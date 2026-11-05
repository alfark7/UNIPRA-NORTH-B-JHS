'use client';

import { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Award,
  Users,
  LineChart as LineChartIcon,
  ChevronDown,
  ChevronUp,
  Info,
  Calendar,
  CheckCircle2,
  Sparkles,
  BarChart3,
  SlidersHorizontal,
  ArrowRight,
  School,
  Percent,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BeceCandidate,
  BeceYearAggregateSummary,
  getFiveYearAggregateSummaries,
} from '@/lib/bece-data';

export type AggregateMetricMode =
  | 'mean_and_best'
  | 'bands_percent'
  | 'qualifying_rate'
  | 'core_subjects'
  | 'cohort_size';

interface BeceAggregateFiveYearChartProps {
  currentCandidates: BeceCandidate[];
  currentYear: string;
  allDbCandidates?: BeceCandidate[];
  onSelectYear: (year: string) => void;
}

export function BeceAggregateFiveYearChart({
  currentCandidates,
  currentYear,
  allDbCandidates = [],
  onSelectYear,
}: BeceAggregateFiveYearChartProps) {
  const [metricMode, setMetricMode] = useState<AggregateMetricMode>('mean_and_best');
  const [isTableOpen, setIsTableOpen] = useState(false);
  const [isChartExpanded, setIsChartExpanded] = useState(true);

  // Compute the 5-year chronological data
  const fiveYearData: BeceYearAggregateSummary[] = useMemo(() => {
    return getFiveYearAggregateSummaries(currentCandidates, currentYear, allDbCandidates);
  }, [currentCandidates, currentYear, allDbCandidates]);

  // Overall 5-year macro metrics
  const stats = useMemo(() => {
    if (fiveYearData.length === 0) return null;
    const totalCandidates5Y = fiveYearData.reduce((acc, y) => acc + y.totalCandidates, 0);
    const avgMeanAgg = Number(
      (fiveYearData.reduce((acc, y) => acc + y.averageAggregate, 0) / fiveYearData.length).toFixed(1)
    );
    const bestAggEver = Math.min(...fiveYearData.map((y) => y.bestAggregate).filter((a) => a > 0));
    const bestYearRecord = fiveYearData.find((y) => y.bestAggregate === bestAggEver);
    const avgQualifyingPass = Number(
      (fiveYearData.reduce((acc, y) => acc + y.qualifyingPassPercent, 0) / fiveYearData.length).toFixed(1)
    );

    // Trend calculation: first year (2021/2022) vs most recent year (2025/2026)
    const firstYear = fiveYearData[0];
    const lastYear = fiveYearData[fiveYearData.length - 1];
    // In BECE lower aggregate is better!
    const aggChange = Number((lastYear.averageAggregate - firstYear.averageAggregate).toFixed(1));
    const isImproved = aggChange < 0; // Dropping aggregate score means improved grades!

    return {
      totalCandidates5Y,
      avgMeanAgg,
      bestAggEver,
      bestYearRecord,
      avgQualifyingPass,
      aggChange,
      isImproved,
    };
  }, [fiveYearData]);

  // Custom Tooltip for Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const currentSummary = fiveYearData.find((d) => d.academicYear === label);

    return (
      <div className="rounded-xl border bg-card/95 backdrop-blur-md p-3.5 shadow-xl text-xs min-w-[240px] space-y-2 z-50">
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-1.5 font-bold text-foreground">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            <span>Academic Year: {label}</span>
          </div>
          {label === currentYear && (
            <Badge variant="default" className="text-[10px] h-4 px-1.5">
              Active View
            </Badge>
          )}
        </div>

        <div className="space-y-1.5 pt-1">
          {payload.map((entry: any, index: number) => (
            <div key={`tip-${index}`} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-muted-foreground">{entry.name}:</span>
              </div>
              <span className="font-mono font-bold text-foreground">
                {entry.value}
                {metricMode === 'bands_percent' || metricMode === 'qualifying_rate' ? '%' : ''}
              </span>
            </div>
          ))}
        </div>

        {currentSummary && (
          <div className="border-t pt-2 space-y-1 text-[11px] text-muted-foreground">
            <div className="flex justify-between">
              <span>Total Candidates:</span>
              <span className="font-semibold text-foreground">{currentSummary.totalCandidates}</span>
            </div>
            {currentSummary.topCandidateName && (
              <div className="flex justify-between">
                <span>Top Candidate:</span>
                <span className="font-semibold text-foreground truncate max-w-[130px]" title={currentSummary.topCandidateName}>
                  {currentSummary.topCandidateName} (Agg. {currentSummary.bestAggregate})
                </span>
              </div>
            )}
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
              <span>Qualifying Pass (≤ 30):</span>
              <span>{currentSummary.qualifyingPassPercent}%</span>
            </div>
          </div>
        )}

        <div className="pt-1 border-t text-[10px] text-primary font-medium flex items-center justify-center gap-1">
          <span>Click dot to switch to {label}</span>
          <ArrowRight className="h-3 w-3" />
        </div>
      </div>
    );
  };

  return (
    <Card className="border border-border/80 shadow-xs overflow-hidden transition-all print:border-none print:shadow-none">
      {/* Header with Title & Metric Mode Selector */}
      <CardHeader className="p-4 sm:p-5 bg-card border-b">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <LineChartIcon className="h-5 w-5" />
              </span>
              <CardTitle className="text-lg sm:text-xl font-bold tracking-tight">
                5-Year BECE Aggregate Comparison (2021/2022 – 2025/2026)
              </CardTitle>
              <Badge variant="outline" className="text-xs font-semibold gap-1 py-0.5 border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300">
                <School className="h-3 w-3" />
                UNIPRA NORTH JHS
              </Badge>
            </div>
            <CardDescription className="text-xs sm:text-sm text-muted-foreground">
              Multi-year longitudinal analysis of BECE Best-Six aggregates, distinction rates, and senior high school qualification trends.
            </CardDescription>
          </div>

          {/* Quick metric mode pills & toggle */}
          <div className="flex flex-wrap items-center gap-1.5 self-start lg:self-center">
            <div className="inline-flex p-1 rounded-lg bg-muted/60 border text-xs">
              <button
                type="button"
                onClick={() => setMetricMode('mean_and_best')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  metricMode === 'mean_and_best'
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Mean &amp; Best Agg.
              </button>
              <button
                type="button"
                onClick={() => setMetricMode('bands_percent')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  metricMode === 'bands_percent'
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Aggregate Bands (%)
              </button>
              <button
                type="button"
                onClick={() => setMetricMode('qualifying_rate')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  metricMode === 'qualifying_rate'
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Pass Rate (≤30)
              </button>
              <button
                type="button"
                onClick={() => setMetricMode('core_subjects')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  metricMode === 'core_subjects'
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Core Subjects
              </button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsChartExpanded(!isChartExpanded)}
              className="h-8 w-8 p-0 text-muted-foreground"
              title={isChartExpanded ? 'Collapse chart' : 'Expand chart'}
            >
              {isChartExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* 5-Year High-Level KPI Summary Strip */}
        {stats && isChartExpanded && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 mt-1 border-t border-dashed">
            <div className="rounded-lg bg-muted/40 p-2.5 border">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                5-Yr Average Aggregate
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl font-bold font-mono text-foreground">{stats.avgMeanAgg}</span>
                <span className="text-[11px] text-muted-foreground">Best-Six mean</span>
              </div>
            </div>

            <div className="rounded-lg bg-muted/40 p-2.5 border">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                5-Yr School Record
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
                  Agg. {stats.bestAggEver}
                </span>
                <span className="text-[11px] text-muted-foreground truncate" title={stats.bestYearRecord?.topCandidateName}>
                  {stats.bestYearRecord?.academicYear}
                </span>
              </div>
            </div>

            <div className="rounded-lg bg-muted/40 p-2.5 border">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                5-Yr SHS Pass Rate
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {stats.avgQualifyingPass}%
                </span>
                <span className="text-[11px] text-muted-foreground">Agg ≤ 30 eligible</span>
              </div>
            </div>

            <div className="rounded-lg bg-muted/40 p-2.5 border">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                5-Yr Total Candidates
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
                  {stats.totalCandidates5Y}
                </span>
                <div className="flex items-center text-[11px] font-medium text-muted-foreground">
                  <span>Graduates examined</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardHeader>

      {/* Chart Section */}
      {isChartExpanded && (
        <CardContent className="p-4 sm:p-6 space-y-4">
          {/* BECE Scale Guidance Note */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/40 text-xs">
            <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200">
              <Info className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
              <span>
                <strong>BECE Aggregate Guide:</strong> In Ghana BECE, aggregate scores range from 6 to 54. 
                <span className="font-semibold underline ml-1">Lower scores represent higher academic achievement</span> (e.g., Aggregate 6 = six grade 1s).
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
              <span>Active Selection:</span>
              <Badge variant="secondary" className="font-mono text-xs font-bold px-2 py-0.5">
                {currentYear} ({currentCandidates.length} candidates)
              </Badge>
            </div>
          </div>

          {/* Line Chart Area */}
          <div className="w-full h-[320px] sm:h-[360px] pt-2">
            <ResponsiveContainer width="100%" height="100%">
              {metricMode === 'mean_and_best' ? (
                <LineChart
                  data={fiveYearData}
                  margin={{ top: 15, right: 30, left: -10, bottom: 5 }}
                  onClick={(e) => {
                    if (e && e.activeLabel) {
                      onSelectYear(e.activeLabel);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/60" vertical={false} />
                  <XAxis
                    dataKey="academicYear"
                    tick={{ fontSize: 12, fill: 'currentColor' }}
                    tickLine={false}
                    className="text-muted-foreground font-medium"
                  />
                  <YAxis
                    domain={[6, 36]}
                    tick={{ fontSize: 12, fill: 'currentColor' }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground font-mono"
                    label={{
                      value: 'Aggregate Score (Lower is better)',
                      angle: -90,
                      position: 'insideLeft',
                      offset: 15,
                      style: { fontSize: 11, fill: '#6b7280' },
                    }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
                  />
                  {/* Reference line for Distinction threshold (15) and Pass threshold (30) */}
                  <ReferenceLine
                    y={15}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    label={{
                      value: 'Distinction Cut-off (15)',
                      position: 'insideTopRight',
                      fill: '#10b981',
                      fontSize: 10,
                    }}
                  />
                  <ReferenceLine
                    y={30}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    label={{
                      value: 'SHS Qualifying Cut-off (30)',
                      position: 'insideBottomRight',
                      fill: '#f59e0b',
                      fontSize: 10,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="averageAggregate"
                    name="Mean Aggregate (School)"
                    stroke="#6366f1"
                    strokeWidth={3}
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      const isActive = payload.academicYear === currentYear;
                      return (
                        <circle
                          key={`dot-mean-${payload.academicYear}`}
                          cx={cx}
                          cy={cy}
                          r={isActive ? 6 : 4}
                          fill="#6366f1"
                          stroke={isActive ? '#ffffff' : '#6366f1'}
                          strokeWidth={isActive ? 2.5 : 1}
                          className="cursor-pointer transition-all"
                        />
                      );
                    }}
                    activeDot={{ r: 7, stroke: '#6366f1', strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="bestAggregate"
                    name="Best Candidate Aggregate"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    strokeDasharray="6 3"
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      const isActive = payload.academicYear === currentYear;
                      return (
                        <polygon
                          key={`poly-best-${payload.academicYear}`}
                          points={`${cx},${cy - 5} ${cx + 5},${cy + 4} ${cx - 5},${cy + 4}`}
                          fill="#f59e0b"
                          stroke={isActive ? '#ffffff' : '#f59e0b'}
                          strokeWidth={isActive ? 2 : 1}
                          className="cursor-pointer"
                        />
                      );
                    }}
                    activeDot={{ r: 7, stroke: '#f59e0b', strokeWidth: 2 }}
                  />
                </LineChart>
              ) : metricMode === 'bands_percent' ? (
                <LineChart
                  data={fiveYearData}
                  margin={{ top: 15, right: 30, left: -10, bottom: 5 }}
                  onClick={(e) => {
                    if (e && e.activeLabel) onSelectYear(e.activeLabel);
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/60" vertical={false} />
                  <XAxis
                    dataKey="academicYear"
                    tick={{ fontSize: 12, fill: 'currentColor' }}
                    tickLine={false}
                    className="text-muted-foreground font-medium"
                  />
                  <YAxis
                    domain={[0, 60]}
                    unit="%"
                    tick={{ fontSize: 12, fill: 'currentColor' }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground font-mono"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="distinctionPercent"
                    name="Distinction (6–15) %"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#10b981' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="creditPercent"
                    name="Credit (16–24) %"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#3b82f6' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="passPercent"
                    name="Pass (25–30) %"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#f59e0b' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="weakPercent"
                    name="Weak (>30) %"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    dot={{ r: 4, fill: '#f43f5e' }}
                  />
                </LineChart>
              ) : metricMode === 'qualifying_rate' ? (
                <LineChart
                  data={fiveYearData}
                  margin={{ top: 15, right: 30, left: -10, bottom: 5 }}
                  onClick={(e) => {
                    if (e && e.activeLabel) onSelectYear(e.activeLabel);
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/60" vertical={false} />
                  <XAxis
                    dataKey="academicYear"
                    tick={{ fontSize: 12, fill: 'currentColor' }}
                    tickLine={false}
                    className="text-muted-foreground font-medium"
                  />
                  <YAxis
                    domain={[50, 100]}
                    unit="%"
                    tick={{ fontSize: 12, fill: 'currentColor' }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground font-mono"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
                  />
                  <ReferenceLine
                    y={75}
                    stroke="#059669"
                    strokeDasharray="3 3"
                    label={{
                      value: 'National Target (75%)',
                      position: 'insideBottomRight',
                      fill: '#059669',
                      fontSize: 10,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="qualifyingPassPercent"
                    name="SHS Qualifying Rate (Aggregate ≤ 30)"
                    stroke="#059669"
                    strokeWidth={3}
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      const isActive = payload.academicYear === currentYear;
                      return (
                        <circle
                          key={`dot-qual-${payload.academicYear}`}
                          cx={cx}
                          cy={cy}
                          r={isActive ? 6 : 4}
                          fill="#059669"
                          stroke={isActive ? '#ffffff' : '#059669'}
                          strokeWidth={isActive ? 2 : 1}
                        />
                      );
                    }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              ) : (
                <LineChart
                  data={fiveYearData.map((d) => ({
                    academicYear: d.academicYear,
                    eng: d.coreAverages.eng,
                    maths: d.coreAverages.maths,
                    sci: d.coreAverages.sci,
                    social: d.coreAverages.social,
                  }))}
                  margin={{ top: 15, right: 30, left: -10, bottom: 5 }}
                  onClick={(e) => {
                    if (e && e.activeLabel) onSelectYear(e.activeLabel);
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/60" vertical={false} />
                  <XAxis
                    dataKey="academicYear"
                    tick={{ fontSize: 12, fill: 'currentColor' }}
                    tickLine={false}
                    className="text-muted-foreground font-medium"
                  />
                  <YAxis
                    domain={[1, 7]}
                    reversed={true} // In grades, 1 is best, so reverse axis!
                    tick={{ fontSize: 12, fill: 'currentColor' }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground font-mono"
                    label={{
                      value: 'Average Grade (1 is Distinction)',
                      angle: -90,
                      position: 'insideLeft',
                      offset: 15,
                      style: { fontSize: 11, fill: '#6b7280' },
                    }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="eng"
                    name="English Language"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="maths"
                    name="Mathematics"
                    stroke="#ef4444"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sci"
                    name="Science"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="social"
                    name="Social Studies"
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Quick Year Selection Pill Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Click Year to Switch View:</span>
              {fiveYearData.map((d) => (
                <Button
                  key={`switch-${d.academicYear}`}
                  variant={d.academicYear === currentYear ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onSelectYear(d.academicYear)}
                  className={`h-7 px-2.5 text-xs font-mono transition-all ${
                    d.academicYear === currentYear
                      ? 'shadow-xs font-bold'
                      : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {d.academicYear}
                  {d.academicYear === currentYear && (
                    <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  )}
                </Button>
              ))}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsTableOpen(!isTableOpen)}
              className="text-xs h-8 text-primary font-semibold gap-1 hover:bg-primary/5"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {isTableOpen ? 'Hide 5-Year Breakdown Table' : 'Show 5-Year Data Table'}
              {isTableOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          </div>

          {/* Detailed 5-Year Numerical Breakdown Table */}
          {isTableOpen && (
            <div className="rounded-xl border overflow-x-auto bg-card animate-in fade-in-50 duration-200">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/70 text-muted-foreground border-b text-left">
                    <th className="py-2.5 px-3 font-semibold">Academic Year</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Candidates</th>
                    <th className="py-2.5 px-3 font-semibold text-center text-indigo-600 dark:text-indigo-400">
                      Mean Aggregate
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-center text-amber-600 dark:text-amber-400">
                      Best Aggregate
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-center text-emerald-600 dark:text-emerald-400">
                      Distinction (6–15)
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-center text-blue-600 dark:text-blue-400">
                      Credit (16–24)
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-center text-amber-500">
                      Pass (25–30)
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-center text-rose-500">
                      Weak (&gt;30)
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-center text-emerald-600 font-bold">
                      SHS Pass (≤30)
                    </th>
                    <th className="py-2.5 px-3 font-semibold">Top Candidate</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-mono">
                  {fiveYearData.map((row) => {
                    const isSelected = row.academicYear === currentYear;
                    return (
                      <tr
                        key={row.academicYear}
                        className={`transition-colors ${
                          isSelected ? 'bg-primary/5 font-semibold' : 'hover:bg-muted/40'
                        }`}
                      >
                        <td className="py-2 px-3 font-sans font-bold text-foreground flex items-center gap-1.5">
                          {row.academicYear}
                          {isSelected && (
                            <Badge variant="default" className="text-[9px] h-4 px-1 py-0">
                              Active
                            </Badge>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">{row.totalCandidates}</td>
                        <td className="py-2 px-3 text-center font-bold text-indigo-600 dark:text-indigo-400">
                          {row.averageAggregate}
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-amber-600 dark:text-amber-400">
                          {row.bestAggregate}
                        </td>
                        <td className="py-2 px-3 text-center text-emerald-600 dark:text-emerald-400">
                          {row.distinctionCount} ({row.distinctionPercent}%)
                        </td>
                        <td className="py-2 px-3 text-center text-blue-600 dark:text-blue-400">
                          {row.creditCount} ({row.creditPercent}%)
                        </td>
                        <td className="py-2 px-3 text-center text-amber-600 dark:text-amber-400">
                          {row.passCount} ({row.passPercent}%)
                        </td>
                        <td className="py-2 px-3 text-center text-rose-600 dark:text-rose-400">
                          {row.weakCount} ({row.weakPercent}%)
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                          {row.qualifyingPassPercent}%
                        </td>
                        <td className="py-2 px-3 font-sans truncate max-w-[150px] text-muted-foreground" title={row.topCandidateName}>
                          {row.topCandidateName || '—'}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {row.academicYear !== currentYear ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onSelectYear(row.academicYear)}
                              className="h-6 px-2 text-[10px] text-primary"
                            >
                              Load Year
                            </Button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground font-sans">Viewing</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
