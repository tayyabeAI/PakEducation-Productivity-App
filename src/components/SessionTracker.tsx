import { useEffect, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';
import { db, auth, collection, addDoc, serverTimestamp } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

export default function SessionTracker() {
  const { user } = useAuth();
  const startTimeRef = useRef<number>(Date.now());
  const sessionStartedRef = useRef<boolean>(false);

  useEffect(() => {
    if (user && !sessionStartedRef.current) {
      startTimeRef.current = Date.now();
      sessionStartedRef.current = true;
      console.log('Session tracking started for:', user.displayName);
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && sessionStartedRef.current && user) {
        saveSession();
      } else if (document.visibilityState === 'visible' && user) {
        startTimeRef.current = Date.now();
        sessionStartedRef.current = true;
      }
    };

    const saveSession = async () => {
      if (!user || !sessionStartedRef.current || !auth.currentUser) return;
      
      const endTime = Date.now();
      const duration = Math.floor((endTime - startTimeRef.current) / 1000);
      
      if (duration > 5) {
        try {
          await addDoc(collection(db, 'sessions'), {
            userId: user.uid,
            startTime: new Date(startTimeRef.current),
            endTime: new Date(endTime),
            duration: duration,
            createdAt: serverTimestamp()
          });
          console.log(`Saved session: ${duration}s`);
        } catch (error) {
          // Only log if it's not a permission error during logout
          if (auth.currentUser) {
            handleFirestoreError(error, OperationType.CREATE, 'sessions');
          }
        }
      }
      sessionStartedRef.current = false;
    };

    window.addEventListener('beforeunload', saveSession);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      saveSession();
      window.removeEventListener('beforeunload', saveSession);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  return null;
}
