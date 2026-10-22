import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  onSnapshot,
  setDoc
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { AppState } from './types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  const path = 'test/connection';
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
    return false;
  }
}

export async function signInWithGoogle(): Promise<FirebaseUser> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    // Sync authenticated user with Cloud SQL backend
    try {
      const token = await result.user.getIdToken();
      await fetch('/api/auth/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: result.user.displayName })
      });
    } catch (syncErr) {
      console.warn('Backend user sync warning:', syncErr);
    }
    return result.user;
  } catch (err) {
    console.error('Google Sign-In failed', err);
    throw err;
  }
}

export async function signOutFirebase(): Promise<void> {
  await fbSignOut(auth);
}

const STATE_DOC_PATH = 'inventory_data/shared_ledger';

// Save state to Cloud SQL PostgreSQL via Express API
export async function saveStateToCloudSQL(state: AppState, userDisplayName?: string): Promise<boolean> {
  try {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/ledger/save', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        state,
        updatedBy: userDisplayName || auth.currentUser?.email || 'Store Staff'
      })
    });
    return res.ok;
  } catch (err) {
    console.warn('Cloud SQL save notice:', err);
    return false;
  }
}

// Fetch initial state from Cloud SQL PostgreSQL
export async function fetchStateFromCloudSQL(): Promise<AppState | null> {
  try {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/ledger', { headers });
    if (!res.ok) return null;
    const data = await res.json();
    return data.found ? data.state : null;
  } catch (err) {
    console.warn('Cloud SQL fetch notice:', err);
    return null;
  }
}

export async function saveStateToFirestore(state: AppState, userDisplayName?: string): Promise<void> {
  try {
    const payload = {
      ...state,
      updatedAt: new Date().toISOString(),
      updatedBy: userDisplayName || (auth.currentUser?.email || auth.currentUser?.displayName || 'anonymous')
    };
    await setDoc(doc(db, 'inventory_data', 'shared_ledger'), payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, STATE_DOC_PATH);
  }
}

export function subscribeToFirestoreState(
  onUpdate: (state: AppState) => void,
  onInitialEmpty?: () => void
): () => void {
  const stateDocRef = doc(db, 'inventory_data', 'shared_ledger');
  return onSnapshot(
    stateDocRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as AppState;
        onUpdate(data);
      } else if (onInitialEmpty) {
        onInitialEmpty();
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, STATE_DOC_PATH);
    }
  );
}
