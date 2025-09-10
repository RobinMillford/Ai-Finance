import { useSession, signIn, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';

export function useAuth() {
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status !== 'loading') {
      setIsLoading(false);
    }
  }, [status]);

  const isAuthenticated = status === 'authenticated';
  const isUnauthenticated = status === 'unauthenticated';

  return {
    session,
    isAuthenticated,
    isUnauthenticated,
    isLoading,
    signIn,
    signOut,
  };
}