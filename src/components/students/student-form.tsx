
'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Student } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Label } from '../ui/label';

const formSchema = z.object({
  firstName: z.string().min(2, 'First name is required.'),
  lastName: z.string().min(2, 'Last name is required.'),
  email: z.string().email('Invalid email address.'),
  admissionNumber: z.string().min(1, 'Admission number is required.'),
  class: z.string().min(1, 'Class is required.'),
  stream: z.string().nullable(),
  section: z.enum(['RED', 'YELLOW', 'BLUE', 'GREEN']),
  gender: z.enum(['Male', 'Female']),
  guardianName: z.string().min(2, 'Guardian name is required.'),
  guardianPhone: z.string().min(10, 'Guardian phone is required.'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
});

type StudentFormValues = z.infer<typeof formSchema>;

interface StudentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Student, 'id'>, id?: string) => void;
  student: Student | null;
  existingStudents?: Student[];
}

const classLevels = ['JHS1', 'JHS2', 'JHS3'];
const streams = ['A', 'B', 'C', 'D'];
const sections = ['RED', 'YELLOW', 'BLUE', 'GREEN'] as const;

import { compressImageFile, compressBase64Image } from '@/lib/image-utils';
import { Loader2 } from 'lucide-react';

export function StudentForm({ isOpen, onClose, onSave, student, existingStudents = [] }: StudentFormProps) {
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      admissionNumber: '',
      class: 'JHS1',
      stream: 'A',
      section: 'RED',
      gender: 'Male',
      guardianName: '',
      guardianPhone: '',
      dateOfBirth: ''
    },
  });

  useEffect(() => {
    if (isOpen) {
        if (student) {
          form.reset({
              ...student,
              stream: student.stream || null,
          });
          setAvatarPreview(student.avatar);
        } else {
          form.reset({
              firstName: '',
              lastName: '',
              email: '',
              admissionNumber: '',
              class: 'JHS1',
              stream: 'A',
              section: 'RED',
              gender: 'Male',
              guardianName: '',
              guardianPhone: '',
              dateOfBirth: '',
          });
          setAvatarPreview(null);
        }
    }
  }, [student, form, isOpen]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setIsCompressingPhoto(true);
        // Automatically compress and resize to max 300x300, JPEG 0.75 (~20-40KB)
        // Keeps student document safely under Firestore 1MB limit.
        const compressed = await compressImageFile(file, {
          maxWidth: 300,
          maxHeight: 300,
          quality: 0.75,
          maxSizeBytes: 150 * 1024,
        });
        setAvatarPreview(compressed);
      } catch (err) {
        console.warn('Image compression fallback:', err);
        const reader = new FileReader();
        reader.onloadend = () => {
          setAvatarPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } finally {
        setIsCompressingPhoto(false);
      }
    }
  };


  const onSubmit = async (values: StudentFormValues) => {
    // 1. Strict duplicate check on Admission Number
    const trimmedAdm = values.admissionNumber.trim().toLowerCase();
    const duplicateAdm = existingStudents.find(
      s => s.admissionNumber?.trim().toLowerCase() === trimmedAdm && (!student || s.id !== student.id)
    );
    if (duplicateAdm) {
      form.setError('admissionNumber', {
        type: 'manual',
        message: `Admission number "${values.admissionNumber}" is already assigned to ${duplicateAdm.firstName} ${duplicateAdm.lastName} (${duplicateAdm.class}${duplicateAdm.stream ? ` ${duplicateAdm.stream}` : ''}).`,
      });
      return;
    }

    // 2. Strict duplicate check on Full Name & Class
    const duplicateName = existingStudents.find(
      s => s.firstName?.trim().toLowerCase() === values.firstName.trim().toLowerCase() &&
           s.lastName?.trim().toLowerCase() === values.lastName.trim().toLowerCase() &&
           s.class?.trim().toLowerCase() === values.class.trim().toLowerCase() &&
           (!student || s.id !== student.id)
    );
    if (duplicateName) {
      form.setError('firstName', {
        type: 'manual',
        message: `A student named ${values.firstName} ${values.lastName} is already enrolled in ${values.class} (Admission: ${duplicateName.admissionNumber}).`,
      });
      return;
    }

     const streamVal = values.stream === 'none' ? null : values.stream;
     const dataToSave = {
      ...values,
      stream: streamVal,
      classId: streamVal ? `${values.class}${streamVal}` : values.class,
    };
    
    let finalAvatar = avatarPreview || `https://picsum.photos/seed/${values.admissionNumber}/150/150`;
    // If the student already has an uncompressed large base64 avatar, compress it before saving
    if (finalAvatar.startsWith('data:image/') && finalAvatar.length > 80 * 1024) {
      try {
        finalAvatar = await compressBase64Image(finalAvatar, {
          maxWidth: 300,
          maxHeight: 300,
          quality: 0.75,
          maxSizeBytes: 150 * 1024,
        });
      } catch (e) {
        console.warn('Failed to compress avatar before save:', e);
      }
    }

    onSave({ ...dataToSave, avatar: finalAvatar }, student?.id);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{student ? 'Edit Student' : 'Add New Student'}</DialogTitle>
          <DialogDescription>
            {student ? "Update the student's information below." : "Enter the details for the new student."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div className="flex items-center gap-4">
               <Avatar className="h-20 w-20">
                <AvatarImage src={avatarPreview || undefined} />
                <AvatarFallback className="text-2xl">
                    {form.getValues('firstName')?.[0] || ''}
                    {form.getValues('lastName')?.[0] || ''}
                </AvatarFallback>
              </Avatar>
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="picture">Student Photo</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    id="picture" 
                    type="file" 
                    accept="image/*" 
                    disabled={isCompressingPhoto}
                    onChange={handleAvatarChange} 
                  />
                  {isCompressingPhoto && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isCompressingPhoto ? 'Optimizing photo for Firestore...' : 'Photos are automatically compressed to ensure fast loading.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
             <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="john.doe@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="admissionNumber"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Admission Number</FormLabel>
                    <FormControl>
                        <Input placeholder="UPNG001" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                 <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
               <FormField
                control={form.control}
                name="class"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Class</FormLabel>
                     <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a class" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {classLevels.map(level => (
                            <SelectItem key={level} value={level}>{level}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
              <FormField
                control={form.control}
                name="stream"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Stream</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || 'none'}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select stream" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="none">N/A</SelectItem>
                            {streams.map(rank => (
                                <SelectItem key={rank} value={rank}>{rank}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="section"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Section</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select section" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sections.map(section => (
                          <SelectItem key={section} value={section}>{section}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                      <FormItem>
                      <FormLabel>Gender</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                          <SelectTrigger>
                              <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                              <SelectItem value="Male">Male</SelectItem>
                              <SelectItem value="Female">Female</SelectItem>
                          </SelectContent>
                      </Select>
                      <FormMessage />
                      </FormItem>
                  )}
              />
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="guardianName"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Guardian Name</FormLabel>
                        <FormControl>
                            <Input placeholder="Jane Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="guardianPhone"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Guardian Phone</FormLabel>
                        <FormControl>
                            <Input placeholder="123-456-7890" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
             </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isCompressingPhoto}>
                {isCompressingPhoto ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Optimizing...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
