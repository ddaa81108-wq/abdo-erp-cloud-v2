import { deleteApp, initializeApp, getApps, getApp } from 'firebase/app';
import { doc, getFirestore, Firestore, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, deleteUser, getAuth, signOut } from 'firebase/auth';
import type { User } from './types';
import { normalizeLoginIdentifier } from './utils/authUtils';

const firebaseConfig = {
  apiKey: "AIzaSyBfLx_TXLJHgcWAzAXk0bzAcqhWoAuIYUk",
  authDomain: "abdonew-3dd25.firebaseapp.com",
  projectId: "abdonew-3dd25",
  storageBucket: "abdonew-3dd25.firebasestorage.app",
  messagingSenderId: "471040967252",
  appId: "1:471040967252:web:afb98f2cb735acf2caa3c1"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export let db: Firestore = getFirestore(app);
export const auth = getAuth(app);

type NewUserProfile = Omit<User, 'id' | 'password'>;

/**
 * Creates a Firebase Auth account without replacing the currently signed-in
 * administrator, then writes the matching Firestore permissions document.
 */
export async function createFirebaseUserAccount(
  identifier: string,
  password: string,
  profile: NewUserProfile,
): Promise<User> {
  const loginEmail = normalizeLoginIdentifier(identifier);
  const secondaryApp = initializeApp(firebaseConfig, `user-creation-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      loginEmail,
      password,
    );

    const newUser: User = {
      ...profile,
      id: credential.user.uid,
      email: loginEmail,
      password: '',
    };

    try {
      await setDoc(doc(db, 'users', credential.user.uid), {
        ...newUser,
        isActive: true,
      });
    } catch (error) {
      // Avoid leaving an unusable Auth account when its permissions document fails.
      await deleteUser(credential.user).catch(() => undefined);
      throw error;
    }

    return newUser;
  } finally {
    await signOut(secondaryAuth).catch(() => undefined);
    await deleteApp(secondaryApp).catch(() => undefined);
  }
}
