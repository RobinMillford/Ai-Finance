"use client";

import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Newspaper } from 'lucide-react';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";

interface NewsItem {
  headline: string;
  summary: string;
}

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/news');
      const data = await response.json();
      setNews(data.news || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch news",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link href="/" className="text-primary hover:text-primary/80">
            ← Back to Stocks
          </Link>
        </div>
        
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Newspaper className="h-6 w-6" />
            <h1 className="text-2xl font-semibold">Financial News</h1>
          </div>
          
          {loading ? (
            <div className="text-center py-8">Loading news...</div>
          ) : (
            <div className="space-y-6">
              {news.map((item, index) => (
                <div key={index} className="border-b pb-6 last:border-0">
                  <h2 className="text-xl font-medium mb-2">{item.headline}</h2>
                  <p className="text-muted-foreground">{item.summary}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}