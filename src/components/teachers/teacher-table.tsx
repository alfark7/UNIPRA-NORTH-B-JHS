
'use client';

import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Edit, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { Teacher } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Skeleton } from '../ui/skeleton';

type SortField = keyof Teacher | '';
type SortDirection = 'asc' | 'desc';

interface TeacherTableProps {
  teachers: Teacher[];
  onEditTeacher: (teacher: Teacher) => void;
  onDeleteTeacher: (teacherId: string) => void;
  loading: boolean;
}

export function TeacherTable({ teachers, onEditTeacher, onDeleteTeacher, loading }: TeacherTableProps) {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const searchTerm = searchParams.get('search') || '';
  const subjectFilter = searchParams.get('subject') || '';
  const rankFilter = searchParams.get('rank') || '';
  const gradeFilter = searchParams.get('grade') || '';

  const [sortField, setSortField] = useState<SortField>('lastName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleDelete = (teacherId: string) => {
    onDeleteTeacher(teacherId);
  };

  const filteredAndSortedTeachers = useMemo(() => {
    if (!teachers) return [];
    const filtered = teachers
      .filter(teacher => {
        const matchesSearch = (
          teacher.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          teacher.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          teacher.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
          teacher.subjects.join(' ').toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        const matchesSubject = !subjectFilter || teacher.subjects.includes(subjectFilter);
        const matchesRank = !rankFilter || teacher.rank === rankFilter;
        const matchesGrade = !gradeFilter || teacher.grade === gradeFilter;
        
        return matchesSearch && matchesSubject && matchesRank && matchesGrade;
      });

    if (sortField) {
      return [...filtered].sort((a, b) => {
        const aValue = a[sortField as keyof Teacher];
        const bValue = b[sortField as keyof Teacher];
        
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        
        if (Array.isArray(aValue) && Array.isArray(bValue)) {
          const aStr = aValue.join(', ');
          const bStr = bValue.join(', ');
           return sortDirection === 'asc'
            ? aStr.localeCompare(bStr)
            : bStr.localeCompare(aStr);
        }

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }
        
        return 0;
      });
    }

    return filtered;
  }, [teachers, searchTerm, sortField, sortDirection]);

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
                    Teacher Name <SortIcon field="lastName" />
                  </div>
                </TableHead>
                <TableHead onClick={() => handleSort('staffId')} className="cursor-pointer hidden md:table-cell">
                   <div className="flex items-center">
                    Staff ID <SortIcon field="staffId" />
                  </div>
                </TableHead>
                <TableHead onClick={() => handleSort('rank')} className="cursor-pointer hidden lg:table-cell">
                   <div className="flex items-center">
                    Rank <SortIcon field="rank" />
                  </div>
                </TableHead>
                <TableHead className="hidden lg:table-cell">Subjects</TableHead>
                <TableHead onClick={() => handleSort('datePostedToCurrentStation')} className="cursor-pointer hidden lg:table-cell">
                   <div className="flex items-center">
                    Date Posted <SortIcon field="datePostedToCurrentStation" />
                  </div>
                </TableHead>
                <TableHead className="hidden md:table-cell">Contact</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                 Array.from({length: 3}).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                ))
              ) : filteredAndSortedTeachers.length > 0 ? (
                filteredAndSortedTeachers.map((teacher: Teacher) => (
                <TableRow key={teacher.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={teacher.avatar} alt={teacher.firstName} />
                        <AvatarFallback>
                          {teacher.firstName[0]}
                          {teacher.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="font-medium">{teacher.lastName}, {teacher.firstName}</div>
                    </div>
                  </TableCell>
                   <TableCell className="hidden md:table-cell text-muted-foreground">{teacher.staffId}</TableCell>
                   <TableCell className="hidden lg:table-cell text-muted-foreground">{teacher.rank}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {teacher.subjects.map(subject => (
                          <Badge key={subject} variant="secondary">{subject}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{format(new Date(teacher.datePostedToCurrentStation), 'MMMM d, yyyy')}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    <div>{teacher.email}</div>
                    <div className="text-xs">{teacher.phone}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-1">
                        <Button variant="ghost" size="icon" title="Edit Teacher" onClick={() => onEditTeacher(teacher)}>
                            <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Delete Teacher" className="text-destructive hover:text-destructive" onClick={() => handleDelete(teacher.id)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
                <TableRow>
                  <TableCell colSpan={7} className="p-6 text-center text-muted-foreground">
                    No teachers found matching your criteria.
                  </TableCell>
                </TableRow>
            )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
      