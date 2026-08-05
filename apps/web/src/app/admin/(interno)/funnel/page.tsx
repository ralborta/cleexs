'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DollarSign,
  Filter,
  Loader2,
  RefreshCw,
  Share2,
  Users,
} from 'lucide-react';
import { AdminAuthExpiredCard, looksLikeAdminAuthError } from '@/components/admin/admin-callout';
import { adminUiFetch } from '@/lib/admin-ui-client-fetch';
import { addDaysToDayString, formatDayInArgentina } from '@cleexs/shared';

export const dynamic = 'force-dynamic';

type FunnelStep = { count: number; pct: number | null };

type FunnelMetrics = {
  ok: boolean;
  range: { from: string; to: string; timezone: string };
  notes: {
    purchaseLinkage: string;
    purchaseLinkageDetail: string;
    cacSource: string;
    ltvSource: string;
    paybackSource: string;
  };
  funnel: {
    visitors: { count: number; pageViews: number };
    diagnosticsStarted: FunnelStep;
    diagnosticsCompleted: FunnelStep;
    emailsCaptured: FunnelStep;
    shares: FunnelStep & { byChannel: { channel: string; count: number }[] };
    purchaseH24: FunnelStep;
    purchaseD30: FunnelStep;
    purchaseD60: FunnelStep;
    purchaseD90: FunnelStep;
  };
  cohorts: {
    eligible: number;
    linkage: string;
    windows: Record<
      string,
      { label: string; eligible: number; converted: number; rate: number | null }
    >;
  };
  economics: {
    adSpendUsd: number;
    payingCustomers: number;
    revenueUsd: number;
    cacUsd: number;
    ltvUsd: number;
    paybackDays: number;
  };
  byReferrer: Array<{
    refCode: string;
    name: string;
    diagnostics: number;
    withEmail: number;
    uniqueEmails: number;
    completed: number;
    isSponsor: boolean;
    registered: boolean;
  }>;
};

function fmt(n: number) {
  return n.toLocaleString('es-AR');
}

function fmtUsd(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

function pctLabel(p: number | null) {
  return p == null ? '—' : `${p}%`;
}

function rangeForPreset(preset: 'hoy' | 'ayer' | '7' | '15' | '30'): { from: string; to: string } {
  const today = formatDayInArgentina();
  if (preset === 'hoy') return { from: today, to: today };
  if (preset === 'ayer') {
    const yesterday = addDaysToDayString(today, -1);
    return { from: yesterday, to: yesterday };
  }
  const span = preset === '7' ? 6 : preset === '15' ? 14 : 29;
  return { from: addDaysToDayString(today, -span), to: today };
}

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  linkedin: 'LinkedIn',
  x: 'X',
  copy: 'Copiar link',
  other: 'Otro',
};

