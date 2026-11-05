'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { downloadBeceTemplateExcel, parseBeceFile } from '@/lib/bece-excel';
import { BeceCandidate } from '@/lib/bece-data';

interface BeceImportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  academicYear: string;
  onImportComplete: (candidates: BeceCandidate[]) => Promise<void>;
}

export function BeceImportDialog({
  isOpen,
  onOpenChange,
  academicYear,
  onImportComplete,
}: BeceImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedPreview, setParsedPreview] = useState<BeceCandidate[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsProcessing(true);
    try {
      const results = await parseBeceFile(selectedFile, academicYear);
      setParsedPreview(results);
      toast({
        title: 'File Parsed Successfully',
        description: `Loaded ${results.length} candidate records ready for review.`,
      });
    } catch (err: any) {
      toast({
        title: 'Error Parsing File',
        description: err.message || 'Could not parse the selected spreadsheet.',
        variant: 'destructive',
      });
      setFile(null);
      setParsedPreview([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    if (!parsedPreview || parsedPreview.length === 0) return;
    setIsSaving(true);
    try {
      await onImportComplete(parsedPreview);
      toast({
        title: 'Import Complete',
        description: `Successfully stored ${parsedPreview.length} BECE candidate records.`,
      });
      onOpenChange(false);
      setFile(null);
      setParsedPreview([]);
    } catch (err: any) {
      toast({
        title: 'Failed to Save Candidates',
        description: err.message || 'Error occurred while saving records to Firestore.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-headline">
            <Upload className="h-5 w-5 text-primary" />
            Import BECE Academic Performance
          </DialogTitle>
          <DialogDescription>
            Import candidates, index numbers, and grades for all 10 BECE subjects for academic year{' '}
            <span className="font-semibold text-foreground">{academicYear}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 flex-1 overflow-y-auto">
          {/* Template Download Card */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-md text-primary">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">Standard BECE Template</p>
                <p className="text-xs text-muted-foreground">
                  Includes all 10 subject columns (ENG, MATHS, SCI, S. STDS, RME, CAD, C. TECH, COMP, FREN, FANTE)
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={downloadBeceTemplateExcel} className="gap-1.5 shrink-0">
              <Download className="h-4 w-4" />
              Download Template
            </Button>
          </div>

          {/* File Upload Input */}
          <div className="space-y-2">
            <Label htmlFor="bece-file-upload">Select Excel or CSV Spreadsheet</Label>
            <Input
              id="bece-file-upload"
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              disabled={isProcessing || isSaving}
            />
          </div>

          {isProcessing && (
            <div className="flex items-center justify-center p-6 text-sm text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Analyzing spreadsheet rows and computing Best Six totals...
            </div>
          )}

          {parsedPreview.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Preview ({parsedPreview.length} Candidates ready to import)
                </p>
              </div>
              <div className="border rounded-md max-h-48 overflow-y-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="p-2 border-b">S/N</th>
                      <th className="p-2 border-b">Candidate Name</th>
                      <th className="p-2 border-b">Index Number</th>
                      <th className="p-2 border-b">Core (E/M/S/SS)</th>
                      <th className="p-2 border-b">Best 6</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedPreview.slice(0, 10).map((cand, idx) => (
                      <tr key={idx} className="hover:bg-muted/50 border-b">
                        <td className="p-2 font-mono">{cand.sn || idx + 1}</td>
                        <td className="p-2 font-medium">{cand.name}</td>
                        <td className="p-2 font-mono text-muted-foreground">{cand.indexNumber}</td>
                        <td className="p-2 font-mono">
                          {cand.eng}/{cand.maths}/{cand.sci}/{cand.social}
                        </td>
                        <td className="p-2 font-bold text-primary">{cand.bestSixTotal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedPreview.length > 10 && (
                <p className="text-xs text-muted-foreground text-center">
                  Showing first 10 of {parsedPreview.length} records.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={parsedPreview.length === 0 || isSaving}
            className="gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Confirm & Import {parsedPreview.length > 0 ? `(${parsedPreview.length})` : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
