'use client';

import { useState, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import {
  BeceCandidate,
  BECE_SUBJECTS,
  calculateBestSixTotal,
  BeceSubjectKey,
} from '@/lib/bece-data';
import { GraduationCap, Sparkles, Check, AlertCircle } from 'lucide-react';

interface BeceCandidateDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  candidateToEdit?: BeceCandidate | null;
  academicYear: string;
  nextSn: number;
  onSave: (candidate: Partial<BeceCandidate>) => Promise<void>;
}

export function BeceCandidateDialog({
  isOpen,
  onOpenChange,
  candidateToEdit,
  academicYear,
  nextSn,
  onSave,
}: BeceCandidateDialogProps) {
  const [name, setName] = useState('');
  const [indexNumber, setIndexNumber] = useState('');
  const [grades, setGrades] = useState<Record<BeceSubjectKey, number>>({
    eng: 5,
    maths: 5,
    sci: 5,
    social: 5,
    rme: 5,
    cad: 5,
    careerTech: 5,
    computing: 5,
    french: 6,
    fante: 5,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (candidateToEdit) {
      setName(candidateToEdit.name);
      setIndexNumber(candidateToEdit.indexNumber);
      setGrades({
        eng: candidateToEdit.eng,
        maths: candidateToEdit.maths,
        sci: candidateToEdit.sci,
        social: candidateToEdit.social,
        rme: candidateToEdit.rme,
        cad: candidateToEdit.cad,
        careerTech: candidateToEdit.careerTech,
        computing: candidateToEdit.computing,
        french: candidateToEdit.french,
        fante: candidateToEdit.fante,
      });
    } else {
      setName('');
      setIndexNumber(`0302054${String(nextSn).padStart(3, '0')}`);
      setGrades({
        eng: 5,
        maths: 5,
        sci: 5,
        social: 5,
        rme: 5,
        cad: 5,
        careerTech: 5,
        computing: 5,
        french: 6,
        fante: 5,
      });
    }
    setErrorMsg('');
  }, [candidateToEdit, nextSn, isOpen]);

  const bestSix = calculateBestSixTotal(grades);

  const handleGradeChange = (key: BeceSubjectKey, value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 1 && num <= 9) {
      setGrades((prev) => ({ ...prev, [key]: num }));
    } else if (value === '') {
      setGrades((prev) => ({ ...prev, [key]: 9 }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please enter the candidate name.');
      return;
    }
    if (!indexNumber.trim()) {
      setErrorMsg('Please enter the index number.');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');
    try {
      await onSave({
        id: candidateToEdit?.id,
        sn: candidateToEdit?.sn || nextSn,
        name: name.trim().toUpperCase(),
        indexNumber: indexNumber.trim(),
        academicYear,
        ...grades,
        bestSixTotal: bestSix,
      });
      onOpenChange(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save candidate.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-headline">
            <GraduationCap className="h-5 w-5 text-primary" />
            {candidateToEdit ? 'Edit BECE Candidate' : 'Add New BECE Candidate'}
          </DialogTitle>
          <DialogDescription>
            Enter candidate credentials and national WAEC/BECE grades (1–9) for all 10 subjects.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 flex-1 overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cand-name">Candidate Name *</Label>
              <Input
                id="cand-name"
                placeholder="e.g. ABBAM GODFRED"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cand-index">Index Number *</Label>
              <Input
                id="cand-index"
                placeholder="e.g. 0302054001"
                value={indexNumber}
                onChange={(e) => setIndexNumber(e.target.value)}
              />
            </div>
          </div>

          {/* Live Best Six Aggregate Preview */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border rounded-lg flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                Best Six (6) Total / Aggregate
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Formula: 4 Cores (ENG, MATH, SCI, S.STDS) + Best 2 Electives
              </p>
            </div>
            <div className="text-right flex items-center gap-2">
              <span className="text-3xl font-extrabold font-mono text-primary">{bestSix}</span>
              <Badge
                variant={bestSix <= 15 ? 'default' : bestSix <= 30 ? 'secondary' : 'outline'}
                className="text-xs"
              >
                {bestSix <= 15 ? 'Distinction' : bestSix <= 24 ? 'Credit' : bestSix <= 30 ? 'Pass' : 'Weak Pass'}
              </Badge>
            </div>
          </div>

          {/* Core Subjects */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b pb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Core Subjects (Mandatory in Aggregate)
              </span>
              <span className="text-[11px] text-muted-foreground">Grades 1 (Highest) to 9 (Lowest)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {BECE_SUBJECTS.filter((s) => s.isCore).map((sub) => (
                <div key={sub.key} className="space-y-1 p-2 bg-slate-50 dark:bg-slate-900/60 rounded border">
                  <Label htmlFor={`grade-${sub.key}`} className="text-xs font-semibold block truncate" title={sub.name}>
                    {sub.code} ({sub.name})
                  </Label>
                  <Input
                    id={`grade-${sub.key}`}
                    type="number"
                    min={1}
                    max={9}
                    value={grades[sub.key]}
                    onChange={(e) => handleGradeChange(sub.key, e.target.value)}
                    className="font-mono text-center font-bold text-base h-9"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Elective Subjects */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b pb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Elective Subjects (Best 2 counted)
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {BECE_SUBJECTS.filter((s) => !s.isCore).map((sub) => (
                <div key={sub.key} className="space-y-1 p-2 bg-slate-50 dark:bg-slate-900/60 rounded border">
                  <Label htmlFor={`grade-${sub.key}`} className="text-xs font-semibold block truncate" title={sub.name}>
                    {sub.code} ({sub.name})
                  </Label>
                  <Input
                    id={`grade-${sub.key}`}
                    type="number"
                    min={1}
                    max={9}
                    value={grades[sub.key]}
                    onChange={(e) => handleGradeChange(sub.key, e.target.value)}
                    className="font-mono text-center font-bold text-base h-9"
                  />
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving} className="gap-2">
              <Check className="h-4 w-4" />
              {candidateToEdit ? 'Save Changes' : 'Add Candidate'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
