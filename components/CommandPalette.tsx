"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Home,
  TrendingUp,
  Globe,
  Bitcoin,
  Briefcase,
  Star,
  LogOut,
  Search,
  Plus,
  BarChart3,
  Clock,
  DollarSign,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";
import Fuse from "fuse.js";

interface Portfolio {
  _id: string;
  name: string;
  description?: string;
}

interface Watchlist {
  _id: string;
  name: string;
  assets: any[];
}

interface MarketAsset {
  symbol: string;
  name?: string;
  type: "stock" | "forex" | "crypto";
  exchange?: string;
}

interface RecentItem {
  id: string;
  label: string;
  type: "portfolio" | "watchlist" | "stock" | "forex" | "crypto" | "page";
  path: string;
  timestamp: number;
}

const RECENT_ITEMS_KEY = "commandPalette_recentItems";
const MAX_RECENT_ITEMS = 5;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [marketAssets, setMarketAssets] = useState<MarketAsset[]>([]);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { data: session, status } = useSession();
  const { toast } = useToast();

  // Load recent items from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(RECENT_ITEMS_KEY);
    if (stored) {
      try {
        setRecentItems(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse recent items:", e);
      }
    }
  }, []);

  // Keyboard shortcut listener
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Fetch user data and market assets when dialog opens
  useEffect(() => {
    if (open) {
      if (status === "authenticated") {
        fetchUserData();
      }
      fetchMarketAssets();
    }
  }, [open, status]);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      const [portfoliosRes, watchlistsRes] = await Promise.all([
        fetch("/api/portfolio"),
        fetch("/api/watchlist"),
      ]);

      if (portfoliosRes.ok) {
        const portfoliosData = await portfoliosRes.json();
        setPortfolios(portfoliosData);
      }

      if (watchlistsRes.ok) {
        const watchlistsData = await watchlistsRes.json();
        setWatchlists(watchlistsData);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMarketAssets = async () => {
    try {
      const assets: MarketAsset[] = [];

      // Fetch stocks
      try {
        const stocksRes = await fetch("/api/stocks");
        if (stocksRes.ok) {
          const stocksData = await stocksRes.json();
          const stocks = Array.isArray(stocksData) ? stocksData : [];
          assets.push(
            ...stocks.slice(0, 100).map((s: any) => ({
              symbol: s.symbol,
              name: s.name || s.symbol,
              type: "stock" as const,
              exchange: s.exchange,
            }))
          );
          console.log(`Loaded ${stocks.length} stocks for search`);
        }
      } catch (e) {
        console.error("Error fetching stocks:", e);
      }

      // Fetch forex
      try {
        const forexRes = await fetch("/api/forexs?page=1&perPage=100");
        if (forexRes.ok) {
          const forexData = await forexRes.json();
          const pairs = forexData.pairs || forexData || [];
          assets.push(
            ...pairs.slice(0, 100).map((f: any) => ({
              symbol: f.symbol,
              name: f.name || `${f.base_currency || ""}/${f.quote_currency || ""}`,
              type: "forex" as const,
            }))
          );
          console.log(`Loaded ${pairs.length} forex pairs for search`);
        }
      } catch (e) {
        console.error("Error fetching forex:", e);
      }

      // Fetch crypto
      try {
        const cryptoRes = await fetch("/api/cryptos");
        if (cryptoRes.ok) {
          const cryptoData = await cryptoRes.json();
          const crypto = Array.isArray(cryptoData) ? cryptoData : [];
          assets.push(
            ...crypto.slice(0, 100).map((c: any) => ({
              symbol: c.symbol,
              name: `${c.currency_base || ""}/${c.currency_quote || ""}`,
              type: "crypto" as const,
            }))
          );
          console.log(`Loaded ${crypto.length} crypto pairs for search`);
        }
      } catch (e) {
        console.error("Error fetching crypto:", e);
      }

      console.log(`Total market assets loaded: ${assets.length}`);
      setMarketAssets(assets);
    } catch (error) {
      console.error("Error fetching market assets:", error);
    }
  };

  const addRecentItem = (item: Omit<RecentItem, "timestamp">) => {
    const newItem: RecentItem = {
      ...item,
      timestamp: Date.now(),
    };

    const updated = [
      newItem,
      ...recentItems.filter((i) => i.id !== item.id),
    ].slice(0, MAX_RECENT_ITEMS);

    setRecentItems(updated);
    localStorage.setItem(RECENT_ITEMS_KEY, JSON.stringify(updated));
  };

  const handleSelect = (callback: () => void, recentItem?: Omit<RecentItem, "timestamp">) => {
    setOpen(false);
    if (recentItem) {
      addRecentItem(recentItem);
    }
    callback();
  };

  const handleSignOut = () => {
    signOut({ callbackUrl: "/" });
    toast({
      title: "Signed out",
      description: "You have been signed out successfully",
    });
  };

  const getAssetIcon = (type: string) => {
    switch (type) {
      case "stock":
        return <TrendingUp className="mr-2 h-4 w-4 text-blue-500" />;
      case "forex":
        return <Globe className="mr-2 h-4 w-4 text-green-500" />;
      case "crypto":
        return <Bitcoin className="mr-2 h-4 w-4 text-orange-500" />;
      default:
        return <DollarSign className="mr-2 h-4 w-4 text-gray-500" />;
    }
  };

  const getAssetPath = (asset: MarketAsset) => {
    switch (asset.type) {
      case "stock":
        return `/stock/${asset.symbol}`;
      case "forex":
        return `/forex/${asset.symbol}`;
      case "crypto":
        return `/crypto/${asset.symbol}`;
      default:
        return "/";
    }
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search markets, portfolios, or navigate..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Recent Items */}
        {recentItems.length > 0 && (
          <>
            <CommandGroup heading="Recent">
              {recentItems.map((item) => (
                <CommandItem
                  key={item.id}
                  onSelect={() => handleSelect(() => router.push(item.path))}
                >
                  <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{item.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground capitalize">
                    {item.type}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Search Results (Fuzzy Search) */}
        {/* Market Assets */}
        {marketAssets.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Market Assets">
              {marketAssets.map((asset) => (
                <CommandItem
                  key={asset.symbol}
                  keywords={[asset.symbol, asset.name || "", asset.type]}
                  onSelect={() =>
                    handleSelect(
                      () => router.push(getAssetPath(asset)),
                      {
                        id: asset.symbol,
                        label: `${asset.symbol} - ${asset.name}`,
                        type: asset.type,
                        path: getAssetPath(asset),
                      }
                    )
                  }
                >
                  {getAssetIcon(asset.type)}
                  <span className="font-medium">{asset.symbol}</span>
                  {asset.name && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {asset.name}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Portfolios */}
        {status === "authenticated" && portfolios.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Portfolios">
              {portfolios.map((portfolio) => (
                <CommandItem
                  key={portfolio._id}
                  keywords={[portfolio.name, portfolio.description || ""]}
                  onSelect={() =>
                    handleSelect(
                      () => router.push(`/portfolio/${portfolio._id}`),
                      {
                        id: portfolio._id,
                        label: portfolio.name,
                        type: "portfolio",
                        path: `/portfolio/${portfolio._id}`,
                      }
                    )
                  }
                >
                  <Briefcase className="mr-2 h-4 w-4 text-purple-500" />
                  <span>{portfolio.name}</span>
                  {portfolio.description && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {portfolio.description.slice(0, 30)}
                      {portfolio.description.length > 30 ? "..." : ""}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Watchlists */}
        {status === "authenticated" && watchlists.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Watchlists">
              {watchlists.map((watchlist) => (
                <CommandItem
                  key={watchlist._id}
                  keywords={[watchlist.name]}
                  onSelect={() =>
                    handleSelect(
                      () => router.push("/watchlist"),
                      {
                        id: watchlist._id,
                        label: watchlist.name,
                        type: "watchlist",
                        path: "/watchlist",
                      }
                    )
                  }
                >
                  <Star className="mr-2 h-4 w-4 text-yellow-500" />
                  <span>{watchlist.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {watchlist.assets.length} assets
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Navigation (only show if no search) */}
        <CommandSeparator />
        <CommandGroup heading="Navigation">
            <CommandItem
              onSelect={() => handleSelect(() => router.push("/"), { id: "home", label: "Dashboard", type: "page", path: "/" })}
            >
              <Home className="mr-2 h-4 w-4 text-blue-500" />
              <span>Dashboard</span>
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelect(() => router.push("/stocks"), { id: "stocks", label: "Stocks", type: "page", path: "/stocks" })}
            >
              <TrendingUp className="mr-2 h-4 w-4 text-blue-500" />
              <span>Stocks</span>
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelect(() => router.push("/forexs"), { id: "forexs", label: "Forex", type: "page", path: "/forexs" })}
            >
              <Globe className="mr-2 h-4 w-4 text-green-500" />
              <span>Forex</span>
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelect(() => router.push("/cryptos"), { id: "cryptos", label: "Crypto", type: "page", path: "/cryptos" })}
            >
              <Bitcoin className="mr-2 h-4 w-4 text-orange-500" />
              <span>Crypto</span>
            </CommandItem>
            {status === "authenticated" && (
              <>
                <CommandItem
                  onSelect={() => handleSelect(() => router.push("/portfolio"), { id: "portfolio", label: "Portfolio", type: "page", path: "/portfolio" })}
                >
                  <Briefcase className="mr-2 h-4 w-4 text-purple-500" />
                  <span>Portfolio</span>
                </CommandItem>
                <CommandItem
                  onSelect={() => handleSelect(() => router.push("/watchlist"), { id: "watchlist", label: "Watchlist", type: "page", path: "/watchlist" })}
                >
                  <Star className="mr-2 h-4 w-4 text-yellow-500" />
                  <span>Watchlist</span>
                </CommandItem>
              </>
            )}
          </CommandGroup>

        {/* Quick Actions */}
        {status === "authenticated" && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Actions">
              <CommandItem
                onSelect={() => handleSelect(() => router.push("/portfolio"))}
              >
                <Plus className="mr-2 h-4 w-4 text-green-500" />
                <span>Create Portfolio</span>
              </CommandItem>
              <CommandItem
                onSelect={() => handleSelect(() => router.push("/watchlist"))}
              >
                <Plus className="mr-2 h-4 w-4 text-yellow-500" />
                <span>Create Watchlist</span>
              </CommandItem>
              <CommandItem onSelect={() => handleSelect(handleSignOut)}>
                <LogOut className="mr-2 h-4 w-4 text-red-500" />
                <span>Sign Out</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}

        {/* Search Hint */}
        {!loading && portfolios.length === 0 && watchlists.length === 0 && status === "authenticated" && (
          <CommandGroup heading="Get Started">
            <CommandItem
              onSelect={() => handleSelect(() => router.push("/portfolio"))}
            >
              <Search className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                Create your first portfolio to see it here
              </span>
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
