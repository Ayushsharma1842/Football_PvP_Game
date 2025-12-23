import { signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/config/firebase';

/**
 * Sign in anonymously - creates a persistent anonymous user
 */
export async function signInAnonymous(): Promise<User> {
  const result = await signInAnonymously(auth);
  return result.user;
}

/**
 * Get current user (null if not signed in)
 */
export function getCurrentUser(): User | null {
  return auth.currentUser;
}

/**
 * Subscribe to auth state changes
 */
export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

/**
 * Get user ID (signs in anonymously if needed)
 */
export async function getUserId(): Promise<string> {
  if (auth.currentUser) {
    return auth.currentUser.uid;
  }
  const user = await signInAnonymous();
  return user.uid;
}

