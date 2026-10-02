'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminAuthExpiredCard, looksLikeAdminAuthError } from '@/components/admin/admin-callout';
import { adminUiFetch } from '@/lib/admin-ui-client-fetch';
import { addDaysToDayString, formatDayInArgentina } from '@cleexs/shared';
import type { Metrics } from '@/components/conversion/conversion-metrics-dashboard';
import './meta-stitch-scope.css';

export const dynamic = 'force-dynamic';

type Preset = '7' | '15' | '30' | '90';

function fmt(n: number) {
  return n.toLocaleString('es-AR');
}

function fmtMoney(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

function pctNum(num: number, den: number): number | null {
  if (den <= 0) return null;
  return Math.round((num / den) * 1000) / 10;
}

function pctLabel(num: number, den: number): string {
  const p = pctNum(num, den);
  return p == null ? '—' : `${p}%`;
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

type FunnelStepDef = {
  key: string;
  label: string;
  icon: string;
  count: number;
  note: string;
  noteTone: 'ok' | 'bad' | 'mute' | 'good';
  barClass: string;
  rateClass: string;
};

function statusForShare(share: number | null): { label: string; tone: string } {
  if (share == null) return { label: 'Sin dato', tone: 'bg-surface-container text-on-surface-variant' };
  if (share >= 50) return { label: 'Canal Mayoritario', tone: 'bg-primary-fixed text-primary' };
  if (share >= 30) return { label: 'Estable', tone: 'bg-surface-container text-on-surface-variant' };
  if (share >= 20) return { label: 'Lead Capture', tone: 'bg-secondary-fixed text-secondary' };
  if (share >= 15) return { label: 'Engagement', tone: 'bg-tertiary-fixed/40 text-tertiary' };
  return { label: 'Baja cuota', tone: 'bg-error-container/30 text-error' };
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

  const visitors = mf?.homeVisitors.count ?? 0;
  const pageViews = mf?.homeVisitors.pageViews ?? 0;
  const url = mf?.urlSubmitted.count ?? 0;
  const email = mf?.emailLeft.count ?? 0;
  const shared = mf?.shared.count ?? 0;
  const unlock = mf?.unlockClicks.count ?? 0;
  const purchased = mf?.purchased.count ?? 0;
  const allVisitors = af?.homeVisitors.count ?? 0;

  const revenueUsd = useMemo(() => {
    const rows = mf?.purchased.bySource ?? [];
    return rows.reduce((s, r) => s + (Number(r.usd) || 0), 0);
  }, [mf]);

  const shareOfTotal = pctNum(visitors, allVisitors);
  const finalConv = pctNum(purchased, visitors);
  const stageRates = [
    { from: 'Visitas', to: 'URL', drop: visitors > 0 ? pctNum(visitors - url, visitors) : null },
    { from: 'URL', to: 'Email', drop: url > 0 ? pctNum(url - email, url) : null },
    { from: 'Email', to: 'Share', drop: email > 0 ? pctNum(email - shared, email) : null },
    { from: 'Share', to: 'Unlock', drop: shared > 0 ? pctNum(shared - unlock, shared) : null },
    { from: 'Unlock', to: 'Compra', drop: unlock > 0 ? pctNum(unlock - purchased, unlock) : null },
  ];
  const worstDrop = stageRates.reduce<(typeof stageRates)[number] | null>((best, cur) => {
    if (cur.drop == null) return best;
    if (!best || (best.drop ?? -1) < cur.drop) return cur;
    return best;
  }, null);

  const funnelSteps: FunnelStepDef[] = [
    {
      key: 'visitas',
      label: 'Visitas',
      icon: 'group',
      count: visitors,
      note: 'Drop-off: 0%',
      noteTone: 'mute',
      barClass: 'bg-primary-container',
      rateClass: 'text-primary',
    },
    {
      key: 'url',
      label: 'URL enviada',
      icon: 'link',
      count: url,
      note: visitors > 0 ? `-${pctLabel(visitors - url, visitors)} abandono` : '—',
      noteTone: 'bad',
      barClass: 'bg-primary-container',
      rateClass: 'text-primary',
    },
    {
      key: 'email',
      label: 'Dejaron email',
      icon: 'mail',
      count: email,
      note: url > 0 ? `${pctLabel(email, url)} de Paso 2` : '—',
      noteTone: 'mute',
      barClass: 'bg-primary-container',
      rateClass: 'text-primary',
    },
    {
      key: 'share',
      label: 'Compartieron',
      icon: 'share',
      count: shared,
      note: email > 0 ? `-${pctLabel(email - shared, email)} vs email` : '—',
      noteTone: 'bad',
      barClass: 'bg-secondary-container',
      rateClass: 'text-primary',
    },
    {
      key: 'unlock',
      label: 'Unlock clicks',
      icon: 'lock_open',
      count: unlock,
      note: 'Re-engagement',
      noteTone: 'good',
      barClass: 'bg-tertiary-container',
      rateClass: 'text-tertiary',
    },
    {
      key: 'compra',
      label: 'Compraron',
      icon: 'credit_card',
      count: purchased,
      note: purchased === 0 ? '0 conversiones' : `${fmt(purchased)} conversiones`,
      noteTone: purchased === 0 ? 'mute' : 'ok',
      barClass: 'bg-outline',
      rateClass: 'text-outline',
    },
  ];

  const compareRows = [
    { label: 'Visitas', icon: 'visibility', meta: visitors, total: af?.homeVisitors.count ?? 0 },
    { label: 'URL enviada', icon: 'link', meta: url, total: af?.urlSubmitted.count ?? 0 },
    { label: 'Email', icon: 'mail', meta: email, total: af?.emailLeft.count ?? 0 },
    { label: 'Share', icon: 'share', meta: shared, total: af?.shared.count ?? 0 },
    { label: 'Unlock', icon: 'lock_open', meta: unlock, total: af?.unlockClicks.count ?? 0 },
    { label: 'Compra', icon: 'credit_card', meta: purchased, total: af?.purchased.count ?? 0 },
  ];

  return (
    <div className="meta-stitch -mx-2 sm:-mx-4 rounded-2xl p-space-md sm:p-space-lg">
      <div className="flex flex-col w-full pb-space-2xl space-y-space-lg">
        {/* Header */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-md pt-space-xs">
          <div className="flex flex-col gap-space-2xs">
            <div className="flex items-center gap-space-xs flex-wrap">
              <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
                Resultados Meta
              </h1>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800">
                <span className="h-2 w-2 rounded-full bg-tertiary-container animate-pulse" />
                <span className="font-label-sm text-label-sm text-tertiary font-semibold uppercase tracking-wider">
                  En vivo / Sincronizado
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-lg bg-surface-container text-on-surface-variant font-label-code text-label-code">
                landing=meta-v1
              </span>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Tráfico y conversión de publicidad Meta: landing <code className="font-label-code">/meta</code> +
              campañas Meta/IG. Comparado contra el total Cleexs.
            </p>
          </div>

          <div className="flex items-center gap-space-xs flex-wrap">
            <div className="flex items-center bg-surface-container-low p-1 rounded-xl shadow-sm">
              {(['7', '15', '30', '90'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPreset(p)}
                  className={
                    preset === p
                      ? 'px-3.5 py-1.5 rounded-lg bg-surface-container-lowest font-headline-sm text-label-md text-primary shadow-sm'
                      : 'px-3 py-1.5 rounded-lg font-label-md text-label-md text-on-surface-variant hover:bg-surface-container'
                  }
                >
                  {p === '30' ? '30 días' : `${p}d`}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-lowest shadow-sm text-on-surface">
              <span className="material-symbols-outlined text-primary text-[18px]">calendar_today</span>
              <span className="font-label-code text-label-code text-on-surface">
                {range.from} → {range.to}
              </span>
            </div>
            <Link
              href="/admin/conversion"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container-lowest hover:bg-surface-container shadow-sm font-label-md text-label-md text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Conversión
            </Link>
            <button
              type="button"
              onClick={() => void reload()}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-container hover:bg-primary transition-all text-on-primary font-label-md text-label-md shadow-sm disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[18px] text-on-primary ${loading ? 'animate-pulse' : ''}`}>
                sync
              </span>
              Actualizar
            </button>
          </div>
        </div>

        {authExpired ? <AdminAuthExpiredCard /> : null}
        {error ? (
          <div className="rounded-xl bg-error-container/30 px-4 py-3 font-body-sm text-error">{error}</div>
        ) : null}

        {loading && !meta ? (
          <div className="flex items-center gap-2 py-16 text-on-surface-variant font-body-md">
            <span className="material-symbols-outlined animate-pulse">progress_activity</span>
            Cargando métricas Meta…
          </div>
        ) : meta && mf ? (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-md">
              <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col">
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      Visitas Meta
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="font-display-lg text-display-lg text-on-surface font-bold tracking-tight">
                        {fmt(visitors)}
                      </span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[22px]">visibility</span>
                  </div>
                </div>
                <div className="mt-space-md pt-space-xs flex items-center justify-between">
                  <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                    <strong className="font-semibold text-on-surface">{fmt(pageViews)}</strong> pageviews · /meta + ads
                  </p>
                </div>
              </div>

              <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col">
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      % del total Cleexs
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="font-display-lg text-display-lg text-primary font-bold tracking-tight">
                        {shareOfTotal == null ? '—' : `${shareOfTotal}%`}
                      </span>
                      {shareOfTotal != null && shareOfTotal >= 40 ? (
                        <span className="font-label-code text-label-code text-on-surface-variant">cuota líder</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[22px]">pie_chart</span>
                  </div>
                </div>
                <div className="mt-space-md pt-space-xs flex flex-col gap-1.5">
                  <div className="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant">
                    <span>
                      {fmt(visitors)} de {fmt(allVisitors)} visitas totales
                    </span>
                    <span className="font-label-code font-semibold text-primary">
                      {shareOfTotal == null ? '—' : `${shareOfTotal}%`}
                    </span>
                  </div>
                  <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-primary-container h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, shareOfTotal ?? 0)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col">
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      Compras Meta
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="font-display-lg text-display-lg text-on-surface font-bold tracking-tight">
                        {fmt(purchased)}
                      </span>
                      <span className="inline-flex items-center text-outline font-label-sm text-label-sm bg-surface-container px-1.5 py-0.5 rounded-lg">
                        {finalConv == null ? '—' : `${finalConv}%`} conv.
                      </span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[22px]">shopping_cart_checkout</span>
                  </div>
                </div>
                <div className="mt-space-md pt-space-xs flex items-center justify-between font-body-sm text-body-sm text-on-surface-variant">
                  <span>{pctLabel(purchased, visitors)} de visitas Meta</span>
                </div>
              </div>

              <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col">
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      Ingresos Atribuidos
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="font-display-lg text-display-lg text-on-surface font-bold tracking-tight">
                        {fmtMoney(revenueUsd)}
                      </span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[22px]">payments</span>
                  </div>
                </div>
                <div className="mt-space-md pt-space-xs flex items-center justify-between font-body-sm text-body-sm text-on-surface-variant">
                  <span>USD en compras Meta (rango)</span>
                  {purchased === 0 ? (
                    <span className="font-label-sm text-label-sm text-error bg-error-container/30 px-1.5 py-0.5 rounded-lg">
                      Sin retorno
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Embudo */}
            <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col gap-space-lg">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-xs">
                <div>
                  <div className="flex items-center gap-space-xs">
                    <span className="material-symbols-outlined text-primary text-[24px]">filter_alt</span>
                    <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">Embudo Meta</h2>
                    <span className="font-label-code text-label-code px-2 py-0.5 bg-primary-fixed/40 text-primary font-semibold rounded-lg">
                      6 Etapas
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                    Flujo: Visitantes → URL → Email → Share → Unlock → Compra
                  </p>
                </div>
                <div className="flex items-center gap-space-sm bg-surface-container-low px-space-md py-space-xs rounded-xl flex-wrap">
                  <div className="flex flex-col">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">Top-of-Funnel</span>
                    <span className="font-headline-sm text-headline-sm text-on-surface">
                      {fmt(visitors)}{' '}
                      <span className="font-label-sm font-normal text-on-surface-variant">users</span>
                    </span>
                  </div>
                  <div className="h-6 w-px bg-surface-container-highest" />
                  <div className="flex flex-col">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">Tasa Conv. Final</span>
                    <span
                      className={`font-headline-sm text-headline-sm font-semibold ${
                        (finalConv ?? 0) > 0 ? 'text-tertiary' : 'text-error'
                      }`}
                    >
                      {finalConv == null ? '—' : `${finalConv.toFixed(2)}%`}
                    </span>
                  </div>
                  <div className="h-6 w-px bg-surface-container-highest" />
                  <div className="flex flex-col">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">Paso con mayor fuga</span>
                    <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                      {worstDrop?.drop != null
                        ? `${worstDrop.from} → ${worstDrop.to} (${worstDrop.drop}% drop)`
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                {funnelSteps.map((step, i) => {
                  const rate = pctNum(step.count, visitors);
                  const width = Math.max(rate ?? 0, step.count > 0 ? 4 : 0);
                  return (
                    <div
                      key={step.key}
                      className="flex flex-col justify-between p-space-md rounded-xl bg-surface-container-low"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            i === 0 ? 'bg-primary-container text-on-primary' : 'bg-surface-container text-primary'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[18px]">{step.icon}</span>
                        </div>
                        <span className="font-label-code text-label-code font-bold text-on-surface-variant">
                          Paso {i + 1}
                        </span>
                      </div>
                      <div>
                        <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                          {step.label}
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="font-display-lg text-headline-lg font-bold text-on-surface">
                            {fmt(step.count)}
                          </span>
                        </div>
                      </div>
                      <div className="mt-4 pt-3 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between font-label-sm text-label-sm">
                          <span className="text-on-surface-variant">Tasa etapa</span>
                          <span className={`font-semibold font-label-code ${step.rateClass}`}>
                            {i === 0 ? '100% base' : rate == null ? '—' : `${rate}%`}
                          </span>
                        </div>
                        <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                          <div
                            className={`${step.barClass} h-full rounded-full`}
                            style={{ width: `${i === 0 ? 100 : width}%` }}
                          />
                        </div>
                        <span
                          className={
                            step.noteTone === 'bad'
                              ? 'font-label-sm text-label-sm text-error bg-error-container/20 px-1 py-0.5 rounded self-start'
                              : step.noteTone === 'good'
                                ? 'font-label-sm text-label-sm text-tertiary bg-emerald-50 px-1 py-0.5 rounded self-start'
                                : 'font-label-sm text-label-sm text-outline'
                          }
                        >
                          {step.note}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-space-md bg-surface-container-low rounded-xl flex flex-col gap-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                    Flujo de conversión consolidado (% sobre visitantes)
                  </span>
                  <span className="font-label-code text-label-code text-on-surface-variant">
                    Base {fmt(visitors)} = 100%
                  </span>
                </div>
                <div className="relative w-full h-7 bg-surface-container rounded-lg overflow-hidden flex">
                  <div className="h-full bg-primary flex items-center justify-center text-on-primary font-label-sm px-3">
                    Visitas {fmt(visitors)} (100%)
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pt-1 font-label-sm text-label-sm text-on-surface-variant">
                  {(
                    [
                      ['URL', url, 'bg-primary'],
                      ['Email', email, 'bg-secondary'],
                      ['Share', shared, 'bg-secondary-container'],
                      ['Unlock', unlock, 'bg-tertiary'],
                      ['Compras', purchased, 'bg-outline'],
                    ] as const
                  ).map(([label, n, dot]) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
                      <span>
                        {label}: <strong className="text-on-surface">{fmt(n)}</strong> ({pctLabel(n, visitors)})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Meta vs Total + insight */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-space-lg items-start">
              <div className="xl:col-span-2 p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col gap-space-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[22px]">compare_arrows</span>
                      <h3 className="font-headline-md text-headline-md text-on-surface tracking-tight">
                        Meta vs Total Cleexs
                      </h3>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                      Cuota de Meta frente al tráfico global del workspace.
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-container-low">
                        {['Etapa', 'Meta', 'Total Cleexs', '% Participación Meta', 'Status / Benchmark'].map((h) => (
                          <th
                            key={h}
                            className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {compareRows.map((row) => {
                        const share = pctNum(row.meta, row.total);
                        const status = statusForShare(share);
                        return (
                          <tr key={row.label} className="hover:bg-surface-container-low transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2.5">
                                <span className="material-symbols-outlined text-primary text-[18px]">{row.icon}</span>
                                <span className="font-headline-sm text-body-md text-on-surface">{row.label}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-right font-label-code text-label-code font-bold text-on-surface">
                              {fmt(row.meta)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-label-code text-label-code text-on-surface-variant">
                              {fmt(row.total)}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-24 bg-surface-container h-2 rounded-full overflow-hidden">
                                  <div
                                    className="bg-primary h-full rounded-full"
                                    style={{ width: `${Math.min(100, share ?? 0)}%` }}
                                  />
                                </div>
                                <span className="font-label-code text-label-code font-bold text-primary">
                                  {share == null ? '—' : `${share}%`}
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full font-label-sm text-label-sm ${status.tone}`}
                              >
                                {status.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-col gap-space-md">
                <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col gap-space-sm">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">fact_check</span>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface">Captura de origen</h3>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Filtro <code className="font-label-code">landing=meta-v1</code>: path <code className="font-label-code">/meta</code> +
                    sources Meta/IG.
                  </p>
                  <div className="grid grid-cols-1 gap-2 mt-1">
                    <div className="rounded-lg bg-surface-container-low px-3 py-2 font-label-code text-label-code">
                      Meta / Total visitas: <strong>{fmt(visitors)}</strong> / {fmt(allVisitors)}
                    </div>
                    <div className="rounded-lg bg-surface-container-low px-3 py-2 font-label-code text-label-code">
                      Conv. a email: <strong>{pctLabel(email, visitors)}</strong>
                    </div>
                    <div className="rounded-lg bg-surface-container-low px-3 py-2 font-label-code text-label-code">
                      Compras: <strong>{fmt(purchased)}</strong>
                    </div>
                  </div>
                </div>

                <div className="p-space-lg rounded-xl bg-primary-container text-on-primary shadow-sm flex flex-col justify-between gap-space-sm">
                  <div className="flex items-start gap-space-xs">
                    <span className="material-symbols-outlined text-[22px] text-on-primary">lightbulb</span>
                    <div>
                      <h3 className="font-headline-sm text-headline-sm text-on-primary">Insight embudo</h3>
                      <p className="font-body-sm text-body-sm text-on-primary mt-1" style={{ opacity: 0.92 }}>
                        {worstDrop?.drop != null
                          ? `La mayor fuga está en ${worstDrop.from} → ${worstDrop.to} (${worstDrop.drop}% drop). Revisá fricción en ese paso para Meta.`
                          : 'Sin datos suficientes para calcular fugas.'}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/admin/conversion?landing=meta-v1"
                    className="mt-2 w-full py-2 px-3 rounded-lg bg-surface-bright text-primary font-headline-sm text-body-sm text-center hover:bg-surface-container-lowest"
                  >
                    Ver detalle en Conversión
                  </Link>
                </div>
              </div>
            </div>

            <p className="font-label-sm text-label-sm text-outline">
              Fuente: mismas métricas que /admin/conversion · filtro Meta · corte métricas Meta desde ago-2026.
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
