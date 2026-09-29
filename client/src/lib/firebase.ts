import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";

// Fallback configuration for development
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-api-key",
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID || "anpr-directorio"}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "anpr-directorio",
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID || "anpr-directorio"}.firebasestorage.app`,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789:web:abcdef123456",
};

let app: FirebaseApp | undefined;
let auth: Auth | null = null;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
} catch (error) {
  console.warn("Firebase initialization failed, using fallback mode:", error);
  // Create a mock auth object for development
  auth = null;
}

export { auth };
export default app;
