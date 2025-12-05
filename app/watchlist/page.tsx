"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  Star,
  Eye,
  TrendingUp,
  Edit2,
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ExportButton } from "@/components/ExportButton";
import { exportWatchlistToCSV, exportWatchlistToPDF } from "@/lib/export-utils";

interface WatchlistAsset {
  symbol: string;
  assetType: "stock" | "crypto" | "forex";
  addedAt: string;
  notes?: string;
  alertPrice?: number;
}

interface Watchlist {
  _id: string;
  name: string;
  assets: WatchlistAsset[];
  createdAt: string;
  updatedAt: string;
}

export default function WatchlistPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newWatchlistName, setNewWatchlistName] = useState("");
  const [creating, setCreating] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editWatchlistName, setEditWatchlistName] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [watchlistToDelete, setWatchlistToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (status === "authenticated") {
      fetchWatchlists();
    }
  }, [status, router]);

  const fetchWatchlists = async () => {
    try {
      const res = await fetch("/api/watchlist");
      if (res.ok) {
        const data = await res.json();
        setWatchlists(data);
        if (data.length > 0 && !selectedWatchlistId) {
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
    } finally {
      setLoading(false);
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

    setCreating(true);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newWatchlistName.trim() }),
      });

      if (res.ok) {
        const newWatchlist = await res.json();
        setWatchlists([...watchlists, newWatchlist]);
        setSelectedWatchlistId(newWatchlist._id);
        setIsCreateDialogOpen(false);
        setNewWatchlistName("");
        toast({
          title: "Success",
          description: "Watchlist created successfully",
        });
      } else {
        const error = await res.json();
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
    } finally {
      setCreating(false);
    }
  };

  const removeAsset = async (watchlistId: string, symbol: string) => {
    if (!confirm(`Are you sure you want to remove ${symbol} from your watchlist?`))
      return;

    try {
      const res = await fetch(
        `/api/watchlist/${watchlistId}/assets/${symbol}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        // Refresh watchlists to get updated data
        fetchWatchlists();
        toast({
          title: "Success",
          description: `${symbol} removed from watchlist`,
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to remove asset",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error removing asset:", error);
      toast({
        title: "Error",
        description: "Failed to remove asset",
        variant: "destructive",
      });
    }
  };

  const editWatchlist = async () => {
    if (!editWatchlistName.trim() || !selectedWatchlistId) return;

    try {
      const res = await fetch(`/api/watchlist/${selectedWatchlistId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editWatchlistName.trim() }),
      });

      if (res.ok) {
        const updated = await res.json();
        setWatchlists(watchlists.map((w) => (w._id === updated._id ? updated : w)));
        setIsEditDialogOpen(false);
        toast({
          title: "Success",
          description: "Watchlist name updated",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to update watchlist",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating watchlist:", error);
      toast({
        title: "Error",
        description: "Failed to update watchlist",
        variant: "destructive",
      });
    }
  };

  const deleteWatchlist = async () => {
    if (!watchlistToDelete) return;

    try {
      const res = await fetch(`/api/watchlist/${watchlistToDelete}`, {
        method: "DELETE",
      });

      if (res.ok) {
        const remaining = watchlists.filter((w) => w._id !== watchlistToDelete);
        setWatchlists(remaining);
        if (selectedWatchlistId === watchlistToDelete) {
          setSelectedWatchlistId(remaining.length > 0 ? remaining[0]._id : "");
        }
        setIsDeleteDialogOpen(false);
        setWatchlistToDelete(null);
        toast({
          title: "Success",
          description: "Watchlist deleted",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to delete watchlist",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting watchlist:", error);
      toast({
        title: "Error",
        description: "Failed to delete watchlist",
        variant: "destructive",
      });
    }
  };

  const getAssetTypeBadge = (type: string) => {
    const badges = {
      stock: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
      forex: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
      crypto: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100",
    };
    return badges[type as keyof typeof badges] || badges.stock;
  };

  const getAssetTypeIcon = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const selectedWatchlist = watchlists.find((w) => w._id === selectedWatchlistId);
  const totalAssets = watchlists.reduce((sum, w) => sum + w.assets.length, 0);
  const assetsByType = watchlists.reduce(
    (acc, w) => {
      w.assets.forEach((asset) => {
        acc[asset.assetType] = (acc[asset.assetType] || 0) + 1;
      });
      return acc;
    },
    {} as Record<string, number>
  );

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-purple-50/20 dark:to-purple-950/20 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* User Info Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card/50 backdrop-blur-sm border rounded-xl p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {session?.user?.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || "User"}
                  className="w-12 h-12 rounded-full border-2 border-primary/20"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                  <Eye className="w-6 h-6 text-primary" />
                </div>
              )}
              <div>
                <p className="font-semibold">{session?.user?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {session?.user?.email}
                </p>
              </div>
            </div>
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold flex items-center gap-3">
                <Star className="h-10 w-10 text-yellow-500" />
                My Watchlists
              </h1>
              <p className="text-muted-foreground mt-2">
                Track and monitor your favorite assets across all markets
              </p>
            </div>

            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="gap-2">
                  <Plus className="w-5 h-5" />
                  Create Watchlist
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Watchlist</DialogTitle>
                  <DialogDescription>
                    Give your watchlist a name to get started
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <label className="text-sm font-medium">Watchlist Name</label>
                    <Input
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
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={createWatchlist} disabled={creating}>
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Watchlist"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </motion.div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/10 rounded-lg">
                <Star className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Assets</p>
                <p className="text-2xl font-bold">{totalAssets}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <TrendingUp className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Stocks</p>
                <p className="text-2xl font-bold">{assetsByType.stock || 0}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Forex</p>
                <p className="text-2xl font-bold">{assetsByType.forex || 0}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-500/10 rounded-lg">
                <TrendingUp className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Crypto</p>
                <p className="text-2xl font-bold">{assetsByType.crypto || 0}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Watchlist Content */}
        <Card className="p-6">
          {watchlists.length === 0 ? (
            <div className="text-center py-12">
              <Star className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">No Watchlists Yet</h2>
              <p className="text-muted-foreground mb-6">
                Create your first watchlist to start tracking assets
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Watchlist
              </Button>
            </div>
          ) : (
            <>
              {/* Watchlist Selector */}
              <div className="mb-6 flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">
                    {watchlists.length > 1 ? "Select Watchlist" : "Current Watchlist"}
                  </label>
                  {watchlists.length > 1 ? (
                    <select
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
                  ) : (
                    <div className="flex h-10 items-center px-3 py-2 border border-input rounded-md bg-muted/50">
                      <span className="font-medium">{selectedWatchlist?.name}</span>
                      <span className="text-sm text-muted-foreground ml-2">
                        ({selectedWatchlist?.assets.length || 0} assets)
                      </span>
                    </div>
                  )}
                </div>
                <ExportButton
                  onExportCSV={() => selectedWatchlist ? exportWatchlistToCSV(selectedWatchlist) : false}
                  onExportPDF={() => selectedWatchlist ? exportWatchlistToPDF(selectedWatchlist) : false}
                  variant="outline"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setEditWatchlistName(selectedWatchlist?.name || "");
                    setIsEditDialogOpen(true);
                  }}
                  disabled={!selectedWatchlist}
                  title="Edit watchlist name"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setWatchlistToDelete(selectedWatchlistId);
                    setIsDeleteDialogOpen(true);
                  }}
                  disabled={!selectedWatchlist}
                  className="text-destructive hover:text-destructive"
                  title="Delete watchlist"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Assets Table */}
              {selectedWatchlist && selectedWatchlist.assets.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Alert Price</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedWatchlist.assets.map((asset, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-bold">{asset.symbol}</TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${getAssetTypeBadge(
                              asset.assetType
                            )}`}
                          >
                            {getAssetTypeIcon(asset.assetType)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {new Date(asset.addedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {asset.notes || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {asset.alertPrice ? `$${asset.alertPrice.toFixed(2)}` : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAsset(selectedWatchlist._id, asset.symbol)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-lg font-medium mb-2">No Assets Yet</p>
                  <p className="text-sm text-muted-foreground">
                    Browse stocks, forex, or crypto pages and click the "Watch" button
                    to add assets
                  </p>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Edit Watchlist Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Watchlist Name</DialogTitle>
              <DialogDescription>
                Update the name of your watchlist
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">Watchlist Name</label>
                <Input
                  value={editWatchlistName}
                  onChange={(e) => setEditWatchlistName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") editWatchlist();
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={editWatchlist}>Update</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Watchlist Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Watchlist?</DialogTitle>
              <DialogDescription>
                This action cannot be undone. This will permanently delete the watchlist and all its assets.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={deleteWatchlist}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
