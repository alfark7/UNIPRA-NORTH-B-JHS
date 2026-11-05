
'use client';

import { useState, useEffect } from 'react';
import {
  onSnapshot,
  Query,
} from 'firebase/firestore';
import { useAuth } from '../provider';

export function useCollection<T>(
  query: Query | null
) {
  const auth = useAuth();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!query) {
      setData([]);
      setLoading(false);
      return;
    }

    let isCancelled = false;
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
      if (isCancelled) return;

      if (!currentUser) {
        if (unsubscribeSnapshot) {
          try {
            unsubscribeSnapshot();
          } catch {}
          unsubscribeSnapshot = null;
        }
        setData([]);
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
          query,
          (snapshot) => {
            if (isCancelled) return;
            const result: T[] = [];
            snapshot.forEach((doc) => {
              result.push({ id: doc.id, ...doc.data() } as T);
            });
            setData(result);
            setLoading(false);
            setError(null);
          },
          (err) => {
            if (isCancelled) return;
            console.warn("Firestore collection snapshot handled:", err?.message || err);
            setError(err);
            setLoading(false);
          }
        );
      } catch (subErr: any) {
        if (!isCancelled) {
          console.warn("Failed to subscribe to collection:", subErr?.message || subErr);
          setError(subErr);
          setLoading(false);
        }
      }
    });

    return () => {
      isCancelled = true;
      if (unsubscribeSnapshot) {
        try {
          unsubscribeSnapshot();
        } catch (unsubErr: any) {
          console.warn("Error during collection unsubscription handled:", unsubErr?.message || unsubErr);
        }
        unsubscribeSnapshot = null;
      }
      unsubscribeAuth();
    };
  }, [query, auth]);

  return { data, setData, loading, error };
}
