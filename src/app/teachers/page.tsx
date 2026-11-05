
'use client';

import { useMemo, useState } from 'react';
import { doc, setDoc, addDoc, collection, deleteDoc, writeBatch } from 'firebase/firestore';
import { useFirestore, useCollection } from '@/firebase';
import { TeacherControls } from '@/components/teachers/teacher-controls';
import { TeacherTable } from '@/components/teachers/teacher-table';
import { TeacherForm } from '@/components/teachers/teacher-form';
import { TeacherImportDialog } from '@/components/teachers/teacher-import-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { Teacher } from '@/lib/types';
import type { ParsedTeacherRow } from '@/lib/excel';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { compressBase64Image } from '@/lib/image-utils';


export default function TeachersPage() {
  const firestore = useFirestore();
  const teachersQuery = useMemo(() => collection(firestore, 'teachers'), [firestore]);
  const { data: teachers, loading } = useCollection<Teacher>(teachersQuery);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [teacherToDelete, setTeacherToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  const handleOpenForm = (teacher: Teacher | null) => {
    setSelectedTeacher(teacher);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedTeacher(null);
  };

  const handleBatchImport = async (parsedList: ParsedTeacherRow[]) => {
    if (!parsedList || parsedList.length === 0) return;

    // Build lookup maps for fast matching against existing teachers in state
    const existingByStaffId = new Map<string, string>();
    const existingByEmail = new Map<string, string>();
    const existingById = new Set<string>();

    teachers.forEach((t) => {
      if (t.id) existingById.add(t.id);
      if (t.staffId) {
        existingByStaffId.set(t.staffId.trim().toLowerCase(), t.id);
      }
      if (t.email) {
        existingByEmail.set(t.email.trim().toLowerCase(), t.id);
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
          const staffKey = item.staffId?.trim().toLowerCase();
          const emailKey = item.email?.trim().toLowerCase();

          if (!targetDocId && staffKey && existingByStaffId.has(staffKey)) {
            targetDocId = existingByStaffId.get(staffKey);
          } else if (!targetDocId && emailKey && existingByEmail.has(emailKey)) {
            targetDocId = existingByEmail.get(emailKey);
          }

          const teacherData = {
            firstName: item.firstName,
            lastName: item.lastName,
            email: item.email,
            phone: item.phone || '0244000000',
            role: item.role || 'Teacher',
            subjects: item.subjects || ['Mathematics'],
            avatar: item.avatar || `https://picsum.photos/seed/${encodeURIComponent(item.staffId || Math.random().toString())}/150/150`,
            staffId: item.staffId,
            socialSecurityNumber: item.socialSecurityNumber || 'C000000000000',
            dateOfBirth: item.dateOfBirth || '1990-01-01',
            dateOf1stAppointment: item.dateOf1stAppointment || '2016-09-01',
            datePostedToCurrentStation: item.datePostedToCurrentStation || '2020-01-15',
            lastDateOfPromotion: item.lastDateOfPromotion || '2022-09-01',
            grade: item.grade || '1',
            rank: item.rank || 'SUPT1',
            professionalQualification: item.professionalQualification || 'Diploma in Basic Education',
            academicQualification: item.academicQualification || 'B.Ed Basic Education',
            nameOfBank: item.nameOfBank || 'GCB Bank',
            bankAccountNumber: item.bankAccountNumber || '1000000000000',
            bankBranch: item.bankBranch || 'Main Branch',
            ntcLicenseNumber: item.ntcLicenseNumber || 'PT/2020/00000',
            residentialAddress: item.residentialAddress || 'School Quarters, Accra',
            maritalStatus: item.maritalStatus || 'Single',
            religion: item.religion || 'Christianity',
            homeTown: item.homeTown || 'Accra',
          };

          if (targetDocId && (existingById.has(targetDocId) || (staffKey && existingByStaffId.has(staffKey)) || (emailKey && existingByEmail.has(emailKey)))) {
            const docRef = doc(firestore, 'teachers', targetDocId);
            batch.set(docRef, teacherData, { merge: true });
            updatedCount++;
          } else {
            const newDocRef = doc(collection(firestore, 'teachers'));
            batch.set(newDocRef, teacherData);
            addedCount++;
          }
        }

        await batch.commit();
      }

      toast({
        title: 'Import Completed',
        description: `Successfully processed ${parsedList.length} teacher records (${addedCount} added, ${updatedCount} updated).`,
      });
    } catch (serverError: any) {
      console.error('Error importing teachers batch:', serverError);
      const permissionError = new FirestorePermissionError({
        path: 'teachers',
        operation: 'create',
      });
      errorEmitter.emit('permission-error', permissionError);
      toast({
        variant: 'destructive',
        title: 'Batch Import Failed',
        description: serverError?.message || 'Could not import teachers to Firestore.',
      });
      throw serverError;
    }
  };

  const handleSaveTeacher = async (teacherData: Omit<Teacher, 'id' | 'subjects'> & { subjects: string[] }, id?: string) => {
    let dataToSave = { ...teacherData };
    if (dataToSave.avatar && dataToSave.avatar.startsWith('data:image/') && dataToSave.avatar.length > 80 * 1024) {
      try {
        dataToSave.avatar = await compressBase64Image(dataToSave.avatar, {
          maxWidth: 300,
          maxHeight: 300,
          quality: 0.75,
          maxSizeBytes: 150 * 1024,
        });
      } catch (err) {
        console.warn('Teacher avatar compression error before save:', err);
      }
    }

    if (id) {
      // Update existing teacher
      const docRef = doc(firestore, 'teachers', id);
      try {
        await setDoc(docRef, dataToSave, { merge: true });
        toast({
          title: 'Teacher Updated',
          description: `${dataToSave.firstName} ${dataToSave.lastName}'s information has been updated.`,
        });
      } catch (serverError: any) {
        console.error("Error updating teacher:", serverError);
        const errMsg = String(serverError?.message || serverError || '');
        const isSizeError = errMsg.includes('exceeds the maximum allowed size') || 
                            errMsg.includes('maximum allowed size') || 
                            serverError?.code === 'resource-exhausted';

        if (isSizeError) {
          toast({
            variant: 'destructive',
            title: 'Image / Data Exceeds Limit',
            description: 'The teacher photo or data is too large for Firestore (max 1MB). It has been compressed, please try saving again.',
          });
        } else {
          const permissionError = new FirestorePermissionError({
              path: docRef.path,
              operation: 'update',
              requestResourceData: dataToSave,
          });
          errorEmitter.emit('permission-error', permissionError);
          toast({
            variant: 'destructive',
            title: 'Update Failed',
            description: errMsg.includes('Missing or insufficient permissions')
              ? 'You do not have permission to update teacher records.'
              : errMsg || 'Could not update teacher record.',
          });
        }
      }
    } else {
      // Add new teacher
      const collectionRef = collection(firestore, 'teachers');
      try {
        await addDoc(collectionRef, dataToSave);
        toast({
          title: 'Teacher Added',
          description: `${dataToSave.firstName} ${dataToSave.lastName} has been added.`,
        });
      } catch (serverError: any) {
        console.error("Error adding teacher:", serverError);
        const errMsg = String(serverError?.message || serverError || '');
        const isSizeError = errMsg.includes('exceeds the maximum allowed size') || 
                            errMsg.includes('maximum allowed size') || 
                            serverError?.code === 'resource-exhausted';

        if (isSizeError) {
          toast({
            variant: 'destructive',
            title: 'Image / Data Exceeds Limit',
            description: 'The teacher photo or data is too large for Firestore (max 1MB). Please select a smaller photo.',
          });
        } else {
          const permissionError = new FirestorePermissionError({
              path: collectionRef.path,
              operation: 'create',
              requestResourceData: dataToSave,
          });
          errorEmitter.emit('permission-error', permissionError);
          toast({
            variant: 'destructive',
            title: 'Addition Failed',
            description: errMsg.includes('Missing or insufficient permissions')
              ? 'You do not have permission to add teacher records.'
              : errMsg || 'Could not add teacher record.',
          });
        }
      }
    }
    handleCloseForm();
  };
  
    const handleDeleteTeacher = (teacherId: string) => {
      setTeacherToDelete(teacherId);
      setIsDeleteDialogOpen(true);
    }

    const confirmDeleteTeacher = async () => {
      if (!teacherToDelete) return;
      
      const docRef = doc(firestore, 'teachers', teacherToDelete);
      try {
        await deleteDoc(docRef);
        toast({
            title: 'Teacher Deleted',
            description: 'The teacher record has been deleted.',
        });
      } catch (serverError) {
          console.error("Error deleting teacher:", serverError);
          const permissionError = new FirestorePermissionError({
              path: docRef.path,
              operation: 'delete',
          });
          errorEmitter.emit('permission-error', permissionError);
          toast({
            variant: 'destructive',
            title: 'Deletion Failed',
            description: 'You do not have permission to delete teacher records.',
          });
      }
      setIsDeleteDialogOpen(false);
      setTeacherToDelete(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <TeacherControls 
        onAddTeacher={() => handleOpenForm(null)} 
        teachers={teachers}
        onOpenImport={() => setIsImportOpen(true)}
      />
      <TeacherTable teachers={teachers} onEditTeacher={handleOpenForm} onDeleteTeacher={handleDeleteTeacher} loading={loading} />
      <TeacherForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSave={handleSaveTeacher}
        teacher={selectedTeacher}
      />
      <TeacherImportDialog
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        existingTeachers={teachers}
        onConfirmImport={handleBatchImport}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the teacher's
              record from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTeacherToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTeacher} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
