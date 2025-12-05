"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
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
  TrendingUp,
  TrendingDown,
  Loader2,
  DollarSign,
  Percent,
  BarChart3,
} from "lucide-react";
import { motion } from "framer-motion";
import { SymbolSearch } from "@/components/SymbolSearch";
import { ExportButton } from "@/components/ExportButton";
import { exportPortfolioToCSV, exportPortfolioToPDF } from "@/lib/export-utils";

interface Holding {
  symbol: string;
  assetType: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate: string;
  notes?: string;
}

interface Portfolio {
  _id: string;
  name: string;
  description?: string;
  holdings: Holding[];
  createdAt: string;
  updatedAt: string;
}

export default function PortfolioDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  // Add holding form
  const [symbol, setSymbol] = useState("");
  const [assetType, setAssetType] = useState("stock");
  const [quantity, setQuantity] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (status === "authenticated" && params.id) {
      fetchPortfolio();
    }
  }, [status, params.id, router]);

  const fetchPortfolio = async () => {
    try {
      const res = await fetch(`/api/portfolio/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setPortfolio(data);
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch portfolio",
          variant: "destructive",
        });
        router.push("/portfolio");
      }
    } catch (error) {
      console.error("Error fetching portfolio:", error);
    } finally {
      setLoading(false);
    }
  };

  const addHolding = async () => {
    if (!symbol || !quantity || !purchasePrice) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setAdding(true);
    try {
      const res = await fetch(`/api/portfolio/${params.id}/holdings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: symbol.toUpperCase(),
          assetType,
          quantity: Number(quantity),
          purchasePrice: Number(purchasePrice),
          purchaseDate: new Date().toISOString(),
          notes,
        }),
      });

      if (res.ok) {
        const updatedPortfolio = await res.json();
        setPortfolio(updatedPortfolio);
        setIsAddDialogOpen(false);
        resetForm();
        toast({
          title: "Success",
          description: "Holding added successfully",
        });
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.error || "Failed to add holding",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error adding holding:", error);
      toast({
        title: "Error",
        description: "Failed to add holding",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const deleteHolding = async (index: number) => {
    if (!confirm("Are you sure you want to delete this holding?")) return;

    try {
      const res = await fetch(
        `/api/portfolio/${params.id}/holdings?index=${index}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        const updatedPortfolio = await res.json();
        setPortfolio(updatedPortfolio);
        toast({
          title: "Success",
          description: "Holding deleted successfully",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to delete holding",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting holding:", error);
    }
  };

  const resetForm = () => {
    setSymbol("");
    setAssetType("stock");
    setQuantity("");
    setPurchasePrice("");
    setNotes("");
  };

  const calculateTotals = () => {
    if (!portfolio) return { totalValue: 0, totalCost: 0, totalPL: 0, totalPLPercent: 0 };

    const totalCost = portfolio.holdings.reduce(
      (sum: number, h: Holding) => sum + h.quantity * h.purchasePrice,
      0
    );

    // For now, use purchase price as current price
    // In next iteration, we'll fetch live prices
    const totalValue = totalCost;
    const totalPL = totalValue - totalCost;
    const totalPLPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;

    return { totalValue, totalCost, totalPL, totalPLPercent };
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!portfolio) {
    return null;
  }

  const { totalValue, totalCost, totalPL, totalPLPercent } = calculateTotals();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-6">
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
                  <DollarSign className="w-6 h-6 text-primary" />
                </div>
              )}
              <div>
                <p className="font-semibold">{session?.user?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {session?.user?.email}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() => router.push("/portfolio")}
              size="sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              All Portfolios
            </Button>
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
              <h1 className="text-4xl font-bold">{portfolio.name}</h1>
              {portfolio.description && (
                <p className="text-muted-foreground mt-2">
                  {portfolio.description}
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-1">
                Created {new Date(portfolio.createdAt).toLocaleDateString()} •
                Last updated {new Date(portfolio.updatedAt).toLocaleDateString()}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="lg"
                onClick={() => router.push(`/portfolio/${params.id}/analytics`)}
              >
                <BarChart3 className="w-5 h-5 mr-2" />
                Analytics
              </Button>
              <ExportButton
                onExportCSV={() => exportPortfolioToCSV(portfolio, portfolio.holdings)}
                onExportPDF={() => exportPortfolioToPDF(portfolio, portfolio.holdings)}
              />
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="gap-2">
                  <Plus className="w-5 h-5" />
                  Add Holding
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Holding</DialogTitle>
                  <DialogDescription>
                    Add a new asset to your portfolio
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Search Symbol
                    </label>
                    <SymbolSearch
                      value={symbol}
                      onChange={setSymbol}
                      onSelect={(asset) => {
                        setSymbol(asset.symbol);
                        setAssetType(asset.type);
                      }}
                      placeholder="Search for stocks, crypto..."
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Start typing to search for assets
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Asset Type</label>
                      <select
                        className="w-full h-10 px-3 rounded-md border border-input bg-background"
                        value={assetType}
                        onChange={(e) => setAssetType(e.target.value)}
                      >
                        <option value="stock">Stock</option>
                        <option value="crypto">Crypto</option>
                        <option value="forex">Forex</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Symbol</label>
                      <Input
                        value={symbol}
                        onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                        placeholder="Or type manually"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Quantity</label>
                      <Input
                        type="number"
                        placeholder="10"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        Purchase Price
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="150.50"
                        value={purchasePrice}
                        onChange={(e) => setPurchasePrice(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">
                      Notes (Optional)
                    </label>
                    <Input
                      placeholder="Add notes..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={addHolding} disabled={adding}>
                    {adding ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Holding"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </div>
          </div>
        </motion.div>

        {/* Portfolio Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">
                  ${totalValue.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <DollarSign className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Cost</p>
                <p className="text-2xl font-bold">
                  ${totalCost.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${totalPL >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                {totalPL >= 0 ? (
                  <TrendingUp className="w-6 h-6 text-green-500" />
                ) : (
                  <TrendingDown className="w-6 h-6 text-red-500" />
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total P&L</p>
                <p className={`text-2xl font-bold ${totalPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  ${Math.abs(totalPL).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${totalPLPercent >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                <Percent className={`w-6 h-6 ${totalPLPercent >= 0 ? 'text-green-500' : 'text-red-500'}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Return %</p>
                <p className={`text-2xl font-bold ${totalPLPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {totalPLPercent.toFixed(2)}%
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Holdings Table */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-6">Holdings</h2>
          {portfolio.holdings.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                No holdings yet. Add your first holding to get started.
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Holding
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Purchase Price</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead>Purchase Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {portfolio.holdings.map((holding, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-bold">{holding.symbol}</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 bg-muted rounded text-xs">
                        {holding.assetType}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{holding.quantity}</TableCell>
                    <TableCell className="text-right">
                      ${holding.purchasePrice.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      ${(holding.quantity * holding.purchasePrice).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {new Date(holding.purchaseDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteHolding(index)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
