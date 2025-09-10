'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useState, useEffect } from 'react';

export default function TestAuthPage() {
  const { data: session, status } = useSession();
  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    if (session) {
      setDebugInfo({
        session: session,
        status: status
      });
    }
  }, [session, status]);

  const handleGoogleSignIn = async () => {
    console.log('Attempting Google sign in');
    const result = await signIn('google', { 
      callbackUrl: '/test-auth',
      redirect: true
    });
    console.log('Google sign in result:', result);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Card className="p-6 bg-card/50 backdrop-blur-sm border border-primary/10 shadow-xl">
          <h1 className="text-2xl font-bold mb-6 text-center">Authentication Test Page</h1>
          
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={handleGoogleSignIn}>
                Sign in with Google
              </Button>
              <Button onClick={() => signIn('github', { callbackUrl: '/test-auth' })}>
                Sign in with GitHub
              </Button>
              <Button onClick={() => signOut()}>
                Sign Out
              </Button>
            </div>
            
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4">Authentication Status</h2>
              <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm">
                {JSON.stringify({ session, status }, null, 2)}
              </pre>
            </div>
            
            {debugInfo && (
              <div className="mt-8">
                <h2 className="text-xl font-semibold mb-4">Debug Information</h2>
                <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}