"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { Search, TrendingUp, Bitcoin, DollarSign, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Asset {
  symbol: string;
  name: string;
  type: "stock" | "crypto" | "forex";
  exchange?: string;
}

interface SymbolSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (asset: Asset) => void;
  placeholder?: string;
  className?: string;
}

export function SymbolSearch({
  value,
  onChange,
  onSelect,
  placeholder = "Search symbol (e.g., AAPL, BTC)",
  className,
}: SymbolSearchProps) {
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Asset[]>([]);
  const [mounted, setMounted] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update dropdown position
  useEffect(() => {
    if (open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
      console.log("Dropdown position:", { top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: rect.width });
    }
  }, [open, results]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  // Search for assets
  useEffect(() => {
    const searchAssets = async () => {
      if (!value || value.length < 1) {
        setResults([]);
        setOpen(false);
        return;
      }

      setSearching(true);
      try {
        const [stocks, cryptos] = await Promise.all([
          fetch(`/api/stocks?search=${encodeURIComponent(value)}`).then((r) =>
            r.ok ? r.json() : { data: [] }
          ),
          fetch(`/api/cryptos?search=${encodeURIComponent(value)}`).then((r) =>
            r.ok ? r.json() : { data: [] }
          ),
        ]);

        const stockResults: Asset[] = (stocks.data || [])
          .slice(0, 5)
          .map((s: any) => ({
            symbol: s.symbol,
            name: s.name,
            type: "stock" as const,
            exchange: s.exchange,
          }));

        const cryptoResults: Asset[] = (cryptos.data || [])
          .slice(0, 5)
          .map((c: any) => ({
            symbol: c.symbol || c.currency_base,
            name: `${c.currency_base || c.symbol}/${c.currency_quote || "USD"}`,
            type: "crypto" as const,
          }));

        const allResults = [...stockResults, ...cryptoResults];
        console.log("Search results for", value, ":", allResults);
        setResults(allResults);
        if (allResults.length > 0) {
          setOpen(true);
          console.log("Opening dropdown with", allResults.length, "results");
        }
      } catch (error) {
        console.error("Error searching assets:", error);
        setResults([]);
        setOpen(false);
      } finally {
        setSearching(false);
      }
    };

    const debounce = setTimeout(searchAssets, 300);
    return () => clearTimeout(debounce);
  }, [value]);

  const handleSelect = (asset: Asset) => {
    onChange(asset.symbol);
    onSelect?.(asset);
    setOpen(false);
  };

  const getAssetIcon = (type: string) => {
    switch (type) {
      case "stock":
        return <TrendingUp className="w-4 h-4 text-blue-500" />;
      case "crypto":
        return <Bitcoin className="w-4 h-4 text-orange-500" />;
      case "forex":
        return <DollarSign className="w-4 h-4 text-green-500" />;
      default:
        return <Search className="w-4 h-4" />;
    }
  };

  console.log("Render state:", { open, mounted, resultsLength: results.length, dropdownPosition });

  const dropdown = open && mounted && results.length > 0 && (
    <div
      style={{
        position: "fixed",
        top: `${dropdownPosition.top}px`,
        left: `${dropdownPosition.left}px`,
        width: `${dropdownPosition.width}px`,
        zIndex: 9999,
      }}
      className="bg-popover border rounded-md shadow-lg max-h-[300px] overflow-y-auto"
    >
      <div className="p-2">
        <div className="text-xs font-medium text-muted-foreground px-2 py-1.5">
          Search Results ({results.length})
        </div>
        {results.map((asset, index) => (
          <button
            key={`${asset.type}-${asset.symbol}-${index}`}
            onClick={() => handleSelect(asset)}
            className="w-full flex items-center gap-3 px-2 py-2.5 rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer text-left transition-colors"
          >
            <div className="flex-shrink-0">{getAssetIcon(asset.type)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{asset.symbol}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-muted capitalize">
                  {asset.type}
                </span>
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {asset.name}
              </div>
            </div>
            {asset.exchange && (
              <div className="text-xs text-muted-foreground flex-shrink-0">
                {asset.exchange}
              </div>
            )}
          </button>
        ))}</div>
    </div>
  );

  return (
    <>
      <div ref={containerRef} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => {
              onChange(e.target.value.toUpperCase());
            }}
            onFocus={() => {
              if (value && results.length > 0) {
                setOpen(true);
              }
            }}
            placeholder={placeholder}
            className={cn("pl-9 pr-9", className)}
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
          )}
          {!searching && results.length > 0 && (
            <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
          )}
        </div>
      </div>
      {mounted && typeof document !== "undefined" && createPortal(dropdown, document.body)}
    </>
  );
}
