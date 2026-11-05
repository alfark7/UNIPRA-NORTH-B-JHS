
'use client';

import { useState, useEffect } from 'react';
import { useAuth, useFirestore } from '../provider';
import { 
  User, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
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

    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
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
                  // Clean up temporary email-based doc
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
          // Set a default working profile based on user email to prevent blocking UI
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
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
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
      return result.user;
    } catch (err: any) {
      console.error("Google Signin failed:", err);
      setError(err.message || 'Login failed.');
      setLoading(false);
      throw err;
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
    try {
      let firebaseUser: User;
      try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        firebaseUser = result.user;
      } catch (signInErr: any) {
        // Handle demo account provisioning if email-password is not registered on auth yet
        const isDemo = email.endsWith('@upnjhs.ac.pg');
        if (isDemo && (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential' || signInErr.code === 'auth/invalid-email')) {
          console.log("Demo account not found, provisioning sandbox account:", email);
          const signupResult = await createUserWithEmailAndPassword(auth, email, password);
          firebaseUser = signupResult.user;
          // Set registration metadata
          if (displayName && assignedRole) {
            const userDocRef = doc(firestore, 'users', firebaseUser.uid);
            const newProfile: AppUser = {
              id: firebaseUser.uid,
              name: displayName,
              email: email,
              role: assignedRole,
              status: 'Active',
              assignedClassIds: assignedClassIds || (assignedRole === 'Teacher' ? ['JHS1A', 'JHS2A', 'JHS3A'] : undefined),
              studentId: studentId || (assignedRole === 'Student' ? 'UP-JHS-2024-001' : undefined),
              createdAt: new Date().toISOString(),
            };
            try {
              await setDoc(userDocRef, newProfile);
            } catch (persistErr) {
              console.warn("Could not persist user profile to Firestore:", persistErr);
            }
            setProfile(newProfile);
          }
        } else {
          throw signInErr;
        }
      }
      return firebaseUser;
    } catch (err: any) {
      console.error("Email login failed:", err);
      let cleanedMsg = err.message || 'Login failed.';
      if (err.code === 'auth/operation-not-allowed') {
        cleanedMsg = 'Email/Password Authentication is not enabled in Firebase Console. Please sign in with Google or enable this provider.';
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        cleanedMsg = 'Invalid email address or passcode. Please check your credentials and try again.';
      } else if (err.code === 'auth/invalid-email') {
        cleanedMsg = 'The email address is formatted incorrectly.';
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
      console.error("Email signup failed:", err);
      let cleanedMsg = err.message || 'Registration failed.';
      if (err.code === 'auth/operation-not-allowed') {
        cleanedMsg = 'Email/Password Authentication is not enabled in Firebase Console. Please sign in with Google or enable this provider.';
      } else if (err.code === 'auth/email-already-in-use') {
        cleanedMsg = 'This email address is already registered in the school system.';
      } else if (err.code === 'auth/weak-password') {
        cleanedMsg = 'The password must be at least 6 characters.';
      }
      setError(cleanedMsg);
      setLoading(false);
      throw new Error(cleanedMsg);
    }
  };

  const logout = async () => {
    setError(null);
    try {
      await firebaseSignOut(auth);
      setProfile(null);
      setUser(null);
    } catch (err: any) {
      console.error("Logout failed:", err);
      setError(err.message || 'Signout failed.');
      throw err;
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
