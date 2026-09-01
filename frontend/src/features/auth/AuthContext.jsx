import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

const AuthContext = createContext(null);

/**
 * Friendly translation for Firebase Auth error codes
 */
export function getFriendlyAuthErrorMessage(error) {
  if (!error) return 'An unknown error occurred.';
  const code = error.code || '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email address or password. Please check your credentials and try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists. Try signing in.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters long.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-disabled':
      return 'This user account has been disabled. Please contact support.';
    case 'auth/too-many-requests':
      return 'Too many unsuccessful attempts. Access has been temporarily restricted. Please try again later or reset your password.';
    case 'auth/network-request-failed':
      return 'Network connection issue. Please check your internet connection and try again.';
    case 'auth/api-key-not-valid.':
    case 'auth/api-key-not-valid':
    case 'auth/invalid-api-key':
      return 'Firebase API key is not configured or invalid. Please check your .env configuration.';
    default:
      return error.message?.replace('Firebase: ', '') || 'Authentication failed. Please try again.';
  }
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState(() => {
    return localStorage.getItem('cashtwin_business_name') || 'Hussain Crafts';
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setCurrentUser(user);
        setLoading(false);
      },
      (error) => {
        console.error('Firebase Auth state change error:', error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    return await signInWithEmailAndPassword(auth, email, password);
  };

  const signup = async ({ email, password, displayName, businessName: bName }) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName && userCredential.user) {
      await updateProfile(userCredential.user, { displayName });
    }
    if (bName) {
      localStorage.setItem('cashtwin_business_name', bName);
      setBusinessName(bName);
    }
    return userCredential;
  };

  const logout = async () => {
    return await signOut(auth);
  };

  const resetPassword = async (email) => {
    return await sendPasswordResetEmail(auth, email);
  };

  const updateUserProfile = async (updates) => {
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, updates);
      setCurrentUser({ ...auth.currentUser });
    }
  };

  const setBusiness = (name) => {
    localStorage.setItem('cashtwin_business_name', name);
    setBusinessName(name);
  };

  const value = useMemo(
    () => ({
      currentUser,
      loading,
      businessName,
      login,
      signup,
      logout,
      resetPassword,
      updateUserProfile,
      setBusiness,
      isAuthenticated: Boolean(currentUser),
    }),
    [currentUser, loading, businessName],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
