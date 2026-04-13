import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  auth, 
  onAuthStateChanged, 
  db, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp, 
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  signOut,
  signInWithPopup,
  googleProvider
} from './firebase';
import { logActivity } from './activity-logger';
import { UserProfile } from '../types';
import { toast } from 'sonner';

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
        const emailQuery = query(collection(db, 'users'), where('email', '==', firebaseUser.email));
        const emailSnapshot = await getDocs(emailQuery);
        
        const existingUser = emailSnapshot.docs.find(d => d.data().status === 'suspended' || d.data().status === 'deleted');
        
        if (existingUser) {
          const status = existingUser.data().status;
          await signOut(auth);
          setUser(null);
          setLoading(false);
          toast.error(`This account has been ${status}. Please contact admin.`);
          return;
        }

        // Listen to user document changes
        unsubscribeDoc = onSnapshot(doc(db, 'users', firebaseUser.uid), async (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as UserProfile;
            
            if (data.status === 'suspended' || data.status === 'deleted') {
              await signOut(auth);
              setUser(null);
              setLoading(false);
              return;
            }

            setUser(data);
            setLoading(false);

            // Update missing fields for existing users and lastLogin
            if (!snapshot.metadata.hasPendingWrites) {
              const updates: any = {};
              if (!data.providerId) updates.providerId = firebaseUser.providerData[0]?.providerId || 'direct';
              if (!data.createdAt) updates.createdAt = serverTimestamp();
              if (!data.status) updates.status = 'active';
              
              // Force super-admin for specific email
              if (firebaseUser.email === 'masnoezahanat@gmail.com' && data.role !== 'super-admin') {
                updates.role = 'super-admin';
              }
              
              const currentTeamIds = data.teamIds || [];
              if (data.teamId && !currentTeamIds.includes(data.teamId)) {
                updates.teamIds = [...currentTeamIds, data.teamId];
              } else if (!data.teamIds) {
                updates.teamIds = [];
              }
              
              // Update lastLogin if it's been more than 5 minutes or missing
              const lastLogin = data.lastLogin?.toDate?.() || new Date(0);
              if (new Date().getTime() - lastLogin.getTime() > 5 * 60 * 1000) {
                updates.lastLogin = serverTimestamp();
                logActivity('login', `User logged in from ${data.providerId || 'direct'}`);
              }

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
              role: firebaseUser.email === 'masnoezahanat@gmail.com' ? 'super-admin' : 'member',
              createdAt: serverTimestamp(),
              providerId: firebaseUser.providerData[0]?.providerId || 'direct',
              status: 'active',
              teamIds: []
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
    await signInWithPopup(auth, googleProvider);
  };

  const logout = async () => {
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
