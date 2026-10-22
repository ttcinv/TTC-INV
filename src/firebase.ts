import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  signInAnonymously,
  User as FirebaseUser
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
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

// Automatically initiate or restore an auth session so rules with isSignedIn() succeed
export async function ensureAuthSession(): Promise<FirebaseUser | null> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (user) {
        resolve(user);
      } else {
        try {
          const cred = await signInAnonymously(auth);
          resolve(cred.user);
        } catch {
          resolve(null);
        }
      }
    });
  });
}

export async function signInWithGoogle(): Promise<FirebaseUser> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
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
