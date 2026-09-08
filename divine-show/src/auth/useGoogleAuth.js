import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { auth, firebaseConfigured, googleProvider } from '../firebase';
import { authErrorMessage } from './errors';

export function useGoogleAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(auth));
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const unsubscribe = auth ? onAuthStateChanged(auth, (nextUser) => {
      if (!mounted.current) return;
      setUser(nextUser);
      setLoading(false);
      setError('');
    }, (failure) => {
      if (mounted.current) {
        setLoading(false);
        setError(authErrorMessage(failure));
      }
    }) : null;
    return () => { mounted.current = false; unsubscribe?.(); };
  }, []);

  const signIn = async () => {
    if (pending.current) return;
    if (!auth || !firebaseConfigured) return setError('Firebase не настроен.');
    pending.current = true;
    setSigningIn(true);
    setError('');
    try {
      // Keep the popup in the tap handler: an awaited setup step can block it on mobile.
      await signInWithPopup(auth, googleProvider);
    } catch (failure) {
      if (mounted.current && !auth.currentUser) setError(authErrorMessage(failure));
    } finally {
      pending.current = false;
      if (mounted.current) setSigningIn(false);
    }
  };

  return { user, loading, signingIn, error, signIn };
}
