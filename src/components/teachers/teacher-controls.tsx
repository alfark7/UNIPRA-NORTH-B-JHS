
'use client';

import React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, PlusCircle, Upload, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { subjects, type Teacher } from '@/lib/types';
import { exportTeachersToExcel } from '@/lib/excel';
import { useToast } from '@/hooks/use-toast';

const ranks = [
    'SUPT1', 'SENIOR SUPT.2', 'SENIOR SUPT.1', 'PRINCIPAL SUPT', 
    'ASSISTANT DIRECTOR 2', 'ASSISTANT DIRECTOR 1', 'DEPUTY DIRECTOR', 
    'DIRECTOR', 'DIRECTOR GENERAL'
];

interface TeacherControlsProps {
  onAddTeacher: () => void;
  teachers?: Teacher[];
  onOpenImport?: () => void;
}

export function TeacherControls({ onAddTeacher, teachers = [], onOpenImport }: TeacherControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const handleImport = () => {
    if (onOpenImport) {
      onOpenImport();
    }
  };

  const handleExport = () => {
    exportTeachersToExcel(teachers, 'teachers_directory');
    toast({
      title: 'Export Successful',
      description: `Exported ${teachers.length} teacher record(s) to Excel.`,
    });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const params = new URLSearchParams(searchParams);
    if (e.target.value) {
      params.set('search', e.target.value);
    } else {
      params.delete('search');
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value && value !== 'all') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div>
       <div className="flex items-center justify-between">
            <div>
                <h1 className="text-2xl font-headline font-semibold md:text-3xl">Teachers Directory</h1>
                <p className="text-muted-foreground">Search, filter, and manage teacher records.</p>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleImport}>
                    <Upload className="mr-2 h-4 w-4" /> Import
                </Button>
                <Button variant="outline" onClick={handleExport}>
                    <Download className="mr-2 h-4 w-4" /> Export
                </Button>
                <Button onClick={onAddTeacher}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Teacher
                </Button>
            </div>
        </div>
        <div className="mt-6 flex flex-col gap-4 md:flex-row">
            <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                type="search"
                placeholder="Search by name..."
                className="w-full pl-10"
                defaultValue={searchParams.get('search') || ''}
                onChange={handleSearchChange}
                />
            </div>
            <div className="w-full md:w-48">
                <Select 
                    value={searchParams.get('subject') || 'all'} 
                    onValueChange={(v) => handleFilterChange('subject', v)}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Subject" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Subjects</SelectItem>
                        {subjects.map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="w-full md:w-48">
                <Select 
                    value={searchParams.get('grade') || 'all'} 
                    onValueChange={(v) => handleFilterChange('grade', v)}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Grade" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Grades</SelectItem>
                        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(g => (
                            <SelectItem key={g} value={g}>Grade {g}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="w-full md:w-48">
                <Select 
                    value={searchParams.get('rank') || 'all'} 
                    onValueChange={(v) => handleFilterChange('rank', v)}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Rank" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Ranks</SelectItem>
                        {ranks.map(r => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    </div>
  );
}
