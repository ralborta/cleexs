'use client';

import Link from 'next/link';
import React, { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  AlertTriangle,
  Braces,
  ChevronDown,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Clock,
  Copy,
  ExternalLink,
  FileSearch,
  Gauge,
  Globe,
  Info,
  LayoutTemplate,
  Lightbulb,
  ListChecks,
  Loader2,
  Quote,
  ShieldAlert,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PublicDiagnosticSatelliteModule } from '@/lib/api';
import { CLEEXS_TOOLS_PUBLIC_URL } from '@/lib/site';
import { cn } from '@/lib/utils';

/** Orden alineado con el dashboard CleexsTools37 */
const SATELLITE_TOOL_ROWS: Array<{ key: string; label: string; Icon: LucideIcon }> = [
  { key: 'crawlability', label: 'Crawlability', Icon: Globe },
  { key: 'robots_sitemap', label: 'Robots & Sitemap', Icon: FileSearch },
  { key: 'schema', label: 'Schema', Icon: Braces },
  { key: 'axp', label: 'AXP', Icon: Zap },
  { key: 'ai_presence', label: 'AI Presence', Icon: Sparkles },
  { key: 'citations', label: 'Citations', Icon: Quote },
  { key: 'alerts', label: 'Alerts', Icon: AlertTriangle },
  { key: 'freshness', label: 'Freshness', Icon: Clock },
  { key: 'ai_overview', label: 'AI Overview', Icon: LayoutTemplate },
  { key: 'duplicates', label: 'Duplicados', Icon: Copy },
];

function satelliteScoreColor(score: number, hasError?: boolean) {
  if (hasError) return { border: 'border-l-red-400', icon: 'bg-red-50 text-red-500', bar: 'bg-red-400', text: 'text-red-600' };
  if (score <= 0) return { border: 'border-l-slate-200', icon: 'bg-slate-100 text-slate-400', bar: 'bg-slate-200', text: 'text-slate-400' };
  if (score >= 80) return { border: 'border-l-emerald-400', icon: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-400', text: 'text-emerald-700' };
  if (score >= 50) return { border: 'border-l-amber-400', icon: 'bg-amber-50 text-amber-600', bar: 'bg-amber-400', text: 'text-amber-700' };
  return { border: 'border-l-amber-400', icon: 'bg-amber-50 text-amber-600', bar: 'bg-amber-400', text: 'text-amber-700' };
}

// kept for backward compat (used nowhere else but just in case)
function satelliteScoreStyles(score: number, hasError?: boolean) {
  if (hasError) return 'text-destructive border-destructive/30 bg-destructive/5';
  if (score >= 80) return 'text-emerald-700 border-emerald-200 bg-emerald-50/80';
  if (score >= 50) return 'text-amber-700 border-amber-200 bg-amber-50/80';
  return 'text-red-700 border-red-200 bg-red-50/80';
}

function humanizeDetailKey(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Claves que nunca mostramos en el resumen (contenido crudo, HTML, cuerpos de respuesta). */
function normalizeDetailKeyForFilter(key: string) {
  return key.trim().toLowerCase().replace(/\s+/g, '_');
}

function shouldOmitDetailFieldKey(key: string): boolean {
  const n = normalizeDetailKeyForFilter(key);
  const omitExact = new Set([
    'raw_content',
    'rawcontent',
    'raw_html',
    'raw_html_body',
    'response_body',
    'response_text',
    'payload',
  ]);
  if (omitExact.has(n)) return true;
  if (n.includes('raw') && (n.includes('content') || n.includes('body'))) return true;
  return false;
}

/** En listados compactos; el panel expandido usa `MAX_DETAIL_STRING_EXPANDED`. */
const MAX_DETAIL_STRING_LEN = 420;
const MAX_DETAIL_STRING_EXPANDED = 12_000;

function looksLikeRawMarkup(text: string): boolean {
  const t = text.trimStart().toLowerCase();
  return (
    t.startsWith('<!doctype') ||
    t.startsWith('<html') ||
    t.startsWith('<?xml') ||
    (t.includes('<head') && t.includes('<body')) ||
    (t.startsWith('<') && t.length > 200 && /<\/[a-z]+>/i.test(t))
  );
}

function formatDetailPrimitive(
  key: string | undefined,
  value: unknown,
  maxStr: number = MAX_DETAIL_STRING_LEN
): string | null {
  if (key !== undefined && shouldOmitDetailFieldKey(key)) return null;
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t.length) return null;
    if (looksLikeRawMarkup(t)) {
      return 'La respuesta parece HTML o XML (no es texto plano con URLs, como un sitemap o robots.txt legibles línea a línea). En este panel no mostramos el cuerpo completo por tamaño y legibilidad.';
    }
    if (t.length > maxStr) {
      return `${t.slice(0, maxStr)}... [${t.length - maxStr} caracteres más no mostrados aquí]`;
    }
    return t;
  }
  return null;
}

