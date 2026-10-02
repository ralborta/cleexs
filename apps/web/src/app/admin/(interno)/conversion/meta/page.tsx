'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  DollarSign,
  Eye,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  Share2,
  Users,
} from 'lucide-react';
import { AdminAuthExpiredCard, looksLikeAdminAuthError } from '@/components/admin/admin-callout';
import { adminUiFetch } from '@/lib/admin-ui-client-fetch';
import {
  addDaysToDayString,
  formatDayInArgentina,
} from '@cleexs/shared';
import type { Metrics } from '@/components/conversion/conversion-metrics-dashboard';

export const dynamic = 'force-dynamic';

type Preset = '7' | '15' | '30' | '90';

function fmt(n: number) {
  return n.toLocaleString('es-AR');
}

function pct(num: number, den: number): string {
  if (den <= 0) return '—';
  return `${Math.round((num / den) * 1000) / 10}%`;
}

function rangeForPreset(preset: Preset): { from: string; to: string } {
  const today = formatDayInArgentina();
  const span = preset === '7' ? 6 : preset === '15' ? 14 : preset === '30' ? 29 : 89;
  return { from: addDaysToDayString(today, -span), to: today };
}

async function loadLanding(from: string, to: string, landing: 'all' | 'meta-v1'): Promise<Metrics> {
  const qs = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&landing=${landing}`;
  const res = await adminUiFetch(`/api/admin-ui/conversion${qs}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || `HTTP ${res.status}`);
  return json as Metrics;
}

function Card({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

export default function AdminConversionMetaPage() {
  const [preset, setPreset] = useState<Preset>('30');
  const range = useMemo(() => rangeForPreset(preset), [preset]);
  const [meta, setMeta] = useState<Metrics | null>(null);
  const [all, setAll] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authExpired, setAuthExpired] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAuthExpired(false);
    try {
      const [m, a] = await Promise.all([
        loadLanding(range.from, range.to, 'meta-v1'),
        loadLanding(range.from, range.to, 'all'),
      ]);
      setMeta(m);
      setAll(a);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al cargar';
      if (looksLikeAdminAuthError(msg)) setAuthExpired(true);
      else setError(msg);
      setMeta(null);
      setAll(null);
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const mf = meta?.funnel;
  const af = all?.funnel;

  const metaVisitors = mf?.homeVisitors.count ?? 0;
  const allVisitors = af?.homeVisitors.count ?? 0;
  const metaUrl = mf?.urlSubmitted.count ?? 0;
  const metaEmail = mf?.emailLeft.count ?? 0;
  const metaShared = mf?.shared.count ?? 0;
  const metaUnlock = mf?.unlockClicks.count ?? 0;
  const metaPurchased = mf?.purchased.count ?? 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Cleexs · Meta Ads</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Resultados Meta</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Tráfico y conversión de publicidad Meta: landing <code className="text-xs">/meta</code> +
            campañas Meta/IG. Comparado contra el total Cleexs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/conversion"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Conversión completa
          </Link>
          <button
            type="button"
            onClick={() => void reload()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {(['7', '15', '30', '90'] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPreset(p)}
            className={
              preset === p
                ? 'rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white'
                : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50'
            }
          >
            {p === '90' ? '90 días' : `${p} días`}
          </button>
        ))}
        <span className="text-xs text-slate-400">
          {range.from} → {range.to}
        </span>
      </div>

      {authExpired ? <AdminAuthExpiredCard /> : null}
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {loading && !meta ? (
        <div className="flex items-center gap-2 py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando métricas Meta…
        </div>
      ) : meta && mf ? (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <Card
              icon={<Eye className="h-4 w-4" />}
              label="Visitas Meta"
              value={fmt(metaVisitors)}
              sub={`${fmt(mf.homeVisitors.pageViews)} pageviews · /meta + ads`}
            />
            <Card
              icon={<Users className="h-4 w-4" />}
              label="% del total Cleexs"
              value={pct(metaVisitors, allVisitors)}
              sub={`${fmt(metaVisitors)} de ${fmt(allVisitors)} visitas totales`}
            />
            <Card
              icon={<DollarSign className="h-4 w-4" />}
              label="Compras Meta"
              value={fmt(metaPurchased)}
              sub={`${pct(metaPurchased, metaVisitors)} de visitas Meta`}
            />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Embudo Meta</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Visitantes → URL → email → share → unlock → compra
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Card
                icon={<Eye className="h-4 w-4" />}
                label="Visitas"
                value={fmt(metaVisitors)}
              />
              <Card
                icon={<Users className="h-4 w-4" />}
                label="URL enviada"
                value={fmt(metaUrl)}
                sub={pct(metaUrl, metaVisitors)}
              />
              <Card
                icon={<Mail className="h-4 w-4" />}
                label="Dejaron email"
                value={fmt(metaEmail)}
                sub={pct(metaEmail, metaVisitors)}
              />
              <Card
                icon={<Share2 className="h-4 w-4" />}
                label="Compartieron"
                value={fmt(metaShared)}
                sub={pct(metaShared, metaVisitors)}
              />
              <Card
                icon={<Lock className="h-4 w-4" />}
                label="Unlock clicks"
                value={fmt(metaUnlock)}
                sub={pct(metaUnlock, metaVisitors)}
              />
              <Card
                icon={<DollarSign className="h-4 w-4" />}
                label="Compraron"
                value={fmt(metaPurchased)}
                sub={pct(metaPurchased, metaVisitors)}
              />
            </div>
          </section>

          {af ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Meta vs total</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="pb-2 pr-4 font-semibold">Etapa</th>
                      <th className="pb-2 pr-4 font-semibold">Meta</th>
                      <th className="pb-2 pr-4 font-semibold">Total</th>
                      <th className="pb-2 font-semibold">% Meta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {(
                      [
                        ['Visitas', metaVisitors, af.homeVisitors.count],
                        ['URL', metaUrl, af.urlSubmitted.count],
                        ['Email', metaEmail, af.emailLeft.count],
                        ['Share', metaShared, af.shared.count],
                        ['Unlock', metaUnlock, af.unlockClicks.count],
                        ['Compra', metaPurchased, af.purchased.count],
                      ] as const
                    ).map(([label, m, t]) => (
                      <tr key={label}>
                        <td className="py-2.5 pr-4 font-medium">{label}</td>
                        <td className="py-2.5 pr-4 tabular-nums">{fmt(m)}</td>
                        <td className="py-2.5 pr-4 tabular-nums">{fmt(t)}</td>
                        <td className="py-2.5 tabular-nums font-semibold text-slate-900">
                          {pct(m, t)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <p className="text-[11px] text-slate-400">
            Fuente: mismas métricas que /admin/conversion con filtro landing=meta-v1 (path /meta +
            sources Meta/IG). Corte de métricas Meta desde ago-2026.
          </p>
        </>
      ) : null}
    </div>
  );
}
