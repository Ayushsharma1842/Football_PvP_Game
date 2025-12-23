import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { onAuthChange, signInAnonymous } from '@/lib/auth';

interface UseAuthReturn {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  userId: string | null;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = onAuthChange(async (authUser) => {
      if (authUser) {
        setUser(authUser);
        setIsLoading(false);
      } else {
        // No user - sign in anonymously
        try {
          const newUser = await signInAnonymous();
          setUser(newUser);
        } catch (error) {
          console.error('Failed to sign in anonymously:', error);
        }
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    userId: user?.uid || null,
  };
}

