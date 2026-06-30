"use client";

import { useState } from "react";
import type { AnalysisResult } from "@/app/page";
import ScoreCircle from "./ScoreCircle";

interface Props {
  result: AnalysisResult;
  onReset: () => void;
}

type Tab = "robots" | "bots" | "sitemap" | "suggestions";

export default function ResultsDashboard({ result, onReset }: Props) {
  const [tab, setTab] = useState<Tab>("bots");
  const [showRaw, setShowRaw] = useState(false);
  const [showGenerated, setShowGenerated] = useState(false);

  const { robots, sitemap } = result;
  const aiAllowed = robots.ai_bots.filter((b: { allowed: boolean }) => b.allowed).length;
  const aiBlocked = robots.ai_bots.filter((b: { allowed: boolean }) => !b.allowed).length;

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
            {result.target_url} &middot; {result.analysis_time}s
          </p>
        </div>
      </div>

      {/* Score + Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm flex items-center justify-center">
          <ScoreCircle score={result.score} />
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <p className="text-sm text-[var(--text-muted)] mb-1">Robots.txt</p>
          <p className="text-2xl font-bold">
            {robots.found ? (
              <span className="text-[var(--success)]">Encontrado</span>
            ) : (
              <span className="text-[var(--critical)]">No encontrado</span>
            )}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            {robots.rules.length} reglas &middot;{" "}
            {robots.sitemaps_declared.length} sitemaps declarados
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <p className="text-sm text-[var(--text-muted)] mb-1">Bots de IA</p>
          <div className="flex items-baseline gap-3">
            <div>
              <span className="text-2xl font-bold text-[var(--success)]">{aiAllowed}</span>
              <span className="text-xs text-[var(--text-muted)] ml-1">permitidos</span>
            </div>
            <div>
              <span className="text-2xl font-bold text-[var(--critical)]">{aiBlocked}</span>
              <span className="text-xs text-[var(--text-muted)] ml-1">bloqueados</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <p className="text-sm text-[var(--text-muted)] mb-1">Sitemap</p>
          <p className="text-2xl font-bold">
            {sitemap.found ? (
              <span className="text-[var(--success)]">Encontrado</span>
            ) : (
              <span className="text-[var(--warning)]">No encontrado</span>
            )}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            {sitemap.found
              ? `${sitemap.urls_count} URLs${sitemap.is_index ? " (index)" : ""}`
              : result.generated_sitemap
                ? "Sitemap generado disponible"
                : "No se pudo generar"}
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6">
        {([
          { key: "bots", label: "Bots de IA" },
          { key: "robots", label: "Robots.txt" },
          { key: "sitemap", label: "Sitemap" },
          { key: "suggestions", label: `Sugerencias (${robots.suggestions.length})` },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${
              tab === t.key
                ? "bg-[var(--primary)] text-white"
                : "bg-white text-[var(--text-muted)] hover:bg-gray-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {tab === "bots" && <BotsTab robots={robots} />}
        {tab === "robots" && (
          <RobotsTab robots={robots} showRaw={showRaw} setShowRaw={setShowRaw} />
        )}
        {tab === "sitemap" && (
          <SitemapTab
            sitemap={sitemap}
            generatedSitemap={result.generated_sitemap}
            showGenerated={showGenerated}
            setShowGenerated={setShowGenerated}
          />
        )}
        {tab === "suggestions" && <SuggestionsTab robots={robots} />}
      </div>
    </section>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */

function BotsTab({ robots }: { robots: any }) {
  return (
    <div className="divide-y divide-gray-50">
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="font-semibold">Bots de IA</h3>
        <p className="text-xs text-[var(--text-muted)]">
          Estado de acceso de cada motor de IA a tu sitio
        </p>
      </div>
      {robots.ai_bots.map((bot: any) => (
        <div key={bot.name} className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                bot.allowed ? "bg-[var(--success)]" : "bg-[var(--critical)]"
              }`}
            />
            <div>
              <p className="text-sm font-medium">{bot.name}</p>
              <p className="text-xs text-[var(--text-muted)]">{bot.engine}</p>
            </div>
          </div>
          <div className="text-right">
            <span
              className={`text-xs px-3 py-1 rounded-full font-medium ${
                bot.allowed
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {bot.allowed ? "Permitido" : "Bloqueado"}
            </span>
            <p className="text-xs text-[var(--text-muted)] mt-1">{bot.details}</p>
          </div>
        </div>
      ))}

      {robots.search_bots.length > 0 && (
        <>
          <div className="px-6 py-4 border-t border-gray-100">
            <h3 className="font-semibold">Bots de busqueda</h3>
          </div>
          {robots.search_bots.map((bot: any) => (
            <div key={bot.name} className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    bot.allowed ? "bg-[var(--success)]" : "bg-[var(--critical)]"
                  }`}
                />
                <div>
                  <p className="text-sm font-medium">{bot.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">{bot.engine}</p>
                </div>
              </div>
              <span
                className={`text-xs px-3 py-1 rounded-full font-medium ${
                  bot.allowed
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {bot.allowed ? "Permitido" : "Bloqueado"}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function RobotsTab({
  robots,
  showRaw,
  setShowRaw,
}: {
  robots: any;
  showRaw: boolean;
  setShowRaw: (v: boolean) => void;
}) {
  return (
    <div>
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Robots.txt</h3>
          <p className="text-xs text-[var(--text-muted)]">{robots.url}</p>
        </div>
        {robots.found && (
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="text-xs text-[var(--primary)] hover:underline cursor-pointer"
          >
            {showRaw ? "Ocultar contenido" : "Ver contenido original"}
          </button>
        )}
      </div>

      {showRaw && robots.raw_content && (
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
          <pre className="text-xs text-[var(--foreground)] font-mono leading-relaxed overflow-x-auto">
            {robots.raw_content}
          </pre>
        </div>
      )}

      {robots.rules.length > 0 ? (
        <div className="divide-y divide-gray-50">
          {robots.rules.map((group: any, i: number) => (
            <div key={i} className="px-6 py-4">
              <p className="text-sm font-semibold mb-2">
                User-agent: <span className="text-[var(--primary)]">{group.user_agent}</span>
              </p>
              <div className="space-y-1">
                {group.rules.map((rule: any, j: number) => (
                  <div key={j} className="flex items-center gap-2 text-xs">
                    <span
                      className={`font-mono px-2 py-0.5 rounded ${
                        rule.directive.toLowerCase() === "disallow"
                          ? "bg-red-50 text-red-600"
                          : rule.directive.toLowerCase() === "allow"
                            ? "bg-green-50 text-green-600"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {rule.directive}
                    </span>
                    <span className="font-mono text-[var(--text-muted)]">
                      {rule.value || "(vacio)"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-6 py-8 text-center text-[var(--text-muted)] text-sm">
          {robots.found
            ? "No se encontraron reglas en el archivo."
            : "No existe un archivo robots.txt en este dominio."}
        </div>
      )}

      {robots.sitemaps_declared.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-100">
          <p className="text-sm font-semibold mb-2">Sitemaps declarados</p>
          {robots.sitemaps_declared.map((s: string, i: number) => (
            <p key={i} className="text-xs text-[var(--primary)] font-mono">
              {s}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function SitemapTab({
  sitemap,
  generatedSitemap,
  showGenerated,
  setShowGenerated,
}: {
  sitemap: any;
  generatedSitemap: string;
  showGenerated: boolean;
  setShowGenerated: (v: boolean) => void;
}) {
  const handleDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="font-semibold">Sitemap</h3>
        {sitemap.found && (
          <p className="text-xs text-[var(--text-muted)]">
            {sitemap.url} &middot; {sitemap.urls_count} URLs
          </p>
        )}
      </div>

      {sitemap.found && sitemap.is_index && (
        <div className="px-6 py-4 border-b border-gray-100">
          <p className="text-sm font-medium mb-2">Sitemap Index - Sub-sitemaps:</p>
          {sitemap.child_sitemaps.map((s: string, i: number) => (
            <p key={i} className="text-xs text-[var(--primary)] font-mono mb-1">
              {s}
            </p>
          ))}
        </div>
      )}

      {sitemap.found && sitemap.urls.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-medium text-[var(--text-muted)] uppercase">
                  URL
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase">
                  Ultima mod.
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase">
                  Frecuencia
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-[var(--text-muted)] uppercase">
                  Prioridad
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sitemap.urls.map((u: any, i: number) => (
                <tr key={i} className="hover:bg-gray-50/50">
                  <td className="px-6 py-3 text-xs font-mono max-w-sm truncate">
                    {u.loc}
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-[var(--text-muted)]">
                    {u.lastmod || "-"}
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-[var(--text-muted)]">
                    {u.changefreq || "-"}
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-[var(--text-muted)]">
                    {u.priority || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sitemap.urls_count > 50 && (
            <p className="px-6 py-3 text-xs text-[var(--text-muted)] text-center">
              Mostrando 50 de {sitemap.urls_count} URLs
            </p>
          )}
        </div>
      )}

      {!sitemap.found && (
        <div className="px-6 py-8 text-center">
          <p className="text-[var(--text-muted)] text-sm mb-4">
            No se encontro un sitemap XML en este dominio.
          </p>
          {generatedSitemap && (
            <div>
              <p className="text-sm font-medium mb-3">
                Generamos un sitemap basado en el rastreo de tu sitio:
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowGenerated(!showGenerated)}
                  className="text-sm text-[var(--primary)] hover:underline cursor-pointer"
                >
                  {showGenerated ? "Ocultar" : "Ver sitemap generado"}
                </button>
                <button
                  onClick={() => handleDownload(generatedSitemap, "sitemap.xml")}
                  className="bg-[var(--primary)] text-white text-sm px-4 py-2 rounded-full hover:bg-[var(--primary-hover)] transition-colors cursor-pointer"
                >
                  Descargar sitemap.xml
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showGenerated && generatedSitemap && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
          <pre className="text-xs font-mono leading-relaxed overflow-x-auto">
            {generatedSitemap}
          </pre>
        </div>
      )}

      {sitemap.errors.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-100">
          {sitemap.errors.map((err: string, i: number) => (
            <p key={i} className="text-xs text-[var(--warning)]">
              {err}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function SuggestionsTab({ robots }: { robots: any }) {
  const priorityConfig: Record<string, { bg: string; text: string }> = {
    critica: { bg: "bg-red-50", text: "text-red-700" },
    alta: { bg: "bg-amber-50", text: "text-amber-700" },
    media: { bg: "bg-blue-50", text: "text-blue-700" },
    info: { bg: "bg-green-50", text: "text-green-700" },
  };

  return (
    <div>
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="font-semibold">Sugerencias de mejora</h3>
      </div>
      {robots.suggestions.length === 0 ? (
        <div className="px-6 py-8 text-center text-[var(--text-muted)] text-sm">
          No hay sugerencias. Tu configuracion esta bien.
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {robots.suggestions.map((s: any, i: number) => {
            const config = priorityConfig[s.priority] || priorityConfig.info;
            return (
              <div key={i} className="px-6 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.bg} ${config.text}`}
                  >
                    {s.priority}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">{s.type}</span>
                </div>
                <p className="text-sm font-medium">{s.message}</p>
                {s.detail && (
                  <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                    {s.detail}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {robots.issues.length > 0 && (
        <>
          <div className="px-6 py-4 border-t border-gray-100">
            <h3 className="font-semibold">Problemas detectados</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {robots.issues.map((issue: any, i: number) => (
              <div key={i} className="px-6 py-4 flex items-center gap-3">
                <div
                  className={`w-2 h-2 rounded-full ${
                    issue.severity === "critical"
                      ? "bg-red-500"
                      : issue.severity === "warning"
                        ? "bg-amber-500"
                        : "bg-blue-500"
                  }`}
                />
                <p className="text-sm">{issue.message}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
