"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
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
import { Loader2, Plus, Briefcase } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface Portfolio {
  _id: string;
  name: string;
  description?: string;
}

interface AddToPortfolioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: {
    symbol: string;
    name: string;
    type: "stock" | "crypto" | "forex";
    exchange?: string;
  };
}

export function AddToPortfolioDialog({
  open,
  onOpenChange,
  asset,
}: AddToPortfolioDialogProps) {
  const { data: session, status } = useSession();
  const { toast } = useToast();

  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>("");
  
  // Form fields for adding to portfolio
  const [quantity, setQuantity] = useState<string>("1");
  const [purchasePrice, setPurchasePrice] = useState<string>("");
  const [purchaseDate, setPurchaseDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  useEffect(() => {
    if (open && status === "authenticated") {
      fetchPortfolios();
    }
  }, [open, status]);

  const fetchPortfolios = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/portfolio");
      if (res.ok) {
        const data = await res.json();
        setPortfolios(data);
        if (data.length > 0 && !selectedPortfolio) {
          setSelectedPortfolio(data[0]._id);
        }
      }
    } catch (error) {
      console.error("Error fetching portfolios:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToPortfolio = async () => {
    if (!selectedPortfolio) {
      toast({
        title: "Error",
        description: "Please select a portfolio",
        variant: "destructive",
      });
      return;
    }

    if (!quantity || parseFloat(quantity) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid quantity",
        variant: "destructive",
      });
      return;
    }

    if (!purchasePrice || parseFloat(purchasePrice) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid purchase price",
        variant: "destructive",
      });
      return;
    }

    setAdding(true);
    try {
      const res = await fetch(`/api/portfolio/${selectedPortfolio}/holdings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: asset.symbol,
          assetType: asset.type,
          quantity: parseFloat(quantity),
          purchasePrice: parseFloat(purchasePrice),
          purchaseDate: purchaseDate,
        }),
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: `${asset.symbol} added to portfolio successfully`,
        });
        onOpenChange(false);
        // Reset form
        setQuantity("1");
        setPurchasePrice("");
        setPurchaseDate(new Date().toISOString().split("T")[0]);
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.error || "Failed to add to portfolio",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error adding to portfolio:", error);
      toast({
        title: "Error",
        description: "Failed to add to portfolio",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  if (status === "unauthenticated") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign In Required</DialogTitle>
            <DialogDescription>
              Please sign in to add assets to your portfolio
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 text-center">
            <p className="text-muted-foreground">
              You need to be signed in to manage portfolios
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add {asset.symbol} to Portfolio</DialogTitle>
          <DialogDescription>
            Add {asset.name} to one of your portfolios
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : portfolios.length === 0 ? (
          <div className="py-8 text-center space-y-4">
            <Briefcase className="w-12 h-12 mx-auto text-muted-foreground" />
            <div>
              <p className="font-medium">No Portfolios Found</p>
              <p className="text-sm text-muted-foreground">
                Create a portfolio first to add assets
              </p>
            </div>
            <Button onClick={() => window.location.href = "/portfolio"}>
              <Plus className="w-4 h-4 mr-2" />
              Create Portfolio
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Portfolio Selection */}
            <div className="space-y-3">
              <Label>Select Portfolio</Label>
              <RadioGroup
                value={selectedPortfolio}
                onValueChange={setSelectedPortfolio}
                className="space-y-2"
              >
                {portfolios.map((portfolio) => (
                  <div
                    key={portfolio._id}
                    className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-accent cursor-pointer"
                  >
                    <RadioGroupItem value={portfolio._id} id={portfolio._id} />
                    <Label
                      htmlFor={portfolio._id}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="font-medium">{portfolio.name}</div>
                      {portfolio.description && (
                        <div className="text-xs text-muted-foreground">
                          {portfolio.description}
                        </div>
                      )}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Holding Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="1.0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Purchase Price ($)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Purchase Date</Label>
              <Input
                id="date"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>
          </div>
        )}

        {portfolios.length > 0 && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddToPortfolio} disabled={adding}>
              {adding ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add to Portfolio
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
