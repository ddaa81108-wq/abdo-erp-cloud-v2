<<<<<<< HEAD
// File: src/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
=======
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
>>>>>>> 121a74f (Update Firebase config for AbdoNew)

const firebaseConfig = {
  apiKey: "AIzaSyBfLx_TXLJHgcWAzAXk0bzAcqhWoAuIYUk",
  authDomain: "abdonew-3dd25.firebaseapp.com",
  projectId: "abdonew-3dd25",
  storageBucket: "abdonew-3dd25.firebasestorage.app",
  messagingSenderId: "471040967252",
  appId: "1:471040967252:web:afb98f2cb735acf2caa3c1"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
<<<<<<< HEAD
export const db: Firestore = getFirestore(app);
export const auth = getAuth(app);
=======
db = getFirestore(app);
export const auth = getAuth(app);
>>>>>>> 121a74f (Update Firebase config for AbdoNew)
