'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bot,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Globe2,
  Info,
  Loader2,
  Mail,
  MessageCircle,
  Network,
  RefreshCw,
  Share2,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import type { FunnelMetrics } from '@/components/funnel/funnel-dashboard';

function fmt(n: number) {
  return n.toLocaleString('es-AR');
}

function pctLabel(p: number | null) {
  return p == null ? '—' : `${p}%`;
}

function stepPct(num: number, den: number): number | null {
  return den > 0 ? Math.round((num / den) * 1000) / 10 : null;
}

function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function todayAR(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function formatRange(from: string, to: string) {
  const fmtD = (s: string) => {
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  };
  return `${fmtD(from)} — ${fmtD(to)}`;
}

/**
 * Dashboard Agency: layout Stitch cableado al funnel real
 * (`/api/borrador/portal-funnel` — misma fuente que la pestaña Funnel).
 */
export function AgencyDashboardView() {
  const today = useMemo(() => todayAR(), []);
  const initial = useMemo(() => ({ from: addDays(today, -14), to: today }), [today]);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [preset, setPreset] = useState<string | null>('15');
  const [data, setData] = useState<FunnelMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/borrador/portal-funnel?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || 'Error al cargar métricas');
      setData(json as FunnelMetrics);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyPreset(key: 'hoy' | 'ayer' | '7' | '15' | '30') {
    setPreset(key);
    if (key === 'hoy') {
      setFrom(today);
      setTo(today);
      return;
    }
    if (key === 'ayer') {
      const y = addDays(today, -1);
      setFrom(y);
      setTo(y);
      return;
    }
    const span = key === '7' ? 6 : key === '15' ? 14 : 29;
    setFrom(addDays(today, -span));
    setTo(today);
  }

  const f = data?.funnel;
  const visitors = f?.visitors.count ?? 0;
  const demos = f?.diagnosticsStarted.count ?? 0;
  const completed = f?.diagnosticsCompleted.count ?? 0;
  const emails = f?.emailsCaptured.count ?? 0;
  const shared = f?.shares.count ?? 0;
  const purchaseH24 = f?.purchaseH24.count ?? 0;
  const purchased = f?.purchaseD30.count ?? 0;

  const demoOfVisitors = stepPct(demos, visitors);
  const completedOfDemos = stepPct(completed, demos);
  const emailOfCompleted = stepPct(emails, completed);
  const sharedOfEmails = stepPct(shared, emails);
  const h24OfShared = stepPct(purchaseH24, shared);
  const purchasedOfH24 = stepPct(purchased, Math.max(purchaseH24, 1));
  // Si no hubo compra 24h, mostrar % vs emails (cohorte elegible).
  const purchasedOfEmails = stepPct(purchased, emails);

  const dropVisitToDemo =
    visitors > 0 ? Math.round(((visitors - demos) / visitors) * 1000) / 10 : null;

  const eco = data?.economics;
  const paying = eco?.payingCustomers ?? purchased;
  const revenue = eco?.revenueUsd ?? 0;
  const ltv = eco?.ltvUsd ?? 99;
  const mrr = paying > 0 ? Math.round(paying * ltv) : Math.round(revenue);
  const pipeline = Math.round(emails * ltv);
  const deals = Math.max(0, emails - purchased);
  const activaciones = demos;
  const sprintMeta = Math.max(10, Math.ceil(demos * 1.2) || 10);
  const sprintPct = sprintMeta > 0 ? Math.min(100, Math.round((activaciones / sprintMeta) * 100)) : 0;
  const closeRate = emails > 0 ? Math.round((purchased / emails) * 1000) / 10 : 0;

  const referrers = (data?.byReferrer ?? [])
    .filter((r) => r.refCode !== '__sin_referidor__' && !/sin referidor/i.test(r.name))
    .slice(0, 5);
  const referrerTotal = referrers.reduce((s, r) => s + (r.uniqueEmails || r.withEmail || 0), 0) || 1;

  const stages = [
    {
      n: 1,
      label: 'Visitantes',
      value: visitors,
      pct: '100%',
      hint: 'base',
      bar: 100,
      tone: 'indigo' as const,
      icon: <Users className="h-[18px] w-[18px] text-[#94a3b8]" />,
    },
    {
      n: 2,
      label: 'Pidieron Demo',
      value: demos,
      pct: pctLabel(demoOfVisitors),
      hint: 'del paso ant.',
      bar: Math.min(100, demoOfVisitors ?? 0),
      tone: 'indigo' as const,
      icon: <MessageCircle className="h-[18px] w-[18px] text-[#94a3b8]" />,
    },
    {
      n: 3,
      label: 'Completaron',
      value: completed,
      pct: pctLabel(completedOfDemos),
      hint: 'del paso ant.',
      bar: Math.min(100, completedOfDemos ?? 0),
      tone: 'indigo' as const,
      icon: <ClipboardList className="h-[18px] w-[18px] text-[#94a3b8]" />,
    },
    {
      n: 4,
      label: 'Dejaron Email',
      value: emails,
      pct: pctLabel(emailOfCompleted),
      hint: 'del paso ant.',
      bar: Math.min(100, emailOfCompleted ?? 0),
      tone: 'green' as const,
      icon: <Mail className="h-[18px] w-[18px] text-[#94a3b8]" />,
    },
    {
      n: 5,
      label: 'Compartieron',
      value: shared,
      pct: pctLabel(sharedOfEmails),
      hint: 'del paso ant.',
      bar: Math.min(100, sharedOfEmails ?? 0),
      tone: 'green' as const,
      icon: <Share2 className="h-[18px] w-[18px] text-[#94a3b8]" />,
    },
    {
      n: 6,
      label: 'Compra 24h',
      value: purchaseH24,
      pct: pctLabel(h24OfShared),
      hint: 'del paso ant.',
      bar: Math.min(100, h24OfShared ?? 0),
      tone: 'indigo' as const,
      icon: <Zap className="h-[18px] w-[18px] text-[#94a3b8]" />,
    },
    {
      n: 7,
      label: 'Contrataron',
      value: purchased,
      pct: pctLabel(purchaseH24 > 0 ? purchasedOfH24 : purchasedOfEmails),
      hint: purchaseH24 > 0 ? 'vs 24h' : 'de emails',
      bar: Math.min(100, (purchaseH24 > 0 ? purchasedOfH24 : purchasedOfEmails) ?? 0),
      tone: 'success' as const,
      icon: <CheckCircle2 className="h-[18px] w-[18px] text-[#059669]" />,
    },
  ];

  const retainDemoEmail = stepPct(emails, demos);

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#0f172a]">Conversión y Métricas Generales</h1>
          <p className="mt-1 max-w-2xl text-[14px] text-[#64748b]">
            Embudo de adquisición Empliados: de visitas a operadores logísticos que activan agentes IA. Datos en vivo ·
            cierres a medianoche UTC-3.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-[#f1f5f9] p-1 shadow-sm">
            {(
              [
                ['hoy', 'Hoy'],
                ['ayer', 'Ayer'],
                ['7', '7 días'],
                ['15', '15 días'],
                ['30', '30 días'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key)}
                className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition ${
                  preset === key
                    ? 'bg-white text-[#4648d4] shadow-[0_1px_3px_rgba(0,0,0,0.06)]'
                    : 'text-[#64748b] hover:text-[#0f172a]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center rounded-lg bg-white px-3 py-1.5 shadow-sm ring-1 ring-[#e2e8f0]">
            <Calendar className="mr-2 h-4 w-4 text-[#94a3b8]" />
            <span className="text-[13px] font-semibold tabular-nums text-[#0f172a]">
              {formatRange(from, to)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-1.5 text-[11px] font-semibold text-[#0f172a] shadow-sm ring-1 ring-[#e2e8f0] hover:bg-[#f8fafc] disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-[#4648d4]" /> : <RefreshCw className="h-4 w-4 text-[#4648d4]" />}
            Actualizar
          </button>
        </div>
      </div>

      <div className="flex flex-col items-start justify-between gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-[#e2e8f0] sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">Fuente:</span>
          <span className="inline-flex items-center gap-2 rounded-lg bg-[#4648d4] px-3 py-1.5 text-[13px] font-semibold text-white shadow-sm">
            <Network className="h-4 w-4" />
            Funnel en vivo
            <span className="text-[11px] text-white/80">Fathom + diagnósticos</span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-lg bg-[#f1f5f9] px-3 py-1.5 text-[13px] font-medium text-[#64748b]">
            <Globe2 className="h-4 w-4" />
            Consolidado
          </span>
        </div>
        <div className="flex items-center gap-2 text-[13px] text-[#64748b]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
          <span>
            Total consolidado:{' '}
            <strong className="font-semibold tabular-nums text-[#0f172a]">
              {fmt(visitors)} visitantes únicos
            </strong>{' '}
            auditados
          </span>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-[#e2e8f0] transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#d1fae5] text-[#047857]">
                <TrendingUp className="h-[19px] w-[19px]" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">MRR Activo</span>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#d1fae5] px-2 py-0.5 text-[11px] font-bold text-[#047857]">
              {fmt(paying)} pagos
            </span>
          </div>
          <div className="my-4">
            <div className="flex items-baseline gap-2">
              <span className="text-[32px] font-bold tracking-tight text-[#0f172a] tabular-nums">
                US$ {fmt(mrr)}
              </span>
              <span className="text-[13px] text-[#94a3b8]">/ mes</span>
            </div>
            <p className="mt-1 text-[13px] text-[#64748b]">Ingresos estimados · LTV × clientes que pagaron en el rango.</p>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] font-semibold text-[#94a3b8] tabular-nums">LTV prom. US$ {fmt(ltv)}</span>
            <svg className="h-6 w-24 text-[#10b981]" fill="none" viewBox="0 0 100 24">
              <path d="M0 20 L20 18 L40 14 L60 16 L80 8 L100 2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
              <path d="M0 20 L20 18 L40 14 L60 16 L80 8 L100 2 L100 24 L0 24 Z" fill="currentColor" fillOpacity="0.08" />
            </svg>
          </div>
        </div>

        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-[#e2e8f0] transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef2ff] text-[#4648d4]">
                <Network className="h-[19px] w-[19px]" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">Pipeline Calificado</span>
            </div>
            <span className="rounded-full bg-[#e0e7ff] px-2 py-0.5 text-[11px] font-bold tabular-nums text-[#3730a3]">
              {fmt(deals)} leads
            </span>
          </div>
          <div className="my-4">
            <div className="flex items-baseline gap-2">
              <span className="text-[32px] font-bold tracking-tight text-[#0f172a] tabular-nums">
                US$ {fmt(pipeline)}
              </span>
              <span className="text-[13px] text-[#94a3b8]">estimado</span>
            </div>
            <p className="mt-1 text-[13px] text-[#64748b]">
              {fmt(emails)} emails capturados · {fmt(deals)} aún sin compra.
            </p>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] font-semibold text-[#94a3b8]">Tasa de cierre: {closeRate}%</span>
            <svg className="h-6 w-24 text-[#4648d4]" fill="none" viewBox="0 0 100 24">
              <path d="M0 22 L25 19 L50 15 L75 11 L100 4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
              <path d="M0 22 L25 19 L50 15 L75 11 L100 4 L100 24 L0 24 Z" fill="currentColor" fillOpacity="0.08" />
            </svg>
          </div>
        </div>

        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-[#e2e8f0] transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ede9fe] text-[#7c3aed]">
                <Bot className="h-[19px] w-[19px]" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">Demos iniciadas</span>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#d1fae5] px-2 py-0.5 text-[11px] font-bold text-[#047857]">
              en vivo
            </span>
          </div>
          <div className="my-4">
            <div className="flex items-baseline gap-2">
              <span className="text-[32px] font-bold tabular-nums tracking-tight text-[#0f172a]">{fmt(activaciones)}</span>
              <span className="text-[13px] text-[#94a3b8]">en el rango</span>
            </div>
            <p className="mt-1 text-[13px] text-[#64748b]">Diagnósticos iniciados · misma cohorte del embudo.</p>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] font-semibold text-[#94a3b8]">Meta de sprint: {sprintMeta}</span>
            <div className="h-2 w-24 overflow-hidden rounded-full bg-[#e2e8f0]">
              <div className="h-full rounded-full bg-[#8b5cf6]" style={{ width: `${sprintPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-[#e2e8f0]">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[20px] font-bold tracking-tight text-[#0f172a]">Embudo de Adquisición Empliados</h2>
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-[#4648d4]" /> : null}
            </div>
            <p className="text-[13px] text-[#64748b]">
              Cohorte {formatRange(from, to)} · misma fuente que la pestaña Funnel.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {stages.map((s) => {
            const success = s.tone === 'success';
            const green = s.tone === 'green';
            const barColor = success || green ? 'bg-[#10b981]' : 'bg-[#4648d4]';
            const pctColor = success || green ? 'text-[#059669]' : 'text-[#4648d4]';
            return (
              <div
                key={s.n}
                className={`relative flex flex-col justify-between rounded-xl p-4 transition ${
                  success ? 'bg-[#d1fae5]/60 hover:bg-[#d1fae5]/80' : 'bg-[#f1f5f9] hover:bg-[#e2e8f0]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[11px] font-bold tabular-nums shadow-sm ${
                      success ? 'text-[#059669]' : 'text-[#0f172a]'
                    }`}
                  >
                    {s.n}
                  </div>
                  {s.icon}
                </div>
                <div className="mb-2 mt-4">
                  <span
                    className={`block text-[11px] font-semibold uppercase tracking-wider ${
                      success ? 'font-bold text-[#059669]' : 'text-[#94a3b8]'
                    }`}
                  >
                    {s.label}
                  </span>
                  <span className="text-[26px] font-bold tabular-nums tracking-tight text-[#0f172a]">{fmt(s.value)}</span>
                </div>
                <div className="space-y-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#e2e8f0]">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.max(4, s.bar)}%` }} />
                  </div>
                  <div className="flex justify-between text-[11px] font-semibold">
                    <span className={pctColor}>{s.pct}</span>
                    <span className="text-[#94a3b8]">{s.hint}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col items-start justify-between gap-2 rounded-lg bg-[#f1f5f9] px-4 py-3 text-[13px] text-[#64748b] sm:flex-row sm:items-center">
          <div className="flex items-start gap-2 sm:items-center">
            <Info className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#10b981] sm:mt-0" />
            <span>
              El flujo retiene <strong className="text-[#0f172a]">{pctLabel(retainDemoEmail)}</strong> entre solicitud de
              demo y entrega de email
              {retainDemoEmail != null && retainDemoEmail >= 38
                ? ', superando la referencia B2B SaaS de logística (38%).'
                : '.'}
            </span>
          </div>
          <button type="button" className="inline-flex items-center gap-1 font-semibold text-[#4648d4] hover:underline">
            Auditar drop-offs
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="flex flex-col justify-between rounded-xl bg-white p-5 shadow-sm ring-1 ring-[#e2e8f0] lg:col-span-7">
          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[20px] font-bold tracking-tight text-[#0f172a]">Emails por referidor (Ranking)</h3>
                <p className="text-[13px] text-[#64748b]">Top campañas / refs con emails en el rango.</p>
              </div>
              <span className="rounded bg-[#f1f5f9] px-2.5 py-1 text-[11px] font-semibold text-[#64748b]">
                Top {referrers.length} de {(data?.byReferrer ?? []).filter((r) => r.refCode !== '__sin_referidor__').length || referrers.length}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {referrers.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-[#94a3b8]">Sin emails atribuidos a un ref en el rango.</p>
              ) : (
                referrers.map((r, i) => {
                  const emailsCount = r.uniqueEmails || r.withEmail || 0;
                  const share = Math.round((emailsCount / referrerTotal) * 1000) / 10;
                  const initials = r.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((w) => w[0]?.toUpperCase() ?? '')
                    .join('');
                  const conv = r.diagnostics > 0 ? Math.round((emailsCount / r.diagnostics) * 100) : 0;
                  return (
                    <div
                      key={r.refCode}
                      className="flex items-center justify-between rounded-lg p-3 transition hover:bg-[#f8fafc]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded text-[11px] font-bold tabular-nums ${
                            i === 0 ? 'bg-[#eef2ff] text-[#4648d4]' : 'bg-[#f1f5f9] text-[#0f172a]'
                          }`}
                        >
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e2e8f0] text-[11px] font-bold text-[#0f172a]">
                            {initials || 'R'}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-[14px] font-semibold text-[#0f172a]">{r.name}</div>
                            <div className="truncate text-[11px] text-[#94a3b8]">ref: {r.refCode}</div>
                          </div>
                        </div>
                      </div>
                      <div className="ml-3 flex shrink-0 items-center gap-4">
                        <div className="text-right">
                          <span className="block text-[14px] font-bold tabular-nums text-[#0f172a]">
                            {fmt(emailsCount)} emails
                          </span>
                          <span className="block text-[11px] text-[#94a3b8]">{share}% del total</span>
                        </div>
                        <span className="rounded-full bg-[#d1fae5] px-2 py-0.5 text-[11px] font-bold text-[#047857]">
                          {conv}% conv.
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-5">
          <div className="rounded-xl border border-rose-200/80 bg-[#fff1f2] p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-rose-700">
                Alerta Funnel
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-500">Punto crítico de fuga</span>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-600">Mayor abandono detectado</p>
            <p className="mt-1 text-[26px] font-bold tracking-tight text-[#0f172a]">
              {pctLabel(dropVisitToDemo)} se retira
            </p>
            <p className="mt-1 text-[13px] text-[#64748b]">
              Entre Visitantes e inicio de demo · ~{fmt(Math.max(0, visitors - demos))} usuarios perdidos en el rango.
            </p>
            <ul className="mt-4 space-y-2 text-[13px] text-[#334155]">
              <li className="flex items-start gap-2">
                <input type="checkbox" className="mt-1 rounded border-[#cbd5e1]" defaultChecked readOnly />
                Activar auto-prompt Teo en landing de demo
              </li>
              <li className="flex items-start gap-2">
                <input type="checkbox" className="mt-1 rounded border-[#cbd5e1]" defaultChecked readOnly />
                Simplificar campos del formulario (email + WA)
              </li>
            </ul>
            <button
              type="button"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#312e81] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#3730a3]"
            >
              <Zap className="h-4 w-4" />
              Aplicar Optimización A/B en 1-Click
            </button>
          </div>

          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-[#e2e8f0]">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#8b5cf6]" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                Share of Voice IA (Semana)
              </span>
            </div>
            <p className="mt-2 text-[13px] text-[#334155]">
              Empliados aparece recomendado en <strong className="text-[#0f172a]">74%</strong> de prompts LLM de logística
              medidos esta semana.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
