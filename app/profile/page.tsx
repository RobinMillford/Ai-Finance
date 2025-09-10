"use client";

import { useSession } from 'next-auth/react';
import { useUserAssets } from '@/hooks/useUserAssets';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, LogOut, Plus, Trash, Settings, Eye, User, Bell } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProfileSettings from './settings';
import PortfolioTracking from './portfolio';
import NotificationPreferences from './notifications';

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const { watchlist, trackedAssets } = useUserAssets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is authenticated
    if (status !== 'loading') {
      if (status === 'unauthenticated') {
        // Redirect to sign in if not authenticated
        router.push('/auth/signin');
      } else {
        // User is authenticated, stop loading
        setLoading(false);
      }
    }
  }, [status, router]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-4 text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  // If user is not authenticated, don't render the profile page
  if (status === 'unauthenticated') {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-background/90"></div>
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
          <div className="absolute -top-40 -left-40 w-80 h-80 rounded-full bg-primary/10 blur-3xl"></div>
          <div className="absolute top-20 right-20 w-60 h-60 rounded-full bg-primary/10 blur-3xl"></div>
          <div className="absolute bottom-20 left-1/3 w-40 h-40 rounded-full bg-primary/10 blur-3xl"></div>
        </div>
      </div>

      <header className="relative z-10 border-b border-border/20 bg-background/50 backdrop-blur-md">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-primary/50 rounded-full blur opacity-30"></div>
                <BarChart3 className="h-8 w-8 text-primary relative z-10" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">FinanceAI</span>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                onClick={() => signOut()} 
                variant="outline" 
                className="border-primary/20 hover:bg-primary/10"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">User Profile</h1>
            <p className="text-muted-foreground">Manage your account settings and portfolio</p>
          </div>

          <Tabs defaultValue="dashboard" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="portfolio" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Portfolio
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Notifications
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Profile Information */}
                <Card className="p-6 bg-card/50 backdrop-blur-sm border border-primary/10 shadow-xl">
                  <CardHeader>
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>Your account details</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center space-x-4 mb-6">
                      {session.user?.image ? (
                        <img 
                          src={session.user.image} 
                          alt={session.user.name || ''} 
                          className="w-16 h-16 rounded-full"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-8 w-8 text-primary" />
                        </div>
                      )}
                      <div>
                        <h3 className="text-xl font-semibold">{session.user?.name}</h3>
                        <p className="text-muted-foreground">{session.user?.email}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Member since</span>
                        <span>{new Date().toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Assets tracked</span>
                        <span>{trackedAssets.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Items in watchlist</span>
                        <span>{watchlist.length}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Stats */}
                <Card className="p-6 bg-card/50 backdrop-blur-sm border border-primary/10 shadow-xl">
                  <CardHeader>
                    <CardTitle>Quick Stats</CardTitle>
                    <CardDescription>Your portfolio overview</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-primary/5 rounded-lg">
                        <div className="text-2xl font-bold">{watchlist.length}</div>
                        <div className="text-sm text-muted-foreground">Watchlist Items</div>
                      </div>
                      <div className="p-4 bg-primary/5 rounded-lg">
                        <div className="text-2xl font-bold">{trackedAssets.length}</div>
                        <div className="text-sm text-muted-foreground">Tracked Assets</div>
                      </div>
                      <div className="p-4 bg-primary/5 rounded-lg">
                        <div className="text-2xl font-bold">0</div>
                        <div className="text-sm text-muted-foreground">Alerts Active</div>
                      </div>
                      <div className="p-4 bg-primary/5 rounded-lg">
                        <div className="text-2xl font-bold">0</div>
                        <div className="text-sm text-muted-foreground">Portfolio Value</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Activity */}
                <Card className="p-6 bg-card/50 backdrop-blur-sm border border-primary/10 shadow-xl lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>Your latest actions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No recent activity</p>
                      <p className="text-sm mt-2">Your recent actions will appear here</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="portfolio" className="mt-6">
              <PortfolioTracking />
            </TabsContent>

            <TabsContent value="settings" className="mt-6">
              <ProfileSettings />
            </TabsContent>

            <TabsContent value="notifications" className="mt-6">
              <Card className="p-6 bg-card/50 backdrop-blur-sm border border-primary/10 shadow-xl">
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                  <CardDescription>Manage how you receive alerts and updates</CardDescription>
                </CardHeader>
                <CardContent>
                  <NotificationPreferences />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="mt-8 text-center">
            <Link href="/">
              <Button variant="outline" className="border-primary/20 hover:bg-primary/10">
                <Eye className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}