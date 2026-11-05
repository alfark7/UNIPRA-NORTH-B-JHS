'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { DatePicker } from '@/components/ui/date-picker';
import { useToast } from '@/hooks/use-toast';
import { UserRole } from '@/firebase/auth/use-user';

// Firebase Database & Auth imports
import { useFirestore, useCollection } from '@/firebase';
import { useAuth } from '@/firebase/provider';
import { collection, doc, setDoc, getDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { compressImageFile, compressBase64Image } from '@/lib/image-utils';

// Shadcn primitives
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Icons
import {
  Plus,
  Edit2,
  Trash2,
  Shield,
  User,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
} from 'lucide-react';

// Helper function to convert hex to HSL string 'H S% L%'
const hexToHsl = (hex: string): string => {
    if (!hex.startsWith('#')) {
        return '';
    }
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
    }

    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    h = Math.round(h * 360);
    s = Math.round(s * 100);
    l = Math.round(l * 100);

    return `${h} ${s}% ${l}%`;
};

const defaultScoreSettings = {
  test1: 100,
  test2: 100,
  groupWork: 50,
  project: 50,
  classExercises: 20,
  homeWork: 20,
  exam: 100,
};

export default function SettingsPage() {
  const { toast } = useToast();

  // Firebase Database State & Auth Context
  const firestore = useFirestore();
  const authObj = useAuth();
  
  const usersQuery = useMemo(() => query(collection(firestore, 'users'), orderBy('createdAt', 'desc')), [firestore]);
  const { data: users, loading: usersLoading, error: usersError } = useCollection<any>(usersQuery);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  
  // Add User Dialog State
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('Teacher');
  const [newUserAssignedClasses, setNewUserAssignedClasses] = useState('JHS1A, JHS2B');
  const [newUserStudentId, setNewUserStudentId] = useState('');
  const [newUserStatus, setNewUserStatus] = useState<'Active' | 'Inactive'>('Active');
  
  // Edit User Dialog State
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingEmail, setEditingEmail] = useState('');
  const [editingRole, setEditingRole] = useState<UserRole>('Teacher');
  const [editingAssignedClasses, setEditingAssignedClasses] = useState('');
  const [editingStudentId, setEditingStudentId] = useState('');
  const [editingStatus, setEditingStatus] = useState<'Active' | 'Inactive'>('Active');
  
  // Delete User Confirmation State
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deletingUserName, setDeletingUserName] = useState('');

  // Filtering users
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    return users.filter((user: any) => {
      const matchesSearch = 
        (user.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (user.email?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (user.studentId?.toLowerCase() || '').includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'All' || user.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  // Firestore Permission & Operational Error conformant to database specifications
  const handleFirestoreError = (error: unknown, operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write', path: string | null) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: authObj?.currentUser?.uid || 'user-alfredarkorful',
        email: authObj?.currentUser?.email || 'alfredarkorful75@gmail.com',
        emailVerified: authObj?.currentUser?.emailVerified || true,
        isAnonymous: authObj?.currentUser?.isAnonymous || false,
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    const permissionError = new FirestorePermissionError({
      path: path || 'users',
      operation: operationType as any,
    });
    errorEmitter.emit('permission-error', permissionError);
    toast({
      variant: 'destructive',
      title: 'Action Failed',
      description: error instanceof Error ? error.message : 'Missing or insufficient permissions for this action.',
    });
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) {
      toast({
        title: 'Error',
        description: 'Please fill out all required fields.',
        variant: 'destructive',
      });
      return;
    }
    
    const docId = newUserEmail.toLowerCase().trim().replace(/[^a-zA-Z0-9]/g, '_');
    const userPayload: any = {
      id: docId,
      name: newUserName.trim(),
      email: newUserEmail.toLowerCase().trim(),
      role: newUserRole,
      status: newUserStatus,
      createdAt: new Date().toISOString(),
    };

    if (newUserRole === 'Teacher') {
      userPayload.assignedClassIds = newUserAssignedClasses.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (newUserRole === 'Student') {
      userPayload.studentId = newUserStudentId.trim();
    }
    
    try {
      await setDoc(doc(firestore, 'users', docId), userPayload);
      toast({
        title: 'User Added Successfully',
        description: `${userPayload.name} has been added as a system ${userPayload.role}.`,
      });
      
      // Reset forms
      setNewUserName('');
      setNewUserEmail('');
      setNewUserRole('Teacher');
      setNewUserAssignedClasses('JHS1A, JHS2B');
      setNewUserStudentId('');
      setNewUserStatus('Active');
      setIsAddUserOpen(false);
    } catch (err) {
      handleFirestoreError(err, 'write', `users/${docId}`);
    }
  };

  const openEditModal = (user: any) => {
    setEditingUserId(user.id);
    setEditingName(user.name || '');
    setEditingEmail(user.email || '');
    setEditingRole((user.role as UserRole) || 'Teacher');
    setEditingAssignedClasses(Array.isArray(user.assignedClassIds) ? user.assignedClassIds.join(', ') : '');
    setEditingStudentId(user.studentId || '');
    setEditingStatus(user.status || 'Active');
    setIsEditUserOpen(true);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserId) return;
    if (!editingName.trim()) {
      toast({
        title: 'Error',
        description: 'Name cannot be empty.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const updateData: any = {
        name: editingName.trim(),
        role: editingRole,
        status: editingStatus,
      };

      if (editingRole === 'Teacher') {
        updateData.assignedClassIds = editingAssignedClasses.split(',').map(s => s.trim()).filter(Boolean);
      } else {
        updateData.assignedClassIds = [];
      }

      if (editingRole === 'Student') {
        updateData.studentId = editingStudentId.trim();
      } else {
        updateData.studentId = '';
      }

      await updateDoc(doc(firestore, 'users', editingUserId), updateData);

      toast({
        title: 'User Updated',
        description: `${editingName}'s settings have been successfully updated.`,
      });
      setIsEditUserOpen(false);
      setEditingUserId(null);
    } catch (err) {
      handleFirestoreError(err, 'write', `users/${editingUserId}`);
    }
  };

  const openDeleteModal = (user: any) => {
    setDeletingUserId(user.id);
    setDeletingUserName(user.name || user.email);
    setIsDeleteConfirmOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!deletingUserId) return;
    try {
      await deleteDoc(doc(firestore, 'users', deletingUserId));
      toast({
        title: 'User Deleted',
        description: `Successfully removed ${deletingUserName} from the system.`,
      });
      setIsDeleteConfirmOpen(false);
      setDeletingUserId(null);
    } catch (err) {
      handleFirestoreError(err, 'write', `users/${deletingUserId}`);
    }
  };
  const [vacationDate, setVacationDate] = useState<Date | undefined>();
  const [reopeningDate, setReopeningDate] = useState<Date | undefined>();
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // School Info State
  const [schoolName, setSchoolName] = useState("University Practice Junior High School");
  const [schoolEmail, setSchoolEmail] = useState("contact@upnjhs.ac.pg");
  const [headTeacherName, setHeadTeacherName] = useState('');
  const [headTeacherSignaturePreview, setHeadTeacherSignaturePreview] = useState<string | null>(null);

  // Theme state
  const [primaryColor, setPrimaryColor] = useState('#3b82f6');
  const [accentColor, setAccentColor] = useState('#f4f4f5');
  const [backgroundColor, setBackgroundColor] = useState('#fcfcfd');

  // Score settings state
  const [scoreSettings, setScoreSettings] = useState(defaultScoreSettings);

  useEffect(() => {
    if (primaryColor) document.documentElement.style.setProperty('--primary', hexToHsl(primaryColor));
    if (accentColor) document.documentElement.style.setProperty('--accent', hexToHsl(accentColor));
    if (backgroundColor) document.documentElement.style.setProperty('--background', hexToHsl(backgroundColor));
  }, [primaryColor, accentColor, backgroundColor]);


  const syncSchoolInfoToFirestore = async (updates: Record<string, any>) => {
    if (!firestore) return;
    try {
      await setDoc(doc(firestore, 'schoolInfo', 'settings'), {
        id: 'settings',
        updatedAt: new Date().toISOString(),
        ...updates
      }, { merge: true });
    } catch (err) {
      console.warn('Could not sync schoolInfo to Firestore:', err);
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImageFile(file, {
          maxWidth: 360,
          maxHeight: 360,
          quality: 0.8,
          maxSizeBytes: 180 * 1024,
        });
        setLogoPreview(compressed);
        try {
          localStorage.setItem('school-logo', compressed);
          window.dispatchEvent(new Event('storage_change'));
        } catch (err) {
          console.warn('Could not save logo to localStorage:', err);
        }
        syncSchoolInfoToFirestore({ logoUrl: compressed });
      } catch (err) {
        console.warn('Image compression fallback:', err);
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          setLogoPreview(result);
          try {
            localStorage.setItem('school-logo', result);
            window.dispatchEvent(new Event('storage_change'));
          } catch (storageErr) {
            console.warn('Could not save logo to localStorage:', storageErr);
          }
          syncSchoolInfoToFirestore({ logoUrl: result });
        };
        reader.readAsDataURL(file);
      }
    }
  };
  
  const handleSignatureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImageFile(file, {
          maxWidth: 400,
          maxHeight: 200,
          quality: 0.8,
          maxSizeBytes: 100 * 1024,
        });
        setHeadTeacherSignaturePreview(compressed);
      } catch (err) {
        console.warn('Signature compression fallback:', err);
        const reader = new FileReader();
        reader.onloadend = () => {
          setHeadTeacherSignaturePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSaveSchoolInfo = async () => {
    localStorage.setItem('school-name', schoolName);
    localStorage.setItem('school-email', schoolEmail);
    localStorage.setItem('head-teacher-name', headTeacherName);

    let finalLogo = logoPreview;
    if (finalLogo && finalLogo.startsWith('data:image/') && finalLogo.length > 150 * 1024) {
      try {
        finalLogo = await compressBase64Image(finalLogo, {
          maxWidth: 360,
          maxHeight: 360,
          quality: 0.8,
          maxSizeBytes: 180 * 1024,
        });
        setLogoPreview(finalLogo);
      } catch (e) {
        console.warn('Logo compression error on save:', e);
      }
    }

    if (finalLogo) {
      try {
        localStorage.setItem('school-logo', finalLogo);
      } catch (err) {
        console.warn('LocalStorage logo set failed:', err);
      }
    }
    window.dispatchEvent(new Event('storage_change'));

    await syncSchoolInfoToFirestore({
      name: schoolName,
      email: schoolEmail,
      headTeacherName: headTeacherName,
      ...(finalLogo ? { logoUrl: finalLogo } : {}),
    });

    toast({
        title: 'Settings Saved',
        description: 'Your school settings and logo have been updated and are live on the login page.',
    });
  };

  const handleSaveTermDates = () => {
    if (vacationDate) localStorage.setItem('vacation-date', vacationDate.toISOString());
    if (reopeningDate) localStorage.setItem('reopening-date', reopeningDate.toISOString());
    window.dispatchEvent(new Event('storage_change'));
    toast({
        title: 'Term Dates Saved',
        description: 'Your term date settings have been updated.',
    });
  };

  const handleSaveAppearance = async () => {
    localStorage.setItem('theme-primary', primaryColor);
    localStorage.setItem('theme-accent', accentColor);
    localStorage.setItem('theme-background', backgroundColor);
    if (logoPreview) localStorage.setItem('school-logo', logoPreview);
    if (headTeacherSignaturePreview) localStorage.setItem('head-teacher-signature', headTeacherSignaturePreview);
    window.dispatchEvent(new Event('storage_change'));

    if (logoPreview) {
      await syncSchoolInfoToFirestore({ logoUrl: logoPreview });
    }

    toast({
        title: 'Appearance Settings Saved',
        description: 'Your appearance settings and school logo have been updated.',
    });
  };
  
  const handleSaveScoreSettings = () => {
    localStorage.setItem('score-settings', JSON.stringify(scoreSettings));
    window.dispatchEvent(new Event('storage_change'));
    toast({
      title: 'Score Settings Saved',
      description: 'Your academic score settings have been updated.',
    });
  };

  const handleScoreSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setScoreSettings(prev => ({...prev, [name]: parseInt(value) || 0 }));
  }

  useEffect(() => {
    // School Info
    const savedSchoolName = localStorage.getItem('school-name');
    if (savedSchoolName) setSchoolName(savedSchoolName);
    const savedSchoolEmail = localStorage.getItem('school-email');
    if (savedSchoolEmail) setSchoolEmail(savedSchoolEmail);
    const savedLogo = localStorage.getItem('school-logo');
    if (savedLogo) setLogoPreview(savedLogo);
    const savedHeadTeacherName = localStorage.getItem('head-teacher-name');
    if (savedHeadTeacherName) setHeadTeacherName(savedHeadTeacherName);
    const savedSignature = localStorage.getItem('head-teacher-signature');
    if (savedSignature) setHeadTeacherSignaturePreview(savedSignature);

    // Term Dates
    const savedVacationDate = localStorage.getItem('vacation-date');
    if (savedVacationDate) setVacationDate(new Date(savedVacationDate));
    const savedReopeningDate = localStorage.getItem('reopening-date');
    if (savedReopeningDate) setReopeningDate(new Date(savedReopeningDate));

    // Theme
    const savedPrimary = localStorage.getItem('theme-primary');
    if (savedPrimary) setPrimaryColor(savedPrimary);
    const savedAccent = localStorage.getItem('theme-accent');
    if (savedAccent) setAccentColor(savedAccent);
    const savedBackground = localStorage.getItem('theme-background');
    if (savedBackground) setBackgroundColor(savedBackground);
    
    // Score Settings
    const savedScoreSettings = localStorage.getItem('score-settings');
    if (savedScoreSettings) {
      try {
        setScoreSettings(JSON.parse(savedScoreSettings));
      } catch (error) {
        console.error("Failed to parse score settings from storage", error);
      }
    }

    // Sync from Firestore if available
    const fetchRemoteSchoolInfo = async () => {
      if (!firestore) return;
      try {
        const snap = await getDoc(doc(firestore, 'schoolInfo', 'settings'));
        if (snap.exists()) {
          const data = snap.data();
          if (data?.logoUrl && !localStorage.getItem('school-logo')) {
            setLogoPreview(data.logoUrl);
            localStorage.setItem('school-logo', data.logoUrl);
          }
          if (data?.name && !localStorage.getItem('school-name')) {
            setSchoolName(data.name);
            localStorage.setItem('school-name', data.name);
          }
          if (data?.email && !localStorage.getItem('school-email')) {
            setSchoolEmail(data.email);
            localStorage.setItem('school-email', data.email);
          }
          if (data?.headTeacherName && !localStorage.getItem('head-teacher-name')) {
            setHeadTeacherName(data.headTeacherName);
            localStorage.setItem('head-teacher-name', data.headTeacherName);
          }
        }
      } catch (err) {
        // Silently fallback to localStorage
      }
    };
    fetchRemoteSchoolInfo();
  }, [firestore]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-headline font-semibold md:text-3xl">Settings</h1>
        <p className="text-muted-foreground">Manage system settings and preferences.</p>
      </div>
      <Tabs defaultValue="school" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="school">School</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="term-dates">Term Dates</TabsTrigger>
          <TabsTrigger value="academic-scores">Academic Scores</TabsTrigger>
          <TabsTrigger value="theme">Appearance</TabsTrigger>
        </TabsList>
        <TabsContent value="school">
          <Card>
            <CardHeader>
              <CardTitle>School Information</CardTitle>
              <CardDescription>Update your school's institutional details and official crest.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="school-logo-file">School Logo (Crest / Emblem)</Label>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3.5 border rounded-lg bg-muted/20">
                  <div className="relative h-20 w-20 rounded-xl border border-dashed flex items-center justify-center bg-background overflow-hidden shadow-sm shrink-0">
                    {logoPreview ? (
                      <img src={logoPreview} alt="School Logo Preview" className="h-full w-full object-contain p-1" />
                    ) : (
                      <p className="text-xs text-muted-foreground text-center px-1 font-medium">No Logo</p>
                    )}
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <Input id="school-logo-file" type="file" accept="image/*" onChange={handleLogoChange} className="max-w-xs cursor-pointer text-xs" />
                    <p className="text-xs text-muted-foreground">
                      Upload school logo. This logo automatically appears on the <strong>Login Page</strong>, navigation sidebar, and printed academic reports.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="name">School Name</Label>
                <Input id="name" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email">Contact Email</Label>
                <Input id="email" value={schoolEmail} onChange={(e) => setSchoolEmail(e.target.value)} />
              </div>
               <div className="space-y-1">
                <Label htmlFor="head-teacher-name">Head Teacher's Name</Label>
                <Input id="head-teacher-name" value={headTeacherName} onChange={(e) => setHeadTeacherName(e.target.value)} />
              </div>
               <Button onClick={handleSaveSchoolInfo}>Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="users">
          <Card>
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle>User & Role Directory</CardTitle>
                <CardDescription>
                  Manage administrative access, system permissions, and roles for school administration, teachers, and staff members.
                </CardDescription>
              </div>
              
              <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                <DialogTrigger asChild>
                  <Button className="font-medium inline-flex items-center gap-2">
                    <Plus className="h-4 w-4" /> Add New User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New User</DialogTitle>
                    <DialogDescription>
                      Assign an administration role and check account status.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddUser} className="space-y-4 py-2">
                    <div className="space-y-1">
                      <Label htmlFor="new-name">Name</Label>
                      <Input
                        id="new-name"
                        placeholder="e.g. Richard Sarpong"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        required
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <Label htmlFor="new-email">Email Address</Label>
                      <Input
                        id="new-email"
                        type="email"
                        placeholder="e.g. rsarpong@upnjhs.ac.pg"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        required
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="new-role">System Role</Label>
                        <Select
                          value={newUserRole}
                          onValueChange={(val: any) => setNewUserRole(val)}
                        >
                          <SelectTrigger id="new-role">
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Administrator">Administrator</SelectItem>
                            <SelectItem value="Headmistress">Head Teacher</SelectItem>
                            <SelectItem value="Teacher">Teacher</SelectItem>
                            <SelectItem value="Examinations Officer">Examinations Officer</SelectItem>
                            <SelectItem value="Student">Student</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-1">
                        <Label htmlFor="new-status">Account Status</Label>
                        <Select
                          value={newUserStatus}
                          onValueChange={(val: any) => setNewUserStatus(val)}
                        >
                          <SelectTrigger id="new-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {newUserRole === 'Teacher' && (
                      <div className="space-y-1">
                        <Label htmlFor="new-assigned-classes">Assigned Class IDs (comma-separated)</Label>
                        <Input
                          id="new-assigned-classes"
                          placeholder="e.g. JHS1A, JHS2B"
                          value={newUserAssignedClasses}
                          onChange={(e) => setNewUserAssignedClasses(e.target.value)}
                        />
                        <p className="text-[10px] text-muted-foreground">Required for teacher document authorization in security rules.</p>
                      </div>
                    )}

                    {newUserRole === 'Student' && (
                      <div className="space-y-1">
                        <Label htmlFor="new-student-id">Student ID</Label>
                        <Input
                          id="new-student-id"
                          placeholder="e.g. UP-JHS-2024-001"
                          value={newUserStudentId}
                          onChange={(e) => setNewUserStudentId(e.target.value)}
                        />
                        <p className="text-[10px] text-muted-foreground">Used by security rules to restrict access to student's own records.</p>
                      </div>
                    )}
                    
                    <DialogFooter className="pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsAddUserOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">
                        Create User
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {/* Filters Toolbar */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between mb-6">
                <div className="relative w-full sm:max-w-md">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, or student ID..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue placeholder="Filter by Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Roles</SelectItem>
                      <SelectItem value="Administrator">Administrator</SelectItem>
                      <SelectItem value="Headmistress">Head Teacher</SelectItem>
                      <SelectItem value="Teacher">Teacher</SelectItem>
                      <SelectItem value="Examinations Officer">Examinations Officer</SelectItem>
                      <SelectItem value="Student">Student</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Users Table */}
              {usersLoading ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground space-y-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <p className="text-sm">Fetching and synchronizing permissions...</p>
                </div>
              ) : usersError ? (
                <div className="text-center py-10 bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
                  <p className="font-semibold">Failed to load system users</p>
                  <p className="text-sm mt-1">{usersError.message}</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-12 border border-dashed rounded-lg bg-muted/20">
                  <User className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-60" />
                  <p className="font-semibold text-lg">No system users found</p>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
                    {searchQuery || roleFilter !== 'All' 
                      ? 'No users match your filters. Try clearing your search fields.' 
                      : 'Get started by creating your first administrative user.'}
                  </p>
                  {!(searchQuery || roleFilter !== 'All') && (
                    <Button className="mt-4 inline-flex items-center gap-2" onClick={() => setIsAddUserOpen(true)}>
                      <Plus className="h-4 w-4" /> Add Initial User
                    </Button>
                  )}
                </div>
              ) : (
                <div className="border rounded-md overflow-hidden bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User Profile</TableHead>
                        <TableHead>System Email</TableHead>
                        <TableHead>Role & Attributes</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user: any) => {
                        const getRoleBadgeColor = (role: string) => {
                          switch(role) {
                            case 'Administrator': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
                            case 'Headmistress':
                            case 'Head Teacher': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
                            case 'Teacher': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
                            case 'Examinations Officer': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
                            case 'Student': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
                            default: return 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300';
                          }
                        };
                        
                        return (
                          <TableRow key={user.id} className="transition-all hover:bg-muted/30">
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold">
                                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                                </div>
                                <span className="font-headline font-semibold">{user.name || 'Anonymous User'}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{user.email}</TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <Badge className={`${getRoleBadgeColor(user.role)} border-none shadow-none w-fit`}>
                                  <Shield className="h-3 w-3 mr-1 inline" /> {user.role === 'Headmistress' ? 'Head Teacher' : (user.role || 'Teacher')}
                                </Badge>
                                {user.role === 'Teacher' && Array.isArray(user.assignedClassIds) && user.assignedClassIds.length > 0 && (
                                  <span className="text-[10px] text-muted-foreground font-mono">
                                    Classes: {user.assignedClassIds.join(', ')}
                                  </span>
                                )}
                                {user.role === 'Student' && user.studentId && (
                                  <span className="text-[10px] text-muted-foreground font-mono">
                                    ID: {user.studentId}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={user.status === 'Active' ? 'default' : 'secondary'} className="gap-1 rounded-sm">
                                {user.status === 'Active' ? (
                                  <>
                                    <CheckCircle2 className="h-3 w-3 inline" /> Active
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="h-3 w-3 inline" /> Inactive
                                  </>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                                  onClick={() => openEditModal(user)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                  <span className="sr-only">Edit role</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => openDeleteModal(user)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete user</span>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Edit User Dialog */}
          <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit User Settings & Role</DialogTitle>
                <DialogDescription>
                  Modify permissions or profile info. System email is locked.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleEditUser} className="space-y-4 py-2">
                <div className="space-y-1">
                  <Label htmlFor="edit-name">Name</Label>
                  <Input
                    id="edit-name"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-1">
                  <Label>Email Address (Immutable)</Label>
                  <Input
                    value={editingEmail}
                    disabled
                    className="bg-muted text-muted-foreground font-mono"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="edit-role">System Role</Label>
                    <Select
                      value={editingRole}
                      onValueChange={(val: any) => setEditingRole(val)}
                    >
                      <SelectTrigger id="edit-role">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Administrator">Administrator</SelectItem>
                        <SelectItem value="Headmistress">Head Teacher</SelectItem>
                        <SelectItem value="Teacher">Teacher</SelectItem>
                        <SelectItem value="Examinations Officer">Examinations Officer</SelectItem>
                        <SelectItem value="Student">Student</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-1">
                    <Label htmlFor="edit-status">Account Status</Label>
                    <Select
                      value={editingStatus}
                      onValueChange={(val: any) => setEditingStatus(val)}
                    >
                      <SelectTrigger id="edit-status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {editingRole === 'Teacher' && (
                  <div className="space-y-1">
                    <Label htmlFor="edit-assigned-classes">Assigned Class IDs (comma-separated)</Label>
                    <Input
                      id="edit-assigned-classes"
                      placeholder="e.g. JHS1A, JHS2B"
                      value={editingAssignedClasses}
                      onChange={(e) => setEditingAssignedClasses(e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground">Required for teacher document authorization in security rules.</p>
                  </div>
                )}

                {editingRole === 'Student' && (
                  <div className="space-y-1">
                    <Label htmlFor="edit-student-id">Student ID</Label>
                    <Input
                      id="edit-student-id"
                      placeholder="e.g. UP-JHS-2024-001"
                      value={editingStudentId}
                      onChange={(e) => setEditingStudentId(e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground">Links account to specific student documents.</p>
                  </div>
                )}
                
                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsEditUserOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    Save Changes
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Delete User Confirm Dialog */}
          <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-destructive font-semibold">Confirm Deletion</DialogTitle>
                <DialogDescription>
                  Are you absolutely sure you want to delete <strong>{deletingUserName}</strong>? This action is permanent and will instantly revoke all access settings.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="pt-4">
                <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDeleteUser}>
                  Yes, Remove User
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
        <TabsContent value="term-dates">
          <Card>
            <CardHeader>
              <CardTitle>Academic Term Dates</CardTitle>
              <CardDescription>Set the vacation and reopening dates for the academic term.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <Label>Vacation Date</Label>
                    <DatePicker date={vacationDate} setDate={setVacationDate} />
                </div>
                <div className="space-y-1">
                    <Label>Reopening Date</Label>
                    <DatePicker date={reopeningDate} setDate={setReopeningDate} />
                </div>
              </div>
               <Button onClick={handleSaveTermDates}>Save Dates</Button>
            </CardContent>
          </Card>
        </TabsContent>
         <TabsContent value="academic-scores">
            <Card>
                <CardHeader>
                    <CardTitle>Academic Score Settings</CardTitle>
                    <CardDescription>Define the maximum score for each assessment component.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="test1-score">Test 1 Max Score</Label>
                            <Input id="test1-score" name="test1" type="number" value={scoreSettings.test1} onChange={handleScoreSettingsChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="test2-score">Test 2 Max Score</Label>
                            <Input id="test2-score" name="test2" type="number" value={scoreSettings.test2} onChange={handleScoreSettingsChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="groupWork-score">Group Work Max Score</Label>
                            <Input id="groupWork-score" name="groupWork" type="number" value={scoreSettings.groupWork} onChange={handleScoreSettingsChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="project-score">Project Work Max Score</Label>
                            <Input id="project-score" name="project" type="number" value={scoreSettings.project} onChange={handleScoreSettingsChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="classExercises-score">Class Exercises Max Score</Label>
                            <Input id="classExercises-score" name="classExercises" type="number" value={scoreSettings.classExercises} onChange={handleScoreSettingsChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="homeWork-score">Home Work Max Score</Label>
                            <Input id="homeWork-score" name="homeWork" type="number" value={scoreSettings.homeWork} onChange={handleScoreSettingsChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="exam-score">Exam Max Score</Label>
                            <Input id="exam-score" name="exam" type="number" value={scoreSettings.exam} onChange={handleScoreSettingsChange} />
                        </div>
                    </div>
                    <Button onClick={handleSaveScoreSettings}>Save Score Settings</Button>
                </CardContent>
            </Card>
        </TabsContent>
         <TabsContent value="theme">
            <Card>
                <CardHeader>
                    <CardTitle>Appearance</CardTitle>
                    <CardDescription>Customize the look and feel of the application.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label>School Logo</Label>
                        <div className="flex items-center gap-4">
                            <div className="relative h-20 w-20 rounded-lg border border-dashed flex items-center justify-center bg-muted overflow-hidden">
                                {logoPreview ? (
                                    <img src={logoPreview} alt="Logo Preview" className="h-full w-full object-contain p-1 rounded-lg" />
                                ) : (
                                    <p className="text-xs text-muted-foreground font-medium">Preview</p>
                                )}
                            </div>
                            <Input id="logo-upload" type="file" accept="image/*" onChange={handleLogoChange} className="max-w-xs cursor-pointer text-xs" />
                        </div>
                        <p className="text-xs text-muted-foreground">Upload a new school logo. For best results, use a square image. Displays on the login page and across the portal.</p>
                    </div>
                    <div className="space-y-2">
                        <Label>Head Teacher's Signature</Label>
                        <div className="flex items-center gap-4">
                            <div className="relative h-20 w-40 rounded-lg border border-dashed flex items-center justify-center bg-muted overflow-hidden">
                                {headTeacherSignaturePreview ? (
                                    <img src={headTeacherSignaturePreview} alt="Signature Preview" className="h-full w-full object-contain p-1 rounded-lg" />
                                ) : (
                                    <p className="text-xs text-muted-foreground font-medium">Preview</p>
                                )}
                            </div>
                            <Input id="signature-upload" type="file" accept="image/*" onChange={handleSignatureChange} className="max-w-xs cursor-pointer text-xs" />
                        </div>
                        <p className="text-xs text-muted-foreground">Upload an image of the head teacher's signature.</p>
                    </div>
                     <div className="space-y-4">
                        <Label>Theme Customization</Label>
                        <p className="text-sm text-muted-foreground">
                           Change the color scheme of the application. Changes are applied in real-time and saved to your browser.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="primary-color">Primary Color</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        id="primary-color"
                                        type="color"
                                        value={primaryColor}
                                        onChange={(e) => setPrimaryColor(e.target.value)}
                                        className="h-10 w-12 cursor-pointer p-1"
                                    />
                                    <span className="font-mono text-sm">{primaryColor}</span>
                                </div>
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="accent-color">Accent Color</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        id="accent-color"
                                        type="color"
                                        value={accentColor}
                                        onChange={(e) => setAccentColor(e.target.value)}
                                        className="h-10 w-12 cursor-pointer p-1"
                                    />
                                    <span className="font-mono text-sm">{accentColor}</span>
                                </div>
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="background-color">Background Color</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        id="background-color"
                                        type="color"
                                        value={backgroundColor}
                                        onChange={(e) => setBackgroundColor(e.target.value)}
                                        className="h-10 w-12 cursor-pointer p-1"
                                    />
                                     <span className="font-mono text-sm">{backgroundColor}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <Button onClick={handleSaveAppearance}>Save Appearance</Button>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
