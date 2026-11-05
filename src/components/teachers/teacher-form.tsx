
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
import { Textarea } from '@/components/ui/textarea';
import type { Teacher } from '@/lib/types';
import { subjects } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { compressImageFile, compressBase64Image } from '@/lib/image-utils';
import { Loader2 } from 'lucide-react';

const ranks = ['SUPT1', 'SENIOR SUPT.2', 'SENIOR SUPT.1', 'PRINCIPAL SUPT', 'ASSISTANT DIRECTOR 2', 'ASSISTANT DIRECTOR 1', 'DEPUTY DIRECTOR', 'DIRECTOR', 'DIRECTOR GENERAL'] as const;
const grades = Array.from({ length: 9 }, (_, i) => String(1 + i)); // 1-9
const maritalStatuses = ['Single', 'Married', 'Divorced', 'Widowed'] as const;

const formSchema = z.object({
  firstName: z.string().min(2, 'First name is required.'),
  lastName: z.string().min(2, 'Last name is required.'),
  email: z.string().email('Invalid email address.'),
  phone: z.string().min(10, 'Phone number is required.'),
  subjects: z.string().min(2, 'At least one subject is required.'),
  
  // New fields
  staffId: z.string().min(1, 'Staff ID is required.'),
  socialSecurityNumber: z.string().min(1, 'SSN is required.'),
  dateOfBirth: z.string().min(1, 'Date of Birth is required.'),
  dateOf1stAppointment: z.string().min(1, 'Date of 1st appointment is required.'),
  datePostedToCurrentStation: z.string().min(1, 'Date posted to current station is required.'),
  lastDateOfPromotion: z.string().min(1, 'Last promotion date is required.'),
  
  grade: z.string().min(1, 'Grade is required.'),
  rank: z.enum(ranks),
  
  professionalQualification: z.string().min(1, 'Professional qualification is required.'),
  academicQualification: z.string().min(1, 'Academic qualification is required.'),
  
  nameOfBank: z.string().min(1, 'Name of bank is required.'),
  bankAccountNumber: z.string().min(1, 'Bank account number is required.'),
  bankBranch: z.string().min(1, 'Bank branch is required.'),
  ntcLicenseNumber: z.string().min(1, 'NTC License is required.'),
  
  residentialAddress: z.string().min(1, 'Residential address is required.'),
  homeTown: z.string().min(1, 'Home town is required.'),
  maritalStatus: z.enum(maritalStatuses),
  religion: z.string().min(1, 'Religion is required.'),
  role: z.string().min(1, "Role is required")
});


type TeacherFormValues = z.infer<typeof formSchema>;

interface TeacherFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Teacher, 'id' | 'subjects'> & { subjects: string[] }, id?: string) => void;
  teacher: Teacher | null;
}

