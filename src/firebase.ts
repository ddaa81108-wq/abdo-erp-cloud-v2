import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBy-AaKnxHSxFS4Gud_QaVEw6AZGFC-YGg",
  authDomain: "abdocash121.firebaseapp.com",
  projectId: "abdocash121",
  storageBucket: "abdocash121.firebasestorage.app",
  messagingSenderId: "24328376389",
  appId: "1:24328376389:web:252876b9522cfdbed2932c"
};

export let db: Firestore | null = null;
export let auth: Auth | null = null;
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
db = getFirestore(app);
auth = getAuth(app);
