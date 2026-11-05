'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldAlert, LogIn, Sparkles, ShieldCheck, User, Key, ArrowRight, BookOpen, GraduationCap, Award, FileCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useToast } from '@/hooks/use-toast';
import { UserRole } from '@/firebase/auth/use-user';

export default function LoginPage() {
  const { user, profile, loading, error, loginWithGoogle, loginWithEmail, registerWithEmail, setError } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const defaultSchoolLogo = PlaceHolderImages.find(img => img.id === 'school_logo');
  const [schoolLogoUrl, setSchoolLogoUrl] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string>('University Practice Junior High School');

  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Form State - Login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Form State - Register
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('Teacher');
  const [regAssignedClasses, setRegAssignedClasses] = useState('JHS1A, JHS2B');
  const [regStudentId, setRegStudentId] = useState('UP-JHS-2024-001');

  // If already authenticated and has profile, redirect to dashboard
  useEffect(() => {
    if (!loading && user) {
      if (profile && profile.status === 'Inactive') {
        toast({
          title: 'Account Inactive',
          description: 'Your account has been marked as Inactive. Please contact the administrator.',
          variant: 'destructive',
        });
        return;
      }
      router.push('/dashboard');
    }
  }, [user, profile, loading, router, toast]);

  // Synchronize School Logo and School Information uploaded in Portal Settings
  useEffect(() => {
    const updateSchoolBrand = () => {
      try {
        const savedLogo = localStorage.getItem('school-logo');
        if (savedLogo) {
          setSchoolLogoUrl(savedLogo);
        } else if (defaultSchoolLogo?.imageUrl) {
          setSchoolLogoUrl(defaultSchoolLogo.imageUrl);
        }

        const savedName = localStorage.getItem('school-name');
        if (savedName) {
          setSchoolName(savedName);
        }
      } catch (err) {
        console.warn('Error reading school branding:', err);
      }
    };

    updateSchoolBrand();
    window.addEventListener('storage_change', updateSchoolBrand);
    window.addEventListener('storage', updateSchoolBrand);

    // Also attempt fetching from Firestore public schoolInfo/settings document
    const fetchRemoteBrand = async () => {
      if (!firestore) return;
      try {
        const snap = await getDoc(doc(firestore, 'schoolInfo', 'settings'));
        if (snap.exists()) {
          const data = snap.data();
          if (data?.logoUrl) {
            setSchoolLogoUrl(data.logoUrl);
            try { localStorage.setItem('school-logo', data.logoUrl); } catch {}
          }
          if (data?.name) {
            setSchoolName(data.name);
            try { localStorage.setItem('school-name', data.name); } catch {}
          }
        }
      } catch (err) {
        // Silently fallback to localStorage or defaults
      }
    };
    fetchRemoteBrand();

    return () => {
      window.removeEventListener('storage_change', updateSchoolBrand);
      window.removeEventListener('storage', updateSchoolBrand);
    };
  }, [firestore, defaultSchoolLogo]);

  const handleGoogleLogin = async () => {
    setIsSigningIn(true);
    try {
      await loginWithGoogle();
      toast({
        title: 'Authentication Successful',
        description: 'Synchronizing permissions...',
      });
    } catch (err: any) {
      toast({
        title: 'Authentication Failed',
        description: err.message || 'Could not verify credentials with Google.',
        variant: 'destructive',
      });
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast({
        title: 'Missing Details',
        description: 'Please type both your registered email and passcode.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSigningIn(true);
    try {
      if (loginWithEmail) {
        await loginWithEmail(email.toLowerCase().trim(), password);
        toast({
          title: 'Sign In Successful',
          description: 'Synchronizing school credentials...',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Login Failed',
        description: err.message || 'Invalid credentials.',
        variant: 'destructive',
      });
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword.trim()) {
      toast({
        title: 'Incomplete Registration',
        description: 'All field credentials are required to enroll in the system.',
        variant: 'destructive',
      });
      return;
    }

    setIsSigningIn(true);
    try {
      if (registerWithEmail) {
        const assignedClasses = regRole === 'Teacher' 
          ? regAssignedClasses.split(',').map(s => s.trim()).filter(Boolean)
          : undefined;
        const studentId = regRole === 'Student' ? regStudentId.trim() : undefined;

        await registerWithEmail(
          regEmail.toLowerCase().trim(),
          regPassword,
          regName.trim(),
          regRole,
          assignedClasses,
          studentId
        );
        toast({
          title: 'Account Registered',
          description: 'Your profile has been created successfully.',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Registration Failed',
        description: err.message || 'Failed to complete registration.',
        variant: 'destructive',
      });
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleQuickDemoIn = async (demoRole: UserRole) => {
    setIsSigningIn(true);
    
    let demoEmail = '';
    const demoPass = 'upjhs1234';
    let demoName = '';
    let assignedClasses: string[] | undefined = undefined;
    let studentId: string | undefined = undefined;
    
    switch (demoRole) {
      case 'Administrator':
        demoEmail = 'admin@upnjhs.ac.pg';
        demoName = 'Principal Richard Sarpong';
        break;
      case 'Headmistress':
        demoEmail = 'headmistress@upnjhs.ac.pg';
        demoName = 'Mrs. Elizabeth Daniels (Head Teacher)';
        break;
      case 'Teacher':
        demoEmail = 'teacher@upnjhs.ac.pg';
        demoName = 'Madam Joyce Appiah (Form Teacher)';
        assignedClasses = ['JHS1A', 'JHS2A', 'JHS3A'];
        break;
      case 'Examinations Officer':
        demoEmail = 'exams@upnjhs.ac.pg';
        demoName = 'Mr. Isaac Kofi (Exams Officer)';
        break;
      case 'Student':
        demoEmail = 'student@upnjhs.ac.pg';
        demoName = 'Kwame Mensah (Student)';
        studentId = 'UP-JHS-2024-001';
        break;
    }

    setEmail(demoEmail);
    setPassword(demoPass);

    try {
      if (loginWithEmail) {
        await loginWithEmail(demoEmail, demoPass, demoName, demoRole, assignedClasses, studentId);
        toast({
          title: 'Demo Session Initialized',
          description: `Successfully signed in as standard school ${demoRole}.`,
        });
      }
    } catch (err: any) {
      toast({
        title: 'Demo Access Blocked',
        description: err.message || 'Failed to configure dummy demo session.',
        variant: 'destructive',
      });
    } finally {
      setIsSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4 animate-duration-1000"></div>
        <p className="text-sm font-mono text-xs text-muted-foreground uppercase tracking-widest">Verifying Portal Access</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-1/4 left-1/4 w-[40rem] h-[40rem] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[40rem] h-[40rem] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-xl z-10"
      >
        <Card className="border shadow-xl bg-background/95 backdrop-blur-md overflow-hidden">
          <CardHeader className="text-center pt-8 pb-3">
            <div className="mx-auto mb-3 flex items-center justify-center">
              {schoolLogoUrl ? (
                <div className="relative h-20 w-20 sm:h-24 sm:w-24 rounded-2xl bg-white dark:bg-slate-900 border border-border/80 shadow-md p-2 flex items-center justify-center overflow-hidden transition-all duration-200 hover:scale-105">
                  <img
                    src={schoolLogoUrl}
                    alt={schoolName || 'School Logo'}
                    className="h-full w-full object-contain rounded-xl"
                    onError={() => {
                      setSchoolLogoUrl(null);
                    }}
                  />
                </div>
              ) : (
                <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                  <GraduationCap className="h-7 w-7" />
                </div>
              )}
            </div>
            <CardTitle className="text-2xl font-headline font-semibold tracking-tight text-foreground" id="page-title">
              {schoolName ? `${schoolName} Academic Hub` : 'UP JHS Academic Hub'}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
              {schoolName ? `${schoolName} Academic Management Portal` : 'University Practice Junior High School Academic Management Portal'}
            </CardDescription>
          </CardHeader>

          <CardContent className="px-6 py-4 space-y-5">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive flex gap-2"
                id="login-error-alert"
              >
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {!isRegisterMode ? (
              <>
                <Tabs defaultValue="sso" className="w-full" onValueChange={() => { if (setError) setError(null); }}>
                  <TabsList className="grid w-full grid-cols-2 h-11 mb-4 bg-muted/65 p-1 rounded-lg">
                    <TabsTrigger value="sso" className="font-medium text-xs py-2 rounded-md">
                      <GraduationCap className="h-4 w-4 mr-1.5" /> Single Sign-On
                    </TabsTrigger>
                    <TabsTrigger value="credentials" className="font-medium text-xs py-2 rounded-md">
                      <Key className="h-4 w-4 mr-1.5" /> Portal Credentials
                    </TabsTrigger>
                  </TabsList>

                  {/* Google OAuth Tab */}
                  <TabsContent value="sso" className="space-y-4 focus-visible:outline-none focus-visible:ring-0">
                    <p className="text-xs text-center text-muted-foreground leading-relaxed px-2">
                      Official school accounts can sign in directly using Google Workspace credentials to synchronize their personal teacher or administrator directories.
                    </p>

                    <Button
                      id="google-signin-btn"
                      onClick={handleGoogleLogin}
                      disabled={isSigningIn}
                      className="w-full h-11 relative flex items-center justify-center gap-3 font-medium transition-all shadow-sm hover:scale-[1.01] duration-150"
                    >
                      {isSigningIn ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                      ) : (
                        <>
                          <svg className="h-4 w-4 mr-1 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                            <path
                              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                              fill="#4285F4"
                            />
                            <path
                              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                              fill="#34A853"
                            />
                            <path
                              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                              fill="#FBBC05"
                            />
                            <path
                              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                              fill="#EA4335"
                            />
                          </svg>
                          <span>Sign In with Google Workspace</span>
                        </>
                      )}
                    </Button>
                  </TabsContent>

                  {/* Email & Password Creds Tab */}
                  <TabsContent value="credentials" className="focus-visible:outline-none focus-visible:ring-0">
                    <form onSubmit={handleEmailLogin} className="space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground">Portal Registered Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="e.g. rsarpong@upnjhs.ac.pg"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={isSigningIn}
                          className="h-10 text-sm focus-visible:ring-1"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="passcode" className="text-xs font-semibold text-muted-foreground">Security Passcode</Label>
                        </div>
                        <Input
                          id="passcode"
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          disabled={isSigningIn}
                          className="h-10 text-sm focus-visible:ring-1"
                          required
                        />
                      </div>

                      <Button
                        type="submit"
                        disabled={isSigningIn}
                        className="w-full h-10 mt-2 font-medium flex items-center justify-center gap-2 shadow-sm"
                        id="portal-signin-btn"
                      >
                        {isSigningIn ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                        ) : (
                          <>
                            <LogIn className="h-4 w-4" /> Sign In to Portal
                          </>
                        )}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-muted" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-wider text-muted-foreground bg-background px-3 max-w-fit mx-auto">
                    Sandbox Review Environment
                  </div>
                </div>

                {/* Professional Quick Access Roles Panel */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/80 bg-muted/30 px-3 py-1.5 rounded-md border w-fit">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    <span>Quick-Access Portal Personnels (Preconfigured)</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      id="demo-admin-btn"
                      onClick={() => handleQuickDemoIn('Administrator')}
                      disabled={isSigningIn}
                      className="h-auto py-2 px-2.5 flex flex-col items-start gap-0.5 text-left bg-gradient-to-br from-background to-blue-50/10 hover:to-blue-50/20 dark:hover:to-blue-950/20 hover:border-blue-200/50 hover:bg-muted/40 group transition-all"
                    >
                      <div className="flex items-center gap-1.5 w-full">
                        <ShieldCheck className="h-3.5 w-3.5 text-blue-500 fill-blue-500/10 shrink-0" />
                        <span className="font-semibold text-xs tracking-tight text-foreground truncate select-none">Administrator</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      </div>
                      <span className="text-[10px] text-muted-foreground select-none truncate">admin@upnjhs.ac.pg</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      id="demo-headmistress-btn"
                      onClick={() => handleQuickDemoIn('Headmistress')}
                      disabled={isSigningIn}
                      className="h-auto py-2 px-2.5 flex flex-col items-start gap-0.5 text-left bg-gradient-to-br from-background to-amber-50/10 hover:to-amber-50/20 dark:hover:to-amber-950/20 hover:border-amber-200/50 hover:bg-muted/40 group transition-all"
                    >
                      <div className="flex items-center gap-1.5 w-full">
                        <Award className="h-3.5 w-3.5 text-amber-500 fill-amber-500/10 shrink-0" />
                        <span className="font-semibold text-xs tracking-tight text-foreground truncate select-none">Head Teacher</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      </div>
                      <span className="text-[10px] text-muted-foreground select-none truncate">headmistress@upnjhs.ac.pg</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      id="demo-teacher-btn"
                      onClick={() => handleQuickDemoIn('Teacher')}
                      disabled={isSigningIn}
                      className="h-auto py-2 px-2.5 flex flex-col items-start gap-0.5 text-left bg-gradient-to-br from-background to-purple-50/10 hover:to-purple-50/20 dark:hover:to-purple-950/20 hover:border-purple-200/50 hover:bg-muted/40 group transition-all"
                    >
                      <div className="flex items-center gap-1.5 w-full">
                        <BookOpen className="h-3.5 w-3.5 text-purple-500 fill-purple-500/10 shrink-0" />
                        <span className="font-semibold text-xs tracking-tight text-foreground truncate select-none">Teacher</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      </div>
                      <span className="text-[10px] text-muted-foreground select-none truncate">teacher@upnjhs.ac.pg</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      id="demo-exams-btn"
                      onClick={() => handleQuickDemoIn('Examinations Officer')}
                      disabled={isSigningIn}
                      className="h-auto py-2 px-2.5 flex flex-col items-start gap-0.5 text-left bg-gradient-to-br from-background to-emerald-50/10 hover:to-emerald-50/20 dark:hover:to-emerald-950/20 hover:border-emerald-200/50 hover:bg-muted/40 group transition-all"
                    >
                      <div className="flex items-center gap-1.5 w-full">
                        <FileCheck className="h-3.5 w-3.5 text-emerald-500 fill-emerald-500/10 shrink-0" />
                        <span className="font-semibold text-xs tracking-tight text-foreground truncate select-none">Exams Officer</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      </div>
                      <span className="text-[10px] text-muted-foreground select-none truncate">exams@upnjhs.ac.pg</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      id="demo-student-btn"
                      onClick={() => handleQuickDemoIn('Student')}
                      disabled={isSigningIn}
                      className="h-auto py-2 px-2.5 flex flex-col items-start gap-0.5 text-left bg-gradient-to-br from-background to-indigo-50/10 hover:to-indigo-50/20 dark:hover:to-indigo-950/20 hover:border-indigo-200/50 hover:bg-muted/40 group transition-all col-span-2"
                    >
                      <div className="flex items-center gap-1.5 w-full">
                        <GraduationCap className="h-3.5 w-3.5 text-indigo-500 fill-indigo-500/10 shrink-0" />
                        <span className="font-semibold text-xs tracking-tight text-foreground truncate select-none">Student Portal (Kwame Mensah)</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      </div>
                      <span className="text-[10px] text-muted-foreground select-none truncate">student@upnjhs.ac.pg • ID: UP-JHS-2024-001</span>
                    </Button>
                  </div>
                </div>

                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => { setIsRegisterMode(true); if (setError) setError(null); }}
                    className="text-xs text-primary font-semibold hover:underline"
                    id="toggle-register-btn"
                  >
                    Register new staff or student account
                  </button>
                </div>
              </>
            ) : (
              /* Portal User Registration Form */
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Portal Enrollment</h3>
                  <p className="text-xs text-muted-foreground">Register your profile with the appropriate system role.</p>
                </div>

                <form onSubmit={handleEmailRegister} className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="regName" className="text-xs font-semibold text-muted-foreground">Full Name</Label>
                    <Input
                      id="regName"
                      placeholder="e.g. Richard Sarpong"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      disabled={isSigningIn}
                      className="h-10 text-sm focus-visible:ring-1"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="regEmail" className="text-xs font-semibold text-muted-foreground">Email Address</Label>
                    <Input
                      id="regEmail"
                      type="email"
                      placeholder="e.g. user@upnjhs.ac.pg"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      disabled={isSigningIn}
                      className="h-10 text-sm focus-visible:ring-1"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1 col-span-2 sm:col-span-1">
                      <Label htmlFor="regRole" className="text-xs font-semibold text-muted-foreground">System Role</Label>
                      <Select
                        value={regRole}
                        onValueChange={(val: any) => setRegRole(val)}
                        disabled={isSigningIn}
                      >
                        <SelectTrigger className="h-10 mt-1" id="reg-role-select">
                          <SelectValue placeholder="Select Designation" />
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

                    <div className="space-y-1 col-span-2 sm:col-span-1">
                      <Label htmlFor="regPass" className="text-xs font-semibold text-muted-foreground">Secure Passcode</Label>
                      <Input
                        id="regPass"
                        type="password"
                        placeholder="Min 6 chars"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        disabled={isSigningIn}
                        className="h-10 text-sm mt-1 focus-visible:ring-1"
                        required
                        minLength={6}
                      />
                    </div>
                  </div>

                  {regRole === 'Teacher' && (
                    <div className="space-y-1">
                      <Label htmlFor="regAssignedClasses" className="text-xs font-semibold text-muted-foreground">Assigned Class IDs (comma-separated)</Label>
                      <Input
                        id="regAssignedClasses"
                        placeholder="e.g. JHS1A, JHS2B"
                        value={regAssignedClasses}
                        onChange={(e) => setRegAssignedClasses(e.target.value)}
                        disabled={isSigningIn}
                        className="h-10 text-sm focus-visible:ring-1"
                      />
                      <p className="text-[10px] text-muted-foreground">Determines class-level access permissions under security rules.</p>
                    </div>
                  )}

                  {regRole === 'Student' && (
                    <div className="space-y-1">
                      <Label htmlFor="regStudentId" className="text-xs font-semibold text-muted-foreground">Student ID</Label>
                      <Input
                        id="regStudentId"
                        placeholder="e.g. UP-JHS-2024-001"
                        value={regStudentId}
                        onChange={(e) => setRegStudentId(e.target.value)}
                        disabled={isSigningIn}
                        className="h-10 text-sm focus-visible:ring-1"
                      />
                      <p className="text-[10px] text-muted-foreground">Links student account to personal records and reports.</p>
                    </div>
                  )}

                  <div className="flex gap-4 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setIsRegisterMode(false); if (setError) setError(null); }}
                      disabled={isSigningIn}
                      className="flex-1"
                      id="register-back-btn"
                    >
                      Back to Login
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSigningIn}
                      className="flex-1 font-medium shadow-sm"
                      id="register-submit-btn"
                    >
                      {isSigningIn ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                      ) : (
                        "Complete Enrollment"
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col items-center gap-2 pb-8 text-[10px] text-muted-foreground/60">
            <p>© {new Date().getFullYear()} University Practice JHS Academic Hub</p>
            <p>Protected by Enterprise-grade Zero-Trust Firestore Security</p>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
