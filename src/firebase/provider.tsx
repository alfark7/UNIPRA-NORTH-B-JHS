
'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { initializeFirebase } from './';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

interface FirebaseContextValue {
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export const FirebaseProvider = ({ children }: { children: ReactNode }) => {
  const { firebaseApp, auth, firestore } = initializeFirebase();

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const isFirestoreInternalError = (msg: string) =>
      msg.includes('FIRESTORE') &&
      (msg.includes('ca9') || msg.includes('b815') || msg.includes('INTERNAL ASSERTION FAILED') || msg.includes('Unexpected state'));

    const handleRejection = (event: PromiseRejectionEvent) => {
      const msg = event?.reason?.message || event?.reason?.stack || String(event?.reason || '');
      if (isFirestoreInternalError(msg)) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
        console.warn('Suppressed internal Firestore assertion in unhandled rejection:', msg);
      }
    };

    const handleWindowError = (event: ErrorEvent) => {
      const msg = event?.message || event?.error?.message || event?.error?.stack || '';
      if (isFirestoreInternalError(msg)) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
      }
    };

    const origConsoleError = console.error;
    console.error = (...args: any[]) => {
      const combined = args.map(a => (a?.message || a?.stack || String(a || ''))).join(' ');
      if (isFirestoreInternalError(combined)) {
        console.warn('Suppressed internal Firestore SDK assertion in console:', combined);
        return;
      }
      origConsoleError.apply(console, args);
    };

    window.addEventListener('unhandledrejection', handleRejection, true);
    window.addEventListener('error', handleWindowError, true);

    return () => {
      console.error = origConsoleError;
      window.removeEventListener('unhandledrejection', handleRejection, true);
      window.removeEventListener('error', handleWindowError, true);
    };
  }, []);

  const value = React.useMemo(() => ({
    firebaseApp,
    auth,
    firestore
  }), [firebaseApp, auth, firestore]);

  return (
    <FirebaseContext.Provider value={value}>
      {children}
      <FirebaseErrorListener />
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
    const context = useContext(FirebaseContext);
    if (!context) {
        throw new Error('useFirebase must be used within a FirebaseProvider');
    }
    return context;
}

export const useFirebaseApp = () => useFirebase().firebaseApp;
export const useAuth = () => useFirebase().auth;
export const useFirestore = () => useFirebase().firestore;
