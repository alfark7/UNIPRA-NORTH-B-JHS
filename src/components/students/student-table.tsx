
'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, FileText, Edit, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { Student } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { useSearchParams } from 'next/navigation';
import { Skeleton } from '../ui/skeleton';


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
import { Loader2 } from 'lucide-react';

type SortField = keyof Student | '';
type SortDirection = 'asc' | 'desc';

interface StudentTableProps {
  students: Student[];
  onEditStudent: (student: Student) => void;
  onDeleteStudent: (studentId: string) => Promise<void> | void;
  loading: boolean;
}

export function StudentTable({ students, onEditStudent, onDeleteStudent, loading }: StudentTableProps) {
  const searchParams = useSearchParams();
  
  const searchTerm = searchParams.get('search') || '';
  const filterClass = searchParams.get('class') || '';
  const filterStream = searchParams.get('stream') || '';

  const [sortField, setSortField] = useState<SortField>('lastName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Student deletion confirmation state
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const openDeleteDialog = (student: Student) => {
    setStudentToDelete(student);
  };

  const handleConfirmDelete = async () => {
    if (!studentToDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteStudent(studentToDelete.id);
      setStudentToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredAndSortedStudents = useMemo(() => {
    if(!students) return [];
    const filtered = students
      .filter(student =>
        (student.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
         student.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
         student.admissionNumber.toLowerCase().includes(searchTerm.toLowerCase())) &&
        (!filterClass || filterClass === 'all' || student.class === filterClass) &&
        (!filterStream || filterStream === 'all' || student.stream === filterStream)
      );

    if (sortField) {
      return [...filtered].sort((a, b) => {
        const aValue = a[sortField as keyof Student] as string | number | null;
        const bValue = b[sortField as keyof Student] as string | number | null;

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }
        
        if (typeof aValue === 'number' && typeof bValue === 'number') {
            return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }

        return 0;
      });
    }

    return filtered;
  }, [students, searchTerm, filterClass, filterStream, sortField, sortDirection]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />;
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead onClick={() => handleSort('lastName')} className="cursor-pointer">
                  <div className="flex items-center">
                    Student Name <SortIcon field="lastName" />
                  </div>
                </TableHead>
                <TableHead onClick={() => handleSort('admissionNumber')} className="cursor-pointer hidden md:table-cell">
                   <div className="flex items-center">
                    Admission # <SortIcon field="admissionNumber" />
                  </div>
                </TableHead>
                <TableHead onClick={() => handleSort('class')} className="cursor-pointer hidden md:table-cell">
                  <div className="flex items-center">
                    Class <SortIcon field="class" />
                  </div>
                </TableHead>
                 <TableHead onClick={() => handleSort('stream')} className="cursor-pointer hidden lg:table-cell">
                  <div className="flex items-center">
                    Stream <SortIcon field="stream" />
                  </div>
                </TableHead>
                 <TableHead onClick={() => handleSort('section')} className="cursor-pointer hidden lg:table-cell">
                  <div className="flex items-center">
                    Section <SortIcon field="section" />
                  </div>
                </TableHead>
                <TableHead onClick={() => handleSort('gender')} className="cursor-pointer hidden lg:table-cell">
                   <div className="flex items-center">
                    Gender <SortIcon field="gender" />
                  </div>
                </TableHead>
                <TableHead className="hidden lg:table-cell">Guardian</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({length: 5}).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell colSpan={8}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                ))
              ) : filteredAndSortedStudents.length > 0 ? (
                filteredAndSortedStudents.map((student: Student) => (
                <TableRow key={student.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={student.avatar} alt={student.firstName} />
                        <AvatarFallback>
                          {student.firstName[0]}
                          {student.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="font-medium">{student.lastName}, {student.firstName}</div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{student.admissionNumber}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="outline">{student.class}</Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                      {student.stream ? (
                        <Badge variant="secondary">{student.stream}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                  <TableCell className="hidden lg:table-cell">
                      <Badge variant="outline" style={{
                        // @ts-ignore
                        '--badge-color': `var(--color-${student.section.toLowerCase()})`
                      }} 
                      className="border-[var(--badge-color)] text-[var(--badge-color)]">
                        {student.section}
                      </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{student.gender}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {student.guardianName}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-1">
                        <Button asChild variant="ghost" size="icon" title="View Details">
                            <Link href={`/students/${student.id}`}>
                                <FileText className="h-4 w-4" />
                            </Link>
                        </Button>
                        <Button variant="ghost" size="icon" title="Edit Student" onClick={() => onEditStudent(student)}>
                            <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          title="Delete Student" 
                          className="text-destructive hover:text-destructive hover:bg-destructive/10" 
                          onClick={() => openDeleteDialog(student)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
                <TableRow>
                  <TableCell colSpan={8} className="p-6 text-center text-muted-foreground">
                    No students found matching your criteria.
                  </TableCell>
                </TableRow>
            )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Confirmation Dialog for Student Deletion */}
      <AlertDialog 
        open={!!studentToDelete} 
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setStudentToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Student Record
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2 text-sm text-foreground/80">
                <p>
                  Are you sure you want to permanently delete this student record?
                </p>
                {studentToDelete && (
                  <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Student Name:</span>
                      <span className="font-semibold text-foreground">{studentToDelete.firstName} {studentToDelete.lastName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Admission No:</span>
                      <span className="font-mono font-medium text-foreground">{studentToDelete.admissionNumber || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Class & Stream:</span>
                      <span className="font-medium text-foreground">{studentToDelete.class} {studentToDelete.stream ? `(${studentToDelete.stream})` : ''}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Section:</span>
                      <span className="font-medium text-foreground">{studentToDelete.section}</span>
                    </div>
                  </div>
                )}
                <p className="text-xs text-destructive/90 font-medium">
                  This operation cannot be undone. All personal details for this student will be removed from the directory.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete Student
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
