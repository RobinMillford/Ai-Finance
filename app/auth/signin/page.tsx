"use client";

import { useState, useEffect, Suspense } from 'react';
import { signIn, getCsrfToken } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { BarChart3, ChevronLeft, Github, Globe, Twitter, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function SignInContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check for error in URL parameters
  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      setError('Authentication failed. Please try again.');
    }
    
    // Get CSRF token for credentials provider
    const fetchCsrfToken = async () => {
      const token = await getCsrfToken();
      setCsrfToken(token || null);
    };
    
    fetchCsrfToken();
  }, [searchParams]);

  async function onSubmit(event: React.SyntheticEvent) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setIsLoading(false);
    
    if (result?.error) {
      setError(result.error === 'CredentialsSignIn' 
        ? 'Invalid email or password' 
        : result.error);
    } else {
      // Redirect to home or callback URL
      const callbackUrl = searchParams.get('callbackUrl') || '/';
      router.push(callbackUrl);
    }
  }

  const handleOAuthSignIn = async (provider: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await signIn(provider, {
        callbackUrl: searchParams.get('callbackUrl') || '/',
        redirect: true
      });
      
      if (result?.error) {
        setError('Authentication failed. Please try again.');
        setIsLoading(false);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

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
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2 mb-4">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary to-primary/50 rounded-full blur opacity-30"></div>
              <BarChart3 className="h-8 w-8 text-primary relative z-10" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">FinanceAI</span>
          </Link>
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-muted-foreground">Sign in to your account to continue</p>
        </div>

        <Card className="p-6 bg-card/50 backdrop-blur-sm border border-primary/10 shadow-xl">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-4">
            <Button 
              variant="outline" 
              className="w-full border-primary/20 hover:bg-primary/10"
              onClick={() => handleOAuthSignIn('google')}
              disabled={isLoading}
            >
              <Globe className="mr-2 h-4 w-4" />
              Continue with Google
            </Button>
            <Button 
              variant="outline" 
              className="w-full border-primary/20 hover:bg-primary/10"
              onClick={() => handleOAuthSignIn('github')}
              disabled={isLoading}
            >
              <Github className="mr-2 h-4 w-4" />
              Continue with GitHub
            </Button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/20"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <input name="csrfToken" type="hidden" defaultValue={csrfToken || ''} />
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                placeholder="name@example.com"
                type="email"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect="off"
                disabled={isLoading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-background/50 border-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                placeholder="••••••••"
                type="password"
                autoCapitalize="none"
                autoComplete="current-password"
                autoCorrect="off"
                disabled={isLoading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-background/50 border-primary/20"
              />
            </div>
            <Button 
              disabled={isLoading} 
              className="w-full bg-primary hover:bg-primary/90 relative group"
            >
              {isLoading && (
                <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              )}
              <span className="relative z-10">
                {isLoading ? "Signing in..." : "Sign In"}
              </span>
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <Link href="/auth/signup" className="text-primary hover:underline">
              Don't have an account? Sign up
            </Link>
          </div>
        </Card>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/" className="inline-flex items-center hover:text-primary">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>}>
      <SignInContent />
    </Suspense>
  );
}