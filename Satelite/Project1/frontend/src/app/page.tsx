"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import ResultsDashboard from "@/components/ResultsDashboard";
import LoadingState from "@/components/LoadingState";
import Footer from "@/components/Footer";

export interface CrawlResult {
  target_url: string;
  pages_crawled: number;
  total_links_found: number;
  score: number;
  issues: Array<{
    severity: string;
    category: string;
    url: string;
    message: string;
    details?: string;
  }>;
  pages: Array<{
    url: string;
    status_code: number;
    response_time: number;
    title?: string;
    meta_description?: string;
    meta_robots?: string;
    canonical?: string;
    has_h1: boolean;
    internal_links: string[];
    external_links: string[];
    images_without_alt: number;
    total_images: number;
  }>;
  summary: {
    total_issues: number;
    critical: number;
    warnings: number;
    info: number;
    broken_links: number;
    redirects: number;
    slow_pages: number;
    pages_with_title: number;
    pages_with_meta_desc: number;
    pages_with_h1: number;
    categories: Record<
      string,
      { critical: number; warning: number; info: number }
    >;
  };
  crawl_time: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Home() {
  const [result, setResult] = useState<CrawlResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCrawl = async (url: string) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`${API_URL}/api/crawl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Error al analizar el sitio");
      }

      const data: CrawlResult = await response.json();
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error de conexion con el servidor"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        {!result && !loading && (
          <HeroSection onCrawl={handleCrawl} error={error} />
        )}
        {loading && <LoadingState />}
        {result && (
          <ResultsDashboard result={result} onReset={handleReset} />
        )}
      </main>
      <Footer />
    </div>
  );
}
