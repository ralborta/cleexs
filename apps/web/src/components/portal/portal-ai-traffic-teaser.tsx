'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronRight, LineChart, Loader2, Plug } from 'lucide-react';

const TOKEN_KEY = 'cleexs_portal_token';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type GoogleStatus = {
  planKey: string;
  premium: boolean;
  configured: boolean;
  integration: null | {
    status: string;
    googleEmail?: string;
  };
};

type AITrafficResponse = {
  property: null | {
    ga4PropertyName: string | null;
    ga4PropertyId: string;
    lastSyncAt: string | null;
  };
  windowDays: number;
  totals: { sessions: number; totalUsers: number; conversions: number };
  bySource: Array<{
    aiSource: string;
    sessions: number;
  }>;
};

const AI_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  gemini: 'Gemini',
  claude: 'Claude',
  copilot: 'Copilot',
  you: 'You.com',
  otros_ia: 'Otras IA',
};

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR').format(n);
}

function aiName(key: string) {
  return AI_LABELS[key] || key;
}

export function PortalAiTrafficTeaser({
  runId,
  brandId,
}: {
  runId: string;
  brandId?: string | null;
}) {
  const traficoPath = `/portal-crecimiento/reporte/${runId}/premium/trafico-ia`;
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [traffic, setTraffic] = useState<AITrafficResponse | null>(null);

  useEffect(() => {
    if (!brandId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        let token: string | null = null;
        try {
          token = sessionStorage.getItem(TOKEN_KEY);
        } catch {
          token = null;
        }
        if (!token) {
          setLoading(false);
          return;
        }

        const headers = { Authorization: `Bearer ${token}` };
        const statusRes = await fetch(`${API_URL}/api/google/status`, {
          cache: 'no-store',
          headers,
        });
        if (!statusRes.ok) {
          setLoading(false);
          return;
        }

        const statusData = (await statusRes.json()) as GoogleStatus;
        if (cancelled) return;
        setStatus(statusData);

        if (
          statusData.premium &&
          statusData.integration?.status === 'active'
        ) {
          const trafficRes = await fetch(
            `${API_URL}/api/google/brands/${encodeURIComponent(brandId)}/ai-traffic`,
            { cache: 'no-store', headers }
          );
          if (trafficRes.ok && !cancelled) {
            setTraffic((await trafficRes.json()) as AITrafficResponse);
          }
        }
      } catch {
        /* best-effort teaser */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [brandId]);

  if (!brandId) return null;
  if (!loading && status && !status.premium) return null;

  const topSources = [...(traffic?.bySource ?? [])]
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 3);

  return (
    <section
      id="trafico-ia-resumen"
      className="scroll-mt-24 rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50/80 via-white to-white p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
            <LineChart className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Tráfico real desde IAs</h2>
            <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-slate-600">
              Complemento al Cleexs Score: cuántas visitas llegaron a tu web desde ChatGPT, Perplexity, Gemini y otras
              IAs (datos de Google Analytics).
            </p>
          </div>
        </div>
        <Link
          href={traficoPath}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-sky-900 hover:bg-sky-50"
        >
          Ver detalle
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin text-sky-600" aria-hidden />
          Cargando tráfico desde IAs…
        </div>
      ) : !status?.configured ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
          El módulo de tráfico IA está en configuración. Consultá con soporte si necesitás activarlo.
        </p>
      ) : !status.integration || status.integration.status !== 'active' ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-100 bg-white/80 p-3">
          <div className="flex items-start gap-2 text-xs text-slate-700">
            <Plug className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden />
            <p>
              Conectá Google Analytics para ver cuánta gente real llega a tu sitio desde asistentes de IA — además del
              score de visibilidad.
            </p>
          </div>
          <Link
            href={traficoPath}
            className="inline-flex rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700"
          >
            Conectar GA4
          </Link>
        </div>
      ) : !traffic?.property ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-100 bg-white/80 p-3 text-xs text-slate-700">
          <p>Google conectado. Elegí la propiedad GA4 de tu marca para empezar a ver el tráfico.</p>
          <Link
            href={traficoPath}
            className="inline-flex rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700"
          >
            Elegir propiedad
          </Link>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Sesiones ({traffic.windowDays} días)
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                {fmt(traffic.totals.sessions)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Usuarios</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                {fmt(traffic.totals.totalUsers)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Conversiones</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                {fmt(traffic.totals.conversions)}
              </p>
            </div>
          </div>

          {topSources.length > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Principales fuentes IA
              </p>
              <ul className="mt-2 space-y-1.5">
                {topSources.map((row) => (
                  <li key={row.aiSource} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800">{aiName(row.aiSource)}</span>
                    <span className="tabular-nums text-slate-600">{fmt(row.sessions)} sesiones</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
              GA4 conectado ({traffic.property.ga4PropertyName || traffic.property.ga4PropertyId}). Todavía no
              detectamos sesiones desde IAs en este período — puede ser normal si recién empezás o el sitio tiene poco
              tráfico.
            </p>
          )}

          {traffic.property.lastSyncAt ? (
            <p className="text-[10px] text-slate-500">
              Última sincronización:{' '}
              {new Date(traffic.property.lastSyncAt).toLocaleString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
