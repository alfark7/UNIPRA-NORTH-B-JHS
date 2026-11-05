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
  FileText
} from 'lucide-react';
import { 
  parseTeachersFromExcel, 
  downloadTeacherTemplateExcel, 
  readFileAsArrayBuffer,
  type ParsedTeacherRow 
} from '@/lib/excel';
import type { Teacher } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface TeacherImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  existingTeachers: Teacher[];
  onConfirmImport: (parsedList: ParsedTeacherRow[]) => Promise<void>;
}

export function TeacherImportDialog({
  isOpen,
  onClose,
  existingTeachers,
  onConfirmImport,
}: TeacherImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedTeacherRow[]>([]);
  const [sheetName, setSheetName] = useState<string>('');
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const resetState = () => {
    setFile(null);
    setParsedRows([]);
    setSheetName('');
    setParseErrors([]);
    setIsParsing(false);
    setIsImporting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    if (isImporting) return;
    resetState();
    onClose();
  };

  const processFile = async (selectedFile: File) => {
    const name = selectedFile.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
      toast({
        variant: 'destructive',
        title: 'Invalid File Type',
        description: 'Please upload an Excel spreadsheet (.xlsx, .xls) or CSV file.',
      });
      return;
    }

    setIsParsing(true);
    try {
      // Read array buffer immediately while the file reference is fresh and active
      const buffer = await readFileAsArrayBuffer(selectedFile);
      const result = await parseTeachersFromExcel(buffer);

      setFile(selectedFile);
      setParsedRows(result.teachers);
      setSheetName(result.sheetName);
      setParseErrors(result.errors);

      if (result.teachers.length === 0) {
        toast({
          variant: 'destructive',
          title: 'No Teacher Records Found',
          description: 'Could not find any valid teacher rows with names in the sheet. Please use our template.',
        });
      } else {
        toast({
          title: 'File Parsed Successfully',
          description: `Found ${result.teachers.length} teacher records in sheet "${result.sheetName}".`,
        });
      }
    } catch (err: any) {
      console.error('Failed to parse Excel file:', err);
      const rawMsg = err?.message || String(err);
      const friendlyDescription =
        rawMsg.includes('permission problems') ||
        rawMsg.includes('could not be read') ||
        rawMsg.includes('NotReadableError')
          ? 'The spreadsheet could not be read. If it is currently open in Microsoft Excel, please close the file or save a copy, and try again.'
          : (err.message || 'Could not parse the Excel file. Please ensure it is a valid spreadsheet.');

      toast({
        variant: 'destructive',
        title: 'Failed to Read File',
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

  // Map existing teachers by staffId, email and id
  const existingMap = React.useMemo(() => {
    const setByStaffId = new Set<string>();
    const setByEmail = new Set<string>();
    const setById = new Set<string>();
    (existingTeachers || []).forEach((t) => {
      if (t.staffId) setByStaffId.add(t.staffId.trim().toLowerCase());
      if (t.email) setByEmail.add(t.email.trim().toLowerCase());
      if (t.id) setById.add(t.id);
    });
    return { setByStaffId, setByEmail, setById };
  }, [existingTeachers]);

  const counts = React.useMemo(() => {
    let newCount = 0;
    let updateCount = 0;
    parsedRows.forEach((row) => {
      const staffKey = row.staffId?.trim().toLowerCase();
      const emailKey = row.email?.trim().toLowerCase();
      const isExisting = 
        (row.id && existingMap.setById.has(row.id)) || 
        (staffKey && existingMap.setByStaffId.has(staffKey)) ||
        (emailKey && existingMap.setByEmail.has(emailKey));
      if (isExisting) {
        updateCount++;
      } else {
        newCount++;
      }
    });
    return { newCount, updateCount };
  }, [parsedRows, existingMap]);

  const handleImportClick = async () => {
    if (parsedRows.length === 0) return;
    setIsImporting(true);
    try {
      await onConfirmImport(parsedRows);
      handleClose();
    } catch (err: any) {
      console.error('Teacher import confirmation failed:', err);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-headline font-semibold">
                  Import Teachers from Excel
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Upload an Excel (.xlsx, .xls) or CSV sheet to batch add new teachers or update existing records.
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadTeacherTemplateExcel}
              className="text-xs gap-1.5 h-8"
              type="button"
            >
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
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
                    {isParsing ? 'Reading Excel file...' : 'Click to upload or drag and drop spreadsheet'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports Microsoft Excel (.xlsx, .xls) and CSV files
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="text-[11px] font-normal">
                    Matches existing by Staff ID / Email
                  </Badge>
                  <Badge variant="secondary" className="text-[11px] font-normal">
                    Auto-maps GES Rank, Grade & Qualifications
                  </Badge>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Loaded File Header Card */}
              <div className="p-4 rounded-xl border bg-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold truncate max-w-sm">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB • Sheet: &quot;{sheetName || 'Teachers'}&quot;
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
                  <p className="text-xs text-muted-foreground">Total Valid Teachers</p>
                  <p className="text-xl font-bold text-foreground mt-0.5">{parsedRows.length}</p>
                </div>
                <div className="p-3 rounded-lg border border-emerald-200/60 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">New Teachers</p>
                  </div>
                  <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                    +{counts.newCount}
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-amber-200/60 bg-amber-50/50 dark:bg-amber-950/20">
                  <div className="flex items-center gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5 text-amber-600" />
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Existing to Update</p>
                  </div>
                  <p className="text-xl font-bold text-amber-700 dark:text-amber-400 mt-0.5">
                    {counts.updateCount}
                  </p>
                </div>
              </div>

              {/* Warnings or skipped rows */}
              {parseErrors.length > 0 && (
                <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                  <div className="space-y-1">
                    <p className="font-semibold">Notice for {parseErrors.length} row(s):</p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {parseErrors.slice(0, 3).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                      {parseErrors.length > 3 && (
                        <li>...and {parseErrors.length - 3} more minor row issues.</li>
                      )}
                    </ul>
                  </div>
                </div>
              )}

              {/* Preview Table */}
              <div className="rounded-lg border overflow-hidden">
                <div className="bg-muted/40 px-3 py-2 border-b flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Preview (Showing first {Math.min(parsedRows.length, 8)} of {parsedRows.length} teachers)
                  </p>
                  <span className="text-[11px] text-muted-foreground">
                    Verify details before committing to database
                  </span>
                </div>
                <ScrollArea className="max-h-60">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs hover:bg-transparent">
                        <TableHead className="w-20">Action</TableHead>
                        <TableHead>Staff ID</TableHead>
                        <TableHead>Teacher Name</TableHead>
                        <TableHead>Rank & Grade</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Subjects</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Email</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                      {parsedRows.slice(0, 8).map((row, idx) => {
                        const staffKey = row.staffId?.trim().toLowerCase();
                        const emailKey = row.email?.trim().toLowerCase();
                        const isExisting = 
                          (row.id && existingMap.setById.has(row.id)) || 
                          (staffKey && existingMap.setByStaffId.has(staffKey)) ||
                          (emailKey && existingMap.setByEmail.has(emailKey));
                        return (
                          <TableRow key={idx}>
                            <TableCell>
                              {isExisting ? (
                                <Badge variant="outline" className="text-[10px] font-semibold text-amber-700 border-amber-300 bg-amber-50">
                                  Update
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] font-semibold text-emerald-700 border-emerald-300 bg-emerald-50">
                                  New
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="font-mono font-medium">{row.staffId}</TableCell>
                            <TableCell className="font-medium">
                              {row.firstName} {row.lastName}
                            </TableCell>
                            <TableCell>
                              <span className="font-medium">{row.rank}</span>
                              <span className="text-muted-foreground ml-1">(Gr. {row.grade})</span>
                            </TableCell>
                            <TableCell>{row.role}</TableCell>
                            <TableCell className="max-w-[150px] truncate">
                              {Array.isArray(row.subjects) ? row.subjects.join(', ') : row.subjects}
                            </TableCell>
                            <TableCell className="font-mono text-muted-foreground">
                              {row.phone}
                            </TableCell>
                            <TableCell className="text-muted-foreground truncate max-w-[140px]">
                              {row.email}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-3 border-t mt-2 flex sm:justify-between items-center gap-2">
          <div className="text-xs text-muted-foreground hidden sm:block">
            {parsedRows.length > 0 && !isImporting && (
              <span>Ready to save {parsedRows.length} teachers to UP JHS directory</span>
            )}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={isImporting}
              type="button"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleImportClick}
              disabled={parsedRows.length === 0 || isImporting}
              className="gap-1.5"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving to Directory...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Import {parsedRows.length} Teachers
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
