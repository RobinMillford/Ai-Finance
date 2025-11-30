"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function APITestPage() {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const { toast } = useToast();

  // Portfolio test data
  const [portfolioName, setPortfolioName] = useState("Test Portfolio");
  const [portfolioDesc, setPortfolioDesc] = useState("Testing Phase 1 APIs");
  const [portfolioId, setPortfolioId] = useState("");

  // Holding test data
  const [symbol, setSymbol] = useState("AAPL");
  const [quantity, setQuantity] = useState("10");
  const [price, setPrice] = useState("150.50");

  // Watchlist test data
  const [watchlistName, setWatchlistName] = useState("Test Watchlist");
  const [watchlistId, setWatchlistId] = useState("");

  const testAPI = async (endpoint: string, method: string, body?: any) => {
    setLoading(true);
    setResponse(null);

    try {
      const res = await fetch(endpoint, {
        method,
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await res.json();
      setResponse({ status: res.status, data });

      if (res.ok) {
        // Auto-extract IDs from response
        if (data._id) {
          if (endpoint.includes('/portfolio') && !endpoint.includes('/watchlist')) {
            setPortfolioId(data._id);
            toast({
              title: "✅ Success",
              description: `Portfolio ID copied: ${data._id.substring(0, 8)}...`,
            });
          } else if (endpoint.includes('/watchlist')) {
            setWatchlistId(data._id);
            toast({
              title: "✅ Success",
              description: `Watchlist ID copied: ${data._id.substring(0, 8)}...`,
            });
          }
        } else {
          toast({
            title: "✅ Success",
            description: `${method} ${endpoint} - ${res.status}`,
          });
        }
      } else {
        toast({
          title: "❌ Error",
          description: data.error || "Request failed",
          variant: "destructive",
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      setResponse({ status: 0, error: errorMsg });
      toast({
        title: "❌ Error",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl font-bold mb-2">API Testing Dashboard</h1>
          <p className="text-muted-foreground">
            Test Phase 1 Portfolio & Watchlist APIs
          </p>
        </div>

        <Tabs defaultValue="portfolio" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="portfolio">Portfolio APIs</TabsTrigger>
            <TabsTrigger value="watchlist">Watchlist APIs</TabsTrigger>
          </TabsList>

          {/* Portfolio Tests */}
          <TabsContent value="portfolio" className="space-y-4">
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">1. Create Portfolio</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Portfolio Name</label>
                  <Input
                    value={portfolioName}
                    onChange={(e) => setPortfolioName(e.target.value)}
                    placeholder="My Portfolio"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    value={portfolioDesc}
                    onChange={(e) => setPortfolioDesc(e.target.value)}
                    placeholder="Portfolio description"
                  />
                </div>
                <Button
                  onClick={() =>
                    testAPI("/api/portfolio", "POST", {
                      name: portfolioName,
                      description: portfolioDesc,
                    })
                  }
                  disabled={loading}
                >
                  {loading ? <Loader2 className="animate-spin" /> : "Create Portfolio"}
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">2. List Portfolios</h2>
              <Button
                onClick={() => testAPI("/api/portfolio", "GET")}
                disabled={loading}
              >
                {loading ? <Loader2 className="animate-spin" /> : "Get All Portfolios"}
              </Button>
            </Card>

            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">3. Add Holding</h2>
              {portfolioId && (
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    ✅ Portfolio ID: <code className="text-xs">{portfolioId}</code>
                  </p>
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">
                    Portfolio ID {!portfolioId && "(Create a portfolio first)"}
                  </label>
                  <Input
                    value={portfolioId}
                    onChange={(e) => setPortfolioId(e.target.value)}
                    placeholder="Will auto-fill after creating portfolio"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium">Symbol</label>
                    <Input
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value)}
                      placeholder="AAPL"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Quantity</label>
                    <Input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="10"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Price</label>
                    <Input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="150.50"
                    />
                  </div>
                </div>
                <Button
                  onClick={() =>
                    testAPI(`/api/portfolio/${portfolioId}/holdings`, "POST", {
                      symbol,
                      assetType: "stock",
                      quantity: Number(quantity),
                      purchasePrice: Number(price),
                      purchaseDate: new Date().toISOString(),
                    })
                  }
                  disabled={loading || !portfolioId}
                >
                  {loading ? <Loader2 className="animate-spin" /> : "Add Holding"}
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">4. Get Portfolio Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Portfolio ID</label>
                  <Input
                    value={portfolioId}
                    onChange={(e) => setPortfolioId(e.target.value)}
                    placeholder="Portfolio ID"
                  />
                </div>
                <Button
                  onClick={() => testAPI(`/api/portfolio/${portfolioId}`, "GET")}
                  disabled={loading || !portfolioId}
                >
                  {loading ? <Loader2 className="animate-spin" /> : "Get Portfolio"}
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">5. Delete Portfolio</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Portfolio ID</label>
                  <Input
                    value={portfolioId}
                    onChange={(e) => setPortfolioId(e.target.value)}
                    placeholder="Portfolio ID"
                  />
                </div>
                <Button
                  onClick={() => testAPI(`/api/portfolio/${portfolioId}`, "DELETE")}
                  disabled={loading || !portfolioId}
                  variant="destructive"
                >
                  {loading ? <Loader2 className="animate-spin" /> : "Delete Portfolio"}
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Watchlist Tests */}
          <TabsContent value="watchlist" className="space-y-4">
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">1. Create Watchlist</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Watchlist Name</label>
                  <Input
                    value={watchlistName}
                    onChange={(e) => setWatchlistName(e.target.value)}
                    placeholder="My Watchlist"
                  />
                </div>
                <Button
                  onClick={() =>
                    testAPI("/api/watchlist", "POST", { name: watchlistName })
                  }
                  disabled={loading}
                >
                  {loading ? <Loader2 className="animate-spin" /> : "Create Watchlist"}
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">2. List Watchlists</h2>
              <Button
                onClick={() => testAPI("/api/watchlist", "GET")}
                disabled={loading}
              >
                {loading ? <Loader2 className="animate-spin" /> : "Get All Watchlists"}
              </Button>
            </Card>

            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">3. Add Asset to Watchlist</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Watchlist ID</label>
                  <Input
                    value={watchlistId}
                    onChange={(e) => setWatchlistId(e.target.value)}
                    placeholder="Paste watchlist ID from response above"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Symbol</label>
                  <Input
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    placeholder="TSLA"
                  />
                </div>
                <Button
                  onClick={() =>
                    testAPI(`/api/watchlist/${watchlistId}`, "POST", {
                      symbol,
                      assetType: "stock",
                      notes: "Test asset",
                    })
                  }
                  disabled={loading || !watchlistId}
                >
                  {loading ? <Loader2 className="animate-spin" /> : "Add Asset"}
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">4. Delete Watchlist</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Watchlist ID</label>
                  <Input
                    value={watchlistId}
                    onChange={(e) => setWatchlistId(e.target.value)}
                    placeholder="Watchlist ID"
                  />
                </div>
                <Button
                  onClick={() => testAPI(`/api/watchlist/${watchlistId}`, "DELETE")}
                  disabled={loading || !watchlistId}
                  variant="destructive"
                >
                  {loading ? <Loader2 className="animate-spin" /> : "Delete Watchlist"}
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Response Display */}
        {response && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              {response.status >= 200 && response.status < 300 ? (
                <CheckCircle2 className="text-green-500" />
              ) : (
                <XCircle className="text-red-500" />
              )}
              <h2 className="text-2xl font-bold">
                Response: {response.status || "Error"}
              </h2>
            </div>
            <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-96">
              {JSON.stringify(response.data || response.error, null, 2)}
            </pre>
          </Card>
        )}
      </div>
    </div>
  );
}
