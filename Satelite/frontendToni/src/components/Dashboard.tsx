/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import ScoreCircle from "./ScoreCircle";
import { SuggestionItem, StatusBadge, IssueItem } from "./tools/GenericToolView";

interface Props {
  data: any;
  onReset: () => void;
}

const TOOLS = [
  { key: "crawlability", label: "Crawlability", num: 1, icon: "spider" },
  { key: "robots_sitemap", label: "Robots & Sitemap", num: 2, icon: "file" },
  { key: "schema", label: "Schema", num: 3, icon: "code" },
  { key: "axp", label: "AXP", num: 4, icon: "cpu" },
  { key: "ai_presence", label: "AI Presence", num: 5, icon: "eye" },
  { key: "citations", label: "Citations", num: 6, icon: "quote" },
  { key: "alerts", label: "Alerts", num: 7, icon: "bell" },
  { key: "freshness", label: "Freshness", num: 8, icon: "clock" },
  { key: "ai_overview", label: "AI Overview", num: 9, icon: "chart" },
  { key: "duplicates", label: "Duplicados", num: 10, icon: "copy" },
];

export default function Dashboard({ data, onReset }: Props) {
  const [activeTab, setActiveTab] = useState("crawlability");

  const getScore = (key: string) => {
    const d = data[key];
    if (!d) return 0;
    return d.score ?? 0;
  };

  const overallScore = data.overall_score || 0;
  const scoreColor = overallScore >= 80 ? "var(--success)" : overallScore >= 50 ? "var(--warning)" : "var(--critical)";

  return (
    <section className="px-4 md:px-8 pt-6 pb-16 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onReset} className="w-9 h-9 rounded-xl bg-[var(--background)] hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer">
            <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <p className="text-xs text-[var(--text-muted)] mb-0.5">Resultados para</p>
            <h2 className="text-lg font-bold leading-tight">{data.target_url}</h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-[var(--text-muted)]">Score global</p>
            <p className="text-2xl font-extrabold leading-tight" style={{ color: scoreColor }}>{overallScore}</p>
          </div>
          <div className="w-12 h-12 rounded-full border-[3px] flex items-center justify-center" style={{ borderColor: scoreColor }}>
            <span className="text-xs font-bold" style={{ color: scoreColor }}>/100</span>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="flex gap-5">
        {/* Sidebar */}
        <div className="w-56 shrink-0">
          <div className="bg-white rounded-2xl shadow-sm p-2 space-y-0.5">
            {TOOLS.map((tool) => {
              const score = getScore(tool.key);
              const isActive = activeTab === tool.key;
              const hasError = data[tool.key]?.error;
              const hasData = !!data[tool.key];
              const sColor = score >= 80 ? "var(--success)" : score >= 50 ? "var(--warning)" : "var(--critical)";

              return (
                <button
                  key={tool.key}
                  onClick={() => setActiveTab(tool.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer group ${
                    isActive
                      ? "bg-[var(--primary)] text-white shadow-md shadow-[var(--primary)]/20"
                      : "hover:bg-[var(--background)] text-[var(--foreground)]"
                  }`}
                >
                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    isActive ? "bg-white/20 text-white" : "bg-[var(--background)] text-[var(--text-muted)]"
                  }`}>
                    {tool.num}
                  </span>
                  <span className="flex-1 text-left font-medium truncate">{tool.label}</span>
                  {hasError ? (
                    <span className={`text-xs ${isActive ? "text-white/70" : "text-red-400"}`}>!</span>
                  ) : hasData && (
                    <span
                      className="text-xs font-bold tabular-nums"
                      style={{ color: isActive ? "white" : sColor }}
                    >
                      {score}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm p-6 min-h-[540px] overflow-auto">
          {activeTab === "crawlability" && <CrawlabilityView data={data.crawlability} />}
          {activeTab === "robots_sitemap" && <RobotsSitemapView data={data.robots_sitemap} />}
          {activeTab === "schema" && <SchemaView data={data.schema} />}
          {activeTab === "axp" && <AXPView data={data.axp} />}
          {activeTab === "ai_presence" && <AIPresenceView data={data.ai_presence} />}
          {activeTab === "citations" && <CitationsView data={data.citations} />}
          {activeTab === "alerts" && <AlertsView data={data.alerts} />}
          {activeTab === "freshness" && <FreshnessView data={data.freshness} />}
          {activeTab === "ai_overview" && <AIOverviewView data={data.ai_overview} />}
          {activeTab === "duplicates" && <DuplicatesView data={data.duplicates} />}
        </div>
      </div>
    </section>
  );
}

/* ──── Tool Views ──── */

function SchemaView({ data }: { data: any }) {
  if (!data) return <ErrorState />;
  return (
    <div className="space-y-5">
      <ToolHeader title="Datos Estructurados (Schema)" score={data.score} subtitle={`${data.total_schemas || 0} schemas encontrados`} />
      {data.schemas_found?.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Schemas detectados</h4>
          <div className="flex flex-wrap gap-2">
            {data.schemas_found.map((s: any, i: number) => (
              <div key={i} className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-medium">
                {s.schema_type} <span className="opacity-60">({s.source}, {s.property_count} props)</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.missing_types?.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Tipos faltantes</h4>
          <div className="flex flex-wrap gap-2">
            {data.missing_types.map((t: string) => (
              <span key={t} className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-medium">{t}</span>
            ))}
          </div>
        </div>
      )}
      <Suggestions items={data.suggestions} />
    </div>
  );
}

function AXPView({ data }: { data: any }) {
  if (!data) return <ErrorState />;
  return (
    <div className="space-y-5">
      <ToolHeader title="Agent Experience (AXP)" score={data.score} subtitle="Version optimizada para IAs" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Original" value={formatBytes(data.original_size)} />
        <StatCard label="Optimizado" value={formatBytes(data.optimized_size)} />
        <StatCard label="Reduccion" value={`${data.reduction_pct}%`} />
        <StatCard label="Tokens est." value={`${data.optimized_tokens_est}`} />
      </div>
      {data.ai_friendly_content && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Contenido AI-friendly (preview)</h4>
          <pre className="bg-gray-50 p-4 rounded-xl text-xs leading-relaxed max-h-64 overflow-auto">{data.ai_friendly_content.substring(0, 2000)}</pre>
        </div>
      )}
      <Issues items={data.issues} />
      <Suggestions items={data.suggestions} />
    </div>
  );
}

function FreshnessView({ data }: { data: any }) {
  if (!data) return <ErrorState />;
  const s = data.summary || {};
  return (
    <div className="space-y-5">
      <ToolHeader title="Frescura del Contenido" score={data.score} subtitle={`${data.pages_analyzed || 0} paginas analizadas`} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Frescas (<90d)" value={s.fresh || 0} color="green" />
        <StatCard label="Envejeciendo" value={s.aging || 0} color="yellow" />
        <StatCard label="Desactualizadas" value={s.outdated || 0} color="red" />
        <StatCard label="Sin fecha" value={s.without_dates || 0} />
      </div>
      {data.pages?.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Paginas</h4>
          <div className="space-y-1 max-h-64 overflow-auto">
            {data.pages.map((p: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-1.5 text-xs border-b border-gray-50">
                <span className="truncate max-w-sm">{p.url}</span>
                <span className={`px-2 py-0.5 rounded-full font-medium ${
                  p.freshness_status === "fresh" ? "bg-green-50 text-green-700" :
                  p.freshness_status === "aging" ? "bg-amber-50 text-amber-700" :
                  p.freshness_status === "outdated" ? "bg-red-50 text-red-700" :
                  "bg-gray-50 text-gray-500"
                }`}>{p.freshness_status} {p.days_since_update >= 0 ? `(${p.days_since_update}d)` : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <Suggestions items={data.suggestions} />
    </div>
  );
}

function CrawlabilityView({ data }: { data: any }) {
  if (!data) return <ErrorState />;
  const s = data.summary || {};
  const issues = data.issues || [];

  // Separate issues by category for better display
  const brokenLinks = issues.filter((i: any) => i.category === "broken_links");
  const imgIssues = issues.filter((i: any) => i.category === "accessibility");
  const seoIssues = issues.filter((i: any) => i.category === "seo");
  const indexIssues = issues.filter((i: any) => i.category === "indexability");
  const perfIssues = issues.filter((i: any) => i.category === "performance");
  const robotsIssues = issues.filter((i: any) => i.category === "robots_txt" || i.category === "ai_bots");
  const redirectIssues = issues.filter((i: any) => i.category === "redirects");

  // Aggregate image alt issues into one summary
  const totalImgsWithoutAlt = imgIssues.reduce((sum: number, i: any) => {
    const match = i.message?.match(/(\d+) imagen/);
    return sum + (match ? parseInt(match[1]) : 0);
  }, 0);

  return (
    <div className="space-y-5">
      <ToolHeader title="Crawlability" score={data.score} subtitle={`${data.pages_crawled || 0} paginas, ${data.crawl_time}s`} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Criticos" value={s.critical || 0} color="red" />
        <StatCard label="Advertencias" value={s.warnings || 0} color="yellow" />
        <StatCard label="Info" value={s.info || 0} color="blue" />
        <StatCard label="Enlaces rotos" value={s.broken_links || 0} color="red" />
      </div>

      {/* Broken Links — explicit URLs */}
      {brokenLinks.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Enlaces rotos ({brokenLinks.length})</h4>
          <div className="space-y-1">
            {brokenLinks.map((i: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2 py-1.5 text-xs border-b border-gray-50">
                <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-mono font-bold shrink-0">
                  {i.message?.match(/HTTP (\d+)/)?.[1] || "ERR"}
                </span>
                <span className="truncate text-[var(--foreground)]">{i.url}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Images without alt — aggregated */}
      {totalImgsWithoutAlt > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Imagenes sin atributo alt</h4>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700">
            <p className="font-medium">{totalImgsWithoutAlt} imagenes sin alt en {imgIssues.length} pagina{imgIssues.length !== 1 ? "s" : ""}</p>
            <p className="text-xs mt-1 opacity-80">Las imagenes sin alt son invisibles para los rastreadores de IA.</p>
          </div>
          <div className="mt-2 space-y-0.5 max-h-32 overflow-auto">
            {imgIssues.map((i: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between py-1 text-xs">
                <span className="truncate text-[var(--text-muted)]">{i.url}</span>
                <span className="shrink-0 ml-2 font-medium">{i.message?.match(/(\d+)/)?.[1] || "?"} imgs</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SEO Issues */}
      {seoIssues.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">SEO ({seoIssues.length})</h4>
          <div className="max-h-48 overflow-auto">{seoIssues.map((i: any, idx: number) => <IssueItem key={idx} issue={i} />)}</div>
        </div>
      )}

      {/* Indexability */}
      {indexIssues.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Indexabilidad ({indexIssues.length})</h4>
          <div className="max-h-48 overflow-auto">{indexIssues.map((i: any, idx: number) => <IssueItem key={idx} issue={i} />)}</div>
        </div>
      )}

      {/* Performance */}
      {perfIssues.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Rendimiento ({perfIssues.length})</h4>
          <div className="max-h-48 overflow-auto">{perfIssues.map((i: any, idx: number) => <IssueItem key={idx} issue={i} />)}</div>
        </div>
      )}

      {/* Robots & AI bots */}
      {robotsIssues.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Robots.txt / Bots IA ({robotsIssues.length})</h4>
          <div className="max-h-48 overflow-auto">{robotsIssues.map((i: any, idx: number) => <IssueItem key={idx} issue={i} />)}</div>
        </div>
      )}

      {/* Redirects */}
      {redirectIssues.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Redirecciones ({redirectIssues.length})</h4>
          <div className="max-h-48 overflow-auto">{redirectIssues.map((i: any, idx: number) => <IssueItem key={idx} issue={i} />)}</div>
        </div>
      )}
    </div>
  );
}

function RobotsSitemapView({ data }: { data: any }) {
  if (!data) return <ErrorState />;
  const r = data.robots || {};
  const sm = data.sitemap || {};
  return (
    <div className="space-y-5">
      <ToolHeader title="Robots.txt & Sitemap" score={data.score} />
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Robots.txt" value={r.found ? "Encontrado" : "No encontrado"} color={r.found ? "green" : "red"} />
        <StatCard label="Sitemap" value={sm.found ? `${sm.urls_count} URLs` : "No encontrado"} color={sm.found ? "green" : "red"} />
      </div>
      {r.ai_bots?.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Bots de IA</h4>
          <div className="space-y-1">
            {r.ai_bots.map((bot: any) => (
              <div key={bot.name} className="flex items-center justify-between py-1.5 text-xs border-b border-gray-50">
                <div>
                  <span className="font-medium">{bot.name}</span>
                  <span className="text-[var(--text-muted)] ml-2">{bot.engine}</span>
                </div>
                <StatusBadge allowed={bot.allowed} />
              </div>
            ))}
          </div>
        </div>
      )}
      <Suggestions items={r.suggestions} />
    </div>
  );
}

function AIPresenceView({ data }: { data: any }) {
  if (!data) return <ErrorState />;
  return (
    <div className="space-y-5">
      <ToolHeader title="Presencia en AI Search" score={data.score} subtitle={`Marca: ${data.brand_name}`} />
      {data.signals?.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Senales de visibilidad</h4>
          <div className="space-y-1">
            {data.signals.map((s: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-2 text-xs border-b border-gray-50">
                <span className="font-medium">{s.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--text-muted)] max-w-xs truncate">{s.details}</span>
                  <span className={`px-2 py-0.5 rounded-full font-medium ${
                    s.status === "pass" ? "bg-green-50 text-green-700" :
                    s.status === "warning" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                  }`}>{s.status === "pass" ? "OK" : s.status === "warning" ? "Mejorar" : "Falta"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.test_prompts?.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Prompts de prueba</h4>
          <p className="text-xs text-[var(--text-muted)] mb-2">Prueba estos prompts en ChatGPT, Claude y Perplexity:</p>
          <div className="space-y-2">
            {data.test_prompts.map((p: any, i: number) => (
              <div key={i} className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm font-mono font-medium">&ldquo;{p.prompt}&rdquo;</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">{p.purpose}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <Suggestions items={data.suggestions} />
    </div>
  );
}

function CitationsView({ data }: { data: any }) {
  if (!data) return <ErrorState />;
  return (
    <div className="space-y-5">
      <ToolHeader title="Query Citations" score={data.score} subtitle={`${data.topics?.length || 0} temas detectados`} />
      {data.content_categories?.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Categorias de contenido</h4>
          <div className="flex flex-wrap gap-2">
            {data.content_categories.map((c: any) => (
              <span key={c.name} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-xs font-medium">
                {c.name} ({c.relevance}%)
              </span>
            ))}
          </div>
        </div>
      )}
      {data.potential_queries?.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Queries que podrian citar tu sitio</h4>
          <div className="space-y-1">
            {data.potential_queries.map((q: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-2 text-xs border-b border-gray-50">
                <span className="font-mono">{q.query}</span>
                <span className={`px-2 py-0.5 rounded-full font-medium ${
                  q.citation_probability === "alta" ? "bg-green-50 text-green-700" :
                  q.citation_probability === "media" ? "bg-amber-50 text-amber-700" : "bg-gray-50 text-gray-500"
                }`}>{q.citation_probability}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.citation_signals?.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Senales de citabilidad</h4>
          {data.citation_signals.map((s: any, i: number) => (
            <div key={i} className="flex items-center justify-between py-1.5 text-xs border-b border-gray-50">
              <span>{s.name}</span>
              <span className={`px-2 py-0.5 rounded-full font-medium ${
                s.status === "pass" ? "bg-green-50 text-green-700" :
                s.status === "warning" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
              }`}>{s.status === "pass" ? "OK" : s.status === "warning" ? "Parcial" : "Falta"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AlertsView({ data }: { data: any }) {
  if (!data) return <ErrorState />;
  return (
    <div className="space-y-5">
      <ToolHeader title="Alertas de Menciones" score={data.score} subtitle={`Marca: ${data.brand}`} />
      {data.monitoring_queries?.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Queries de monitoreo</h4>
          {data.monitoring_queries.map((q: any, i: number) => (
            <div key={i} className="bg-gray-50 p-3 rounded-lg mb-2">
              <p className="text-sm font-mono">{q.query}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">{q.description}</p>
            </div>
          ))}
        </div>
      )}
      {data.channels?.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Canales de monitoreo</h4>
          <div className="space-y-2">
            {data.channels.map((ch: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-2 text-xs border-b border-gray-50">
                <div>
                  <span className="font-medium">{ch.name}</span>
                  <span className="text-[var(--text-muted)] ml-2">{ch.description}</span>
                </div>
                {ch.setup_url && (
                  <a href={ch.setup_url} target="_blank" rel="noopener noreferrer"
                    className="text-[var(--primary)] hover:underline shrink-0">Configurar</a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {data.alert_rules?.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Reglas de alerta recomendadas</h4>
          {data.alert_rules.map((r: any, i: number) => (
            <div key={i} className="flex items-center justify-between py-2 text-xs border-b border-gray-50">
              <div><span className="font-medium">{r.name}</span> - {r.trigger}</div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                r.priority === "critica" ? "bg-red-50 text-red-700" :
                r.priority === "alta" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"
              }`}>{r.frequency}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AIOverviewView({ data }: { data: any }) {
  if (!data) return <ErrorState />;
  const imp = data.impact || {};
  return (
    <div className="space-y-5">
      <ToolHeader title="AI Overview Impact" score={data.score} subtitle={`${data.total_keywords || 0} keywords analizadas`} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Afectadas" value={`${imp.affected_pct || 0}%`} color="red" />
        <StatCard label="Alto riesgo" value={imp.high_risk || 0} color="red" />
        <StatCard label="Medio riesgo" value={imp.medium_risk || 0} color="yellow" />
        <StatCard label="Bajo riesgo" value={imp.low_risk || 0} color="green" />
      </div>
      {data.intent_breakdown?.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Desglose por intencion</h4>
          {data.intent_breakdown.map((ib: any, i: number) => (
            <div key={i} className="flex items-center justify-between py-2 text-xs border-b border-gray-50">
              <div><span className="font-medium capitalize">{ib.intent}</span> <span className="text-[var(--text-muted)]">({ib.count} keywords)</span></div>
              <span className="font-medium">{ib.avg_risk}% riesgo</span>
            </div>
          ))}
        </div>
      )}
      {data.high_risk_keywords?.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Keywords de alto riesgo</h4>
          <div className="space-y-1 max-h-48 overflow-auto">
            {data.high_risk_keywords.map((k: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-1.5 text-xs border-b border-gray-50">
                <span className="truncate max-w-sm">{k.keyword}</span>
                <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-medium">{k.ai_overview_risk_pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <Suggestions items={data.suggestions} />
    </div>
  );
}

function DuplicatesView({ data }: { data: any }) {
  if (!data) return <ErrorState />;
  const s = data.summary || {};
  return (
    <div className="space-y-5">
      <ToolHeader title="Contenido Duplicado" score={data.score} subtitle={`${data.pages_analyzed || 0} paginas analizadas`} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Paginas unicas" value={`${s.uniqueness_pct || 0}%`} color="green" />
        <StatCard label="Duplicados exactos" value={s.exact_duplicates || 0} color="red" />
        <StatCard label="Pares similares" value={s.similar_pairs || 0} color="yellow" />
        <StatCard label="Promedio palabras" value={s.avg_words_per_page || 0} />
      </div>
      {data.duplicates?.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Duplicados exactos</h4>
          {data.duplicates.map((d: any, i: number) => (
            <div key={i} className="bg-red-50 p-3 rounded-lg mb-2 text-xs">
              <p className="font-medium text-red-700">{d.count} paginas con contenido identico:</p>
              {d.urls.map((u: string, j: number) => <p key={j} className="text-red-600 truncate">{u}</p>)}
            </div>
          ))}
        </div>
      )}
      {data.similar_pages?.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Paginas similares</h4>
          <div className="space-y-1 max-h-48 overflow-auto">
            {data.similar_pages.slice(0, 10).map((sp: any, i: number) => (
              <div key={i} className="py-2 text-xs border-b border-gray-50">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{sp.similarity_pct}% similar</span>
                </div>
                <p className="text-[var(--text-muted)] truncate">{sp.url_a}</p>
                <p className="text-[var(--text-muted)] truncate">{sp.url_b}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <Suggestions items={data.suggestions} />
    </div>
  );
}

/* ──── Shared sub-components ──── */

function ToolHeader({ title, score, subtitle }: { title: string; score?: number; subtitle?: string }) {
  return (
    <div className="flex items-center justify-between pb-4 border-b border-gray-100">
      <div>
        <h3 className="text-xl font-bold">{title}</h3>
        {subtitle && <p className="text-sm text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
      </div>
      {score !== undefined && <ScoreCircle score={score} size="sm" />}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  const colors: Record<string, { text: string; bg: string; border: string }> = {
    green: { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-100" },
    red: { text: "text-red-700", bg: "bg-red-50", border: "border-red-100" },
    yellow: { text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-100" },
    blue: { text: "text-blue-700", bg: "bg-blue-50", border: "border-blue-100" },
  };
  const c = color ? colors[color] : null;
  return (
    <div className={`rounded-xl p-4 border ${c ? `${c.bg} ${c.border}` : "bg-gray-50 border-gray-100"}`}>
      <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
      <p className={`text-xl font-bold ${c ? c.text : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function Suggestions({ items }: { items?: any[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <h4 className="font-semibold text-sm mb-2">Sugerencias</h4>
      <div className="space-y-2">{items.map((s, i) => <SuggestionItem key={i} suggestion={s} />)}</div>
    </div>
  );
}

function Issues({ items }: { items?: any[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <h4 className="font-semibold text-sm mb-2">Problemas ({items.length})</h4>
      <div className="max-h-48 overflow-auto">{items.map((issue, i) => <IssueItem key={i} issue={issue} />)}</div>
    </div>
  );
}

function ErrorState() {
  return <div className="text-center py-12 text-[var(--text-muted)]">Error al cargar datos de esta herramienta.</div>;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
