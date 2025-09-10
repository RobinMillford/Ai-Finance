"use client";

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { BarChart3, ChevronLeft, Github, Globe } from "lucide-react";
import Link from "next/link";

export default function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState('');
  const router = useRouter();

  // Validate email format
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Validate password strength
  const validatePassword = (password: string) => {
    const minLength = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[@$!%*?&]/.test(password);

    if (!minLength) return 'Password must be at least 8 characters long';
    if (!hasUpper) return 'Password must contain at least one uppercase letter';
    if (!hasLower) return 'Password must contain at least one lowercase letter';
    if (!hasNumber) return 'Password must contain at least one number';
    if (!hasSpecial) return 'Password must contain at least one special character (@$!%*?&)';

    return '';
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    const validationError = validatePassword(value);
    setPasswordStrength(validationError);
  };

  async function onSubmit(event: React.SyntheticEvent) {
    event.preventDefault();
    
    // Validate email
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    // Validate password
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setIsLoading(true);
    setError('');

    try {
      // Call API to create user
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      // Sign in the user after successful signup
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        throw new Error('Failed to sign in after signup');
      }

      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }

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
          <h1 className="text-2xl font-bold">Create an account</h1>
          <p className="text-muted-foreground">Sign up to get started with FinanceAI</p>
        </div>

        <Card className="p-6 bg-card/50 backdrop-blur-sm border border-primary/10 shadow-xl">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                type="text"
                autoCapitalize="words"
                autoComplete="name"
                autoCorrect="off"
                disabled={isLoading}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-background/50 border-primary/20"
                required
              />
            </div>
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
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                placeholder="••••••••"
                type="password"
                autoCapitalize="none"
                autoComplete="new-password"
                autoCorrect="off"
                disabled={isLoading}
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                className="bg-background/50 border-primary/20"
                required
              />
              {password && (
                <p className={`text-sm ${passwordStrength ? 'text-red-500' : 'text-green-500'}`}>
                  {passwordStrength || 'Password strength: Good'}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                placeholder="••••••••"
                type="password"
                autoCapitalize="none"
                autoComplete="new-password"
                autoCorrect="off"
                disabled={isLoading}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-background/50 border-primary/20"
                required
              />
            </div>
            {error && (
              <div className="text-sm text-red-500">{error}</div>
            )}
            <Button 
              disabled={isLoading} 
              className="w-full bg-primary hover:bg-primary/90 relative group"
            >
              {isLoading && (
                <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              )}
              <span className="relative z-10">
                {isLoading ? "Creating account..." : "Sign Up"}
              </span>
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <Link href="/auth/signin" className="text-primary hover:underline">
              Already have an account? Sign in
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