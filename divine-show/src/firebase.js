import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDHVp0mEj1rvLdFXXnI3_0J_PVyt06_DX0',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'divine-show-db.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'divine-show-db',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'divine-show-db.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '765827208001',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:765827208001:web:52d07ae52e4968317e07c0',
};

export const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);

const app = firebaseConfigured ? initializeApp(firebaseConfig) : null;

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
