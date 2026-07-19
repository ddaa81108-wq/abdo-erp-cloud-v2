import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
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
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
db = getFirestore(app, (config as any).firestoreDatabaseId || undefined);


