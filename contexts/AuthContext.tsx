import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  loginAsGuest: () => void;
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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // Only set user if we haven't manually set a guest user (who has no uid in firebase terms)
      // Actually, onAuthStateChanged will return null on init if not logged in.
      // If we are "guest", we manage state locally. 
      // However, if onAuthStateChanged fires (e.g. login elsewhere), it might override.
      // For simplicity, we let Firebase truth prevail, but if null, we keep guest if set? 
      // No, simpler: onAuthStateChanged controls the source of truth for Firebase users.
      // Guest users are local state overrides.
      
      if (user) {
        setCurrentUser(user);
      } else {
        // If firebase says null, we only set null if we aren't currently a guest
        setCurrentUser(prev => (prev?.isAnonymous && prev.email === 'guest@example.com' ? prev : null));
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    await signOut(auth);
    setCurrentUser(null);
  };

  const loginAsGuest = () => {
    // Create a mock user object that satisfies the parts of the User interface we use
    const guestUser = {
      uid: 'guest-' + Math.random().toString(36).substr(2, 9),
      displayName: 'Guest User',
      email: 'guest@example.com',
      photoURL: null,
      emailVerified: true,
      isAnonymous: true,
      metadata: {},
      providerData: [],
      // Mock methods that might be called (though unlikely in this app's current state)
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
    loginAsGuest
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};