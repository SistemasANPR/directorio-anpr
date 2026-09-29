import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence,
  browserLocalPersistence,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  User as FirebaseUser
} from "firebase/auth";
import { auth } from "./firebase";
import { apiRequest } from "./queryClient";

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role?: string;
}

// Sign in with email and password
export const signInWithEmail = async (email: string, password: string, rememberMe: boolean = false): Promise<FirebaseUser> => {
  // Set persistence based on rememberMe option
  await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
};

// Create user with email and password
export const createUserWithEmail = async (email: string, password: string): Promise<FirebaseUser> => {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  return result.user;
};

// WordPress takeover changes the local identity, but must not revoke the
// server-issued manual cookie. Only the user's explicit logout does that.
export const signOutFirebaseOnly = async (): Promise<void> => {
  if (auth) await signOut(auth);
};

// Sign out
export const signOutUser = async (): Promise<void> => {
  // This endpoint clears the HttpOnly admin cookie; removing tempUser alone
  // would leave an authenticated manual admin session active on the server.
  try {
    const response = await fetch("/api/admin/logout", {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("No se pudo cerrar la sesión del servidor");
    }
  } finally {
    await signOutFirebaseOnly();
  }
};

// Change password for a Firebase-authenticated user.
// Requires reauthentication with the current password before updating.
export const changeFirebasePassword = async (
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  const currentUser = auth?.currentUser;
  if (!currentUser || !currentUser.email) {
    throw new Error("No hay una sesión de Firebase activa");
  }

  const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);

  try {
    await reauthenticateWithCredential(currentUser, credential);
    await updatePassword(currentUser, newPassword);
  } catch (error: any) {
    switch (error?.code) {
      case "auth/wrong-password":
      case "auth/invalid-credential":
        throw new Error("La contraseña actual es incorrecta");
      case "auth/weak-password":
        throw new Error("La nueva contraseña es demasiado débil (mínimo 6 caracteres)");
      case "auth/requires-recent-login":
        throw new Error("Por seguridad, cierra sesión y vuelve a iniciar antes de cambiar la contraseña");
      default:
        throw new Error(error?.message || "No se pudo cambiar la contraseña");
    }
  }
};

// Auth state observer
export const onAuthStateChange = (callback: (user: FirebaseUser | null) => void): (() => void) => {
  if (!auth) {
    // The manual signed-cookie session still has to be restored, even when
    // Firebase could not initialize. Otherwise AuthProvider stays loading.
    queueMicrotask(() => callback(null));
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
};

// Get or create user in our database
export const getOrCreateUser = async (firebaseUser: FirebaseUser) => {
  try {
    // Try to get existing user
    const response = await fetch(`/api/users/firebase/${firebaseUser.uid}`, {
      credentials: "include",
    });

    if (response.ok) {
      return await response.json();
    }

    if (response.status === 404) {
      // User doesn't exist, create new one
      const userData = {
        firebaseUid: firebaseUser.uid,
        email: firebaseUser.email || "",
        displayName: firebaseUser.displayName || "",
        photoURL: firebaseUser.photoURL || "",
        role: "user", // Default role
      };

      const createResponse = await apiRequest("POST", "/api/users", userData);
      return await createResponse.json();
    }

    throw new Error("Failed to get or create user");
  } catch (error) {
    console.error("Error getting or creating user:", error);
    throw error;
  }
};

// Combined function for representative authentication
export const signInWithFirebase = async (email: string, password: string, isRegistration: boolean = false): Promise<FirebaseUser> => {
  if (isRegistration) {
    return await createUserWithEmail(email, password);
  } else {
    return await signInWithEmail(email, password, true);
  }
};

// Hook for authentication (simplified)
export const useAuth = () => {
  return {
    signInWithFirebase,
    signOut: signOutUser,
  };
};