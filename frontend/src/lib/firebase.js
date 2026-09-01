import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey) {
  // No hardcoded fallback here on purpose - a silent fallback to someone
  // else's Firebase project is worse than a warning. This deliberately does
  // NOT throw: AuthProvider wraps the entire app in App.jsx, including the
  // public marketing pages, so a hard failure here would blank-screen the
  // whole site rather than just break sign-in until VITE_FIREBASE_* is set.
  console.error(
    'Firebase is not configured: set VITE_FIREBASE_* in frontend/.env (see frontend/.env.example). ' +
      'Sign-in/sign-up will fail until this is set; the rest of the app still works.',
  );
}

// Initialize Firebase App only once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Export Firebase Auth instance only
export const auth = getAuth(app);
export default app;
