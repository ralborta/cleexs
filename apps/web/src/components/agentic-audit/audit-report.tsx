'use client';

import { AlertTriangle, CheckCircle2, Info, MinusCircle, XCircle } from 'lucide-react';

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'info';

export interface AuditCheck {
  id: string;
  label: string;
  status: CheckStatus;
  score: number;
  summary: string;
  detail?: string;
}

export interface AuditCategory {
  id: string;
  label: string;
  weight: number;
  score: number;
  checks: AuditCheck[];
}

export interface AuditRecommendation {
  priority: 'alta' | 'media' | 'baja';
  category: string;
  title: string;
  detail: string;
}

export interface AgenticAuditResult {
  targetUrl: string;
  finalUrl?: string;
  fetchedAt: string;
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  categories: AuditCategory[];
  recommendations: AuditRecommendation[];
  deepTools?: {
    schema?: {
      schemas_found: Array<{ schema_type: string; source: string; missing_recommended: string[] }>;
      total_schemas: number;
      missing_types: string[];
    };
    crawlability?: {
      pages_crawled: number;
      issues: Array<{ severity: string; message: string; url: string; details?: string }>;
      summary: { critical: number; warnings: number; total_issues: number };
    };
    recommendedRobots?: string;
  };
  meta?: {
    psiUsed: boolean;
    durationMs: number;
    warnings: string[];
    toolsSource?: string;
  };
}

function scoreColor(score: number): { text: string; ring: string; bg: string } {
  if (score >= 75) return { text: 'text-emerald-700', ring: 'ring-emerald-200', bg: 'bg-emerald-50' };
  if (score >= 60) return { text: 'text-amber-700', ring: 'ring-amber-200', bg: 'bg-amber-50' };
  if (score >= 40) return { text: 'text-orange-700', ring: 'ring-orange-200', bg: 'bg-orange-50' };
  return { text: 'text-rose-700', ring: 'ring-rose-200', bg: 'bg-rose-50' };
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === 'pass') return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />;
  if (status === 'warn') return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />;
  if (status === 'fail') return <XCircle className="h-4 w-4 shrink-0 text-rose-600" />;
  return <Info className="h-4 w-4 shrink-0 text-slate-400" />;
}

function ScoreGauge({ score, grade }: { score: number; grade: string }) {
  const c = scoreColor(score);
  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative flex h-40 w-40 items-center justify-center">
      <svg className="h-40 w-40 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="52" fill="none" stroke="#e2e8f0" strokeWidth="12" />
        <circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={c.text}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-4xl font-bold tabular-nums ${c.text}`}>{score}</span>
        <span className="text-xs font-medium text-slate-400">/ 100 · {grade}</span>
      </div>
    </div>
  );
}

const PRIORITY_STYLES: Record<string, string> = {
  alta: 'bg-rose-100 text-rose-800 ring-rose-200',
  media: 'bg-amber-100 text-amber-800 ring-amber-200',
  baja: 'bg-slate-100 text-slate-700 ring-slate-200',
};

/**
 * Informe de Auditoría Agéntica. Se usa tanto en el panel admin como en la
 * página pública que ve el cliente.
 */
export function AgenticAuditReport({ result }: { result: AgenticAuditResult }) {
  const c = scoreColor(result.overallScore);
  return (
    <div className="space-y-6">
      {/* Resumen / score */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
          <ScoreGauge score={result.overallScore} grade={result.grade} />
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-500">
              Agent-Readiness Score
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              ¿Qué tan legible es tu sitio para los agentes de IA?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Mide si ChatGPT, Claude, Gemini, Perplexity y los nuevos agentes de IA pueden{' '}
              <strong className="font-semibold text-slate-800">leer, entender e interactuar</strong>{' '}
              con tu web. Un score alto significa que estás preparado para el tráfico que viene de las IAs.
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              {result.categories.map((cat) => {
                const cc = scoreColor(cat.score);
                return (
                  <span
                    key={cat.id}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ${cc.bg} ${cc.text} ${cc.ring}`}
                  >
                    {cat.label}: {cat.score}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Recomendaciones */}
      {result.recommendations.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">Qué mejorar (priorizado)</h3>
          <ul className="mt-4 space-y-3">
            {result.recommendations.map((rec, i) => (
              <li key={i} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-slate-900">{rec.title}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${
                      PRIORITY_STYLES[rec.priority] || PRIORITY_STYLES.baja
                    }`}
                  >
                    {rec.priority}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{rec.detail}</p>
                <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  {rec.category}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Detalle por categoría */}
      <div className="space-y-4">
        {result.categories.map((cat) => {
          const cc = scoreColor(cat.score);
          return (
            <div key={cat.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-slate-900">{cat.label}</h3>
                <span className={`rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums ring-1 ${cc.bg} ${cc.text} ${cc.ring}`}>
                  {cat.score}/100
                </span>
              </div>
              <ul className="mt-4 divide-y divide-slate-100">
                {cat.checks.map((check) => (
                  <li key={check.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <StatusIcon status={check.status} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">{check.label}</p>
                      <p className="mt-0.5 text-sm text-slate-600">{check.summary}</p>
                      {check.detail && (
                        <p className="mt-1 text-xs leading-relaxed text-slate-400">{check.detail}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {result.deepTools?.schema && result.deepTools.schema.schemas_found.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">Schemas detectados (análisis profundo)</h3>
          <ul className="mt-3 space-y-2">
            {result.deepTools.schema.schemas_found.slice(0, 8).map((s, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"
              >
                <span className="font-medium text-slate-800">
                  {s.schema_type}{' '}
                  <span className="text-xs font-normal text-slate-400">({s.source})</span>
                </span>
                {s.missing_recommended.length > 0 && (
                  <span className="text-xs text-amber-700">
                    Faltan: {s.missing_recommended.slice(0, 3).join(', ')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.deepTools?.crawlability && result.deepTools.crawlability.issues.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">
            Rastreo del sitio ({result.deepTools.crawlability.pages_crawled} páginas)
          </h3>
          <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {result.deepTools.crawlability.issues.slice(0, 10).map((issue, i) => (
              <li key={i} className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm">
                <p className="font-medium text-slate-800">{issue.message}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{issue.url}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.deepTools?.recommendedRobots && (
        <div className="rounded-2xl border border-violet-100 bg-violet-50/40 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">robots.txt recomendado</h3>
          <p className="mt-1 text-xs text-slate-600">
            Plantilla sugerida para permitir bots de IA (basada en cleexs-tools).
          </p>
          <pre className="mt-3 max-h-48 overflow-auto rounded-xl border border-violet-200 bg-white p-4 text-xs leading-relaxed text-slate-700">
            {result.deepTools.recommendedRobots}
          </pre>
        </div>
      )}

      {result.meta?.warnings && result.meta.warnings.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
          <MinusCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <p className="font-semibold">Notas técnicas de la corrida:</p>
            <ul className="mt-1 list-disc pl-4">
              {result.meta.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
