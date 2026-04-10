import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, onAuthStateChanged, db, doc, getDoc, setDoc, updateDoc, serverTimestamp, onSnapshot } from './firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Check if email is suspended/deleted (even if UID is different)
        const { collection, query, where, getDocs } = await import('./firebase');
        const emailQuery = query(collection(db, 'users'), where('email', '==', firebaseUser.email));
        const emailSnapshot = await getDocs(emailQuery);
        
        const existingUser = emailSnapshot.docs.find(d => d.data().status === 'suspended' || d.data().status === 'deleted');
        
        if (existingUser) {
          const status = existingUser.data().status;
          const { signOut } = await import('./firebase');
          await signOut(auth);
          setUser(null);
          setLoading(false);
          const { toast } = await import('sonner');
          toast.error(`This account has been ${status}. Please contact admin.`);
          return;
        }

        // Listen to user document changes
        unsubscribeDoc = onSnapshot(doc(db, 'users', firebaseUser.uid), async (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as UserProfile;
            
            if (data.status === 'suspended' || data.status === 'deleted') {
              const { signOut } = await import('./firebase');
              await signOut(auth);
              setUser(null);
              setLoading(false);
              return;
            }

            setUser(data);
            setLoading(false);

            // Update missing fields for existing users
            // Only update if not already present and no pending writes to avoid loops
            if (!snapshot.metadata.hasPendingWrites) {
              const updates: any = {};
              if (!data.providerId) updates.providerId = firebaseUser.providerData[0]?.providerId || 'direct';
              if (!data.createdAt) updates.createdAt = serverTimestamp();
              if (!data.status) updates.status = 'active';

              if (Object.keys(updates).length > 0) {
                await updateDoc(doc(db, 'users', firebaseUser.uid), updates);
              }
            }
          } else {
            const newUser: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'User',
              photoURL: firebaseUser.photoURL || '',
              role: firebaseUser.email === 'masnoezahanat@gmail.com' ? 'admin' : 'member',
              createdAt: serverTimestamp(),
              providerId: firebaseUser.providerData[0]?.providerId || 'direct',
              status: 'active'
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
          }
        });
      } else {
        if (unsubscribeDoc) unsubscribeDoc();
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  const signIn = async () => {
    const { signInWithPopup, googleProvider } = await import('./firebase');
    await signInWithPopup(auth, googleProvider);
  };

  const logout = async () => {
    const { signOut } = await import('./firebase');
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