const SUGGESTION_PRIORITY_META: Record<
  string,
  { box: string; Icon: LucideIcon; short: string }
> = {
  critica: {
    box: 'border-red-200/80 bg-red-50/90 text-red-900',
    Icon: ShieldAlert,
    short: 'Crítica',
  },
  alta: {
    box: 'border-amber-200/80 bg-amber-50/90 text-amber-900',
    Icon: AlertTriangle,
    short: 'Alta',
  },
  media: {
    box: 'border-sky-200/80 bg-sky-50/90 text-sky-900',
    Icon: Gauge,
    short: 'Media',
  },
  baja: {
    box: 'border-slate-200/80 bg-slate-50/95 text-slate-800',
    Icon: CircleDot,
    short: 'Baja',
  },
  info: {
    box: 'border-emerald-200/80 bg-emerald-50/90 text-emerald-900',
    Icon: Info,
    short: 'Info',
  },
};

function SatelliteValueBlock({
  label,
  value,
  depth,
}: {
  label?: string;
  value: unknown;
  depth: number;
}): React.ReactNode {
  if (depth > 8) {
    return <p className="text-xs italic text-slate-400">Profundidad máxima alcanzada.</p>;
  }
  if (value === null || value === undefined) {
    return <span className="text-sm text-slate-400">...</span>;
  }
  if (typeof value === 'boolean') {
    return <span className="text-sm">{value ? 'Sí' : 'No'}</span>;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return <span className="text-sm tabular-nums font-medium text-slate-800">{String(value)}</span>;
  }
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t.length) return <span className="text-sm text-slate-400">...</span>;
    if (looksLikeRawMarkup(t)) {
      return (
        <p className="text-sm text-amber-800 bg-amber-50/80 rounded-lg border border-amber-100 px-3 py-2">
          Contenido tipo HTML/XML omitido en esta vista por seguridad y legibilidad.
        </p>
      );
    }
    const max = MAX_DETAIL_STRING_EXPANDED;
    const shown = t.length > max ? `${t.slice(0, max)}...` : t;
    return (
      <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap break-words max-h-72 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
        {shown}
        {t.length > max ? (
          <span className="mt-2 block text-xs font-medium text-slate-500">
            Total {t.length} caracteres ... el resto no se muestra completo en este panel.
          </span>
        ) : null}
      </p>
    );
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-sm text-slate-400">Sin ?tems</span>;
    }
    if (value.every((x) => typeof x === 'string')) {
      return (
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-800">
          {(value as string[]).map((s, i) => (
            <li key={i} className="leading-snug break-words">
              {s}
            </li>
          ))}
        </ul>
      );
    }
    return (
      <ul className="space-y-2">
        {value.map((item, i) => (
          <li
            key={i}
            className="rounded-lg border border-slate-100 bg-white px-3 py-2.5 text-sm shadow-sm"
          >
            {typeof item === 'object' && item !== null && !Array.isArray(item) ? (
              <div className="space-y-2">
                {Object.entries(item as Record<string, unknown>).map(([ik, iv]) => {
                  if (shouldOmitDetailFieldKey(ik)) return null;
                  return (
                    <div key={ik}>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        {humanizeDetailKey(ik)}
                      </p>
                      <div className="mt-0.5">{SatelliteValueBlock({ value: iv, depth: depth + 1 })}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              SatelliteValueBlock({ value: item, depth: depth + 1 })
            )}
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return (
      <div className="space-y-2 border-l-2 border-slate-200 pl-3">
        {Object.entries(o).map(([k, v]) => {
          if (shouldOmitDetailFieldKey(k)) return null;
          const prim = formatDetailPrimitive(k, v, MAX_DETAIL_STRING_EXPANDED);
          if (prim !== null) {
            return (
              <div key={k}>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{humanizeDetailKey(k)}</p>
                <p className="mt-0.5 text-sm text-slate-800">{prim}</p>
              </div>
            );
          }
          return (
            <div key={k}>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{humanizeDetailKey(k)}</p>
              <div className="mt-1">{SatelliteValueBlock({ value: v, depth: depth + 1 })}</div>
            </div>
          );
        })}
      </div>
    );
  }
  return <span className="text-sm text-slate-600">{String(value)}</span>;
}

/** Detalle estructurado (similar densidad al panel del Tools): campos simples + listas + objetos anidados. */
function SatelliteDetailSections({ detail }: { detail: Record<string, unknown> }) {
  const skip = new Set(['_truncated', '_note', 'error', 'suggestions', 'score']);
  const rows: { label: string; value: string }[] = [];
  const complex: { key: string; label: string; value: unknown }[] = [];

  for (const [k, v] of Object.entries(detail)) {
    if (skip.has(k)) continue;
    if (shouldOmitDetailFieldKey(k)) continue;
    const prim = formatDetailPrimitive(k, v, MAX_DETAIL_STRING_LEN);
    if (prim !== null) {
      rows.push({ label: humanizeDetailKey(k), value: prim });
      continue;
    }
    if (v !== null && v !== undefined) {
      complex.push({ key: k, label: humanizeDetailKey(k), value: v });
    }
  }

  if (rows.length === 0 && complex.length === 0) return null;

  return (
    <div className="space-y-6">
      {rows.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
            <ClipboardList className="h-3.5 w-3.5 text-primary-500" aria-hidden />
            Resumen de campos
          </p>
          <dl className="grid gap-2 sm:grid-cols-2">
            {rows.map((r) => (
              <div key={r.label} className="rounded-lg border border-slate-100 bg-white px-3 py-2.5">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{r.label}</dt>
                <dd className="mt-0.5 text-sm font-medium leading-snug text-slate-900">{r.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {complex.map(({ key, label, value }) => (
        <div key={key} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</p>
          <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3">
            {SatelliteValueBlock({ label, value, depth: 0 })}
          </div>
        </div>
      ))}
    </div>
  );
}

const AEO_SKELETON_HINTS = [
  'Seguimos analizando tu sitio...',
  'En sitios con mucho contenido puede demorar un poco más.',
  'Podés usar el resto del informe arriba; esta sección se actualiza sola.',
  'Estamos consolidando señales técnicas del dominio.',
] as const;

export function SatelliteModuleSkeleton() {
  const [hintIdx, setHintIdx] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setHintIdx((i) => (i + 1) % AEO_SKELETON_HINTS.length);
    }, 10_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <Card className="border border-dashed border-primary-200/80 bg-white shadow-md">
      <CardHeader className="space-y-3 pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-xl text-foreground">
          <Sparkles className="h-5 w-5 shrink-0 animate-pulse text-primary-600" aria-hidden />
          <span>Análisis técnico del sitio (AEO)</span>
        </CardTitle>
        <div className="space-y-2">
          <div className="aeo-progress-track" aria-hidden />
          <p className="text-sm font-semibold text-primary-900 sm:text-base">Generando análisis técnico del sitio...</p>
          <p
            key={hintIdx}
            className="text-xs leading-relaxed text-slate-600 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300 sm:text-sm"
          >
            {AEO_SKELETON_HINTS[hintIdx]}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[4.5rem] rounded-lg bg-gradient-to-br from-slate-100 to-slate-50 animate-pulse"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 md:gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="h-[5.25rem] rounded-lg border border-slate-100 bg-slate-50/80 animate-pulse"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
        <div
          className="flex items-start gap-3 rounded-xl border-2 border-primary-200/90 bg-gradient-to-br from-primary-100/95 via-primary-50 to-sky-50/80 px-4 py-4 shadow-md shadow-primary-900/5 sm:items-center sm:gap-4"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <Loader2
            className="h-6 w-6 shrink-0 animate-spin text-primary-700 sm:h-7 sm:w-7"
            aria-hidden
          />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-semibold leading-snug text-primary-950 sm:text-base">Proceso en curso</p>
            <p className="text-xs leading-relaxed text-primary-900/85 sm:text-sm">
              La página se actualiza sola cuando termine. No hace falta recargar manualmente.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SatelliteToolDetailPanel({
  label,
  toolError,
  detail,
}: {
  label: string;
  toolError?: string;
  detail?: Record<string, unknown>;
}) {
  const err = toolError || (typeof detail?.error === 'string' ? detail.error : null);

  if ((!detail || Object.keys(detail).length === 0) && !err) {
    return (
      <p className="text-left text-sm leading-relaxed text-muted-foreground">
        No hay detalle guardado para <span className="font-medium text-foreground">{label}</span> en este informe.
        Podés generar un diagnóstico nuevo o revisar más adelante si el análisis técnico aún se está completando.
      </p>
    );
  }

  const truncated = detail?._truncated === true;
  const note = typeof detail?._note === 'string' ? detail._note : null;
  const suggestions = detail && Array.isArray(detail.suggestions) ? detail.suggestions : null;

  return (
    <div className="space-y-5 text-left font-sans">
      {err && (
        <div className="flex gap-2.5 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="leading-snug">{err}</p>
        </div>
      )}

      {suggestions && suggestions.length > 0 && (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
            <Lightbulb className="h-3.5 w-3.5 text-amber-500" aria-hidden />
            Sugerencias ({suggestions.length})
          </p>
          <ul className="space-y-2">
            {suggestions.map((s: unknown, i: number) => {
              const item = s as { message?: string; priority?: string; detail?: string; action?: string };
              const message = (item.message || '').trim();
              if (!message) return null;
              const p = (item.priority || 'info').trim().toLowerCase();
              const meta = SUGGESTION_PRIORITY_META[p] || SUGGESTION_PRIORITY_META.info;
              const PriIcon = meta.Icon;
              return (
                <li key={i} className={cn('rounded-lg border px-3 py-3', meta.box)}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <PriIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                        meta.box
                      )}
                    >
                      {meta.short}
                    </span>
                  </div>
                  <p className="text-sm font-semibold leading-snug">{message}</p>
                  {item.action && (
                    <p className="mt-1.5 text-xs font-semibold leading-relaxed">... {item.action}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {detail && <SatelliteDetailSections detail={detail} />}

      {truncated && note ? (
        <div className="flex gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          <p>{note}</p>
        </div>
      ) : null}
    </div>
  );
}

function toolLabelFromSatelliteSource(source: string): string {
  return SATELLITE_TOOL_ROWS.find((r) => r.key === source)?.label ?? source.replace(/_/g, ' ');
}

function countByActionPriority(actions: PublicDiagnosticSatelliteModule['actions']) {
  const c = { critica: 0, alta: 0, media: 0, baja: 0, info: 0 };
  for (const a of actions) {
    const p = (a.priority || 'info').trim().toLowerCase();
    if (p in c) c[p as keyof typeof c] += 1;
    else c.info += 1;
  }
  return c;
}

const ACTION_PILL_META: Record<
  string,
  { label: string; className: string }
> = {
  critica: { label: 'CRÍTICO', className: 'border-red-400 bg-red-50 text-red-900' },
  alta: { label: 'ALTA', className: 'border-amber-400 bg-amber-50 text-amber-950' },
  media: { label: 'MEDIA', className: 'border-sky-400 bg-sky-50 text-sky-950' },
  baja: { label: 'BAJA', className: 'border-slate-300 bg-slate-50 text-slate-800' },
  info: { label: 'INFO', className: 'border-emerald-400 bg-emerald-50 text-emerald-950' },
};

/** Prioridad visual del borde izquierdo en tarjetas de acción (orden de severidad). */
function actionCardBorderClass(priority: string): string {
  const p = priority.trim().toLowerCase();
  if (p === 'critica') return 'border-l-red-500';
  if (p === 'alta') return 'border-l-amber-500';
  if (p === 'media') return 'border-l-sky-500';
  if (p === 'baja') return 'border-l-slate-400';
  return 'border-l-emerald-500';
}

function isSatelliteModuleDegraded(module: PublicDiagnosticSatelliteModule): boolean {
  const nTools = Object.keys(module.tools || {}).length;
  const nActions = module.actions?.length ?? 0;
  const noPayload = nTools === 0 && nActions === 0;
  if (module.status === 'timeout' || module.status === 'failed' || module.status === 'skipped') return true;
  if (module.status === 'completed' && noPayload) return true;
  return false;
}

function SatelliteAeoDegradedNotice({
  module,
  siteUrl,
}: {
  module: PublicDiagnosticSatelliteModule;
  siteUrl: string;
}) {
  const title =
    module.status === 'timeout'
      ? 'Tiempo de espera agotado'
      : module.status === 'failed'
        ? 'No pudimos analizar el sitio desde aquí'
        : module.status === 'skipped'
          ? 'Análisis técnico no ejecutado'
          : 'Sin datos de herramientas en esta corrida';

  const body =
    module.status === 'timeout'
      ? 'El análisis técnico del sitio tardó más de lo que el servidor pudo esperar. No guardamos scores ni detalle: no es que el sitio saque cero, es que la corrida no llegó a completarse.'
      : module.status === 'failed'
        ? module.error?.trim() ||
          'El servicio de análisis del sitio respondió con error. Volvé a intentar más tarde o generá un diagnóstico nuevo con la misma URL.'
        : module.status === 'skipped'
          ? 'Este diagnóstico no incluye URL de sitio o el módulo AEO está desactivado.'
          : 'La corrida figura como completada pero no recibimos resultados por herramienta. Podés generar un diagnóstico nuevo o revisar el sitio con tu equipo técnico.';

  const toolsUrl = CLEEXS_TOOLS_PUBLIC_URL;

  return (
    <div className="rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-50/95 via-white to-orange-50/40 p-5 shadow-sm ring-1 ring-amber-100/80 sm:p-6">
      <div className="flex gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 shadow-inner">
          <AlertCircle className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0 space-y-2">
          <p className="text-base font-bold tracking-tight text-slate-900">{title}</p>
          <p className="text-sm leading-relaxed text-slate-700">{body}</p>
          {siteUrl ? (
            <p className="text-xs text-slate-600">
              <span className="font-semibold text-slate-800">URL prevista:</span>{' '}
              <a href={siteUrl} className="text-primary-600 underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
                {siteUrl}
              </a>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            {toolsUrl ? (
              <a
                href={toolsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-slate-800"
              >
                Ver análisis técnico ampliado
                <ExternalLink className="h-4 w-4 opacity-90" aria-hidden />
              </a>
            ) : null}
            <Link
              href="/diagnostico/crear"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              Nuevo diagnóstico
            </Link>
          </div>
          {!toolsUrl ? (
            <p className="text-xs text-slate-500">
              Si tu organización tiene un enlace propio al análisis técnico ampliado, puede configurarse en el
              despliegue:{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">NEXT_PUBLIC_CLEEXS_TOOLS_URL</code>{' '}
              (solo equipo técnico).
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SatelliteActionsExecuteBlock({ module }: { module: PublicDiagnosticSatelliteModule }) {
  const actions = module.actions ?? [];
  const counts = countByActionPriority(actions);
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const headingId = useId();
  const total = actions.length;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-teal-800/25 shadow-md shadow-teal-900/10 ring-1 ring-teal-900/10"
      aria-labelledby={headingId}
    >
      <button
        type="button"
        id={headingId}
        className="flex w-full flex-wrap items-center gap-3 bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-700 px-4 py-3.5 text-left transition hover:brightness-[1.03] sm:px-5"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white ring-1 ring-white/25">
          <ChevronDown
            className={cn('h-5 w-5 transition-transform duration-200', expanded && 'rotate-180')}
            aria-hidden
          />
        </span>
        <div className="min-w-0 flex-1">
          <span className="block text-base font-bold tracking-tight text-white sm:text-lg">Acciones a ejecutar</span>
          <span className="mt-0.5 block text-xs font-medium leading-snug text-white/90 sm:text-sm">
            Prioridades del análisis técnico del sitio (AEO).{' '}
            <span className="text-white/85">
              {total > 0
                ? `${total} tareas · tocá para ${expanded ? 'ocultar' : 'ver'} píldoras y lista.`
                : expanded
                  ? 'Tocá de nuevo para ocultar.'
                  : 'Tocá para ver el mensaje cuando no hay acciones.'}
            </span>
          </span>
        </div>
        <ListChecks className="hidden h-7 w-7 shrink-0 text-white/85 sm:block" aria-hidden />
      </button>

      {expanded ? (
        <div
          id={panelId}
          role="region"
          aria-labelledby={headingId}
          className="space-y-4 border-t border-teal-900/20 bg-white px-4 py-4 sm:px-5 sm:py-5"
        >
          {actions.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-2">
                {(['critica', 'alta', 'media', 'baja', 'info'] as const).map((pk) => {
                  const n = counts[pk];
                  if (n <= 0) return null;
                  const meta = ACTION_PILL_META[pk];
                  return (
                    <span
                      key={pk}
                      className={cn(
                        'inline-flex items-center rounded-full border-2 px-3 py-1 text-xs font-bold tabular-nums',
                        meta.className
                      )}
                    >
                      {meta.label}: {n}
                    </span>
                  );
                })}
              </div>

              <ul className="space-y-3">
                {actions.map((action, idx) => {
                  const p = (action.priority || 'info').trim().toLowerCase();
                  const meta = SUGGESTION_PRIORITY_META[p] || SUGGESTION_PRIORITY_META.info;
                  const PriIcon = meta.Icon;
                  const src = toolLabelFromSatelliteSource(action.source);
                  return (
                    <li
                      key={`${action.source}-${idx}-${action.message.slice(0, 24)}`}
                      className={cn(
                        'rounded-xl border border-slate-200 bg-white pl-4 pr-4 py-4 shadow-sm sm:pl-5',
                        'border-l-[5px]',
                        actionCardBorderClass(p)
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2 gap-y-1">
                        <PriIcon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                        <span
                          className={cn(
                            'rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                            meta.box
                          )}
                        >
                          {meta.short}
                        </span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                          {src}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-bold leading-snug text-slate-900">{action.message}</p>
                      {action.detail ? (
                        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{action.detail}</p>
                      ) : null}
                      {action.action ? (
                        <p className="mt-2 flex items-start gap-2 text-sm font-semibold text-indigo-800">
                          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                          <span>{action.action}</span>
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              No se generaron acciones agrupadas para este sitio en esta corrida. Revisá el detalle en cada tarjeta de
              herramienta o consultá con tu equipo si hace falta un análisis más profundo.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

export function SatelliteModuleCard({
  module,
  siteUrl,
}: {
  module: PublicDiagnosticSatelliteModule;
  siteUrl: string;
}) {
  const [openToolKey, setOpenToolKey] = useState<string | null>(null);

  useEffect(() => {
    if (!openToolKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenToolKey(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openToolKey]);

  useEffect(() => {
    if (openToolKey) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
    return undefined;
  }, [openToolKey]);

  const statusLabel =
    module.status === 'completed' ? 'Completado'
    : module.status === 'timeout' ? 'Tiempo agotado'
    : module.status === 'failed' ? 'Error'
    : module.status === 'skipped' ? 'Omitido'
    : module.status === 'pending' ? 'En proceso'
    : 'No disponible';

  const totalTools = Object.keys(module.tools || {}).length;
  const degraded = isSatelliteModuleDegraded(module);
  const overallStyle = satelliteScoreColor(module.overallScore, false);

  const openRow = openToolKey ? SATELLITE_TOOL_ROWS.find((r) => r.key === openToolKey) : null;
  const openTool = openRow && openToolKey ? module.tools[openToolKey] : undefined;
  const openScore = openTool?.score ?? 0;
  const openHasStoredDetail =
    Boolean(openTool?.error) ||
    (openTool?.detail &&
      typeof openTool.detail === 'object' &&
      !Array.isArray(openTool.detail) &&
      Object.keys(openTool.detail).length > 0);

  const toolModal =
    openRow && openToolKey
      ? createPortal(
          <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4">
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/55 backdrop-blur-[1px]"
              aria-label="Cerrar panel"
              onClick={() => setOpenToolKey(null)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="satellite-tool-dialog-title"
              className="relative z-10 flex max-h-[min(92vh,880px)] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl"
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p id="satellite-tool-dialog-title" className="truncate text-base font-bold text-slate-900">
                    {openRow.label}
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-slate-600">
                    {degraded ? 'Sin datos en esta corrida' : `Score ${Math.round(openScore)}`}
                  </p>
                  {!openHasStoredDetail ? (
                    <p className="mt-1 text-xs font-medium text-amber-800/90">
                      No hay detalle guardado para esta herramienta en el diagnóstico público.
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setOpenToolKey(null)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
                <SatelliteToolDetailPanel
                  label={openRow.label}
                  toolError={openTool?.error}
                  detail={openTool?.detail}
                />
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-md ring-1 ring-slate-100/80">

      {toolModal}

      <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-violet-50/60 via-white to-sky-50/50 px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-violet-200/60 bg-white text-violet-700 shadow-sm">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">Análisis técnico del sitio (AEO)</p>
            <p className="text-xs leading-relaxed text-slate-600">
              {degraded
                ? 'Cuando la corrida falla o hace timeout, no mostramos scores vacíos como si fueran reales.'
                : 'Tocá una herramienta para ver el detalle. Abajo, acciones priorizadas según el análisis técnico.'}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Score global</p>
          {degraded ? (
            <p className="text-2xl font-black tabular-nums leading-none text-slate-400">N/D</p>
          ) : (
            <p className={cn('text-3xl font-black leading-none tabular-nums', overallStyle.text)}>
              {module.overallScore.toFixed(0)}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-6 bg-slate-50/50 p-5 sm:p-6">
        <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          <p>
            <span className="font-semibold text-slate-800">Sitio analizado:</span>{' '}
            {siteUrl ? (
              <a href={siteUrl} className="text-primary-600 underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
                {siteUrl}
              </a>
            ) : (
              '...'
            )}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Estado: <span className="font-medium text-slate-700">{statusLabel}</span>
            {degraded ? null : (
              <>
                {' '}
                · {totalTools} herramientas con datos · Si algo aparece recortado, parte del volcado técnico puede no
                mostrarse completo en esta vista.
              </>
            )}
          </p>
        </div>

        {degraded ? (
          <SatelliteAeoDegradedNotice module={module} siteUrl={siteUrl} />
        ) : (
          <div>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-slate-900">Herramientas (1...10)</p>
                <p className="text-xs text-slate-500">Clic para abrir el detalle en un panel.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {SATELLITE_TOOL_ROWS.map(({ key, label, Icon: ToolIcon }, idx) => {
                const t = module.tools[key];
                const score = t?.score ?? 0;
                const hasErr = Boolean(t?.error);
                const colors = satelliteScoreColor(score, hasErr);
                const labelShort = label.length > 16 ? `${label.slice(0, 14)}...` : label;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setOpenToolKey(key)}
                    className={cn(
                      'group flex flex-col rounded-2xl border border-slate-200/90 bg-white p-3 text-left shadow-sm transition hover:border-violet-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/80',
                      openToolKey === key && 'border-violet-400 ring-2 ring-violet-300/80 shadow-md'
                    )}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-600 group-hover:bg-violet-100 group-hover:text-violet-800">
                        {idx + 1}
                      </span>
                      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', colors.icon)}>
                        <ToolIcon className="h-4 w-4" aria-hidden />
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-xs font-bold leading-tight text-slate-900" title={label}>
                      {labelShort}
                    </p>
                    <div className="mt-2 flex items-end justify-between gap-2 border-t border-slate-100 pt-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Detalle</span>
                      <span className={cn('text-lg font-black tabular-nums leading-none', colors.text)}>
                        {score > 0 ? Math.round(score) : '...'}
                      </span>
                    </div>
                    {hasErr ? (
                      <span className="mt-1 text-[10px] font-medium text-red-600">Error</span>
                    ) : score >= 80 ? (
                      <span className="mt-1 text-[10px] font-medium text-emerald-600">Muy bien</span>
                    ) : score > 0 ? (
                      <span className="mt-1 text-[10px] font-medium text-slate-500">Revisar</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {!degraded && <SatelliteActionsExecuteBlock module={module} />}
        {degraded && (module.actions?.length ?? 0) > 0 ? <SatelliteActionsExecuteBlock module={module} /> : null}
      </div>
    </div>
  );
}
