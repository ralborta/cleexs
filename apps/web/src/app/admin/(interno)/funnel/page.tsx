'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  CheckCircle2,
  ClipboardList,
  Clock,
  DollarSign,
  Filter,
  Loader2,
  Mail,
  RefreshCw,
  Share2,
  ShoppingBag,
  Target,
  TrendingDown,
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

function pctOf(num: number, den: number): number | null {
  if (den <= 0) return null;
  return Math.round((num / den) * 1000) / 10;
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

type StageTone = 'blue' | 'indigo' | 'violet' | 'orange';

type AcquisitionStage = {
  key: string;
  label: string;
  count: number;
  icon: ReactNode;
  tone: StageTone;
};

const BAR_CLASS: Record<StageTone, string> = {
  blue: 'bg-[#3B82F6]',
  indigo: 'bg-[#6366F1]',
  violet: 'bg-[#8B5CF6]',
  orange: 'bg-[#F97316]',
};

function buildAcquisitionStages(f: FunnelMetrics['funnel']): AcquisitionStage[] {
  return [
    {
      key: 'visitors',
      label: 'Visitantes',
      count: f.visitors.count,
      icon: <Users className="h-4 w-4" />,
      tone: 'blue',
    },
    {
      key: 'started',
      label: 'Inicio del diagnóstico',
      count: f.diagnosticsStarted.count,
      icon: <ClipboardList className="h-4 w-4" />,
      tone: 'blue',
    },
    {
      key: 'completed',
      label: 'Diagnóstico completado',
      count: f.diagnosticsCompleted.count,
      icon: <CheckCircle2 className="h-4 w-4" />,
      tone: 'indigo',
    },
    {
      key: 'email',
      label: 'Email capturado',
      count: f.emailsCaptured.count,
      icon: <Mail className="h-4 w-4" />,
      tone: 'violet',
    },
    {
      key: 'shares',
      label: 'Compartieron',
      count: f.shares.count,
      icon: <Share2 className="h-4 w-4" />,
      tone: 'orange',
    },
  ];
}

function AcquisitionFunnelPanel({
  stages,
  periodLabel,
}: {
  stages: AcquisitionStage[];
  periodLabel: string;
}) {
  const base = Math.max(stages[0]?.count ?? 0, 0);
  const last = stages[stages.length - 1];
  const finalConv = pctOf(last?.count ?? 0, base || 1);

  let worstDrop = { from: '', to: '', abandoned: 0, dropPct: 0, advancePct: 100 };
  for (let i = 1; i < stages.length; i += 1) {
    const prev = stages[i - 1]!;
    const cur = stages[i]!;
    const abandoned = Math.max(0, prev.count - cur.count);
    const advancePct = pctOf(cur.count, prev.count) ?? 0;
    const dropPct = prev.count > 0 ? Math.round((abandoned / prev.count) * 1000) / 10 : 0;
    if (abandoned > worstDrop.abandoned) {
      worstDrop = {
        from: prev.label,
        to: cur.label,
        abandoned,
        dropPct,
        advancePct,
      };
    }
  }

  const shortLabel = (label: string) => {
    if (label.startsWith('Email')) return 'Email';
    if (label.startsWith('Compart')) return 'Compartir';
    if (label.startsWith('Inicio')) return 'Inicio';
    if (label.startsWith('Diagnóstico')) return 'Completado';
    return label.split(' ')[0] || label;
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Embudo de adquisición</h2>
          <p className="mt-0.5 text-xs text-slate-500">Conversión por etapa · {periodLabel}</p>
        </div>
      </div>

      <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-3 sm:p-5">
        <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-mono text-2xl font-bold tabular-nums text-slate-900">{fmt(base)}</p>
              <p className="mt-0.5 text-xs font-medium text-slate-500">Visitantes</p>
            </div>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
              <Users className="h-4 w-4" />
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-mono text-2xl font-bold tabular-nums text-slate-900">
                {finalConv == null ? '—' : `${String(finalConv).replace('.', ',')}%`}
              </p>
              <p className="mt-0.5 text-xs font-medium text-slate-500">Conversión final</p>
            </div>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
              <Filter className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Visitantes → compartieron</p>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-mono text-2xl font-bold tabular-nums text-slate-900">
                {fmt(worstDrop.abandoned)}
              </p>
              <p className="mt-0.5 text-xs font-medium text-slate-500">Mayor abandono</p>
            </div>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
              <TrendingDown className="h-4 w-4" />
            </span>
          </div>
          {worstDrop.abandoned > 0 ? (
            <p className="mt-2 text-[11px] font-medium text-slate-600">
              {shortLabel(worstDrop.from)} → {shortLabel(worstDrop.to)}
            </p>
          ) : (
            <p className="mt-2 text-[11px] text-slate-400">Sin abandonos en el rango</p>
          )}
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1fr_280px]">
        <div className="space-y-0 p-5">
          {stages.map((stage, index) => {
            const ofTotal = pctOf(stage.count, base || 1);
            const widthPct =
              base > 0 ? Math.min(100, Math.max((stage.count / base) * 100, stage.count > 0 ? 6 : 0)) : 0;
            const prev = index > 0 ? stages[index - 1] : null;
            const advanced = prev ? pctOf(stage.count, prev.count) : null;
            const abandoned = prev ? Math.max(0, prev.count - stage.count) : 0;
            const isWorst =
              prev &&
              worstDrop.abandoned > 0 &&
              prev.label === worstDrop.from &&
              stage.label === worstDrop.to;

            return (
              <div key={stage.key}>
                {index > 0 && prev ? (
                  <div className="mb-3 ml-10 flex items-center gap-2 py-1 text-[11px] sm:ml-12">
                    <ArrowDown
                      className={`h-3.5 w-3.5 ${isWorst ? 'text-rose-500' : 'text-slate-300'}`}
                    />
                    <span className="font-medium text-slate-500">
                      {pctLabel(advanced)} avanzó
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className={isWorst ? 'font-semibold text-rose-600' : 'text-slate-500'}>
                      {fmt(abandoned)} abandonaron
                    </span>
                  </div>
                ) : null}

                <div className="flex gap-3 sm:gap-4">
                  <div className="flex w-8 shrink-0 flex-col items-center sm:w-9">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-[11px] font-bold text-slate-500 shadow-sm sm:h-9 sm:w-9 sm:text-xs">
                      {index + 1}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 pb-4">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">{stage.icon}</span>
                          <p className="text-sm font-semibold text-slate-900">{stage.label}</p>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {fmt(stage.count)} usuarios
                          {ofTotal != null ? (
                            <>
                              {' '}
                              · {String(ofTotal).replace('.', ',')}% del total
                            </>
                          ) : null}
                        </p>
                      </div>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all ${BAR_CLASS[stage.tone]}`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <aside className="border-t border-slate-100 bg-gradient-to-b from-orange-50 to-amber-50/60 p-5 lg:border-l lg:border-t-0">
          <div className="flex h-full flex-col">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
              <Target className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">Principal oportunidad</h3>
            {worstDrop.abandoned > 0 && worstDrop.dropPct > 0 ? (
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                El{' '}
                <span className="font-bold text-slate-900">
                  {String(worstDrop.dropPct).replace('.', ',')}%
                </span>{' '}
                abandona entre{' '}
                <span className="font-semibold">{shortLabel(worstDrop.from).toLowerCase()}</span> y{' '}
                <span className="font-semibold">{shortLabel(worstDrop.to).toLowerCase()}</span>
                {worstDrop.from.startsWith('Email')
                  ? ' — después de dejar su email.'
                  : '.'}
              </p>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Todavía no hay un cuello de botella claro en este rango. Cuando haya más volumen, acá
                verás el mayor abandono.
              </p>
            )}
            {worstDrop.abandoned > 0 ? (
              <p className="mt-auto pt-6 text-[11px] text-slate-500">
                {fmt(worstDrop.abandoned)} personas se perdieron en ese paso
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
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
  const initial = useMemo(() => rangeForPreset('30'), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [activePreset, setActivePreset] = useState<string | null>('30');
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

  const periodLabel =
    activePreset === 'hoy'
      ? 'Hoy'
      : activePreset === 'ayer'
        ? 'Ayer'
        : activePreset === '7'
          ? 'Últimos 7 días'
          : activePreset === '15'
            ? 'Últimos 15 días'
            : activePreset === '30'
              ? 'Últimos 30 días'
              : `${from} → ${to}`;

  if (error && looksLikeAdminAuthError(error)) {
    return <AdminAuthExpiredCard />;
  }

  const f = data?.funnel;
  const eco = data?.economics;
  const stages = f ? buildAcquisitionStages(f) : [];

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
              Embudo de negocio y cohortes de compra. Métricas de Conversión queda igual.
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
          <AcquisitionFunnelPanel stages={stages} periodLabel={periodLabel} />

          {f.shares.byChannel.length > 0 ? (
            <p className="-mt-3 text-center text-[11px] text-slate-500">
              Canales de share:{' '}
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
