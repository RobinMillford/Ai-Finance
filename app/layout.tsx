import './globals.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CommandPalette } from "@/components/CommandPalette";
import AuthContext from '@/contexts/AuthContext';

export const metadata: Metadata = {
  title: 'Finance Markets Analysis',
  description: 'Real-time stock, forex and crypto markets analysis with news and AI-powered insights',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
    other: [
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '192x192',
        url: '/favicon.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '512x512',
        url: '/favicon.png',
      },
    ],
  },
  manifest: '/manifest.json',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#ffffff',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read the nonce injected by middleware so ThemeProvider's blocking
  // inline script is covered by the per-request CSP nonce.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ErrorBoundary>
          <AuthContext>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
              nonce={nonce}
            >
              <div className="fixed bottom-4 left-4 z-50">
                <ThemeToggle />
              </div>
              {children}
              <Toaster />
              <CommandPalette />
            </ThemeProvider>
          </AuthContext>
        </ErrorBoundary>
      </body>
    </html>
  );
}