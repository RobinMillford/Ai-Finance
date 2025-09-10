"use client";

import { useAuth } from '@/hooks/useAuth';
import { useUserAssets } from '@/hooks/useUserAssets';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BarChart3, ChevronLeft, LogOut, Plus, Trash } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function DashboardPage() {
  const { session, signOut } = useAuth();
  const { watchlist, trackedAssets, addToWatchlist, removeFromWatchlist } = useUserAssets();
  const [newSymbol, setNewSymbol] = useState('');

  const handleAddToWatchlist = () => {
    if (newSymbol.trim()) {
      addToWatchlist(newSymbol.trim().toUpperCase());
      setNewSymbol('');
    }
  };

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
              <Link href="/profile">
                <Button variant="outline" className="border-primary/20 hover:bg-primary/10">
                  Profile
                </Button>
              </Link>
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

      <main className="relative z-10 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Welcome back, {session?.user?.name}!</h1>
            <p className="text-muted-foreground">Manage your watchlist and tracked assets</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Watchlist Section */}
            <Card className="p-6 bg-card/50 backdrop-blur-sm border border-primary/10 shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Your Watchlist</h2>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add symbol (e.g. AAPL)"
                    value={newSymbol}
                    onChange={(e) => setNewSymbol(e.target.value)}
                    className="px-3 py-2 text-sm bg-background/50 border border-primary/20 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Button 
                    onClick={handleAddToWatchlist}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {watchlist.length > 0 ? (
                <div className="space-y-3">
                  {watchlist.map((symbol) => (
                    <div 
                      key={symbol} 
                      className="flex justify-between items-center p-4 rounded-lg bg-background/50 border border-primary/10"
                    >
                      <span className="font-medium">{symbol}</span>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => removeFromWatchlist(symbol)}
                        className="border-primary/20 hover:bg-primary/10"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Your watchlist is empty</p>
                  <p className="text-sm mt-2">Add symbols to track your favorite assets</p>
                </div>
              )}
            </Card>

            {/* Tracked Assets Section */}
            <Card className="p-6 bg-card/50 backdrop-blur-sm border border-primary/10 shadow-xl">
              <h2 className="text-2xl font-bold mb-6">Tracked Assets</h2>
              
              {trackedAssets.length > 0 ? (
                <div className="space-y-3">
                  {trackedAssets.map((asset) => (
                    <div 
                      key={`${asset.type}-${asset.symbol}`} 
                      className="flex justify-between items-center p-4 rounded-lg bg-background/50 border border-primary/10"
                    >
                      <div>
                        <div className="font-medium">{asset.symbol}</div>
                        <div className="text-sm text-muted-foreground capitalize">{asset.type}</div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="border-primary/20 hover:bg-primary/10"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>You haven't tracked any assets yet</p>
                  <p className="text-sm mt-2">Track stocks, crypto, or forex pairs for detailed analysis</p>
                </div>
              )}
            </Card>
          </div>

          <div className="mt-8 text-center">
            <Link href="/">
              <Button variant="outline" className="border-primary/20 hover:bg-primary/10">
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}