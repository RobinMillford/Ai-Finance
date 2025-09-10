"use client";

import { useUserAssets } from '@/hooks/useUserAssets';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash } from "lucide-react";
import { useState } from "react";

interface TrackedAsset {
  type: 'stock' | 'crypto' | 'forex';
  symbol: string;
  addedAt: Date;
}

export default function PortfolioTracking() {
  const { watchlist, trackedAssets, addToWatchlist, removeFromWatchlist, addTrackedAsset, removeTrackedAsset } = useUserAssets();
  const [newSymbol, setNewSymbol] = useState('');
  const [assetType, setAssetType] = useState<'stock' | 'crypto' | 'forex'>('stock');

  const handleAddToWatchlist = () => {
    if (newSymbol.trim()) {
      addToWatchlist(newSymbol.trim().toUpperCase());
      setNewSymbol('');
    }
  };

  const handleAddTrackedAsset = () => {
    if (newSymbol.trim()) {
      addTrackedAsset({
        type: assetType,
        symbol: newSymbol.trim().toUpperCase(),
        addedAt: new Date()
      });
      setNewSymbol('');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Watchlist Section */}
      <Card className="p-6 bg-card/50 backdrop-blur-sm border border-primary/10 shadow-xl">
        <CardHeader>
          <CardTitle>Watchlist</CardTitle>
          <CardDescription>Track your favorite assets</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-6">
            <Input
              type="text"
              placeholder="Add symbol (e.g. AAPL)"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              className="bg-background/50 border-primary/20"
            />
            <Button 
              onClick={handleAddToWatchlist}
              className="bg-primary hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
            </Button>
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
        </CardContent>
      </Card>

      {/* Tracked Assets Section */}
      <Card className="p-6 bg-card/50 backdrop-blur-sm border border-primary/10 shadow-xl">
        <CardHeader>
          <CardTitle>Tracked Assets</CardTitle>
          <CardDescription>Assets with detailed tracking and analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Input
                  type="text"
                  placeholder="Add symbol (e.g. BTCUSD)"
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value)}
                  className="bg-background/50 border-primary/20"
                />
              </div>
              <Select value={assetType} onValueChange={(value: 'stock' | 'crypto' | 'forex') => setAssetType(value)}>
                <SelectTrigger className="bg-background/50 border-primary/20">
                  <SelectValue placeholder="Asset type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock">Stock</SelectItem>
                  <SelectItem value="crypto">Crypto</SelectItem>
                  <SelectItem value="forex">Forex</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleAddTrackedAsset}
              className="w-full bg-primary hover:bg-primary/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Tracked Asset
            </Button>
          </div>
          
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
                    onClick={() => removeTrackedAsset(asset.symbol)}
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
        </CardContent>
      </Card>
    </div>
  );
}