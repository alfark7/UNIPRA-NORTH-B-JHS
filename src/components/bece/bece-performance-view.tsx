'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Award,
  GraduationCap,
  Upload,
  Download,
  Plus,
  Search,
  Filter,
  FileSpreadsheet,
  FileText,
  Printer,
  Edit2,
  Trash2,
  Sparkles,
  ArrowUpDown,
  BookOpen,
  CheckCircle2,
  XCircle,
  HelpCircle,
  X,
  Layers,
  Star,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection } from '@/firebase';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
} from 'firebase/firestore';
import {
  BeceCandidate,
  BeceSubjectKey,
  BECE_SUBJECTS,
  BECE_ELECTIVE_SUBJECTS,
  BECE_CORE_SUBJECTS,
  BECE_ACADEMIC_YEARS,
  calculateBestSixTotal,
  calculateBeceAnalysis,
  getInitialBeceCandidates,
  getElectivesUsedInBestSix,
  getHistoricalCandidatesForYear,
} from '@/lib/bece-data';
import {
  exportBeceToExcel,
  exportBeceToPdf,
} from '@/lib/bece-excel';
import { BeceCandidateDialog } from './bece-candidate-dialog';
import { BeceImportDialog } from './bece-import-dialog';
import {
  BeceElectiveFilterCard,
  ElectiveGradeFilterType,
} from './bece-elective-filter-card';
import { BeceAggregateFiveYearChart } from './bece-aggregate-five-year-chart';

