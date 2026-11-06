
'use client';

import { useState, useEffect } from 'react';
import { useAuth, useFirestore } from '../provider';
import { 
  User, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously
} from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

export type UserRole = 'Administrator' | 'Headmistress' | 'Teacher' | 'Examinations Officer' | 'Student';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'Active' | 'Inactive';
  assignedClassIds?: string[];
  studentId?: string;
  createdAt: string;
}

export function useUser() {
  const auth = useAuth();
  const firestore = useFirestore();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;

    // Check if there is already a simulated session in storage
    const checkSimulatedSession = (): { user: any; profile: AppUser } | null => {
      if (typeof window !== 'undefined') {
        try {
          const saved = sessionStorage.getItem('upjhs_simulated_session') || localStorage.getItem('upjhs_simulated_session');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.user && parsed.profile) {
              return parsed;
            }
          }
        } catch (e) {
          console.warn("Failed to parse stored simulated session:", e);
        }
      }
      return null;
    };

    const initialSimulated = checkSimulatedSession();
    if (initialSimulated) {
      setUser(initialSimulated.user);
      setProfile(initialSimulated.profile);
      setLoading(false);
    }

    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        
        try {
          // 1. Try to read the profile of user by UID
          const userDocRef = doc(firestore, 'users', firebaseUser.uid);
          let userSnap: any = null;
          try {
            userSnap = await getDoc(userDocRef);
          } catch (readErr: any) {
            console.warn("Could not read profile by UID from Firestore:", readErr?.message || readErr);
          }

          if (userSnap && userSnap.exists()) {
            const existingProfile = userSnap.data() as AppUser;
            const emailLower = (firebaseUser.email || '').toLowerCase().trim();
            if (
              (emailLower === 'alfredarkorful75@gmail.com' ||
                emailLower === 'alfark7777@gmail.com' ||
                emailLower === 'admin@upnjhs.ac.pg') &&
              existingProfile.role !== 'Administrator'
            ) {
              existingProfile.role = 'Administrator';
              setDoc(userDocRef, { role: 'Administrator' }, { merge: true }).catch(console.error);
            }
            setProfile(existingProfile);
          } else {
            // 2. Profile does not exist by UID. Check if email-placeholder profile exists.
            let emailData: any = null;
            const userEmail = (firebaseUser.email || '').toLowerCase().trim();
            if (userEmail) {
              try {
                const emailId = userEmail.replace(/[^a-zA-Z0-9]/g, '_');
                const emailDocRef = doc(firestore, 'users', emailId);
                const emailSnap = await getDoc(emailDocRef);
                if (emailSnap.exists()) {
                  emailData = emailSnap.data();
                  deleteDoc(emailDocRef).catch(console.warn);
                }
              } catch (placeholderErr: any) {
                console.warn("Could not check email-placeholder profile:", placeholderErr?.message || placeholderErr);
              }
            }

            // 3. Fallback/Bootstrap Profile for Authenticated User
            let defaultRole: UserRole = emailData?.role || 'Teacher';
            let defaultName = emailData?.name || firebaseUser.displayName || 'Staff Member';
            let assignedClassIds: string[] | undefined = emailData?.assignedClassIds;
            let studentId: string | undefined = emailData?.studentId;

            if (
              userEmail === 'alfredarkorful75@gmail.com' ||
              userEmail === 'alfark7777@gmail.com' ||
              userEmail === 'admin@upnjhs.ac.pg'
            ) {
              defaultRole = 'Administrator';
              defaultName = firebaseUser.displayName || 'Alfred Arkorful (Administrator)';
            } else if (userEmail === 'headmistress@upnjhs.ac.pg' || userEmail === 'headteacher@upnjhs.ac.pg') {
              defaultRole = 'Headmistress';
              defaultName = firebaseUser.displayName || 'Mrs. Elizabeth Daniels (Head Teacher)';
            } else if (userEmail === 'teacher@upnjhs.ac.pg') {
              defaultRole = 'Teacher';
              defaultName = firebaseUser.displayName || 'Madam Joyce Appiah (Form Teacher)';
              assignedClassIds = assignedClassIds || ['JHS1A', 'JHS2A', 'JHS3A'];
            } else if (userEmail === 'exams@upnjhs.ac.pg') {
              defaultRole = 'Examinations Officer';
              defaultName = firebaseUser.displayName || 'Mr. Isaac Kofi (Exams Officer)';
            } else if (userEmail === 'student@upnjhs.ac.pg') {
              defaultRole = 'Student';
              defaultName = firebaseUser.displayName || 'Kwame Mensah (Student)';
              studentId = studentId || 'UP-JHS-2024-001';
            }

            const newProfile: AppUser = {
              id: firebaseUser.uid,
              name: defaultName,
              email: firebaseUser.email || '',
              role: defaultRole,
              status: emailData?.status || 'Active',
              assignedClassIds: assignedClassIds,
              studentId: studentId,
              createdAt: emailData?.createdAt || new Date().toISOString(),
            };

            try {
              await setDoc(userDocRef, newProfile, { merge: true });
            } catch (writeErr: any) {
              console.warn("Could not persist user profile to Firestore, setting local state:", writeErr?.message || writeErr);
            }
            setProfile(newProfile);
          }
        } catch (err: any) {
          console.warn("Handled profile sync issue:", err?.message || err);
          const emailLower = (firebaseUser.email || '').toLowerCase().trim();
          const isAdminUser = emailLower === 'alfredarkorful75@gmail.com' || emailLower === 'alfark7777@gmail.com' || emailLower === 'admin@upnjhs.ac.pg';
          setProfile({
            id: firebaseUser.uid,
            name: firebaseUser.displayName || (isAdminUser ? 'Alfred Arkorful (Administrator)' : 'School Staff'),
            email: firebaseUser.email || '',
            role: isAdminUser ? 'Administrator' : 'Teacher',
            status: 'Active',
            createdAt: new Date().toISOString(),
          });
        } finally {
          setLoading(false);
        }
      } else {
        // If Firebase User is null, check if we have a simulated session active
        const savedSimulated = checkSimulatedSession();
        if (savedSimulated) {
          setUser(savedSimulated.user);
          setProfile(savedSimulated.profile);
          setLoading(false);
        } else {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    });

    const handleSessionChange = () => {
      const session = checkSimulatedSession();
      if (session) {
        setUser(session.user);
        setProfile(session.profile);
        setLoading(false);
      } else if (!auth.currentUser) {
        setUser(null);
        setProfile(null);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('auth_session_changed', handleSessionChange);
    }

    return () => {
      unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('auth_session_changed', handleSessionChange);
      }
    };
  }, [auth, firestore]);

  const loginWithGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account',
      });
      const result = await signInWithPopup(auth, provider);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('upjhs_simulated_session');
        localStorage.removeItem('upjhs_simulated_session');
        window.dispatchEvent(new Event('auth_session_changed'));
      }
      return result.user;
    } catch (err: any) {
      console.warn("Google Sign-In handled:", err?.code || err?.message || err);
      let userMsg = err.message || 'Google Sign-In failed.';
      if (err.code === 'auth/network-request-failed' || err.code === 'auth/unauthorized-domain') {
        userMsg = "Google Sign-In is not enabled or this domain is not authorized in Firebase project 'unipranorthdbs2'. Please add this app's domain under Firebase Console > Authentication > Settings > Authorized Domains, or enable Google under Sign-in method. You can also explore using Quick-Access below.";
      } else if (err.code === 'auth/operation-not-allowed') {
        userMsg = "Google Sign-In provider is disabled in Firebase Console for 'unipranorthdbs2'. Please enable 'Google' under Authentication > Sign-in method, or explore using Quick-Access below.";
      } else if (err.code === 'auth/popup-closed-by-user') {
        userMsg = "Sign-in popup was closed before completing verification.";
      }
      setError(userMsg);
      setLoading(false);
      throw new Error(userMsg);
    }
  };

  const loginWithEmail = async (
    email: string, 
    password: string, 
    displayName?: string, 
    assignedRole?: UserRole,
    assignedClassIds?: string[],
    studentId?: string
  ) => {
    setError(null);
    setLoading(true);
    const cleanEmail = email.toLowerCase().trim();
    const isDemo = cleanEmail.endsWith('@upnjhs.ac.pg');

    const activateSimulatedSession = (
      roleToAssign?: UserRole, 
      nameToAssign?: string,
      classesToAssign?: string[],
      studentIdToAssign?: string
    ) => {
      let role: UserRole = roleToAssign || assignedRole || 'Teacher';
      let name = nameToAssign || displayName || 'Staff Member';
      let studentIdentifier = studentIdToAssign || studentId;
      let classIds = classesToAssign || assignedClassIds;

      if (cleanEmail === 'admin@upnjhs.ac.pg' || cleanEmail.includes('admin')) {
        role = 'Administrator';
        name = nameToAssign || displayName || 'Principal Richard Sarpong';
      } else if (cleanEmail === 'headmistress@upnjhs.ac.pg' || cleanEmail === 'headteacher@upnjhs.ac.pg' || cleanEmail.includes('head')) {
        role = 'Headmistress';
        name = nameToAssign || displayName || 'Mrs. Elizabeth Daniels (Head Teacher)';
      } else if (cleanEmail === 'teacher@upnjhs.ac.pg' || cleanEmail.includes('teacher')) {
        role = 'Teacher';
        name = nameToAssign || displayName || 'Madam Joyce Appiah (Form Teacher)';
        classIds = classIds || ['JHS1A', 'JHS2A', 'JHS3A'];
      } else if (cleanEmail === 'exams@upnjhs.ac.pg' || cleanEmail.includes('exam')) {
        role = 'Examinations Officer';
        name = nameToAssign || displayName || 'Mr. Isaac Kofi (Exams Officer)';
      } else if (cleanEmail === 'student@upnjhs.ac.pg' || cleanEmail.includes('student')) {
        role = 'Student';
        name = nameToAssign || displayName || 'Kwame Mensah (Student)';
        studentIdentifier = studentIdentifier || 'UP-JHS-2024-001';
      }

      const simulatedUid = 'demo-' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
      const simulatedUser: any = {
        uid: simulatedUid,
        email: cleanEmail,
        displayName: name,
        emailVerified: true,
        isAnonymous: false,
      };

      const simulatedProfile: AppUser = {
        id: simulatedUid,
        name: name,
        email: cleanEmail,
        role: role,
        status: 'Active',
        assignedClassIds: classIds,
        studentId: studentIdentifier,
        createdAt: new Date().toISOString(),
      };

      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('upjhs_simulated_session', JSON.stringify({ user: simulatedUser, profile: simulatedProfile }));
          localStorage.setItem('upjhs_simulated_session', JSON.stringify({ user: simulatedUser, profile: simulatedProfile }));
          window.dispatchEvent(new Event('auth_session_changed'));
        } catch {}
      }

      setUser(simulatedUser);
      setProfile(simulatedProfile);
      setLoading(false);

      // Attempt anonymous sign in if enabled on Firebase
      try {
        signInAnonymously(auth).catch(() => {});
      } catch {}

      return simulatedUser;
    };

    try {
      let firebaseUser: User | null = null;
      try {
        const result = await signInWithEmailAndPassword(auth, cleanEmail, password);
        firebaseUser = result.user;
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('upjhs_simulated_session');
          localStorage.removeItem('upjhs_simulated_session');
          window.dispatchEvent(new Event('auth_session_changed'));
        }
      } catch (signInErr: any) {
        if (signInErr.code === 'auth/operation-not-allowed') {
          if (isDemo) {
            return activateSimulatedSession(assignedRole, displayName, assignedClassIds, studentId);
          }
          throw signInErr;
        } else if (isDemo && (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential' || signInErr.code === 'auth/invalid-email')) {
          try {
            const signupResult = await createUserWithEmailAndPassword(auth, cleanEmail, password);
            firebaseUser = signupResult.user;
          } catch (createErr: any) {
            if (createErr.code === 'auth/operation-not-allowed' || createErr.code === 'auth/network-request-failed') {
              return activateSimulatedSession(assignedRole, displayName, assignedClassIds, studentId);
            }
            throw createErr;
          }
        } else if (isDemo && signInErr.code === 'auth/network-request-failed') {
          return activateSimulatedSession(assignedRole, displayName, assignedClassIds, studentId);
        } else {
          throw signInErr;
        }
      }

      return firebaseUser;
    } catch (err: any) {
      console.warn("Email login handled:", err?.code || err?.message || err);
      let cleanedMsg = err.message || 'Login failed.';
      if (err.code === 'auth/operation-not-allowed') {
        cleanedMsg = "Email/Password sign-in is not enabled in Firebase Console for 'unipranorthdbs2'. Please enable 'Email/Password' under Firebase Console > Authentication > Sign-in method, or explore using Quick-Access below.";
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        cleanedMsg = 'Invalid email address or passcode. Please check your credentials or click a Quick-Access profile below.';
      } else if (err.code === 'auth/invalid-email') {
        cleanedMsg = 'The email address is formatted incorrectly.';
      } else if (err.code === 'auth/network-request-failed') {
        cleanedMsg = 'Network connectivity issue reaching Firebase authentication server. Please check your internet connection or use Quick-Access.';
      }
      setError(cleanedMsg);
      setLoading(false);
      throw new Error(cleanedMsg);
    }
  };

  const registerWithEmail = async (
    email: string, 
    password: string, 
    name: string, 
    role: UserRole,
    assignedClassIds?: string[],
    studentId?: string
  ) => {
    setError(null);
    setLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = result.user;
      
      const userDocRef = doc(firestore, 'users', firebaseUser.uid);
      const newProfile: AppUser = {
        id: firebaseUser.uid,
        name: name,
        email: email,
        role: role,
        status: 'Active',
        assignedClassIds: assignedClassIds,
        studentId: studentId,
        createdAt: new Date().toISOString(),
      };
      try {
        await setDoc(userDocRef, newProfile);
      } catch (persistErr) {
        console.warn("Could not persist registered profile to Firestore:", persistErr);
      }
      setProfile(newProfile);
      return firebaseUser;
    } catch (err: any) {
      console.warn("Email signup handled:", err?.code || err?.message || err);
      let cleanedMsg = err.message || 'Registration failed.';
      if (err.code === 'auth/operation-not-allowed') {
        cleanedMsg = "Email/Password sign-in is not enabled in Firebase project 'unipranorthdbs2'. Please enable 'Email/Password' in Firebase Console (Authentication > Sign-in method) or use Quick-Access below.";
      } else if (err.code === 'auth/email-already-in-use') {
        cleanedMsg = 'This email address is already registered in the school system.';
      } else if (err.code === 'auth/weak-password') {
        cleanedMsg = 'The password must be at least 6 characters.';
      } else if (err.code === 'auth/network-request-failed') {
        cleanedMsg = 'Network connectivity issue reaching Firebase authentication server.';
      }
      setError(cleanedMsg);
      setLoading(false);
      throw new Error(cleanedMsg);
    }
  };

  const logout = async () => {
    setError(null);
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('upjhs_simulated_session');
        localStorage.removeItem('upjhs_simulated_session');
        window.dispatchEvent(new Event('auth_session_changed'));
      }
      await firebaseSignOut(auth).catch(() => {});
      setProfile(null);
      setUser(null);
    } catch (err: any) {
      console.warn("Logout handled cleanly:", err?.message || err);
      setProfile(null);
      setUser(null);
    }
  };

  return {
    user,
    profile,
    loading,
    error,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    logout,
    setError,
  };
}
