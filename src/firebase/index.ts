
'use client';
import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, initializeFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { firebaseConfig } from './config';

import { FirebaseProvider, useFirebase, useFirestore, useFirebaseApp } from './provider';
import { FirebaseClientProvider } from './client-provider';
import { useCollection } from './firestore/use-collection';
import { useDoc } from './firestore/use-doc';
import { useUser } from './auth/use-user';

let firebaseApp: FirebaseApp;
let firestore: Firestore;
let auth: Auth;

function initializeFirebase(): {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
} {
  if (!firebaseApp) {
    if (!getApps().length) {
      firebaseApp = initializeApp(firebaseConfig);
    } else {
      firebaseApp = getApp();
    }
  }
  if (!firestore) {
    const dbId = (firebaseConfig as any).firestoreDatabaseId || '(default)';
    try {
      firestore = initializeFirestore(firebaseApp, {}, dbId);
    } catch {
      firestore = getFirestore(firebaseApp, dbId);
    }
  }
  if (!auth) {
    auth = getAuth(firebaseApp);
  }
  return { firebaseApp, firestore, auth };
}

export {
  initializeFirebase,
  FirebaseProvider,
  FirebaseClientProvider,
  useCollection,
  useDoc,
  useUser,
  useFirebase,
  useFirebaseApp,
  useFirestore,
};
