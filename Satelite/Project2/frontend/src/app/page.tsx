"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import ResultsDashboard from "@/components/ResultsDashboard";
import LoadingState from "@/components/LoadingState";
import Footer from "@/components/Footer";

export interface AnalysisResult {
  target_url: string;
  robots: {
    found: boolean;
    url: string;
    raw_content: string;
    rules: Array<{
      user_agent: string;
      rules: Array<{ directive: string; value: string }>;
    }>;
    ai_bots: Array<{
      name: string;
      engine: string;
      allowed: boolean;
      rule_found: boolean;
      details: string;
    }>;
    search_bots: Array<{
      name: string;
      engine: string;
      allowed: boolean;
      rule_found: boolean;
      details: string;
    }>;
    sitemaps_declared: string[];
    suggestions: Array<{
      type: string;
      priority: string;
      message: string;
      detail?: string;
    }>;
    issues: Array<{
      severity: string;
      message: string;
    }>;
  };
  sitemap: {
    found: boolean;
    url: string;
    urls_count: number;
    urls: Array<{
      loc: string;
      lastmod?: string;
      changefreq?: string;
      priority?: string;
    }>;
    errors: string[];
    is_index: boolean;
    child_sitemaps: string[];
  };
  generated_sitemap: string;
  score: number;
  analysis_time: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

export default function Home() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (url: string) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`${API_URL}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Error al analizar el sitio");
      }

      const data: AnalysisResult = await response.json();
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
          <HeroSection onAnalyze={handleAnalyze} error={error} />
        )}
        {loading && <LoadingState />}
        {result && <ResultsDashboard result={result} onReset={handleReset} />}
      </main>
      <Footer />
    </div>
  );
}
