'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  DollarSign,
  Filter,
  Info,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Share2,
  SlidersHorizontal,
  Target,
  TrendingDown,
  Upload,
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

function CumulativeConversionTimeline({
  eligible,
  h24,
  d30,
  d60,
  d90,
}: {
  eligible: number;
  h24: FunnelStep;
  d30: FunnelStep;
  d60: FunnelStep;
  d90: FunnelStep;
}) {
  const nodes = [
    { key: 'h24', label: '24 horas', icon: <Clock className="h-4 w-4" />, count: h24.count, rate: h24.pct },
    { key: 'd30', label: '30 días', icon: <Mail className="h-4 w-4" />, count: d30.count, rate: d30.pct },
    { key: 'd60', label: '60 días', icon: <Users className="h-4 w-4" />, count: d60.count, rate: d60.pct },
    { key: 'd90', label: '90 días', icon: <Calendar className="h-4 w-4" />, count: d90.count, rate: d90.pct },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-6">
        <h2 className="text-base font-semibold text-slate-900">Conversión acumulada por ventana</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Compras Plan Conquistar después del diagnóstico · {fmt(eligible)} emails elegibles
        </p>
      </div>

      <div className="relative mx-auto max-w-3xl px-2 pt-2">
        <div className="absolute left-[12%] right-[12%] top-[22px] hidden h-0.5 bg-violet-100 sm:block" />
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-2">
          {nodes.map((node) => (
            <div key={node.key} className="relative flex flex-col items-center text-center">
              <span className="relative z-[1] flex h-11 w-11 items-center justify-center rounded-full border-2 border-violet-200 bg-white text-violet-600 shadow-sm">
                {node.icon}
              </span>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-violet-600/90">
                {node.label}
              </p>
              <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900">{fmt(node.count)}</p>
              <p className="mt-0.5 text-xs font-semibold text-emerald-600">{pctLabel(node.rate)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function EconomicsCards({
  eco,
  adSpendInput,
  setAdSpendInput,
  onApplySpend,
  loading,
}: {
  eco: FunnelMetrics['economics'] | undefined;
  adSpendInput: string;
  setAdSpendInput: (v: string) => void;
  onApplySpend: () => void;
  loading: boolean;
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-slate-500">Inversión publicitaria</p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900">
              {fmtUsd(eco?.adSpendUsd ?? 0)}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">Meta Ads · rango actual</p>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
            <DollarSign className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-3 flex gap-2">
          <input
            type="number"
            min={0}
            step="0.01"
            value={adSpendInput}
            placeholder="USD"
            onChange={(e) => setAdSpendInput(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-200"
          />
          <button
            type="button"
            onClick={onApplySpend}
            disabled={loading}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-violet-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            Cargar
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-slate-500">CAC</p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900">
              {fmtUsd(eco?.cacUsd ?? 0)}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {eco && eco.payingCustomers > 0 && eco.adSpendUsd > 0
                ? `÷ ${fmt(eco.payingCustomers)} compradores`
                : 'Cargá inversión para calcular'}
            </p>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
            <Target className="h-4 w-4" />
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-slate-500">LTV</p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900">
              {fmtUsd(eco?.ltvUsd ?? 0)}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {eco && eco.payingCustomers > 0 ? 'Promedio ingreso PC' : 'Sin compras en el cohort'}
            </p>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <TrendingDown className="h-4 w-4 rotate-180" />
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-slate-500">Payback</p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900">
              {fmt(eco?.paybackDays ?? 0)}{' '}
              <span className="text-base font-semibold text-slate-400">días</span>
            </p>
            <p className="mt-1 text-[11px] text-slate-400">Días para recuperar el CAC</p>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <Clock className="h-4 w-4" />
          </span>
        </div>
      </div>
    </section>
  );
}

const REFERRER_PAGE_SIZE = 8;

function ReferrersCampaignsTable({
  rows,
}: {
  rows: FunnelMetrics['byReferrer'];
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [organicOnly, setOrganicOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (organicOnly && r.refCode !== '__sin_referidor__') return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.refCode.toLowerCase().includes(q)
      );
    });
  }, [rows, query, organicOnly]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / REFERRER_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * REFERRER_PAGE_SIZE, safePage * REFERRER_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [query, organicOnly]);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-violet-600" />
          <h2 className="text-sm font-semibold text-slate-900">Referidores y campañas</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative block min-w-[180px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar campaña"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-300 focus:ring-2 focus:ring-violet-200"
            />
          </label>
          <button
            type="button"
            onClick={() => setOrganicOnly((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              organicOnly
                ? 'border-violet-400 bg-violet-50 text-violet-800'
                : 'border-violet-200 bg-white text-violet-700 hover:bg-violet-50'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtros
          </button>
        </div>
      </div>

      {slice.length === 0 ? (
        <p className="px-5 py-8 text-sm text-slate-500">Sin campañas en el rango (0).</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3">Campaña</th>
                <th className="px-3 py-3">Diagnósticos</th>
                <th className="px-3 py-3">Completados</th>
                <th className="px-3 py-3">Con email</th>
                <th className="px-3 py-3">Emails únicos</th>
                <th className="px-5 py-3">
                  <span className="inline-flex items-center gap-1">
                    Conversión
                    <Info className="h-3 w-3" aria-label="Emails con diagnóstico / diagnósticos" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {slice.map((row) => {
                const conv = pctOf(row.withEmail, row.diagnostics);
                const bar = conv == null ? 0 : Math.min(100, conv);
                const isOrganic = row.refCode === '__sin_referidor__';
                return (
                  <tr
                    key={row.refCode}
                    className={`border-b border-slate-50 last:border-0 ${
                      isOrganic ? 'bg-violet-50/70' : 'bg-white'
                    }`}
                  >
                    <td className="px-5 py-3">
                      <p className="font-semibold text-slate-900">{row.name}</p>
                      {!isOrganic ? (
                        <p className="text-[11px] text-slate-400">{row.refCode}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 font-mono tabular-nums text-slate-700">{fmt(row.diagnostics)}</td>
                    <td className="px-3 py-3 font-mono tabular-nums text-slate-700">{fmt(row.completed)}</td>
                    <td className="px-3 py-3 font-mono tabular-nums text-slate-700">{fmt(row.withEmail)}</td>
                    <td className="px-3 py-3 font-mono tabular-nums text-slate-700">{fmt(row.uniqueEmails)}</td>
                    <td className="px-5 py-3">
                      <div className="flex min-w-[120px] items-center gap-2">
                        <span className="w-12 shrink-0 text-xs font-semibold tabular-nums text-slate-700">
                          {conv == null ? '—' : `${String(conv).replace('.', ',')}%`}
                        </span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${bar}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p>
          Mostrando {slice.length} de {filtered.length} campañas
          {organicOnly ? ' · filtro orgánico' : ''}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-violet-300 bg-violet-50 px-2 font-semibold text-violet-800">
            {safePage}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
            aria-label="Página siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
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

          <CumulativeConversionTimeline
            eligible={data?.cohorts.eligible ?? 0}
            h24={f.purchaseH24}
            d30={f.purchaseD30}
            d60={f.purchaseD60}
            d90={f.purchaseD90}
          />

          <EconomicsCards
            eco={eco}
            adSpendInput={adSpendInput}
            setAdSpendInput={setAdSpendInput}
            onApplySpend={() => void load()}
            loading={loading}
          />

          <ReferrersCampaignsTable rows={data?.byReferrer ?? []} />

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
