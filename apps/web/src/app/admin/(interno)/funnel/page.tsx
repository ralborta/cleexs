'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Clock,
  DollarSign,
  Filter,
  Loader2,
  Mail,
  RefreshCw,
  Share2,
  ShoppingBag,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
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

type FunnelStage = {
  key: string;
  label: string;
  count: number;
  stepPct: number | null;
  tone: 'sky' | 'teal' | 'emerald' | 'amber' | 'violet';
};

const TONE_BAR: Record<FunnelStage['tone'], string> = {
  sky: 'from-sky-500 to-sky-600',
  teal: 'from-teal-500 to-teal-600',
  emerald: 'from-emerald-500 to-emerald-600',
  amber: 'from-amber-500 to-orange-500',
  violet: 'from-violet-500 to-violet-700',
};

/** Embudo visual que se estrecha respecto al primer paso (visitantes). */
function FunnelChart({ stages }: { stages: FunnelStage[] }) {
  const base = Math.max(stages[0]?.count ?? 0, 1);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-50 to-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Embudo de adquisición</h2>
          <p className="mt-0.5 text-xs text-slate-500">Ancho relativo a visitantes · % = conversión vs paso anterior</p>
        </div>
      </div>

      <div className="mx-auto flex max-w-2xl flex-col items-center gap-1.5">
        {stages.map((stage, index) => {
          const widthPct = Math.min(100, Math.max((stage.count / base) * 100, stage.count > 0 ? 18 : 12));
          const prev = index > 0 ? stages[index - 1] : null;
          const drop = prev && prev.count > stage.count ? prev.count - stage.count : 0;

          return (
            <div key={stage.key} className="w-full">
              {index > 0 && stage.stepPct != null ? (
                <div className="mb-1.5 flex items-center justify-center gap-2">
                  <span className="h-px w-6 bg-slate-200" />
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${
                      stage.stepPct >= 70
                        ? 'bg-emerald-50 text-emerald-700'
                        : stage.stepPct >= 40
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {pctLabel(stage.stepPct)}
                    {drop > 0 ? ` · −${fmt(drop)}` : ''}
                  </span>
                  <span className="h-px w-6 bg-slate-200" />
                </div>
              ) : null}

              <div className="flex justify-center">
                <div
                  className={`relative flex h-12 items-center justify-between gap-3 bg-gradient-to-r px-4 text-white shadow-sm sm:h-14 sm:px-5 ${TONE_BAR[stage.tone]}`}
                  style={{
                    width: `${widthPct}%`,
                    minWidth: '9.5rem',
                    clipPath: 'polygon(1.5% 0, 98.5% 0, 100% 100%, 0 100%)',
                    borderRadius: index === 0 ? '12px 12px 4px 4px' : index === stages.length - 1 ? '4px 4px 12px 12px' : '4px',
                  }}
                >
                  <span className="truncate text-xs font-semibold tracking-tight sm:text-sm">{stage.label}</span>
                  <span className="shrink-0 font-mono text-base font-bold tabular-nums sm:text-lg">{fmt(stage.count)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CohortCard({
  icon,
  label,
  sub,
  count,
  rate,
  eligible,
}: {
  icon: ReactNode;
  label: string;
  sub: string;
  count: number;
  rate: number | null;
  eligible: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
          {icon}
        </span>
        {label}
      </div>
      <p className="mt-3 font-mono text-3xl font-bold tabular-nums tracking-tight text-slate-900">{fmt(count)}</p>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-sm font-semibold text-emerald-600">{pctLabel(rate)}</span>
        <span className="text-[10px] text-slate-400">de {fmt(eligible)} con email</span>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-slate-500">{sub}</p>
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
          <FunnelChart
            stages={[
              {
                key: 'visitors',
                label: 'Visitantes',
                count: f.visitors.count,
                stepPct: null,
                tone: 'sky',
              },
              {
                key: 'started',
                label: 'Inicio diagnóstico',
                count: f.diagnosticsStarted.count,
                stepPct: f.diagnosticsStarted.pct,
                tone: 'teal',
              },
              {
                key: 'completed',
                label: 'Diagnóstico listo',
                count: f.diagnosticsCompleted.count,
                stepPct: f.diagnosticsCompleted.pct,
                tone: 'emerald',
              },
              {
                key: 'email',
                label: 'Email capturado',
                count: f.emailsCaptured.count,
                stepPct: f.emailsCaptured.pct,
                tone: 'amber',
              },
              {
                key: 'shares',
                label: 'Compartieron',
                count: f.shares.count,
                stepPct: f.shares.pct,
                tone: 'violet',
              },
            ]}
          />

          {f.shares.byChannel.length > 0 ? (
            <p className="text-center text-[11px] text-slate-500">
              Canales:{' '}
              {f.shares.byChannel
                .slice(0, 5)
                .map((c) => `${CHANNEL_LABEL[c.channel] || c.channel} ${c.count}`)
                .join(' · ')}
            </p>
          ) : null}

          <section>
            <div className="mb-3">
              <h2 className="text-base font-semibold text-slate-900">Compras Plan Conquistar</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                De quienes dejaron email en el rango, cuántos compraron después (por ventana)
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <CohortCard
                icon={<Clock className="h-3.5 w-3.5" />}
                label="24 horas"
                sub="Compra el mismo día o dentro de las primeras 24 h"
                count={f.purchaseH24.count}
                rate={f.purchaseH24.pct}
                eligible={data?.cohorts.eligible ?? 0}
              />
              <CohortCard
                icon={<Mail className="h-3.5 w-3.5" />}
                label="30 días"
                sub="Incluye efecto de la secuencia de emails"
                count={f.purchaseD30.count}
                rate={f.purchaseD30.pct}
                eligible={data?.cohorts.eligible ?? 0}
              />
              <CohortCard
                icon={<Users className="h-3.5 w-3.5" />}
                label="60 días"
                sub="Ventana de nurture medio"
                count={f.purchaseD60.count}
                rate={f.purchaseD60.pct}
                eligible={data?.cohorts.eligible ?? 0}
              />
              <CohortCard
                icon={<ShoppingBag className="h-3.5 w-3.5" />}
                label="90 días"
                sub="Ciclo completo post-diagnóstico"
                count={f.purchaseD90.count}
                rate={f.purchaseD90.pct}
                eligible={data?.cohorts.eligible ?? 0}
              />
            </div>
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
