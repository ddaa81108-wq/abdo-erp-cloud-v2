import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBy-AaKnxHSxFS4Gud_QaVEw6AZGFC-YGg",
  authDomain: "abdocash121.firebaseapp.com",
  projectId: "abdocash121",
  storageBucket: "abdocash121.firebasestorage.app",
  messagingSenderId: "24328376389",
  appId: "1:24328376389:web:252876b9522cfdbed2932c"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
