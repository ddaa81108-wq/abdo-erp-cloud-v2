import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import config from "../firebase-applet-config.json";

const firebaseConfig = {
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId
};

export let db: Firestore | null = null;
export let auth: Auth | null = null;
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
db = getFirestore(app, (config as any).firestoreDatabaseId || undefined);
auth = getAuth(app);


