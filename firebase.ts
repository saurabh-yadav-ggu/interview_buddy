import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBOq9jhJLsfuRzABzsRzZzvmOz2Rjnu87Q",
  authDomain: "interview-ffe34.firebaseapp.com",
  projectId: "interview-ffe34",
  storageBucket: "interview-ffe34.firebasestorage.app",
  messagingSenderId: "582518219918",
  appId: "1:582518219918:web:d15fc2e8f15a0787e355df",
  measurementId: "G-KLHHNLDKCZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Export Auth services for use in the app
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export { app, analytics };