export function TeacherForm({ isOpen, onClose, onSave, teacher }: TeacherFormProps) {
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const form = useForm<TeacherFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      subjects: '',
      staffId: '',
      socialSecurityNumber: '',
      dateOfBirth: '',
      dateOf1stAppointment: '',
      datePostedToCurrentStation: '',
      lastDateOfPromotion: '',
      grade: '1',
      rank: 'SUPT1',
      professionalQualification: '',
      academicQualification: '',
      nameOfBank: '',
      bankAccountNumber: '',
      bankBranch: '',
      ntcLicenseNumber: '',
      residentialAddress: '',
      homeTown: '',
      maritalStatus: 'Single',
      religion: '',
      role: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
        if (teacher) {
          form.reset({
              ...teacher,
              subjects: teacher.subjects.join(', '),
          });
          setAvatarPreview(teacher.avatar);
        } else {
          form.reset({
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            subjects: '',
            staffId: '',
            socialSecurityNumber: '',
            dateOfBirth: '',
            dateOf1stAppointment: '',
            datePostedToCurrentStation: '',
            lastDateOfPromotion: '',
            grade: '1',
            rank: 'SUPT1',
            professionalQualification: '',
            academicQualification: '',
            nameOfBank: '',
            bankAccountNumber: '',
            bankBranch: '',
            ntcLicenseNumber: '',
            residentialAddress: '',
            homeTown: '',
            maritalStatus: 'Single',
            religion: '',
            role: '',
          });
          setAvatarPreview(null);
        }
    }
  }, [teacher, form, isOpen]);

  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setIsCompressingPhoto(true);
        const compressed = await compressImageFile(file, {
          maxWidth: 300,
          maxHeight: 300,
          quality: 0.75,
          maxSizeBytes: 150 * 1024,
        });
        setAvatarPreview(compressed);
      } catch (err) {
        console.warn('Teacher photo compression fallback:', err);
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


  const onSubmit = async (values: TeacherFormValues) => {
    const subjectsArray = values.subjects.split(',').map(s => s.trim()).filter(Boolean);
    const dataToSave = {
      ...values,
      subjects: subjectsArray,
    };

    let finalAvatar = avatarPreview || `https://picsum.photos/seed/${values.email}/150/150`;
    if (finalAvatar.startsWith('data:image/') && finalAvatar.length > 80 * 1024) {
      try {
        finalAvatar = await compressBase64Image(finalAvatar, {
          maxWidth: 300,
          maxHeight: 300,
          quality: 0.75,
          maxSizeBytes: 150 * 1024,
        });
      } catch (e) {
        console.warn('Failed to compress teacher avatar before save:', e);
      }
    }

    onSave({ ...dataToSave, avatar: finalAvatar }, teacher?.id);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{teacher ? 'Edit Teacher' : 'Add New Teacher'}</DialogTitle>
          <DialogDescription>
            {teacher ? "Update the teacher's information below." : "Enter the details for the new teacher."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            <h3 className="text-lg font-medium text-primary">Personal Information</h3>
            <div className="flex items-center gap-4">
               <Avatar className="h-20 w-20">
                <AvatarImage src={avatarPreview || undefined} />
                <AvatarFallback className="text-2xl">
                    {form.getValues('firstName')?.[0] || ''}
                    {form.getValues('lastName')?.[0] || ''}
                </AvatarFallback>
              </Avatar>
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="picture">Teacher's Photo</Label>
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
              <FormField name="firstName" control={form.control} render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="John" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField name="lastName" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input placeholder="Doe" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField name="dateOfBirth" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Date of Birth</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField name="maritalStatus" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Marital Status</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl><SelectContent>{maritalStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField name="religion" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Religion</FormLabel><FormControl><Input placeholder="e.g. Christianity" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField name="homeTown" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Home Town</FormLabel><FormControl><Input placeholder="e.g. Accra" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>

             <Separator className="my-6" />
             <h3 className="text-lg font-medium text-primary">Contact & Address</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField name="email" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input placeholder="john.doe@example.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField name="phone" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="123-456-7890" {...field} /></FormControl><FormMessage /></FormItem>)} />
             </div>
              <FormField name="residentialAddress" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Residential Address</FormLabel><FormControl><Textarea placeholder="123 Main St, Anytown, USA" {...field} /></FormControl><FormMessage /></FormItem>)} />
            
            <Separator className="my-6" />
            <h3 className="text-lg font-medium text-primary">Professional Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <FormField name="staffId" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Staff ID</FormLabel><FormControl><Input placeholder="STF001" {...field} /></FormControl><FormMessage /></FormItem>)} />
               <FormField name="socialSecurityNumber" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Social Security Number</FormLabel><FormControl><Input placeholder="SSN123" {...field} /></FormControl><FormMessage /></FormItem>)} />
               <FormField name="ntcLicenseNumber" control={form.control} render={({ field }) => ( <FormItem><FormLabel>NTC License Number</FormLabel><FormControl><Input placeholder="NTC-12345" {...field} /></FormControl><FormMessage /></FormItem>)} />
               <FormField name="role" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Role / Position</FormLabel><FormControl><Input placeholder="e.g. Head of Science" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField name="dateOf1stAppointment" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Date of 1st Appointment</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField name="datePostedToCurrentStation" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Date Posted to Station</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField name="lastDateOfPromotion" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Last Promotion Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormField name="grade" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Grade</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger></FormControl><SelectContent>{grades.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                 <FormField name="rank" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Rank</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select rank" /></SelectTrigger></FormControl><SelectContent>{ranks.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
             </div>
             <FormField name="subjects" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Subjects Taught</FormLabel><FormControl><Textarea placeholder="e.g. Mathematics, Physics, Chemistry" {...field} /></FormControl><p className="text-xs text-muted-foreground">Enter subjects separated by a comma. Suggestions: {subjects.join(', ')}</p><FormMessage /></FormItem>)} />
            <FormField name="professionalQualification" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Professional Qualification</FormLabel><FormControl><Input placeholder="e.g. PGDE" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField name="academicQualification" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Academic Qualification</FormLabel><FormControl><Input placeholder="e.g. BSc. Computer Science" {...field} /></FormControl><FormMessage /></FormItem>)} />
            
             <Separator className="my-6" />
             <h3 className="text-lg font-medium text-primary">Financial Information</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormField name="nameOfBank" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Name of Bank</FormLabel><FormControl><Input placeholder="e.g. Equity Bank" {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField name="bankAccountNumber" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Bank Account Number</FormLabel><FormControl><Input placeholder="0123456789" {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField name="bankBranch" control={form.control} render={({ field }) => ( <FormItem><FormLabel>Bank Branch</FormLabel><FormControl><Input placeholder="Main Branch" {...field} /></FormControl><FormMessage /></FormItem>)} />
             </div>

            <DialogFooter className="pt-6">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
