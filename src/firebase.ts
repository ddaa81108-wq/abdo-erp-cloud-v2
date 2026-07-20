import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';

// Firebase config embedded directly - no external JSON import needed
const firebaseConfig = {
  apiKey: "AIzaSyC-Zp5C76IT16WnfTC--z_PSLOSYTq-Tyk",
  authDomain: "abdocash121.firebaseapp.com",
  projectId: "abdocash121",
  storageBucket: "abdocash121.firebasestorage.app",
  messagingSenderId: "24328376389",
  appId: "1:24328376389:web:252876b9522cfdbed2932c"
};

export let db: Firestore | null = null;
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
db = getFirestore(app);