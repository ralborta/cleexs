"use client";

import { useState } from "react";
import type { CrawlResult } from "@/app/page";
import ScoreCircle from "./ScoreCircle";

interface ResultsDashboardProps {
  result: CrawlResult;
  onReset: () => void;
}

const SEVERITY_CONFIG = {
  critical: {
    label: "Critico",
    color: "var(--critical)",
    bg: "bg-red-50",
    border: "border-red-200",
    dot: "bg-red-500",
  },
  warning: {
    label: "Advertencia",
    color: "var(--warning)",
    bg: "bg-amber-50",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  info: {
    label: "Info",
    color: "var(--info)",
    bg: "bg-blue-50",
    border: "border-blue-200",
    dot: "bg-blue-500",
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  robots_txt: "Robots.txt",
  ai_bots: "Bots de IA",
  broken_links: "Enlaces rotos",
  redirects: "Redirecciones",
  performance: "Rendimiento",
  indexability: "Indexabilidad",
  seo: "SEO",
  accessibility: "Accesibilidad",
  connectivity: "Conectividad",
};

type FilterType = "all" | "critical" | "warning" | "info";

export default function ResultsDashboard({
  result,
  onReset,
}: ResultsDashboardProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [expandedIssue, setExpandedIssue] = useState<number | null>(null);

  const filteredIssues =
    filter === "all"
      ? result.issues
      : result.issues.filter((i) => i.severity === filter);

  return (
    <section className="px-4 pt-10 pb-16 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <button
            onClick={onReset}
            className="text-sm text-[var(--primary)] hover:underline mb-2 flex items-center gap-1 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Analizar otro sitio
          </button>
          <h2 className="text-2xl font-bold">Resultados del analisis</h2>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            {result.target_url} &middot; {result.pages_crawled} paginas
            rastreadas en {result.crawl_time}s
          </p>
        </div>
      </div>

      {/* Score + Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm flex items-center justify-center">
          <ScoreCircle score={result.score} />
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <p className="text-sm text-[var(--text-muted)] mb-1">Paginas rastreadas</p>
          <p className="text-3xl font-bold">{result.pages_crawled}</p>
          <div className="mt-3 space-y-1">
            <MiniStat
              label="Con titulo"
              value={result.summary.pages_with_title}
              total={result.pages_crawled}
            />
            <MiniStat
              label="Con meta desc"
              value={result.summary.pages_with_meta_desc}
              total={result.pages_crawled}
            />
            <MiniStat
              label="Con H1"
              value={result.summary.pages_with_h1}
              total={result.pages_crawled}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <p className="text-sm text-[var(--text-muted)] mb-1">Problemas encontrados</p>
          <p className="text-3xl font-bold">{result.summary.total_issues}</p>
          <div className="mt-3 space-y-1">
            <IssueStat severity="critical" count={result.summary.critical} />
            <IssueStat severity="warning" count={result.summary.warnings} />
            <IssueStat severity="info" count={result.summary.info} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <p className="text-sm text-[var(--text-muted)] mb-1">Conectividad</p>
          <p className="text-3xl font-bold">{result.total_links_found}</p>
          <p className="text-xs text-[var(--text-muted)]">enlaces encontrados</p>
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-muted)]">Enlaces rotos</span>
              <span className="font-semibold">{result.summary.broken_links}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-muted)]">Redirecciones</span>
              <span className="font-semibold">{result.summary.redirects}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-muted)]">Paginas lentas</span>
              <span className="font-semibold">{result.summary.slow_pages}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Overview */}
      {Object.keys(result.summary.categories).length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-8">
          <h3 className="font-semibold text-lg mb-4">Resumen por categoria</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(result.summary.categories).map(([cat, counts]) => (
              <div
                key={cat}
                className="border border-gray-100 rounded-xl p-4"
              >
                <p className="text-sm font-medium mb-2">
                  {CATEGORY_LABELS[cat] || cat}
                </p>
                <div className="flex gap-2">
                  {counts.critical > 0 && (
                    <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">
                      {counts.critical} criticos
                    </span>
                  )}
                  {counts.warning > 0 && (
                    <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium">
                      {counts.warning} avisos
                    </span>
                  )}
                  {counts.info > 0 && (
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                      {counts.info} info
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Issues List */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Problemas detectados</h3>
            <div className="flex gap-2">
              {(["all", "critical", "warning", "info"] as FilterType[]).map(
                (f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                      filter === f
                        ? "bg-[var(--primary)] text-white"
                        : "bg-gray-100 text-[var(--text-muted)] hover:bg-gray-200"
                    }`}
                  >
                    {f === "all"
                      ? `Todos (${result.issues.length})`
                      : f === "critical"
                        ? `Criticos (${result.summary.critical})`
                        : f === "warning"
                          ? `Avisos (${result.summary.warnings})`
                          : `Info (${result.summary.info})`}
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-50">
          {filteredIssues.length === 0 ? (
            <div className="p-8 text-center text-[var(--text-muted)]">
              No hay problemas en esta categoria.
            </div>
          ) : (
            filteredIssues.map((issue, i) => {
              const config =
                SEVERITY_CONFIG[
                  issue.severity as keyof typeof SEVERITY_CONFIG
                ] || SEVERITY_CONFIG.info;
              const isExpanded = expandedIssue === i;

              return (
                <div
                  key={i}
                  className="px-6 py-4 hover:bg-gray-50/50 transition-colors cursor-pointer"
                  onClick={() => setExpandedIssue(isExpanded ? null : i)}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-2 h-2 rounded-full mt-2 shrink-0 ${config.dot}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.bg} ${config.border} border`}
                        >
                          {config.label}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">
                          {CATEGORY_LABELS[issue.category] || issue.category}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{issue.message}</p>
                      <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                        {issue.url}
                      </p>
                      {isExpanded && issue.details && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-[var(--text-muted)]">
                          {issue.details}
                        </div>
                      )}
                    </div>
                    <svg
                      className={`w-4 h-4 text-[var(--text-muted)] transition-transform shrink-0 mt-1 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Pages Table */}
      {result.pages.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm mt-8 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h3 className="font-semibold text-lg">Paginas rastreadas</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                    URL
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                    Tiempo
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                    Titulo
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                    H1
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {result.pages.map((page, i) => (
                  <tr key={i} className="hover:bg-gray-50/50">
                    <td className="px-6 py-3 max-w-xs truncate">{page.url}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          page.status_code < 300
                            ? "bg-green-50 text-green-700"
                            : page.status_code < 400
                              ? "bg-amber-50 text-amber-700"
                              : "bg-red-50 text-red-700"
                        }`}
                      >
                        {page.status_code}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={
                          page.response_time > 3
                            ? "text-red-600 font-medium"
                            : page.response_time > 1
                              ? "text-amber-600"
                              : "text-green-600"
                        }
                      >
                        {page.response_time}s
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {page.title ? (
                        <svg className="w-5 h-5 text-green-500 mx-auto" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-red-400 mx-auto" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {page.has_h1 ? (
                        <svg className="w-5 h-5 text-green-500 mx-auto" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-red-400 mx-auto" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function MiniStat({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[var(--text-muted)]">{label}</span>
      <div className="flex items-center gap-2">
        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--primary)] rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="font-medium w-7 text-right">
          {value}/{total}
        </span>
      </div>
    </div>
  );
}

function IssueStat({
  severity,
  count,
}: {
  severity: keyof typeof SEVERITY_CONFIG;
  count: number;
}) {
  const config = SEVERITY_CONFIG[severity];
  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full ${config.dot}`} />
        <span className="text-[var(--text-muted)]">{config.label}</span>
      </div>
      <span className="font-semibold">{count}</span>
    </div>
  );
}
