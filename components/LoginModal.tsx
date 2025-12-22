import React, { useState } from 'react';
import { X, LogIn, AlertCircle, Sparkles, User, Mail, Lock, ArrowRight } from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false); // Toggle between Login and Sign Up
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(''); // Only for Sign Up

  const { loginAsGuest, registerWithEmail, loginWithEmail } = useAuth();

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      onLoginSuccess();
      onClose();
    } catch (err: any) {
      console.error("Login failed", err);
      handleAuthError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Client-side Validation
    if (password.length < 6) {
        setError("Password must be at least 6 characters long.");
        return;
    }
    if (isSignUp && !name.trim()) {
        setError("Please enter your full name.");
        return;
    }

    setIsLoading(true);

    try {
      if (isSignUp) {
        await registerWithEmail(email, password, name);
      } else {
        await loginWithEmail(email, password);
      }
      onLoginSuccess();
      onClose();
    } catch (err: any) {
      console.error("Auth failed", err);
      handleAuthError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = () => {
    loginAsGuest();
    onLoginSuccess();
    onClose();
  };

  const handleAuthError = (err: any) => {
    const code = err.code;
    const msg = err.message || "";

    if (code === 'auth/invalid-api-key') {
      setError("System Error: Firebase API Key is missing.");
    } else if (code === 'auth/unauthorized-domain') {
      setError("Configuration Error: This domain is not authorized. Please add it in Firebase Console > Authentication > Settings > Authorized Domains.");
    } else if (code === 'auth/popup-closed-by-user') {
      setError("Sign-in cancelled.");
    } else if (code === 'auth/email-already-in-use') {
      setError("This email is already registered. Please log in instead.");
    } else if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
      setError("Invalid email or password. Please try again.");
    } else if (code === 'auth/weak-password') {
      setError("Password is too weak. It must be at least 6 characters.");
    } else if (code === 'auth/network-request-failed') {
      setError("Network error. Please check your internet connection.");
    } else {
      // Clean up generic firebase error messages for the user
      const cleanMsg = msg.replace("Firebase: ", "").replace(/\(auth\/.*\)\.?/, "").trim();
      setError(cleanMsg || "Authentication failed. Please try again.");
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError(null);
    setEmail('');
    setPassword('');
    setName('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative transform transition-all scale-100">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition p-1 rounded-full hover:bg-gray-100 z-10"
        >
          <X size={20} />
        </button>

        <div className="p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-7 h-7 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{isSignUp ? 'Create Account' : 'Welcome Back'}</h2>
            <p className="text-gray-500 text-sm mt-1">
              {isSignUp ? 'Join Interview Mate today.' : 'Sign in to access your interview history.'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start text-left text-sm text-red-600">
              <AlertCircle size={16} className="mr-2 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Email/Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
            {isSignUp && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 ml-1">FULL NAME</label>
                <div className="relative">
                   <User size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                   <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John Doe"
                      required={isSignUp}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
                   />
                </div>
              </div>
            )}
            
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1 ml-1">EMAIL ADDRESS</label>
              <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
                  />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1 ml-1">PASSWORD</label>
              <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
                  />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center disabled:opacity-70"
            >
              {isLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : (
                 <>
                   <span>{isSignUp ? 'Sign Up' : 'Log In'}</span>
                   <ArrowRight size={18} className="ml-2" />
                 </>
              )}
            </button>
          </form>

          {/* Social / Guest Divider */}
          <div className="relative flex py-2 items-center mb-6">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase">Or continue with</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="flex items-center justify-center space-x-2 bg-gray-50 border border-gray-200 hover:bg-white text-gray-700 font-medium py-2.5 rounded-xl transition-all text-sm"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              <span>Google</span>
            </button>
            
            <button
              onClick={handleGuestLogin}
              className="flex items-center justify-center space-x-2 bg-gray-50 border border-gray-200 hover:bg-white text-gray-700 font-medium py-2.5 rounded-xl transition-all text-sm"
            >
              <User size={18} />
              <span>Guest</span>
            </button>
          </div>

          <div className="text-center">
            <button 
              onClick={toggleMode} 
              className="text-blue-600 hover:text-blue-800 text-sm font-semibold hover:underline"
            >
              {isSignUp ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default LoginModal;