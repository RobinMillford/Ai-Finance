import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

interface TrackedAsset {
  type: 'stock' | 'crypto' | 'forex';
  symbol: string;
  addedAt: Date;
}

export function useUserAssets() {
  const { session, isAuthenticated } = useAuth();
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [trackedAssets, setTrackedAssets] = useState<TrackedAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated && session?.user) {
      fetchUserAssets();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, session]);

  const fetchUserAssets = async () => {
    try {
      // Fetch watchlist
      const watchlistResponse = await fetch('/api/user/watchlist');
      if (watchlistResponse.ok) {
        const watchlistData = await watchlistResponse.json();
        setWatchlist(watchlistData.watchlist);
      }
      
      // Fetch tracked assets
      const trackedAssetsResponse = await fetch('/api/user/tracked-assets');
      if (trackedAssetsResponse.ok) {
        const trackedAssetsData = await trackedAssetsResponse.json();
        setTrackedAssets(trackedAssetsData.trackedAssets);
      }
    } catch (error) {
      console.error('Error fetching user assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToWatchlist = async (symbol: string) => {
    if (!isAuthenticated) return;
    
    try {
      // Add to local state immediately for better UX
      setWatchlist(prev => [...prev, symbol]);
      
      // Call API to persist this
      const response = await fetch('/api/user/watchlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ symbol }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to add to watchlist');
      }
    } catch (error) {
      // Rollback on error
      setWatchlist(prev => prev.filter(item => item !== symbol));
      console.error('Error adding to watchlist:', error);
    }
  };

  const removeFromWatchlist = async (symbol: string) => {
    if (!isAuthenticated) return;
    
    try {
      // Update local state immediately for better UX
      setWatchlist(prev => prev.filter(item => item !== symbol));
      
      // Call API to persist this
      const response = await fetch(`/api/user/watchlist?symbol=${symbol}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to remove from watchlist');
      }
    } catch (error) {
      // Rollback on error
      setWatchlist(prev => [...prev, symbol]);
      console.error('Error removing from watchlist:', error);
    }
  };

  const addTrackedAsset = async (asset: TrackedAsset) => {
    if (!isAuthenticated) return;
    
    try {
      // Add to local state immediately for better UX
      setTrackedAssets(prev => [...prev, asset]);
      
      // Call API to persist this
      const response = await fetch('/api/user/tracked-assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(asset),
      });
      
      if (!response.ok) {
        throw new Error('Failed to add tracked asset');
      }
    } catch (error) {
      // Rollback on error
      setTrackedAssets(prev => prev.filter(item => item.symbol !== asset.symbol));
      console.error('Error adding tracked asset:', error);
    }
  };

  const removeTrackedAsset = async (symbol: string) => {
    if (!isAuthenticated) return;
    
    try {
      // Update local state immediately for better UX
      setTrackedAssets(prev => prev.filter(item => item.symbol !== symbol));
      
      // Call API to persist this
      const response = await fetch(`/api/user/tracked-assets?symbol=${symbol}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to remove tracked asset');
      }
    } catch (error) {
      // Rollback on error
      const asset = trackedAssets.find(item => item.symbol === symbol);
      if (asset) {
        setTrackedAssets(prev => [...prev, asset]);
      }
      console.error('Error removing tracked asset:', error);
    }
  };

  return {
    watchlist,
    trackedAssets,
    loading,
    addToWatchlist,
    removeFromWatchlist,
    addTrackedAsset,
    removeTrackedAsset,
  };
}