export function BecePerformanceView() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [selectedYear, setSelectedYear] = useState('2025/2026');
  const [academicYearsList, setAcademicYearsList] = useState(BECE_ACADEMIC_YEARS);
  const [newYearInput, setNewYearInput] = useState('');
  const [isAddingYear, setIsAddingYear] = useState(false);

  // Firestore query for beceRecords of selectedYear
  const beceQuery = useMemo(() => {
    return query(collection(firestore, 'beceRecords'), where('academicYear', '==', selectedYear));
  }, [firestore, selectedYear]);

  const { data: rawCandidates, loading } = useCollection<BeceCandidate>(beceQuery);

  // Query all BECE records across all academic years for multi-year trend calculation
  const allRecordsQuery = useMemo(() => {
    return query(collection(firestore, 'beceRecords'));
  }, [firestore]);
  const { data: allDbCandidates } = useCollection<BeceCandidate>(allRecordsQuery);

  // Local fallback if database is empty initially for the selected year
  const [localFallbackList, setLocalFallbackList] = useState<BeceCandidate[]>([]);

  useEffect(() => {
    if (!loading && rawCandidates.length === 0) {
      // Initialize view with authentic UNIPRA NORTH JHS candidates for the academic year
      const initial = getHistoricalCandidatesForYear(selectedYear);
      setLocalFallbackList(initial);
    } else {
      setLocalFallbackList([]);
    }
  }, [selectedYear, loading, rawCandidates.length]);

  const candidates: BeceCandidate[] = useMemo(() => {
    if (rawCandidates && rawCandidates.length > 0) {
      return [...rawCandidates].sort((a, b) => (a.sn || 0) - (b.sn || 0));
    }
    if (localFallbackList.length > 0) {
      return localFallbackList;
    }
    return [];
  }, [rawCandidates, localFallbackList]);

  // Search & Standard Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [aggregateFilter, setAggregateFilter] = useState('all');

  // Elective Filter & Visualizer State
  const [selectedElective, setSelectedElective] = useState<'all' | BeceSubjectKey>('all');
  const [electiveGradeFilter, setElectiveGradeFilter] = useState<ElectiveGradeFilterType>('all');
  const [focusMode, setFocusMode] = useState(false);

  // Sorting State
  const [sortField, setSortField] = useState<'sn' | 'name' | 'bestSixTotal' | 'electiveGrade'>('sn');
  const [sortAsc, setSortAsc] = useState(true);

  // Dialog States
  const [isCandidateDialogOpen, setIsCandidateDialogOpen] = useState(false);
  const [candidateToEdit, setCandidateToEdit] = useState<BeceCandidate | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [candidateToDelete, setCandidateToDelete] = useState<BeceCandidate | null>(null);
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);

  // Info for active elective
  const selectedElectiveInfo = useMemo(() => {
    if (selectedElective === 'all') return null;
    return BECE_SUBJECTS.find((s) => s.key === selectedElective) || null;
  }, [selectedElective]);

  // Filtered & Sorted candidates
  const filteredCandidates = useMemo(() => {
    let list = [...candidates];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.indexNumber.toLowerCase().includes(q) ||
          String(c.sn).includes(q)
      );
    }

    // Overall Aggregate Band Filter
    if (aggregateFilter === 'distinction') {
      list = list.filter((c) => c.bestSixTotal <= 15);
    } else if (aggregateFilter === 'credit') {
      list = list.filter((c) => c.bestSixTotal >= 16 && c.bestSixTotal <= 24);
    } else if (aggregateFilter === 'pass') {
      list = list.filter((c) => c.bestSixTotal >= 25 && c.bestSixTotal <= 30);
    } else if (aggregateFilter === 'weak') {
      list = list.filter((c) => c.bestSixTotal > 30);
    }

    // Elective Specific Filter
    if (selectedElective !== 'all') {
      if (electiveGradeFilter === 'best2_only') {
        list = list.filter((c) => {
          const top2 = getElectivesUsedInBestSix(c);
          return top2.includes(selectedElective);
        });
      } else if (electiveGradeFilter === 'distinction') {
        list = list.filter((c) => {
          const grade = Number((c as any)[selectedElective]);
          return grade <= 2;
        });
      } else if (electiveGradeFilter === 'credit') {
        list = list.filter((c) => {
          const grade = Number((c as any)[selectedElective]);
          return grade >= 3 && grade <= 6;
        });
      } else if (electiveGradeFilter === 'pass') {
        list = list.filter((c) => {
          const grade = Number((c as any)[selectedElective]);
          return grade <= 6;
        });
      } else if (electiveGradeFilter === 'fail') {
        list = list.filter((c) => {
          const grade = Number((c as any)[selectedElective]);
          return grade >= 7;
        });
      } else if (['1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(electiveGradeFilter)) {
        const targetGrade = Number(electiveGradeFilter);
        list = list.filter((c) => {
          const grade = Number((c as any)[selectedElective]);
          return grade === targetGrade;
        });
      }
    }

    // Sorting
    list.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'sn') {
        comparison = (a.sn || 0) - (b.sn || 0);
      } else if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'bestSixTotal') {
        comparison = a.bestSixTotal - b.bestSixTotal;
      } else if (sortField === 'electiveGrade' && selectedElective !== 'all') {
        const gradeA = Number((a as any)[selectedElective]) || 9;
        const gradeB = Number((b as any)[selectedElective]) || 9;
        comparison = gradeA - gradeB;
      }
      return sortAsc ? comparison : -comparison;
    });

    return list;
  }, [
    candidates,
    searchQuery,
    aggregateFilter,
    selectedElective,
    electiveGradeFilter,
    sortField,
    sortAsc,
  ]);

  // Overall Analysis Metrics
  const analysis = useMemo(() => calculateBeceAnalysis(candidates), [candidates]);

  const bestAggregate = useMemo(() => {
    if (candidates.length === 0) return 0;
    return Math.min(...candidates.map((c) => c.bestSixTotal));
  }, [candidates]);

  const topStudent = useMemo(() => {
    if (candidates.length === 0) return null;
    return [...candidates].sort((a, b) => a.bestSixTotal - b.bestSixTotal)[0];
  }, [candidates]);

  const averageAggregate = useMemo(() => {
    if (candidates.length === 0) return 0;
    const sum = candidates.reduce((acc, c) => acc + c.bestSixTotal, 0);
    return (sum / candidates.length).toFixed(1);
  }, [candidates]);

  // Reset filter handlers
  const handleResetElectiveFilters = () => {
    setSelectedElective('all');
    setElectiveGradeFilter('all');
    setFocusMode(false);
    if (sortField === 'electiveGrade') {
      setSortField('sn');
      setSortAsc(true);
    }
  };

  const handleResetAllFilters = () => {
    setSearchQuery('');
    setAggregateFilter('all');
    setSelectedElective('all');
    setElectiveGradeFilter('all');
    setFocusMode(false);
    setSortField('sn');
    setSortAsc(true);
  };

  const handleSortByElective = (key: BeceSubjectKey) => {
    if (selectedElective === key && sortField === 'electiveGrade') {
      setSortAsc(!sortAsc);
    } else {
      setSelectedElective(key);
      setSortField('electiveGrade');
      setSortAsc(true); // Grade 1 first
    }
  };

  // Handlers
  const handleAddNewYear = () => {
    if (!newYearInput.trim()) return;
    const formatted = newYearInput.trim();
    if (!academicYearsList.includes(formatted)) {
      setAcademicYearsList((prev) => [formatted, ...prev]);
    }
    setSelectedYear(formatted);
    setNewYearInput('');
    setIsAddingYear(false);
    toast({
      title: 'Academic Year Added',
      description: `Switched to BECE academic year ${formatted}.`,
    });
  };

  const handleSaveCandidate = async (candidateData: Partial<BeceCandidate>) => {
    const docId =
      candidateData.id ||
      `bece_${selectedYear.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;

    const payload: BeceCandidate = {
      id: docId,
      sn: candidateData.sn || candidates.length + 1,
      name: candidateData.name || '',
      indexNumber: candidateData.indexNumber || '',
      academicYear: selectedYear,
      eng: Number(candidateData.eng) || 9,
      maths: Number(candidateData.maths) || 9,
      sci: Number(candidateData.sci) || 9,
      social: Number(candidateData.social) || 9,
      rme: Number(candidateData.rme) || 9,
      cad: Number(candidateData.cad) || 9,
      careerTech: Number(candidateData.careerTech) || 9,
      computing: Number(candidateData.computing) || 9,
      french: Number(candidateData.french) || 9,
      fante: Number(candidateData.fante) || 9,
      bestSixTotal: calculateBestSixTotal(candidateData as any),
      updatedAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(firestore, 'beceRecords', docId), payload, { merge: true });
      toast({
        title: candidateData.id ? 'Candidate Updated' : 'Candidate Added',
        description: `${payload.name} has been successfully recorded.`,
      });
    } catch (err: any) {
      // In case Firestore permissions or offline, update fallback state
      setLocalFallbackList((prev) => {
        const idx = prev.findIndex((c) => c.id === docId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = payload;
          return next;
        }
        return [...prev, payload];
      });
      toast({
        title: 'Candidate Saved Locally',
        description: `${payload.name} updated in active session.`,
      });
    }
  };

  const handleDeleteCandidate = async () => {
    if (!candidateToDelete) return;
    try {
      await deleteDoc(doc(firestore, 'beceRecords', candidateToDelete.id));
      setLocalFallbackList((prev) => prev.filter((c) => c.id !== candidateToDelete.id));
      toast({
        title: 'Candidate Deleted',
        description: `${candidateToDelete.name} was removed from records.`,
      });
    } catch (err: any) {
      setLocalFallbackList((prev) => prev.filter((c) => c.id !== candidateToDelete.id));
      toast({
        title: 'Candidate Removed',
        description: `${candidateToDelete.name} removed from active view.`,
      });
    } finally {
      setCandidateToDelete(null);
    }
  };

  const handleBatchImport = async (importedList: BeceCandidate[]) => {
    setIsBatchSyncing(true);
    try {
      const batch = writeBatch(firestore);
      importedList.forEach((cand, idx) => {
        const id = cand.id || `bece_${selectedYear.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}_${idx}`;
        const ref = doc(firestore, 'beceRecords', id);
        batch.set(ref, { ...cand, id, academicYear: selectedYear }, { merge: true });
      });
      await batch.commit();
      toast({
        title: 'Batch Sync Complete',
        description: `All ${importedList.length} candidate records synchronized with database.`,
      });
    } catch (err: any) {
      console.warn('Batch write handled with local fallback:', err);
      setLocalFallbackList(importedList);
      toast({
        title: 'Records Loaded',
        description: `Imported ${importedList.length} candidates into current view.`,
      });
    } finally {
      setIsBatchSyncing(false);
    }
  };

  const handleLoadPdfData = async () => {
    const pdfData = getInitialBeceCandidates('2025/2026');
    await handleBatchImport(pdfData);
  };

  const handleExportFilteredExcel = () => {
    exportBeceToExcel(filteredCandidates, selectedYear);
    toast({
      title: 'Excel Export Ready',
      description: `Downloaded ${filteredCandidates.length} candidate results${
        selectedElective !== 'all' ? ` filtered by ${selectedElective.toUpperCase()}` : ''
      }.`,
    });
  };

  const handleExportAllExcel = () => {
    exportBeceToExcel(candidates, selectedYear);
    toast({
      title: 'Full Excel Export Ready',
      description: `Downloaded all ${candidates.length} candidates in official BECE format.`,
    });
  };

  const handleExportFilteredPdf = () => {
    exportBeceToPdf(filteredCandidates, selectedYear, analysis);
    toast({
      title: 'PDF Export Ready',
      description: `Generated official BECE performance sheet (${filteredCandidates.length} candidates).`,
    });
  };

  const handleExportAllPdf = () => {
    exportBeceToPdf(candidates, selectedYear, analysis);
    toast({
      title: 'Full PDF Export Ready',
      description: 'Official UNIPRA NORTH JHS BECE performance sheet generated.',
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const getGradeBadge = (grade: number, isHighlighted = false, isTopElective = false) => {
    let badgeClass = 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300';
    if (grade <= 2) {
      badgeClass = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
    } else if (grade <= 6) {
      badgeClass = 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';
    }

    return (
      <div className="flex flex-col items-center justify-center">
        <span
          className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-mono font-bold text-xs ${badgeClass} ${
            isHighlighted ? 'ring-2 ring-primary ring-offset-1 shadow-xs' : ''
          }`}
        >
          {grade}
        </span>
        {isTopElective && (
          <span className="text-[9px] font-extrabold text-amber-600 dark:text-amber-400 leading-tight mt-0.5 whitespace-nowrap">
            ★ Best 2
          </span>
        )}
      </div>
    );
  };

  const isAnyFilterActive =
    searchQuery.trim() !== '' ||
    aggregateFilter !== 'all' ||
    selectedElective !== 'all' ||
    electiveGradeFilter !== 'all';

  return (
    <div className="flex flex-col gap-6">
      {/* Page Title & School Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Award className="h-6 w-6" />
            </span>
            <h1 className="text-2xl md:text-3xl font-headline font-bold tracking-tight">
              BECE Academic Performance
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            UNIPRA NORTH JHS • Basic Education Certificate Examination (BECE) Candidate Management &amp; Results Portal
          </p>
        </div>

        {/* Year Selector & Primary Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:inline">
              BECE Year:
            </span>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-36 font-semibold bg-background">
                <SelectValue placeholder="Select Year" />
              </SelectTrigger>
              <SelectContent>
                {academicYearsList.map((yr) => (
                  <SelectItem key={yr} value={yr} className="font-medium">
                    {yr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {!isAddingYear ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAddingYear(true)}
                className="text-xs h-9 px-2 text-muted-foreground"
                title="Add new academic year"
              >
                + New Year
              </Button>
            ) : (
              <div className="flex items-center gap-1">
                <Input
                  placeholder="e.g. 2026/2027"
                  value={newYearInput}
                  onChange={(e) => setNewYearInput(e.target.value)}
                  className="w-28 h-9 text-xs"
                />
                <Button size="sm" className="h-9 px-2 text-xs" onClick={handleAddNewYear}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 px-2 text-xs"
                  onClick={() => setIsAddingYear(false)}
                >
                  ✕
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 print:hidden">
        <Card className="bg-card">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardDescription className="text-xs font-semibold uppercase">Total Candidates</CardDescription>
            <CardTitle className="text-2xl font-bold font-mono text-foreground">
              {candidates.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <p className="text-xs text-muted-foreground">{selectedYear} Academic Year</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardDescription className="text-xs font-semibold uppercase">Overall Subject Pass Rate</CardDescription>
            <CardTitle className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {analysis.overallPassPercent}%
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <p className="text-xs text-muted-foreground">
              {analysis.totalPasses.toLocaleString()} Passes / {analysis.totalSubjectEntries.toLocaleString()} Entries
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardDescription className="text-xs font-semibold uppercase">Best Candidate Aggregate</CardDescription>
            <CardTitle className="text-2xl font-bold font-mono text-primary">
              {bestAggregate > 0 ? bestAggregate : 'N/A'}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0 truncate">
            <p className="text-xs text-muted-foreground truncate" title={topStudent?.name}>
              {topStudent ? topStudent.name : 'No records'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardDescription className="text-xs font-semibold uppercase">Average Aggregate</CardDescription>
            <CardTitle className="text-2xl font-bold font-mono text-foreground">
              {averageAggregate}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <p className="text-xs text-muted-foreground">Best 6 Candidate Mean</p>
          </CardContent>
        </Card>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 print:hidden">
        {/* Search & Filter */}
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search candidate name or index..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <Select value={aggregateFilter} onValueChange={setAggregateFilter}>
            <SelectTrigger className="w-36 h-9 text-xs">
              <SelectValue placeholder="Aggregate Band" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Aggregates</SelectItem>
              <SelectItem value="distinction">Distinction (6–15)</SelectItem>
              <SelectItem value="credit">Credit (16–24)</SelectItem>
              <SelectItem value="pass">Pass (25–30)</SelectItem>
              <SelectItem value="weak">Above 30 (Weak)</SelectItem>
            </SelectContent>
          </Select>

          {/* Quick Elective Subject Selector Dropdown */}
          <Select
            value={selectedElective}
            onValueChange={(val) => {
              setSelectedElective(val as 'all' | BeceSubjectKey);
              if (val === 'all') {
                setElectiveGradeFilter('all');
                setFocusMode(false);
              }
            }}
          >
            <SelectTrigger className="w-44 h-9 text-xs font-medium">
              <SelectValue placeholder="Filter by Elective" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Elective Subjects</SelectItem>
              {BECE_ELECTIVE_SUBJECTS.map((sub) => (
                <SelectItem key={sub.key} value={sub.key}>
                  {sub.code} - {sub.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Buttons (Add, Import, Export, Load PDF Data) */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => {
              setCandidateToEdit(null);
              setIsCandidateDialogOpen(true);
            }}
            size="sm"
            className="h-9 gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Add Candidate
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsImportDialogOpen(true)}
            className="h-9 gap-1.5"
          >
            <Upload className="h-4 w-4" />
            Import
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {isAnyFilterActive && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    Filtered Set ({filteredCandidates.length} Candidates)
                  </div>
                  <DropdownMenuItem onClick={handleExportFilteredExcel} className="gap-2 cursor-pointer text-xs">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    Export Filtered to Excel (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportFilteredPdf} className="gap-2 cursor-pointer text-xs">
                    <FileText className="h-4 w-4 text-rose-600" />
                    Export Filtered to PDF
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    All Records ({candidates.length} Candidates)
                  </div>
                </>
              )}
              <DropdownMenuItem onClick={handleExportAllExcel} className="gap-2 cursor-pointer text-xs">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                Export All to Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportAllPdf} className="gap-2 cursor-pointer text-xs">
                <FileText className="h-4 w-4 text-rose-600" />
                Export All to PDF Document
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handlePrint} className="gap-2 cursor-pointer text-xs">
                <Printer className="h-4 w-4 text-primary" />
                Print Results Sheet
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {selectedYear === '2025/2026' && candidates.length < 146 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleLoadPdfData}
              disabled={isBatchSyncing}
              className="h-9 gap-1.5 text-xs font-semibold"
            >
              <Sparkles className="h-4 w-4 text-amber-500" />
              Load PDF Data (146 Candidates)
            </Button>
          )}
        </div>
      </div>

      {/* 5-Year BECE Aggregate Comparison Visual Line Chart */}
      <BeceAggregateFiveYearChart
        currentCandidates={candidates}
        currentYear={selectedYear}
        allDbCandidates={allDbCandidates}
        onSelectYear={(yr) => {
          setSelectedYear(yr);
          toast({
            title: `Academic Year Switched`,
            description: `Now viewing ${yr} BECE performance records.`,
          });
        }}
      />

      {/* BECE Elective Subject Filter & Visualization Component */}
      <BeceElectiveFilterCard
        candidates={candidates}
        selectedElective={selectedElective}
        onSelectElective={(el) => {
          setSelectedElective(el);
          if (el === 'all') {
            setElectiveGradeFilter('all');
            setFocusMode(false);
            if (sortField === 'electiveGrade') setSortField('sn');
          }
        }}
        gradeFilter={electiveGradeFilter}
        onSelectGradeFilter={(gf) => setElectiveGradeFilter(gf)}
        focusMode={focusMode}
        onToggleFocusMode={setFocusMode}
        filteredCount={filteredCandidates.length}
        totalCount={candidates.length}
        onResetFilters={handleResetElectiveFilters}
      />

      {/* Active Filter Chips Banner */}
      {isAnyFilterActive && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs print:hidden">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-foreground flex items-center gap-1">
              <Filter className="h-3.5 w-3.5 text-primary" />
              Active Filters ({filteredCandidates.length} results):
            </span>
            {selectedElective !== 'all' && selectedElectiveInfo && (
              <Badge variant="outline" className="border-primary/40 bg-background text-primary gap-1 font-medium">
                Elective: {selectedElectiveInfo.name} ({selectedElectiveInfo.code})
                <button
                  type="button"
                  onClick={() => setSelectedElective('all')}
                  className="ml-1 hover:text-foreground"
                >
                  ✕
                </button>
              </Badge>
            )}
            {electiveGradeFilter !== 'all' && (
              <Badge variant="outline" className="border-primary/40 bg-background text-primary gap-1 font-medium">
                Grade: {electiveGradeFilter === 'best2_only' ? '★ Top 2 Contributor' : electiveGradeFilter}
                <button
                  type="button"
                  onClick={() => setElectiveGradeFilter('all')}
                  className="ml-1 hover:text-foreground"
                >
                  ✕
                </button>
              </Badge>
            )}
            {aggregateFilter !== 'all' && (
              <Badge variant="outline" className="border-primary/40 bg-background text-primary gap-1 font-medium">
                Aggregate: {aggregateFilter}
                <button
                  type="button"
                  onClick={() => setAggregateFilter('all')}
                  className="ml-1 hover:text-foreground"
                >
                  ✕
                </button>
              </Badge>
            )}
            {searchQuery && (
              <Badge variant="outline" className="border-primary/40 bg-background text-primary gap-1 font-medium">
                Search: &quot;{searchQuery}&quot;
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="ml-1 hover:text-foreground"
                >
                  ✕
                </button>
              </Badge>
            )}
            {focusMode && selectedElective !== 'all' && (
              <Badge variant="secondary" className="gap-1 text-[11px]">
                <Eye className="h-3 w-3" />
                Focus Mode Active
              </Badge>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetAllFilters}
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear All Filters
          </Button>
        </div>
      )}

      {/* Main Official Results Table */}
      <Card className="overflow-hidden shadow-sm">
        <div className="bg-slate-900 text-white text-center py-4 px-6 border-b">
          <h2 className="text-xl md:text-2xl font-bold font-headline tracking-wide uppercase">
            UNIPRA NORTH JHS
          </h2>
          <p className="text-sm text-slate-300 font-semibold tracking-wider uppercase mt-0.5">
            {selectedYear} ACADEMIC YEAR CANDIDATES
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
            <span className="px-4 py-0.5 rounded-full bg-primary/30 text-primary-foreground font-mono font-bold text-xs tracking-widest uppercase border border-primary/40">
              BECE RESULT SHEET
            </span>
            {selectedElective !== 'all' && selectedElectiveInfo && (
              <span className="px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-semibold text-xs border border-emerald-500/30">
                Filtered: {selectedElectiveInfo.name} ({selectedElectiveInfo.code})
              </span>
            )}
          </div>
        </div>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b">
                  <th
                    rowSpan={2}
                    className="p-2.5 text-center font-bold border-r w-12 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    onClick={() => {
                      setSortField('sn');
                      setSortAsc(sortField === 'sn' ? !sortAsc : true);
                    }}
                  >
                    <div className="flex items-center justify-center gap-1">
                      S/N
                      <ArrowUpDown className="h-3 w-3 opacity-60" />
                    </div>
                  </th>
                  <th
                    rowSpan={2}
                    className="p-2.5 text-left font-bold border-r min-w-[200px] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    onClick={() => {
                      setSortField('name');
                      setSortAsc(sortField === 'name' ? !sortAsc : true);
                    }}
                  >
                    <div className="flex items-center gap-1">
                      NAME OF CANDIDATE
                      <ArrowUpDown className="h-3 w-3 opacity-60" />
                    </div>
                  </th>
                  <th rowSpan={2} className="p-2.5 text-center font-bold border-r min-w-[110px]">
                    INDEX NUMBER
                  </th>

                  {/* Subject Grades Header Spanning Columns */}
                  <th
                    colSpan={focusMode && selectedElective !== 'all' ? 5 : 10}
                    className="p-2 text-center font-bold border-b border-r bg-slate-200 dark:bg-slate-700 uppercase tracking-wider"
                  >
                    {focusMode && selectedElective !== 'all'
                      ? `CORE SUBJECTS + ${selectedElectiveInfo?.code || ''} ELECTIVE`
                      : 'SUBJECT GRADES (1–9)'}
                  </th>

                  <th
                    rowSpan={2}
                    className="p-2.5 text-center font-extrabold border-r bg-primary/10 text-primary min-w-[85px] cursor-pointer hover:bg-primary/20 transition-colors"
                    onClick={() => {
                      setSortField('bestSixTotal');
                      setSortAsc(sortField === 'bestSixTotal' ? !sortAsc : true);
                    }}
                  >
                    <div className="flex items-center justify-center gap-1">
                      BEST SIX (6) TOTAL
                      <ArrowUpDown className="h-3 w-3 opacity-60" />
                    </div>
                  </th>
                  <th rowSpan={2} className="p-2.5 text-center font-bold w-16 print:hidden">
                    ACTIONS
                  </th>
                </tr>

                {/* Sub-header row for subjects */}
                <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b">
                  {/* 4 Core Subjects */}
                  <th className="p-1.5 text-center font-bold border-r w-11" title="English Language">ENG</th>
                  <th className="p-1.5 text-center font-bold border-r w-11" title="Mathematics">MATHS</th>
                  <th className="p-1.5 text-center font-bold border-r w-11" title="Science">SCI</th>
                  <th className="p-1.5 text-center font-bold border-r w-11" title="Social Studies">S. STDS</th>

                  {/* If in Focus Mode, only render the selected elective column */}
                  {focusMode && selectedElective !== 'all' && selectedElectiveInfo ? (
                    <th
                      className="p-1.5 text-center font-bold border-r min-w-[70px] bg-primary/20 text-primary border-primary ring-1 ring-primary/40 cursor-pointer"
                      onClick={() => handleSortByElective(selectedElective)}
                      title={`${selectedElectiveInfo.name} (Click to sort)`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>{selectedElectiveInfo.code}</span>
                        <ArrowUpDown className="h-3 w-3 text-primary" />
                      </div>
                    </th>
                  ) : (
                    /* All 6 Electives */
                    BECE_ELECTIVE_SUBJECTS.map((sub) => {
                      const isHighlighted = selectedElective === sub.key;
                      return (
                        <th
                          key={sub.key}
                          onClick={() => handleSortByElective(sub.key)}
                          className={`p-1.5 text-center font-bold border-r w-11 cursor-pointer transition-colors ${
                            isHighlighted
                              ? 'bg-primary/25 text-primary border-primary ring-2 ring-primary/40 font-extrabold'
                              : 'hover:bg-slate-200/70 dark:hover:bg-slate-700/60'
                          }`}
                          title={`${sub.name} (Click to filter & sort)`}
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>{sub.code}</span>
                            {isHighlighted && <ArrowUpDown className="h-2.5 w-2.5 text-primary" />}
                          </div>
                        </th>
                      );
                    })
                  )}
                </tr>
              </thead>

              <tbody>
                {filteredCandidates.length === 0 ? (
                  <tr>
                    <td
                      colSpan={focusMode && selectedElective !== 'all' ? 9 : 15}
                      className="py-12 text-center text-muted-foreground"
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Award className="h-10 w-10 text-muted-foreground/40" />
                        <p className="text-sm font-semibold">No BECE candidates found</p>
                        <p className="text-xs">
                          {isAnyFilterActive
                            ? 'No matches for your current active filters.'
                            : 'Click "+ Add Candidate" or "Load PDF Data (146 Candidates)" to populate.'}
                        </p>
                        {isAnyFilterActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleResetAllFilters}
                            className="mt-2 text-xs"
                          >
                            Reset All Filters
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCandidates.map((cand, idx) => {
                    const topElectives = getElectivesUsedInBestSix(cand);

                    return (
                      <tr
                        key={cand.id || idx}
                        className="border-b hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors"
                      >
                        <td className="p-2.5 text-center font-mono font-medium border-r text-muted-foreground">
                          {cand.sn || idx + 1}
                        </td>
                        <td className="p-2.5 font-semibold border-r text-foreground">
                          {cand.name}
                        </td>
                        <td className="p-2.5 text-center font-mono text-muted-foreground border-r">
                          {cand.indexNumber}
                        </td>

                        {/* 4 Core Subjects */}
                        <td className="p-2 text-center border-r">{getGradeBadge(cand.eng)}</td>
                        <td className="p-2 text-center border-r">{getGradeBadge(cand.maths)}</td>
                        <td className="p-2 text-center border-r">{getGradeBadge(cand.sci)}</td>
                        <td className="p-2 text-center border-r">{getGradeBadge(cand.social)}</td>

                        {/* Elective Subjects Rendering */}
                        {focusMode && selectedElective !== 'all' && selectedElectiveInfo ? (
                          <td className="p-2 text-center border-r bg-primary/10 border-primary/20">
                            {getGradeBadge(
                              Number((cand as any)[selectedElective]),
                              true,
                              topElectives.includes(selectedElective)
                            )}
                          </td>
                        ) : (
                          BECE_ELECTIVE_SUBJECTS.map((sub) => {
                            const isSelected = selectedElective === sub.key;
                            const isTopElective = topElectives.includes(sub.key);
                            const grade = Number((cand as any)[sub.key]);

                            return (
                              <td
                                key={sub.key}
                                className={`p-2 text-center border-r transition-colors ${
                                  isSelected ? 'bg-primary/10 border-primary/30' : ''
                                }`}
                              >
                                {getGradeBadge(grade, isSelected, isTopElective)}
                              </td>
                            );
                          })
                        )}

                        {/* Best 6 Total */}
                        <td className="p-2 text-center font-mono font-extrabold text-sm border-r bg-primary/5 text-primary">
                          {cand.bestSixTotal}
                        </td>

                        {/* Actions */}
                        <td className="p-2 text-center print:hidden">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                setCandidateToEdit(cand);
                                setIsCandidateDialogOpen(true);
                              }}
                              title="Edit Candidate"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => setCandidateToDelete(cand)}
                              title="Delete Candidate"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Legend & Instructions Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg border gap-2 print:hidden">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-semibold text-foreground">WAEC Grading Legend:</span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
            Grades 1–2 (Distinction)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span>
            Grades 3–6 (Credit &amp; Pass)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500 inline-block"></span>
            Grades 7–9 (Fail)
          </span>
          <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
            <Star className="h-3 w-3 fill-amber-500 text-amber-500 inline-block" />
            ★ Best 2 Elective (Counted in Best 6 Total)
          </span>
        </div>
        <div className="font-mono text-[11px]">
          Showing {filteredCandidates.length} of {candidates.length} candidates
        </div>
      </div>

      {/* Candidate Add / Edit Dialog */}
      <BeceCandidateDialog
        isOpen={isCandidateDialogOpen}
        onOpenChange={setIsCandidateDialogOpen}
        candidateToEdit={candidateToEdit}
        academicYear={selectedYear}
        nextSn={candidates.length + 1}
        onSave={handleSaveCandidate}
      />

      {/* Import Spreadsheet Dialog */}
      <BeceImportDialog
        isOpen={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        academicYear={selectedYear}
        onImportComplete={handleBatchImport}
      />

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!candidateToDelete} onOpenChange={() => setCandidateToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete BECE Candidate?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              <span className="font-bold text-foreground">{candidateToDelete?.name}</span> (Index:{' '}
              {candidateToDelete?.indexNumber})? This will remove their BECE grades from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCandidate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
