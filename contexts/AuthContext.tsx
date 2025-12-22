import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { 
  onAuthStateChanged, 
  User, 
  signOut, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  loginAsGuest: () => void;
  registerWithEmail: (email: string, password: string, name: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // When auth state changes, update state.
        // Note: This fires on login/logout/init, but NOT on updateProfile usually.
        setCurrentUser(user);
      } else {
        // Handle guest user persistence or clear state
        setCurrentUser(prev => (prev?.isAnonymous && prev.email === 'guest@example.com' ? prev : null));
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const registerWithEmail = async (email: string, password: string, name: string) => {
    // 1. Create Auth User
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. Update Auth Profile (Display Name)
    try {
        await updateProfile(user, {
            displayName: name
        });
        
        // Force a reload to ensure all properties are synced
        await user.reload();
    } catch (e) {
        console.error("Error updating profile", e);
    }

    // 3. Store User Data in Firestore
    try {
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name: name,
        email: email,
        createdAt: new Date().toISOString(),
        role: "user"
      });
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        console.warn("Firestore write permission denied. User profile saved in Auth only.");
      } else {
        console.error("Error writing user document: ", error);
      }
    }

    // 4. Force update local state to reflect the new display name immediately.
    // We create a new object reference and explicitly set displayName because 
    // spreading a Firebase User object sometimes misses getter properties.
    const updatedUser = { ...user, displayName: name } as unknown as User;
    setCurrentUser(updatedUser);
  };

  const loginWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
    setCurrentUser(null);
  };

  const loginAsGuest = () => {
    const guestUser = {
      uid: 'guest-' + Math.random().toString(36).substr(2, 9),
      displayName: 'Guest User',
      email: 'guest@example.com',
      photoURL: null,
      emailVerified: true,
      isAnonymous: true,
      metadata: {},
      providerData: [],
      delete: async () => {},
      getIdToken: async () => 'mock-token',
      getIdTokenResult: async () => ({} as any),
      reload: async () => {},
      toJSON: () => ({}),
      phoneNumber: null,
      providerId: 'guest',
    } as unknown as User;
    
    setCurrentUser(guestUser);
  };

  const value = {
    currentUser,
    loading,
    logout,
    loginAsGuest,
    registerWithEmail,
    loginWithEmail
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};