function FunnelRow({
  label,
  hint,
  count,
  pct,
  emphasize,
}: {
  label: string;
  hint?: string;
  count: number;
  pct: number | null;
  emphasize?: boolean;
}) {
  const width = pct == null ? 0 : Math.min(100, Math.max(pct, count > 0 ? 2 : 0));
  return (
    <div className={`rounded-xl border px-4 py-3 ${emphasize ? 'border-violet-200 bg-violet-50/60' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${emphasize ? 'text-violet-950' : 'text-slate-900'}`}>{label}</p>
          {hint ? <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p> : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-lg font-bold tabular-nums text-slate-900">{fmt(count)}</p>
          <p className="text-[11px] font-medium text-slate-500">
            {pct == null ? 'base del embudo' : `${pctLabel(pct)} del paso anterior`}
          </p>
        </div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${emphasize ? 'bg-violet-500' : 'bg-emerald-500'}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export default function AdminFunnelPage() {
  const initial = useMemo(() => rangeForPreset('15'), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [activePreset, setActivePreset] = useState<string | null>('15');
  const [adSpendInput, setAdSpendInput] = useState('');
  const [data, setData] = useState<FunnelMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      const spend = Number(adSpendInput.replace(',', '.'));
      if (Number.isFinite(spend) && spend >= 0 && adSpendInput.trim() !== '') {
        params.set('adSpendUsd', String(spend));
      }
      const res = await adminUiFetch(`/api/admin-ui/funnel?${params.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || 'Error al cargar el funnel');
      setData(json as FunnelMetrics);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [from, to, adSpendInput]);

  useEffect(() => {
    void load();
  }, [from, to]); // eslint-disable-line react-hooks/exhaustive-deps -- ad spend se aplica con "Actualizar"

  function applyPreset(preset: 'hoy' | 'ayer' | '7' | '15' | '30') {
    const r = rangeForPreset(preset);
    setFrom(r.from);
    setTo(r.to);
    setActivePreset(preset);
  }

  if (error && looksLikeAdminAuthError(error)) {
    return <AdminAuthExpiredCard />;
  }

  const f = data?.funnel;
  const eco = data?.economics;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
            <Filter className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Funnel</h1>
            <p className="text-sm text-slate-600">
              Embudo de negocio: visitantes → diagnóstico → compra Plan Conquistar (cohortes). Métricas de Conversión
              queda igual; acá medimos unit economics. Días en hora Argentina.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Actualizar
        </button>
      </header>

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['hoy', 'Hoy'],
              ['ayer', 'Ayer'],
              ['7', 'Últimos 7 días'],
              ['15', 'Últimos 15 días'],
              ['30', 'Últimos 30 días'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                activePreset === key
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-500">
            Desde
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => {
                setFrom(e.target.value);
                setActivePreset(null);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-200"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-500">
            Hasta
            <input
              type="date"
              value={to}
              min={from}
              max={formatDayInArgentina()}
              onChange={(e) => {
                setTo(e.target.value);
                setActivePreset(null);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-200"
            />
          </label>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      ) : null}

      {loading && !data ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando funnel…
        </div>
      ) : null}

      {f ? (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Embudo</h2>
            <FunnelRow
              label="Visitantes"
              hint={`${fmt(f.visitors.pageViews)} pageviews`}
              count={f.visitors.count}
              pct={null}
            />
            <FunnelRow
              label="Inicio del diagnóstico"
              hint="URL / dominio enviado"
              count={f.diagnosticsStarted.count}
              pct={f.diagnosticsStarted.pct}
            />
            <FunnelRow
              label="Diagnóstico completado"
              hint="status = completed"
              count={f.diagnosticsCompleted.count}
              pct={f.diagnosticsCompleted.pct}
            />
            <FunnelRow
              label="Emails capturados"
              hint="Sin placeholders de WhatsApp"
              count={f.emailsCaptured.count}
              pct={f.emailsCaptured.pct}
            />
            <FunnelRow
              label="Compartidos"
              hint={
                f.shares.byChannel.length
                  ? f.shares.byChannel
                      .slice(0, 4)
                      .map((c) => `${CHANNEL_LABEL[c.channel] || c.channel}: ${c.count}`)
                      .join(' · ')
                  : 'ShareEvent'
              }
              count={f.shares.count}
              pct={f.shares.pct}
            />
            <FunnelRow
              label="Compra Plan Conquistar · 24 h"
              hint="Misma persona (email) compró dentro de 24 h del diagnóstico"
              count={f.purchaseH24.count}
              pct={f.purchaseH24.pct}
              emphasize
            />
            <FunnelRow
              label="Compra · 30 días"
              hint="Cohorte: compró dentro de 30 días posteriores al diagnóstico"
              count={f.purchaseD30.count}
              pct={f.purchaseD30.pct}
              emphasize
            />
            <FunnelRow
              label="Compra · 60 días"
              count={f.purchaseD60.count}
              pct={f.purchaseD60.pct}
              emphasize
            />
            <FunnelRow
              label="Compra · 90 días"
              hint="Incluye efecto de la secuencia de emails"
              count={f.purchaseD90.count}
              pct={f.purchaseD90.pct}
              emphasize
            />
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500">
                <DollarSign className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Ad spend (Meta)</span>
              </div>
              <label className="mt-3 flex flex-col gap-1 text-[11px] font-medium text-slate-500">
                USD gastados en el rango
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={adSpendInput}
                  placeholder="0"
                  onChange={(e) => setAdSpendInput(e.target.value)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 shadow-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-200"
                />
              </label>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                Pegá el spend de Meta Ads y tocá Actualizar. Sin dato → CAC y Payback en 0.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">CAC</p>
              <p className="mt-2 font-mono text-2xl font-bold text-slate-900">{fmtUsd(eco?.cacUsd ?? 0)}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                {eco && eco.payingCustomers > 0 && eco.adSpendUsd > 0
                  ? `Spend ÷ ${fmt(eco.payingCustomers)} compradores`
                  : 'Pendiente: conectar Meta Ads o cargar spend'}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">LTV</p>
              <p className="mt-2 font-mono text-2xl font-bold text-slate-900">{fmtUsd(eco?.ltvUsd ?? 0)}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                {eco && eco.payingCustomers > 0
                  ? `Promedio ingreso PC del cohort (${fmtUsd(eco.revenueUsd)} / ${fmt(eco.payingCustomers)})`
                  : 'Pendiente: renovaciones / más compras'}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payback</p>
              <p className="mt-2 font-mono text-2xl font-bold text-slate-900">
                {fmt(eco?.paybackDays ?? 0)} <span className="text-base font-semibold text-slate-500">días</span>
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Estimado (CAC/LTV × 30). 0 si falta spend o LTV.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">Referidores / campañas</h2>
            </div>
            {data?.byReferrer?.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-2 py-2 font-semibold">Campaña</th>
                      <th className="px-2 py-2 font-semibold">Diags</th>
                      <th className="px-2 py-2 font-semibold">Completados</th>
                      <th className="px-2 py-2 font-semibold">Con email</th>
                      <th className="px-2 py-2 font-semibold">Emails únicos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byReferrer.map((row) => (
                      <tr key={row.refCode} className="border-t border-slate-100">
                        <td className="px-2 py-2">
                          <span className="font-medium text-slate-900">{row.name}</span>
                          <span className="ml-2 text-[11px] text-slate-400">{row.refCode}</span>
                        </td>
                        <td className="px-2 py-2 font-mono tabular-nums">{fmt(row.diagnostics)}</td>
                        <td className="px-2 py-2 font-mono tabular-nums">{fmt(row.completed)}</td>
                        <td className="px-2 py-2 font-mono tabular-nums">{fmt(row.withEmail)}</td>
                        <td className="px-2 py-2 font-mono tabular-nums">{fmt(row.uniqueEmails)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Sin referidores en el rango (0).</p>
            )}
          </section>

          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-500">
            <Share2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {data?.notes.purchaseLinkageDetail} Elegibles cohorte: {fmt(data?.cohorts.eligible ?? 0)} emails
              únicos con diagnóstico en el rango.
            </span>
          </p>
        </>
      ) : null}
    </div>
  );
}
