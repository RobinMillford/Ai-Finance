'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertCircle, Home, RotateCcw } from "lucide-react";
import Link from "next/link";
import { Suspense } from 'react';

function AuthErrorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const errorMessages: Record<string, string> = {
    'Configuration': 'There is a problem with the server configuration.',
    'AccessDenied': 'You do not have permission to sign in.',
    'Verification': 'The token has expired or has already been used.',
    'Default': 'An unknown error occurred during authentication.'
  };

  const errorMessage = error ? errorMessages[error] || errorMessages['Default'] : errorMessages['Default'];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-background/90"></div>
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
          <div className="absolute -top-40 -left-40 w-80 h-80 rounded-full bg-primary/10 blur-3xl"></div>
          <div className="absolute top-20 right-20 w-60 h-60 rounded-full bg-primary/10 blur-3xl"></div>
          <div className="absolute bottom-20 left-1/3 w-40 h-40 rounded-full bg-primary/10 blur-3xl"></div>
        </div>
      </div>

      <div className="w-full max-w-md">
        <Card className="p-6 bg-card/50 backdrop-blur-sm border border-primary/10 shadow-xl">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
              <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            
            <h1 className="text-2xl font-bold mb-2">Authentication Error</h1>
            <p className="text-muted-foreground mb-6">
              {errorMessage}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button 
                onClick={() => router.push('/auth/signin')}
                className="flex items-center justify-center"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => router.push('/')}
                className="flex items-center justify-center border-primary/20 hover:bg-primary/10"
              >
                <Home className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>}>
      <AuthErrorContent />
    </Suspense>
  );
}