'use client';

import React, { useState, useRef } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  RefreshCw,
  FileText,
  Search,
  Filter
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { 
  parseAcademicScoresFromExcel, 
  downloadAcademicScoresTemplateExcel, 
  readFileAsArrayBuffer,
  type ParsedScoreRow 
} from '@/lib/excel';
import type { Student } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface AcademicImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  existingStudents: Student[];
  scoreSettings?: any;
  defaultContext?: {
    academicYear?: string;
    term?: number;
    subject?: string;
    class?: string;
    stream?: string;
  };
  onConfirmImport: (parsedList: ParsedScoreRow[]) => Promise<void>;
}

export function AcademicImportDialog({
  isOpen,
  onClose,
  existingStudents,
  scoreSettings,
  defaultContext,
  onConfirmImport,
}: AcademicImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedScoreRow[]>([]);
  const [sheetName, setSheetName] = useState<string>('');
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const resetState = () => {
    setFile(null);
    setParsedRows([]);
    setSheetName('');
    setParseErrors([]);
    setIsParsing(false);
    setIsImporting(false);
    setSearchFilter('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    if (isImporting) return;
    resetState();
    onClose();
  };

  const handleDownloadTemplate = () => {
    downloadAcademicScoresTemplateExcel({
      students: existingStudents,
      selectedClass: defaultContext?.class,
      selectedStream: defaultContext?.stream,
      selectedSubject: defaultContext?.subject,
      selectedAcademicYear: defaultContext?.academicYear,
      selectedTerm: defaultContext?.term,
    });
    toast({
      title: 'Template Downloaded',
      description: 'Excel score entry template has been downloaded. Fill in the scores and upload.',
    });
  };

  const processFile = async (selectedFile: File) => {
    const name = selectedFile.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
      toast({
        variant: 'destructive',
        title: 'Invalid File Format',
        description: 'Please upload an Excel spreadsheet (.xlsx, .xls) or CSV file.',
      });
      return;
    }

    setIsParsing(true);
    try {
      // Read array buffer immediately while the file reference is fresh and active
      const buffer = await readFileAsArrayBuffer(selectedFile);
      const result = await parseAcademicScoresFromExcel(
        buffer,
        existingStudents,
        scoreSettings,
        defaultContext
      );

      setFile(selectedFile);
      setParsedRows(result.scores);
      setSheetName(result.sheetName);
      setParseErrors(result.errors);

      if (result.scores.length === 0) {
        toast({
          variant: 'destructive',
          title: 'No Score Records Found',
          description: 'Could not extract valid student score rows. Please use our Excel template.',
        });
      } else {
        const matched = result.scores.filter(r => r.status === 'ready').length;
        const unmatched = result.scores.length - matched;
        toast({
          title: 'File Parsed Successfully',
          description: `Extracted ${result.scores.length} score rows (${matched} matched with student directory${unmatched > 0 ? `, ${unmatched} unmatched` : ''}).`,
        });
      }
    } catch (err: any) {
      console.error('Failed to parse academic scores Excel:', err);
      const rawMsg = err?.message || String(err);
      const friendlyDescription =
        rawMsg.includes('permission problems') ||
        rawMsg.includes('could not be read') ||
        rawMsg.includes('NotReadableError')
          ? 'The spreadsheet could not be read. If it is currently open in Microsoft Excel, please close the file or save a copy, and try again.'
          : (err.message || 'Could not parse spreadsheet. Please ensure headers match the template.');

      toast({
        variant: 'destructive',
        title: 'Failed to Parse File',
        description: friendlyDescription,
      });
      resetState();
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      processFile(selected);
    }
    // Clear value to allow selecting the same file after modification
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const stats = React.useMemo(() => {
    const total = parsedRows.length;
    const ready = parsedRows.filter(r => r.status === 'ready').length;
    const unmatched = parsedRows.filter(r => r.status === 'student_not_found').length;
    return { total, ready, unmatched };
  }, [parsedRows]);

  const filteredPreview = React.useMemo(() => {
    if (!searchFilter.trim()) return parsedRows;
    const q = searchFilter.toLowerCase();
    return parsedRows.filter(r => 
      r.studentName?.toLowerCase().includes(q) ||
      r.admissionNumber.toLowerCase().includes(q) ||
      r.subject.toLowerCase().includes(q) ||
      r.class.toLowerCase().includes(q)
    );
  }, [parsedRows, searchFilter]);

  const handleImportClick = async () => {
    const readyScores = parsedRows.filter(r => r.status === 'ready');
    if (readyScores.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Valid Scores to Import',
        description: 'None of the rows matched with students in the directory. Please check admission numbers.',
      });
      return;
    }

    setIsImporting(true);
    try {
      await onConfirmImport(readyScores);
      handleClose();
    } catch (err: any) {
      console.error('Import confirmed error:', err);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-headline font-semibold">
                  Import Academic Scores from Excel
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Upload an Excel (.xlsx, .xls) or CSV sheet to batch enter or update student subject scores.
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="text-xs gap-1.5 h-8 shrink-0 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300"
              type="button"
            >
              <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Download Excel Template
            </Button>
          </div>
        </DialogHeader>

        {/* Stable file input permanently mounted to prevent handle invalidation */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx, .xls, .csv"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
          {/* File Upload Zone */}
          {!file ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
              }`}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  {isParsing ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <UploadCloud className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {isParsing ? 'Processing score spreadsheet...' : 'Click to upload or drag and drop spreadsheet'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports Microsoft Excel (.xlsx, .xls) and CSV score sheets
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                  <Badge variant="secondary" className="text-[11px] font-normal">
                    Matches students by Admission Number
                  </Badge>
                  <Badge variant="secondary" className="text-[11px] font-normal">
                    Auto-calculates Class Score (50%) &amp; Exam Score (50%)
                  </Badge>
                  <Badge variant="secondary" className="text-[11px] font-normal">
                    Computes Final Grade &amp; Remarks
                  </Badge>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Loaded File Header Card */}
              <div className="p-3.5 rounded-xl border bg-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold truncate max-w-sm">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB • Sheet: &quot;{sheetName || 'Sheet1'}&quot;
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImporting}
                    className="text-xs gap-1 h-8"
                  >
                    <RefreshCw className="h-3 w-3" /> Change File
                  </Button>
                </div>
              </div>

              {/* Status Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border bg-card text-card-foreground">
                  <p className="text-xs text-muted-foreground">Total Parsed Rows</p>
                  <p className="text-xl font-bold text-foreground mt-0.5">{stats.total}</p>
                </div>
                <div className="p-3 rounded-lg border border-emerald-200/60 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Ready to Import</p>
                  </div>
                  <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {stats.ready}
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-amber-200/60 bg-amber-50/50 dark:bg-amber-950/20">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Unmatched Students</p>
                  </div>
                  <p className="text-xl font-bold text-amber-700 dark:text-amber-400 mt-0.5">
                    {stats.unmatched}
                  </p>
                </div>
              </div>

              {/* Warnings / Parse Errors Accordion */}
              {parseErrors.length > 0 && (
                <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-300">
                  <p className="font-semibold flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> {parseErrors.length} Formatting Issues:
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5 max-h-24 overflow-y-auto">
                    {parseErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preview Controls */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search by student, admission no, or subject..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Showing {filteredPreview.length} of {parsedRows.length} entries
                </p>
              </div>

              {/* Preview Table */}
              <div className="rounded-lg border overflow-hidden">
                <ScrollArea className="max-h-[300px]">
                  <Table className="text-xs">
                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="w-20">Status</TableHead>
                        <TableHead>Admission No</TableHead>
                        <TableHead>Student Name</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead className="text-center">Tests (1/2)</TableHead>
                        <TableHead className="text-center">Continuous (GW/Proj/CE/HW)</TableHead>
                        <TableHead className="text-center">Class (50%)</TableHead>
                        <TableHead className="text-center">Exam (100)</TableHead>
                        <TableHead className="text-center">Exam (50%)</TableHead>
                        <TableHead className="text-center font-bold">Total</TableHead>
                        <TableHead className="text-center">Grade</TableHead>
                        <TableHead>Remark</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPreview.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={13} className="text-center py-6 text-muted-foreground">
                            No matching scores found in the spreadsheet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredPreview.map((row, idx) => (
                          <TableRow key={idx} className={row.status !== 'ready' ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''}>
                            <TableCell>
                              {row.status === 'ready' ? (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] py-0">
                                  Ready
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="text-[10px] py-0" title={row.statusMessage}>
                                  Unmatched
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-[11px]">{row.admissionNumber || '—'}</TableCell>
                            <TableCell className="font-medium whitespace-nowrap">
                              {row.studentName}
                              {row.statusMessage && (
                                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-normal">{row.statusMessage}</p>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {row.class} {row.stream ? `(${row.stream})` : ''}
                            </TableCell>
                            <TableCell className="font-medium text-primary whitespace-nowrap">{row.subject}</TableCell>
                            <TableCell className="text-center whitespace-nowrap">
                              {row.test1} / {row.test2}
                            </TableCell>
                            <TableCell className="text-center text-muted-foreground whitespace-nowrap">
                              {row.groupWork}+{row.project}+{row.classExercises}+{row.homeWork}
                            </TableCell>
                            <TableCell className="text-center font-semibold text-emerald-700 dark:text-emerald-400">
                              {row.classScore}
                            </TableCell>
                            <TableCell className="text-center">{row.exam}</TableCell>
                            <TableCell className="text-center font-semibold text-emerald-700 dark:text-emerald-400">
                              {row.examScore}
                            </TableCell>
                            <TableCell className="text-center font-bold text-foreground">
                              {row.total}
                            </TableCell>
                            <TableCell className="text-center font-semibold">
                              {row.grade}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-[11px] whitespace-nowrap">
                              {row.remark}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-3 border-t flex flex-row items-center justify-between sm:justify-between">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isImporting}
            type="button"
          >
            Cancel
          </Button>
          {file && (
            <Button
              onClick={handleImportClick}
              disabled={isImporting || stats.ready === 0}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing Scores...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm &amp; Import ({stats.ready} Scores)
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
