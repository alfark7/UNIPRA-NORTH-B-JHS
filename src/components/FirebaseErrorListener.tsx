
'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';

// This component listens for custom Firestore permission errors and logs them
// cleanly without crashing the Next.js execution runtime.
export function FirebaseErrorListener() {
  useEffect(() => {
    const handleError = (error: Error) => {
      console.warn('Firestore permission error handled cleanly:', error?.message || error);
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  return null;
}
