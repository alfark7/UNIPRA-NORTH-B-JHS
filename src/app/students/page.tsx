
'use client';

import { useMemo, useState } from 'react';
import { doc, setDoc, addDoc, collection, deleteDoc, writeBatch } from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { StudentControls } from '@/components/students/student-controls';
import { StudentTable } from '@/components/students/student-table';
import { StudentForm } from '@/components/students/student-form';
import { StudentImportDialog } from '@/components/students/student-import-dialog';
import type { Student } from '@/lib/types';
import type { ParsedStudentRow } from '@/lib/excel';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

import { compressBase64Image } from '@/lib/image-utils';
import { AlertTriangle, Trash2, CheckCircle2, ShieldCheck, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function StudentsPage() {
  const firestore = useFirestore();
  const studentsQuery = useMemo(() => collection(firestore, 'students'), [firestore]);
  const { data: students, loading } = useCollection<Student>(studentsQuery);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isDedupeOpen, setIsDedupeOpen] = useState(false);
  const [isCleaningDuplicates, setIsCleaningDuplicates] = useState(false);
  const { toast } = useToast();

  const handleOpenForm = (student: Student | null) => {
    setSelectedStudent(student);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedStudent(null);
  };

  const handleBatchImport = async (parsedList: ParsedStudentRow[]) => {
    if (!parsedList || parsedList.length === 0) return;

    // Build lookup maps for fast matching against existing students in state
    const existingByAdm = new Map<string, string>();
    const existingByNameClass = new Map<string, string>();
    const existingById = new Set<string>();

    students.forEach((s) => {
      if (s.id) existingById.add(s.id);
      if (s.admissionNumber) {
        existingByAdm.set(s.admissionNumber.trim().toLowerCase(), s.id);
      }
      if (s.firstName && s.lastName && s.class) {
        existingByNameClass.set(
          `${s.firstName.trim().toLowerCase()}|${s.lastName.trim().toLowerCase()}|${s.class.trim().toLowerCase()}`,
          s.id
        );
      }
    });

    const CHUNK_SIZE = 400;
    let addedCount = 0;
    let updatedCount = 0;

    try {
      for (let i = 0; i < parsedList.length; i += CHUNK_SIZE) {
        const chunk = parsedList.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(firestore);

        for (const item of chunk) {
          let targetDocId = item.id;
          const admKey = item.admissionNumber?.trim().toLowerCase();
          const nameKey = item.firstName && item.lastName && item.class
            ? `${item.firstName.trim().toLowerCase()}|${item.lastName.trim().toLowerCase()}|${item.class.trim().toLowerCase()}`
            : null;

          if (!targetDocId && admKey && existingByAdm.has(admKey)) {
            targetDocId = existingByAdm.get(admKey);
          } else if (!targetDocId && nameKey && existingByNameClass.has(nameKey)) {
            targetDocId = existingByNameClass.get(nameKey);
          }

          let avatarVal = item.avatar || `https://picsum.photos/seed/${encodeURIComponent(item.admissionNumber || Math.random().toString())}/150/150`;
          if (avatarVal.startsWith('data:image/') && avatarVal.length > 80 * 1024) {
            try {
              avatarVal = await compressBase64Image(avatarVal, { maxWidth: 300, maxHeight: 300, quality: 0.75 });
            } catch {
              avatarVal = `https://picsum.photos/seed/${encodeURIComponent(item.admissionNumber || Math.random().toString())}/150/150`;
            }
          }

          const studentData = {
            firstName: item.firstName,
            lastName: item.lastName,
            email: item.email,
            class: item.class,
            stream: item.stream || null,
            classId: item.stream ? `${item.class}${item.stream}` : item.class,
            section: item.section || 'RED',
            gender: item.gender || 'Male',
            guardianName: item.guardianName || 'Parent / Guardian',
            guardianPhone: item.guardianPhone || '0200000000',
            dateOfBirth: item.dateOfBirth || '2011-01-01',
            avatar: avatarVal,
            admissionNumber: item.admissionNumber,
            ...(item.conduct ? { conduct: item.conduct } : {}),
            ...(item.interest ? { interest: item.interest } : {}),
            ...(item.classTeacherRemark ? { classTeacherRemark: item.classTeacherRemark } : {}),
            ...(item.headTeacherRemark ? { headTeacherRemark: item.headTeacherRemark } : {}),
          };

          if (targetDocId && (existingById.has(targetDocId) || (admKey && existingByAdm.has(admKey)) || (nameKey && existingByNameClass.has(nameKey)))) {
            const docRef = doc(firestore, 'students', targetDocId);
            batch.set(docRef, studentData, { merge: true });
            updatedCount++;
            if (admKey) existingByAdm.set(admKey, targetDocId);
            if (nameKey) existingByNameClass.set(nameKey, targetDocId);
          } else {
            const newDocRef = doc(collection(firestore, 'students'));
            batch.set(newDocRef, studentData);
            addedCount++;
            existingById.add(newDocRef.id);
            if (admKey) existingByAdm.set(admKey, newDocRef.id);
            if (nameKey) existingByNameClass.set(nameKey, newDocRef.id);
          }
        }

        await batch.commit();
      }

      toast({
        title: 'Import Completed',
        description: `Successfully processed ${parsedList.length} student records (${addedCount} added, ${updatedCount} merged/updated).`,
      });
    } catch (serverError: any) {
      console.error('Error importing students batch:', serverError);
      const errMsg = String(serverError?.message || serverError || '');
      const isSizeError = errMsg.includes('exceeds the maximum allowed size') || 
                          errMsg.includes('maximum allowed size') || 
                          serverError?.code === 'resource-exhausted';

      if (isSizeError) {
        toast({
          variant: 'destructive',
          title: 'Batch Import Exceeds Size Limit',
          description: 'One or more student records exceed Firestore limits. Please use compressed photos or URLs.',
        });
      } else {
        const permissionError = new FirestorePermissionError({
          path: 'students',
          operation: 'create',
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({
          variant: 'destructive',
          title: 'Batch Import Failed',
          description: errMsg || 'Could not import students to Firestore.',
        });
      }
      throw serverError;
    }
  };

  // Identify any existing duplicates in the directory
  const duplicateClusters = useMemo(() => {
    if (!students || students.length < 2) return [];

    const byAdm = new Map<string, Student[]>();
    const byNameClass = new Map<string, Student[]>();

    students.forEach((student) => {
      const adm = (student.admissionNumber || '').trim().toLowerCase();
      if (adm) {
        if (!byAdm.has(adm)) byAdm.set(adm, []);
        byAdm.get(adm)!.push(student);
      }

      const nameClass = `${(student.firstName || '').trim().toLowerCase()}|${(student.lastName || '').trim().toLowerCase()}|${(student.class || '').trim().toLowerCase()}`;
      if (student.firstName && student.lastName && student.class) {
        if (!byNameClass.has(nameClass)) byNameClass.set(nameClass, []);
        byNameClass.get(nameClass)!.push(student);
      }
    });

    const clusters: { key: string; reason: string; students: Student[] }[] = [];
    const seenStudentIds = new Set<string>();

    byAdm.forEach((list, adm) => {
      if (list.length > 1) {
        clusters.push({
          key: `adm-${adm}`,
          reason: `Same Admission Number "${list[0].admissionNumber}"`,
          students: list,
        });
        list.forEach((s) => seenStudentIds.add(s.id));
      }
    });

    byNameClass.forEach((list, key) => {
      if (list.length > 1) {
        const hasUnseen = list.some((s) => !seenStudentIds.has(s.id));
        if (hasUnseen) {
          clusters.push({
            key: `name-${key}`,
            reason: `Same Name & Class ("${list[0].firstName} ${list[0].lastName}" in ${list[0].class})`,
            students: list,
          });
          list.forEach((s) => seenStudentIds.add(s.id));
        }
      }
    });

    return clusters;
  }, [students]);

  const handleAutoCleanDuplicates = async () => {
    if (duplicateClusters.length === 0) return;
    setIsCleaningDuplicates(true);
    try {
      const batch = writeBatch(firestore);
      let removedCount = 0;

      duplicateClusters.forEach((cluster) => {
        // Keep the first entry, remove redundant copies
        const toDelete = cluster.students.slice(1);
        toDelete.forEach((s) => {
          batch.delete(doc(firestore, 'students', s.id));
          removedCount++;
        });
      });

      await batch.commit();
      toast({
        title: 'Duplicates Resolved',
        description: `Successfully cleaned up ${removedCount} redundant duplicate student record(s).`,
      });
      setIsDedupeOpen(false);
    } catch (err: any) {
      console.error('Failed to clean duplicates:', err);
      toast({
        variant: 'destructive',
        title: 'Cleanup Failed',
        description: err.message || 'Could not delete duplicate records.',
      });
    } finally {
      setIsCleaningDuplicates(false);
    }
  };

  const handleDeleteSingleDuplicate = async (studentId: string, studentName: string) => {
    try {
      await deleteDoc(doc(firestore, 'students', studentId));
      toast({
        title: 'Duplicate Removed',
        description: `Successfully deleted copy of ${studentName}.`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Deletion Failed',
        description: err.message || 'Could not delete duplicate record.',
      });
    }
  };

  const handleSaveStudent = async (studentData: Omit<Student, 'id'>, id?: string) => {
    // 1. Strict duplicate validation
    const trimmedAdm = (studentData.admissionNumber || '').trim().toLowerCase();
    const trimmedFirst = (studentData.firstName || '').trim().toLowerCase();
    const trimmedLast = (studentData.lastName || '').trim().toLowerCase();
    const trimmedClass = (studentData.class || '').trim().toLowerCase();

    if (!id) {
      // Prevent duplicate admission number
      if (trimmedAdm) {
        const duplicateAdm = students.find(s => (s.admissionNumber || '').trim().toLowerCase() === trimmedAdm);
        if (duplicateAdm) {
          toast({
            variant: 'destructive',
            title: 'Duplicate Student Entry Prevented',
            description: `Admission number "${studentData.admissionNumber}" is already registered to ${duplicateAdm.firstName} ${duplicateAdm.lastName} in ${duplicateAdm.class}.`,
          });
          return;
        }
      }

      // Prevent duplicate full name in same class
      if (trimmedFirst && trimmedLast && trimmedClass) {
        const duplicateName = students.find(
          s => (s.firstName || '').trim().toLowerCase() === trimmedFirst &&
               (s.lastName || '').trim().toLowerCase() === trimmedLast &&
               (s.class || '').trim().toLowerCase() === trimmedClass
        );
        if (duplicateName) {
          toast({
            variant: 'destructive',
            title: 'Duplicate Student Entry Prevented',
            description: `A student named "${studentData.firstName} ${studentData.lastName}" is already enrolled in ${studentData.class} (Admission: ${duplicateName.admissionNumber}).`,
          });
          return;
        }
      }
    } else {
      // Updating: ensure new admission number doesn't conflict with another student
      if (trimmedAdm) {
        const duplicateAdm = students.find(s => s.id !== id && (s.admissionNumber || '').trim().toLowerCase() === trimmedAdm);
        if (duplicateAdm) {
          toast({
            variant: 'destructive',
            title: 'Admission Number Conflict',
            description: `Admission number "${studentData.admissionNumber}" is already in use by ${duplicateAdm.firstName} ${duplicateAdm.lastName}.`,
          });
          return;
        }
      }
    }

    // Ensure avatar data URL is compressed before writing to Firestore
    let finalStudentData = { ...studentData };
    if (finalStudentData.avatar && finalStudentData.avatar.startsWith('data:image/') && finalStudentData.avatar.length > 80 * 1024) {
      try {
        finalStudentData.avatar = await compressBase64Image(finalStudentData.avatar, {
          maxWidth: 300,
          maxHeight: 300,
          quality: 0.75,
          maxSizeBytes: 150 * 1024,
        });
      } catch (err) {
        console.warn('Student avatar compression before save error:', err);
      }
    }

    if (id) {
      // Update existing student
      const docRef = doc(firestore, 'students', id);
      try {
        await setDoc(docRef, finalStudentData, { merge: true });
        toast({
          title: 'Student Updated',
          description: `${finalStudentData.firstName} ${finalStudentData.lastName}'s information has been updated.`,
        });
      } catch (serverError: any) {
        console.error("Error updating student:", serverError);
        const errMsg = String(serverError?.message || serverError || '');
        const isSizeError = errMsg.includes('exceeds the maximum allowed size') || 
                            errMsg.includes('maximum allowed size') || 
                            serverError?.code === 'resource-exhausted';

        if (isSizeError) {
          toast({
            variant: 'destructive',
            title: 'Image / Data Exceeds Limit',
            description: 'The student photo or data is too large for Firestore (max 1MB). It has been automatically resized, please save again.',
          });
        } else {
          const permissionError = new FirestorePermissionError({
              path: docRef.path,
              operation: 'update',
              requestResourceData: finalStudentData,
          });
          errorEmitter.emit('permission-error', permissionError);
          toast({
            variant: 'destructive',
            title: 'Update Failed',
            description: errMsg.includes('Missing or insufficient permissions')
              ? 'You do not have permission to update student records.'
              : errMsg || 'Could not update student record.',
          });
        }
      }
    } else {
      // Add new student
      const collectionRef = collection(firestore, 'students');
      try {
        await addDoc(collectionRef, finalStudentData);
        toast({
          title: 'Student Added',
          description: `${finalStudentData.firstName} ${finalStudentData.lastName} has been added.`,
        });
      } catch (serverError: any) {
        console.error("Error adding student:", serverError);
        const errMsg = String(serverError?.message || serverError || '');
        const isSizeError = errMsg.includes('exceeds the maximum allowed size') || 
                            errMsg.includes('maximum allowed size') || 
                            serverError?.code === 'resource-exhausted';

        if (isSizeError) {
          toast({
            variant: 'destructive',
            title: 'Image / Data Exceeds Limit',
            description: 'The student photo or data is too large for Firestore (max 1MB). Please select a smaller photo.',
          });
        } else {
          const permissionError = new FirestorePermissionError({
              path: collectionRef.path,
              operation: 'create',
              requestResourceData: finalStudentData,
          });
          errorEmitter.emit('permission-error', permissionError);
          toast({
            variant: 'destructive',
            title: 'Addition Failed',
            description: errMsg.includes('Missing or insufficient permissions')
              ? 'You do not have permission to add student records.'
              : errMsg || 'Could not add student record.',
          });
        }
      }
    }
    handleCloseForm();
  };
  
  const handleDeleteStudent = async (studentId: string) => {
      const docRef = doc(firestore, 'students', studentId);
      try {
        await deleteDoc(docRef);
        toast({
            title: 'Student Deleted',
            description: 'The student record has been permanently removed from the directory.',
        });
      } catch (serverError) {
          console.error("Error deleting student:", serverError);
          const permissionError = new FirestorePermissionError({
              path: docRef.path,
              operation: 'delete',
          });
          errorEmitter.emit('permission-error', permissionError);
          toast({
            variant: 'destructive',
            title: 'Deletion Failed',
            description: 'You do not have permission to delete student records.',
          });
      }
  };

  return (
    <div className="flex flex-col gap-6">
      <StudentControls 
        onAddStudent={() => handleOpenForm(null)} 
        students={students} 
        onOpenImport={() => setIsImportOpen(true)}
      />

      {/* Duplicate Students Warning Banner */}
      {duplicateClusters.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-900 dark:text-amber-200 shadow-sm animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="font-semibold text-sm">
                Duplicate Student Records Detected ({duplicateClusters.reduce((acc, c) => acc + c.students.length - 1, 0)} redundant copies)
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Found {duplicateClusters.length} student cluster(s) with matching admission numbers or names.
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="border-amber-300 dark:border-amber-700 bg-white dark:bg-amber-900/40 hover:bg-amber-100 text-amber-900 dark:text-amber-100 font-medium shrink-0" 
            onClick={() => setIsDedupeOpen(true)}
          >
            Review & Resolve Duplicates
          </Button>
        </div>
      )}

      <StudentTable 
        students={students} 
        onEditStudent={handleOpenForm} 
        onDeleteStudent={handleDeleteStudent} 
        loading={loading} 
      />

      <StudentForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSave={handleSaveStudent}
        student={selectedStudent}
        existingStudents={students}
      />

      <StudentImportDialog
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        existingStudents={students}
        onConfirmImport={handleBatchImport}
      />

      {/* Duplicate Resolution Dialog */}
      <Dialog open={isDedupeOpen} onOpenChange={setIsDedupeOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              Resolve Duplicate Student Records
            </DialogTitle>
            <DialogDescription>
              Review identified duplicate entries below. You can automatically delete redundant copies (keeping one verified record per student) or delete individual records.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2">
            {duplicateClusters.map((cluster, idx) => (
              <div key={cluster.key} className="rounded-lg border p-3 bg-muted/20 space-y-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs font-semibold text-foreground">
                    Cluster {idx + 1}: {cluster.reason}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {cluster.students.length} copies found
                  </Badge>
                </div>

                <div className="space-y-1.5">
                  {cluster.students.map((student, sIdx) => (
                    <div 
                      key={student.id} 
                      className="flex items-center justify-between p-2 rounded-md bg-background border text-xs gap-2"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Badge variant={sIdx === 0 ? "default" : "secondary"} className="text-[10px] shrink-0">
                          {sIdx === 0 ? "Primary (Keep)" : "Duplicate Copy"}
                        </Badge>
                        <span className="font-medium text-foreground truncate">
                          {student.firstName} {student.lastName}
                        </span>
                        <span className="text-muted-foreground font-mono">
                          Adm: {student.admissionNumber || 'N/A'}
                        </span>
                        <span className="text-muted-foreground">
                          {student.class} {student.stream ? `(${student.stream})` : ''} • {student.gender}
                        </span>
                      </div>

                      {sIdx > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete this duplicate copy"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0"
                          onClick={() => handleDeleteSingleDuplicate(student.id, `${student.firstName} ${student.lastName}`)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-between pt-2">
            <Button variant="outline" onClick={() => setIsDedupeOpen(false)}>
              Close
            </Button>
            <Button
              disabled={isCleaningDuplicates || duplicateClusters.length === 0}
              onClick={handleAutoCleanDuplicates}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
            >
              {isCleaningDuplicates ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cleaning Duplicates...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Auto-Remove Redundant Copies ({duplicateClusters.reduce((acc, c) => acc + c.students.length - 1, 0)})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
