"use client";

import { useState } from "react";

interface HeroSectionProps {
  onAnalyze: (url: string) => void;
  error: string | null;
}

export default function HeroSection({ onAnalyze, error }: HeroSectionProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onAnalyze(url.trim());
    }
  };

  return (
    <section className="flex flex-col items-center justify-center px-4 pt-20 pb-16">
      <p className="text-[var(--primary)] font-semibold text-sm tracking-wide uppercase mb-4">
        Herramienta Gratuita
      </p>

      <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-center leading-tight mb-4 max-w-3xl">
        Tu{" "}
        <span className="relative inline-block">
          <span className="relative z-10">robots.txt</span>
          <span className="absolute bottom-1 left-0 w-full h-3 bg-[var(--primary)]/20 rounded-sm" />
        </span>{" "}
        y sitemap, listos?
      </h1>

      <p className="text-[var(--text-muted)] text-lg text-center max-w-xl mb-4">
        Verifica como esta configurado tu robots.txt, que bots de IA tienen
        acceso a tu sitio, y si tu sitemap esta en orden.
      </p>

      <div className="flex items-center gap-3 text-sm text-[var(--text-muted)] mb-10 flex-wrap justify-center">
        {["GPTBot", "ClaudeBot", "Googlebot", "PerplexityBot", "Bingbot"].map(
          (name) => (
            <span
              key={name}
              className="bg-white px-3 py-1.5 rounded-full text-xs font-medium shadow-sm"
            >
              {name}
            </span>
          )
        )}
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-xl mb-6">
        <div className="bg-white rounded-full shadow-lg flex items-center p-2 pl-5 gap-2">
          <svg
            className="w-5 h-5 text-[var(--text-muted)] shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://tusitio.com"
            className="flex-1 outline-none text-base bg-transparent placeholder:text-gray-400"
          />
          <button
            type="submit"
            className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold px-6 py-3 rounded-full transition-colors text-sm whitespace-nowrap cursor-pointer"
          >
            Analizar sitio
          </button>
        </div>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm max-w-xl w-full text-center">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl w-full mt-16">
        <FeatureCard
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          }
          title="Analisis de robots.txt"
          desc="Lee tu archivo robots.txt y muestra exactamente que bots tienen acceso."
        />
        <FeatureCard
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4l3 3" />
            </svg>
          }
          title="Estado de bots IA"
          desc="Identifica cuales motores de IA (ChatGPT, Claude, Perplexity) pueden rastrear tu sitio."
        />
        <FeatureCard
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          }
          title="Sitemap y sugerencias"
          desc="Verifica si tu sitemap existe, esta completo, y genera uno si no lo tienes."
        />
      </div>
    </section>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="w-10 h-10 bg-[var(--primary)]/10 rounded-xl flex items-center justify-center text-[var(--primary)] mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-base mb-2">{title}</h3>
      <p className="text-sm text-[var(--text-muted)] leading-relaxed">{desc}</p>
    </div>
  );
}
