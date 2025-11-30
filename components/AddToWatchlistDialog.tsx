"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Star } from "lucide-react";

interface AddToWatchlistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: {
    symbol: string;
    name: string;
    type: "stock" | "crypto" | "forex";
  };
}

interface Watchlist {
  _id: string;
  name: string;
  assets: Array<{
    symbol: string;
    assetType: string;
  }>;
}

export function AddToWatchlistDialog({
  open,
  onOpenChange,
  asset,
}: AddToWatchlistDialogProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [alertPrice, setAlertPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingWatchlists, setFetchingWatchlists] = useState(false);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newWatchlistName, setNewWatchlistName] = useState("");

  // Fetch watchlists when dialog opens
  useEffect(() => {
    if (open && status === "authenticated") {
      fetchWatchlists();
    }
  }, [open, status]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setNotes("");
      setAlertPrice("");
      setShowCreateNew(false);
      setNewWatchlistName("");
    }
  }, [open]);

  const fetchWatchlists = async () => {
    setFetchingWatchlists(true);
    try {
      const response = await fetch("/api/watchlist");
      if (response.ok) {
        const data = await response.json();
        setWatchlists(data);
        if (data.length > 0) {
          setSelectedWatchlistId(data[0]._id);
        }
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch watchlists",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching watchlists:", error);
      toast({
        title: "Error",
        description: "Failed to fetch watchlists",
        variant: "destructive",
      });
    } finally {
      setFetchingWatchlists(false);
    }
  };

  const createWatchlist = async () => {
    if (!newWatchlistName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a watchlist name",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newWatchlistName.trim() }),
      });

      if (response.ok) {
        const newWatchlist = await response.json();
        setWatchlists([...watchlists, newWatchlist]);
        setSelectedWatchlistId(newWatchlist._id);
        setShowCreateNew(false);
        setNewWatchlistName("");
        toast({
          title: "Success",
          description: "Watchlist created successfully",
        });
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to create watchlist",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating watchlist:", error);
      toast({
        title: "Error",
        description: "Failed to create watchlist",
        variant: "destructive",
      });
    }
  };

  const handleAddToWatchlist = async () => {
    if (status !== "authenticated") {
      toast({
        title: "Authentication Required",
        description: "Please sign in to add assets to watchlist",
        variant: "destructive",
      });
      router.push("/");
      return;
    }

    if (!selectedWatchlistId) {
      toast({
        title: "Error",
        description: "Please select a watchlist",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/watchlist/${selectedWatchlistId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol: asset.symbol,
            assetType: asset.type,
            notes: notes.trim() || undefined,
            alertPrice: alertPrice ? parseFloat(alertPrice) : undefined,
          }),
        }
      );

      if (response.ok) {
        toast({
          title: "Success",
          description: `${asset.symbol} added to watchlist`,
        });
        onOpenChange(false);
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to add to watchlist",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error adding to watchlist:", error);
      toast({
        title: "Error",
        description: "Failed to add to watchlist",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (status === "unauthenticated") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign In Required</DialogTitle>
            <DialogDescription>
              Please sign in to add assets to your watchlist.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => router.push("/")}>Go to Sign In</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Add to Watchlist
          </DialogTitle>
          <DialogDescription>
            Add {asset.name} ({asset.symbol}) to your watchlist
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {fetchingWatchlists ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : watchlists.length === 0 && !showCreateNew ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-4">
                You don't have any watchlists yet.
              </p>
              <Button onClick={() => setShowCreateNew(true)}>
                Create Your First Watchlist
              </Button>
            </div>
          ) : showCreateNew ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="new-watchlist-name">Watchlist Name</Label>
                <Input
                  id="new-watchlist-name"
                  placeholder="e.g., Tech Stocks, Crypto Watch"
                  value={newWatchlistName}
                  onChange={(e) => setNewWatchlistName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      createWatchlist();
                    }
                  }}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={createWatchlist} className="flex-1">
                  Create Watchlist
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateNew(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="watchlist">Select Watchlist</Label>
                <div className="flex gap-2">
                  <select
                    id="watchlist"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={selectedWatchlistId}
                    onChange={(e) => setSelectedWatchlistId(e.target.value)}
                  >
                    {watchlists.map((watchlist) => (
                      <option key={watchlist._id} value={watchlist._id}>
                        {watchlist.name} ({watchlist.assets.length} assets)
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowCreateNew(true)}
                    title="Create new watchlist"
                  >
                    +
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Input
                  id="notes"
                  placeholder="e.g., Monitoring for entry point"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="alert-price">Alert Price (Optional)</Label>
                <Input
                  id="alert-price"
                  type="number"
                  step="0.01"
                  placeholder="e.g., 150.00"
                  value={alertPrice}
                  onChange={(e) => setAlertPrice(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Get notified when price reaches this level (future feature)
                </p>
              </div>
            </>
          )}
        </div>

        {!showCreateNew && watchlists.length > 0 && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleAddToWatchlist} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Star className="h-4 w-4 mr-2" />
                  Add to Watchlist
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
