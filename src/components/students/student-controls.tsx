
'use client';

import React, { useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, Filter, PlusCircle, Upload, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { exportToExcel } from '@/lib/excel';
import type { Student } from '@/lib/types';

interface StudentControlsProps {
  onAddStudent: () => void;
  students: Student[];
  onOpenImport?: () => void;
}

export function StudentControls({ onAddStudent, students, onOpenImport }: StudentControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const params = new URLSearchParams(searchParams);
    if (e.target.value) {
      params.set('search', e.target.value);
    } else {
      params.delete('search');
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleFilterChange = (key: 'class' | 'stream', value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value && value !== 'all') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  const classLevels = React.useMemo(() => Array.from(new Set(students.map(s => s.class))), [students]);
  const streams = React.useMemo(() => Array.from(new Set(students.map(s => s.stream).filter(Boolean))) as string[], [students]);

  const handleImport = () => {
    if (onOpenImport) {
      onOpenImport();
    }
  };

  const handleExport = () => {
    exportToExcel(students, 'student_data');
    toast({ title: 'Export Successful', description: 'Student data has been exported to Excel.' });
  };

  return (
    <div>
       <div className="flex items-center justify-between">
            <div>
                <h1 className="text-2xl font-headline font-semibold md:text-3xl">Students Directory</h1>
                <p className="text-muted-foreground">Search, filter, and manage student records.</p>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleImport}>
                    <Upload className="mr-2 h-4 w-4" /> Import
                </Button>
                 <Button variant="outline" onClick={handleExport}>
                    <Download className="mr-2 h-4 w-4" /> Export
                </Button>
                <Button onClick={onAddStudent}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Student
                </Button>
            </div>
        </div>
        <div className="mt-6 flex flex-col gap-4 md:flex-row">
            <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                type="search"
                placeholder="Search by name or admission no..."
                className="w-full pl-10"
                defaultValue={searchParams.get('search') || ''}
                onChange={handleSearchChange}
                />
            </div>
            <div className="grid grid-cols-2 gap-4 md:w-auto md:grid-cols-2">
                 <Select onValueChange={(value) => handleFilterChange('class', value)} defaultValue={searchParams.get('class') || 'all'}>
                    <SelectTrigger className="w-full">
                        <div className="flex items-center gap-2">
                         <Filter className="h-4 w-4 text-muted-foreground" />
                         <span>Filter by class</span>
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Classes</SelectItem>
                        {classLevels.map(level => (
                            <SelectItem key={level} value={level}>{level}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                 <Select onValueChange={(value) => handleFilterChange('stream', value)} defaultValue={searchParams.get('stream') || 'all'}>
                    <SelectTrigger className="w-full">
                        <div className="flex items-center gap-2">
                         <Filter className="h-4 w-4 text-muted-foreground" />
                          <span>Filter by Stream</span>
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Streams</SelectItem>
                        {streams.map(rank => (
                            <SelectItem key={rank} value={rank}>{rank}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    </div>
  );
}
