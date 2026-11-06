
'use client';

import { useState, useEffect } from 'react';
import { onSnapshot, DocumentReference } from 'firebase/firestore';
import { useAuth } from '../provider';

export function useDoc<T>(
  docRef: DocumentReference | null
) {
  const auth = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!docRef) {
      setData(null);
      setLoading(false);
      return;
    }

    let isCancelled = false;
    let unsubscribeSnapshot: (() => void) | null = null;

    const checkAuthStatus = (currentUser: any) => {
      if (isCancelled) return;

      const hasSimulatedSession = typeof window !== 'undefined' && 
        Boolean(sessionStorage.getItem('upjhs_simulated_session') || localStorage.getItem('upjhs_simulated_session'));

      if (!currentUser && !hasSimulatedSession) {
        if (unsubscribeSnapshot) {
          try {
            unsubscribeSnapshot();
          } catch {}
          unsubscribeSnapshot = null;
        }
        setData(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        if (unsubscribeSnapshot) {
          try {
            unsubscribeSnapshot();
          } catch {}
          unsubscribeSnapshot = null;
        }

        unsubscribeSnapshot = onSnapshot(
          docRef,
          (doc) => {
            if (isCancelled) return;
            if (doc.exists()) {
              setData({ id: doc.id, ...doc.data() } as T);
            } else {
              setData(null);
            }
            setLoading(false);
            setError(null);
          },
          (err) => {
            if (isCancelled) return;
            console.warn("Firestore doc snapshot handled:", err?.message || err);
            setError(err);
            setLoading(false);
          }
        );
      } catch (subErr: any) {
        if (!isCancelled) {
          console.warn("Failed to subscribe to doc:", subErr?.message || subErr);
          setError(subErr);
          setLoading(false);
        }
      }
    };

    const unsubscribeAuth = auth.onAuthStateChanged(checkAuthStatus);
    const handleSessionChange = () => checkAuthStatus(auth.currentUser);

    if (typeof window !== 'undefined') {
      window.addEventListener('auth_session_changed', handleSessionChange);
    }

    checkAuthStatus(auth.currentUser);

    return () => {
      isCancelled = true;
      if (unsubscribeSnapshot) {
        try {
          unsubscribeSnapshot();
        } catch (unsubErr: any) {
          console.warn("Error during doc unsubscription handled:", unsubErr?.message || unsubErr);
        }
        unsubscribeSnapshot = null;
      }
      unsubscribeAuth();
      if (typeof window !== 'undefined') {
        window.removeEventListener('auth_session_changed', handleSessionChange);
      }
    };
  }, [docRef, auth]);

  return { data, loading, error };
}
