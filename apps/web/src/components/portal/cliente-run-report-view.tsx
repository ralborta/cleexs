'use client';

import type { ComponentType } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  Gauge,
  Info,
  LineChart,
  ListChecks,
  Lock,
  Medal,
  Plus,
  Rocket,
  Sparkles,
  Users,
} from 'lucide-react';
import { PortalFreeTierNav } from '@/components/portal/portal-free-tier-nav';
import { PortalCrecimientoTierNav } from '@/components/portal/portal-crecimiento-tier-nav';

const TOKEN_KEY = 'cleexs_portal_token';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type UsageResponse = {
  planKey?: string;
  planDisplay?: string;
  account?: { email?: string };
  usage?: { scoreViews?: number; deepReportsGenerated?: number };
  limits?: { scoreViews?: number | null; deepReportsGenerated?: number | null };
};

type PortalRunDetail = {
  id: string;
  status: string;
  brand: {
    id?: string;
    name: string;
    domain?: string | null;
    aliases: Array<{ id: string; alias: string }>;
    competitors?: Array<{ id: string; name: string; domain?: string | null }>;
  };
  priaReports?: Array<{ priaTotal: number }>;
  promptResults: Array<{
    id?: string;
    score: number;
    prompt?: {
      name?: string | null;
      promptText?: string | null;
      category?: { name?: string } | null;
    };
  }>;
};

type ReportItem = {
  id: string;
  status: string;
  createdAt: string;
  score: number | null;
  reportType?: string;
  brand: { id?: string; name: string; domain?: string };
};

type PanelRow = {
  rank: number;
  name: string;
  domain: string | null;
  tag: 'mi_empresa' | 'competidor';
  score: number | null;
};

type PanelResponse = {
  primaryBrandId: string | null;
  multimarca: boolean;
  compareRows: PanelRow[];
};

function isPremiumPlan(planKey?: string) {
  return planKey === 'crecimiento' || planKey === 'enterprise';
}

function isFreePortalPlan(planKey?: string) {
  return planKey === 'free' || planKey === 'anonymous' || !planKey;
}

function toPct(score: number | null | undefined) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  return n <= 1 ? n * 100 : n;
}

function nextRenewalLabel() {
  const d = new Date();
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return next.toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

function displayNameFromEmail(email?: string) {
  if (!email) return 'Tu cuenta';
  const local = email.split('@')[0] ?? '';
  const pretty = local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return pretty || 'Tu cuenta';
}

function initialsFromDisplayName(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || '?';
}

function SemiGauge({ value, showNeedle = true }: { value: number; showNeedle?: boolean }) {
  const gradId = useId().replace(/:/g, '');
  const v = Math.min(100, Math.max(0, value));
  const angleDeg = -90 + (v / 100) * 180;
  return (
    <div className="relative mx-auto flex h-[118px] w-full max-w-[200px] justify-center sm:h-[128px] sm:max-w-[218px]">
      <svg viewBox="0 0 120 72" className="h-full w-full" aria-hidden>
        <defs>
          <linearGradient id={`g-${gradId}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="45%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>
        <path
          d="M 14 64 A 46 46 0 0 1 106 64"
          fill="none"
          stroke="#f1f5f9"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path
          d="M 14 64 A 46 46 0 0 1 106 64"
          fill="none"
          stroke={`url(#g-${gradId})`}
          strokeWidth="9"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${v} ${100 - v}`}
        />
        {showNeedle ? (
          <>
            <g transform={`rotate(${angleDeg} 60 64)`}>
              <line x1="60" y1="64" x2="60" y2="26" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" />
            </g>
            <circle cx="60" cy="64" r="4.5" fill="#1e293b" />
          </>
        ) : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-0">
        <p className="text-xl font-black tabular-nums leading-none text-slate-900 sm:text-[1.35rem]">{Math.round(v)}</p>
        <p className="mt-0.5 text-[9px] font-medium text-slate-500">de 100</p>
      </div>
    </div>
  );
}

function MiniSpark() {
  return (
    <svg width="48" height="20" viewBox="0 0 48 20" className="text-violet-500" aria-hidden>
      <path
        d="M0 14 L8 12 L16 15 L24 8 L32 11 L40 6 L48 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockFooter({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  /** p. ej. rounded-b-xl si el contenedor es rounded-xl */
  className?: string;
}) {
  return (
    <div
      className={`mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-violet-100/90 bg-violet-50/80 px-4 py-2.5 text-[11px] leading-snug text-violet-950 ${className ?? 'rounded-b-2xl'}`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-600" aria-hidden />
        <div className="min-w-0">{children}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function HubMetricCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100">
          <Icon className="h-3.5 w-3.5 text-violet-700" aria-hidden />
        </span>
        <p className="text-[11px] font-semibold text-slate-600">{label}</p>
      </div>
      <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
      {sub ? <p className="text-[11px] text-slate-500">{sub}</p> : null}
    </div>
  );
}

function PortalPlanFreeHeaderKpis({
  run,
  latestReport,
  latestDetailHref,
  currentScore,
  deltaVsPrevious,
  previousComparable,
  analysesUsed,
  analysesLimit,
  analysesLabel,
  belowKpis,
}: {
  run: PortalRunDetail;
  latestReport: ReportItem | null;
  latestDetailHref: string | null;
  currentScore: number;
  deltaVsPrevious: number | null;
  previousComparable: ReportItem | null;
  analysesUsed: number;
  analysesLimit: number | null;
  analysesLabel: string;
  belowKpis?: ReactNode;
}) {
  const domainLine = run.brand.domain?.trim() || 'sin dominio';
  const lastRunDate = latestReport
    ? new Date(latestReport.createdAt).toLocaleDateString('es-AR')
    : '—';
  const comparisonUp = deltaVsPrevious != null && deltaVsPrevious > 0;
  const comparisonDown = deltaVsPrevious != null && deltaVsPrevious < 0;
  const ringFrac =
    analysesLimit != null && analysesLimit > 0
      ? Math.min(1, analysesUsed / analysesLimit)
      : 0;
  const ringDash = `${ringFrac * 88} 88`;

  return (
    <div id="portal-cliente" className="scroll-mt-24 space-y-3">
      <header className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 xl:max-w-[46%]">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-violet-600 sm:text-[10px]">
              PORTAL CLIENTE (PLAN FREE)
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:mt-1.5 sm:text-2xl">
              {run.brand.name}
            </h1>
            <p className="mt-1 text-[11px] leading-snug text-slate-600 sm:mt-1.5 sm:text-xs">
              {domainLine} · Plan Free · Estado{' '}
              <span className="font-semibold lowercase text-emerald-600">{run.status}</span>
            </p>
          </div>
          <div className="flex w-full min-w-0 flex-1 flex-col gap-2.5 rounded-xl border border-violet-200/70 bg-violet-50/95 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-3.5">
            <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:items-center">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 ring-1 ring-violet-200/50">
                <Sparkles className="h-4 w-4 text-violet-600" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold leading-snug text-slate-900 sm:text-[13px]">
                  Desbloqueá todo el potencial de Cleexs
                </p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-slate-600 sm:text-[11px]">
                  Accedé a reportes completos, prompts, histórico y análisis avanzados.
                </p>
              </div>
            </div>
            <Link
              href="/planes"
              className="inline-flex w-full shrink-0 items-center justify-center rounded-lg bg-violet-600 px-3 py-2 text-center text-[11px] font-semibold text-white shadow-sm transition hover:bg-violet-700 sm:w-auto sm:self-center sm:px-3.5 sm:py-2"
            >
              Actualizar plan →
            </Link>
          </div>
        </div>
      </header>

      <section className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
        <div className="relative rounded-xl border border-slate-200/90 bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-100">
            <CalendarClock className="h-3.5 w-3.5 text-violet-600" aria-hidden />
          </div>
          <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">Último análisis</p>
          <p className="mt-0.5 text-base font-bold tabular-nums text-slate-900">{lastRunDate}</p>
          {latestDetailHref ? (
            <Link
              href={latestDetailHref}
              className="mt-1.5 inline-flex text-[10px] font-semibold text-violet-700 hover:underline"
            >
              Ver detalle →
            </Link>
          ) : null}
        </div>

        <div className="relative rounded-xl border border-slate-200/90 bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-100">
            <Gauge className="h-3.5 w-3.5 text-violet-600" aria-hidden />
          </div>
          <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">Cleexs Score</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <p className="text-base font-bold tabular-nums text-slate-900 sm:text-[1.05rem]">{currentScore}</p>
            <span className="rounded-full bg-amber-100 px-1.5 py-px text-[9px] font-semibold text-amber-900">
              Vista parcial
            </span>
          </div>
          <p className="mt-1 text-[9px] text-slate-500">Actualizado: {lastRunDate}</p>
        </div>

        <div className="relative rounded-xl border border-slate-200/90 bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-100">
            <LineChart className="h-3.5 w-3.5 text-violet-600" aria-hidden />
          </div>
          <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">Comparación previa</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <p
              className={`text-base font-bold tabular-nums sm:text-[1.05rem] ${comparisonUp ? 'text-emerald-600' : comparisonDown ? 'text-rose-600' : 'text-slate-900'}`}
            >
              {deltaVsPrevious == null ? '—' : `${deltaVsPrevious > 0 ? '+' : ''}${deltaVsPrevious} pts`}
            </p>
            {deltaVsPrevious != null && deltaVsPrevious !== 0 ? (
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full ${comparisonUp ? 'bg-emerald-500' : 'bg-rose-500'}`}
                aria-hidden
              >
                {comparisonUp ? (
                  <ArrowUp className="h-3 w-3 text-white" strokeWidth={2.5} />
                ) : (
                  <ArrowDown className="h-3 w-3 text-white" strokeWidth={2.5} />
                )}
              </span>
            ) : null}
          </div>
          {previousComparable ? (
            <p className="mt-1 text-[9px] text-slate-500">
              vs {new Date(previousComparable.createdAt).toLocaleDateString('es-AR')}
            </p>
          ) : (
            <p className="mt-1 text-[9px] text-slate-500">Sin base anterior</p>
          )}
        </div>

        <div className="relative rounded-xl border border-slate-200/90 bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-100">
              <ListChecks className="h-3.5 w-3.5 text-violet-600" aria-hidden />
            </div>
            <span title="Uso y tope de análisis según tu cuenta y plan." className="text-slate-400">
              <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </span>
          </div>
          <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">Análisis disponibles</p>
          <p className="mt-0.5 text-base font-bold tabular-nums text-slate-900 sm:text-[1.05rem]">{analysesLabel}</p>
          <Link href="/planes" className="mt-1.5 inline-flex text-[10px] font-semibold text-violet-700 hover:underline">
            Ver plan →
          </Link>
        </div>

        <div className="relative min-h-[6.75rem] rounded-xl border border-slate-200/90 bg-white p-3 pb-9 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-100">
            <BarChart3 className="h-3.5 w-3.5 text-violet-600" aria-hidden />
          </div>
          <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">Límite del plan</p>
          <p className="mt-0.5 pr-11 text-base font-bold leading-tight text-slate-900 sm:text-[1.05rem]">
            {analysesLimit == null || analysesLimit <= 0 ? '—' : `${analysesLimit} análisis / mes`}
          </p>
          <p className="mt-1 text-[9px] text-slate-500">Usados: {analysesUsed}</p>
          {analysesLimit != null && analysesLimit > 0 ? (
            <div className="absolute right-2.5 top-2.5 h-10 w-10">
              <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden>
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-slate-200"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeDasharray={ringDash}
                  className="text-violet-600"
                />
              </svg>
            </div>
          ) : null}
        </div>
      </section>

      {belowKpis ? <div className="flex flex-wrap gap-2 pt-0.5">{belowKpis}</div> : null}
    </div>
  );
}

export type ClienteRunReportShell = 'portal-cliente' | 'portal-crecimiento';

/** Misma vista principal (plan Free / vista parcial); el menú lateral cambía según el portal de entrada. */
export function ClienteRunReportView({ shell }: { shell: ClienteRunReportShell }) {
  const params = useParams();
  const router = useRouter();
  const runId = params.runId as string;
  const [run, setRun] = useState<PortalRunDetail | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [panel, setPanel] = useState<PanelResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [premiumRedirect, setPremiumRedirect] = useState(false);
  const [runningMes, setRunningMes] = useState(false);
  const [hubActionError, setHubActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        let token: string | null = null;
        try {
          token = sessionStorage.getItem(TOKEN_KEY);
        } catch {
          token = null;
        }
        if (!token) {
          setLoadError(
            shell === 'portal-cliente'
              ? 'No hay sesión. Entrá desde /portal-cliente e iniciá sesión.'
              : 'No hay sesión. Entrá desde /portal-crecimiento e iniciá sesión.',
          );
          setLoading(false);
          return;
        }
        const headers = { Authorization: `Bearer ${token}` };
        const [runRes, usageRes] = await Promise.all([
          fetch(`${API_URL}/api/reports/app/reports/${encodeURIComponent(runId)}`, {
            cache: 'no-store',
            headers,
          }),
          fetch(`${API_URL}/api/me/usage`, { cache: 'no-store', headers }),
        ]);
        if (runRes.status === 401 || usageRes.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
          setLoadError(
            shell === 'portal-cliente'
              ? 'Sesión vencida. Volvé a /portal-cliente e iniciá sesión.'
              : 'Sesión vencida. Volvé a /portal-crecimiento e iniciá sesión.',
          );
          setLoading(false);
          return;
        }
        if (!usageRes.ok) {
          const u = await usageRes.json().catch(() => ({}));
          throw new Error((u as { error?: string }).error || `Error usage ${usageRes.status}`);
        }
        if (!runRes.ok) {
          const b = await runRes.json().catch(() => ({}));
          throw new Error((b as { error?: string }).error || `Error ${runRes.status}`);
        }

        const usageData = (await usageRes.json()) as UsageResponse;
        const runData = (await runRes.json()) as PortalRunDetail;

        if (isPremiumPlan(usageData.planKey)) {
          if (!cancelled) {
            setPremiumRedirect(true);
            router.replace(`/portal-crecimiento/reporte/${runId}/premium`);
          }
          return;
        }

        const brandId = runData.brand.id;
        const reportsReq = fetch(`${API_URL}/api/reports/app/reports`, { cache: 'no-store', headers });
        const panelReq = brandId
          ? fetch(`${API_URL}/api/reports/app/portal-panel?brandId=${encodeURIComponent(brandId)}`, {
              cache: 'no-store',
              headers,
            })
          : Promise.resolve(null);

        const [reportsRes, panelRes] = await Promise.all([reportsReq, panelReq]);
        const reportsData = reportsRes.ok ? (((await reportsRes.json()) as ReportItem[]) || []) : [];
        const panelData = panelRes && panelRes.ok ? ((await panelRes.json()) as PanelResponse) : null;

        if (!cancelled) {
          setUsage(usageData);
          setRun(runData);
          setReports(Array.isArray(reportsData) ? reportsData : []);
          setPanel(panelData);
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Error al cargar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId, router, shell]);

  const intentionScores = useMemo(() => {
    if (!run) return [];
    const normalize = (value: string) =>
      value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/g, '')
        .trim();
    const keyOf = (value: string) => {
      const n = normalize(value);
      if (n.includes('urgencia')) return 'urgencia';
      if (n.includes('consideracion')) return 'consideracion';
      if (n.includes('calidad')) return 'calidad';
      if (n.includes('precio')) return 'precio';
      return 'otros';
    };
    const labelOf = (key: string) =>
      key === 'urgencia'
        ? 'Urgencia'
        : key === 'consideracion'
          ? 'Consideración'
          : key === 'calidad'
            ? 'Calidad'
            : key === 'precio'
              ? 'Precio'
              : 'Otros';
    const buckets: Record<string, number[]> = {};
    run.promptResults.forEach((p) => {
      const key = keyOf(p.prompt?.category?.name || p.prompt?.promptText || '');
      if (key === 'otros') return;
      const pct = toPct(p.score ?? 0);
      if (!buckets[key]) buckets[key] = [];
      buckets[key]!.push(Math.max(0, Math.min(100, pct)));
    });
    return Object.entries(buckets)
      .map(([key, values]) => ({
        key,
        label: labelOf(key),
        score: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0,
      }))
      .sort((a, b) => b.score - a.score);
  }, [run]);

  const brandReports = useMemo(() => {
    if (!run) return [];
    return reports
      .filter((r) => (r.brand?.id && run.brand.id ? r.brand.id === run.brand.id : r.brand.name === run.brand.name))
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [reports, run]);

  const latestReport = brandReports[0] ?? null;
  const previousReports = useMemo(() => brandReports.filter((r) => r.id !== runId), [brandReports, runId]);
  const previousComparable = useMemo(
    () => previousReports.find((r) => r.score != null) ?? null,
    [previousReports],
  );

  const cleexsScoreHint = run?.priaReports?.[0]?.priaTotal;
  const currentScore = Math.round(
    cleexsScoreHint ?? toPct(brandReports.find((r) => r.id === runId)?.score ?? latestReport?.score ?? 0),
  );

  const deltaVsPrevious =
    previousComparable && Number.isFinite(currentScore)
      ? Math.round((currentScore - toPct(previousComparable.score)) * 10) / 10
      : null;

  const sortedPanel = useMemo(
    () => [...(panel?.compareRows ?? [])].sort((a, b) => a.rank - b.rank),
    [panel],
  );
  const leaderRow = useMemo(() => {
    const withScore = sortedPanel.filter((r) => r.score != null);
    if (!withScore.length) return null;
    return withScore.reduce((best, r) => (Number(r.score) > Number(best.score) ? r : best));
  }, [sortedPanel]);

  const comparisonRows = useMemo(() => {
    const leaderSc = leaderRow?.score != null ? Number(leaderRow.score) : null;
    return sortedPanel.slice(0, 4).map((row) => {
      const sc = row.score != null ? Math.round(Number(row.score)) : null;
      const diff =
        leaderSc != null && sc != null ? Math.round((sc - leaderSc) * 10) / 10 : null;
      return { ...row, displayScore: sc, diff };
    });
  }, [sortedPanel, leaderRow]);

  const competitorRowsPanel = useMemo(
    () => (panel?.compareRows ?? []).filter((row) => row.tag === 'competidor'),
    [panel],
  );
  const miEmpresaRow = useMemo(
    () => (panel?.compareRows ?? []).find((row) => row.tag === 'mi_empresa') ?? null,
    [panel],
  );
  const rank = miEmpresaRow?.rank ?? null;
  const competitorScores = competitorRowsPanel.filter((c) => c.score != null).map((c) => Number(c.score));
  const leaderCompetitor = competitorScores.length > 0 ? Math.max(...competitorScores) : null;
  const avgIntentionScore =
    intentionScores.length > 0
      ? Math.round(intentionScores.reduce((acc, row) => acc + row.score, 0) / intentionScores.length)
      : currentScore;
  const gapVsLeader =
    leaderCompetitor != null && Number.isFinite(currentScore)
      ? Math.round((currentScore - leaderCompetitor) * 10) / 10
      : null;

  const runNewDiagnostic = useCallback(async () => {
    if (!run?.brand?.id) {
      setHubActionError('No se pudo identificar la marca para ejecutar una nueva corrida.');
      return;
    }
    let token: string | null = null;
    try {
      token = sessionStorage.getItem(TOKEN_KEY);
    } catch {
      token = null;
    }
    if (!token) {
      setHubActionError('Sesión vencida. Volvé al portal e iniciá sesión.');
      return;
    }
    setRunningMes(true);
    setHubActionError(null);
    try {
      const res = await fetch(`${API_URL}/api/runs/portal/mes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ brandId: run.brand.id }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) throw new Error(body.message || body.error || `Error HTTP ${res.status}`);
      window.location.href = '/portal-crecimiento';
    } catch (e) {
      setHubActionError(e instanceof Error ? e.message : 'Error al iniciar la corrida');
    } finally {
      setRunningMes(false);
    }
  }, [run?.brand?.id]);

  const configuredCompetitors = run?.brand.competitors ?? [];
  const analysesUsed = usage?.usage?.scoreViews ?? 0;
  const analysesLimitRaw = usage?.limits?.scoreViews;
  const analysesLimitForNav = analysesLimitRaw ?? 2;
  const analysesLabel =
    analysesLimitRaw == null ? `${analysesUsed} (sin tope declarado)` : `${analysesUsed} / ${analysesLimitRaw}`;

  const scoreLevel =
    currentScore >= 80 ? 'Nivel excelente' : currentScore >= 60 ? 'Nivel alto' : currentScore >= 40 ? 'Nivel medio' : 'Nivel inicial';

  const scoreLevelClass =
    currentScore >= 80
      ? 'text-emerald-700'
      : currentScore >= 60
        ? 'text-primary-700'
        : currentScore >= 40
          ? 'text-amber-700'
          : 'text-slate-700';

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <p className="text-center text-sm text-slate-600">Cargando portal cliente…</p>
      </main>
    );
  }

  if (premiumRedirect) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <p className="text-center text-sm text-slate-600">Redirigiendo al portal Crecimiento (Premium)…</p>
      </main>
    );
  }

  if (loadError || !run) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-red-200/80 bg-red-50/90 p-6 text-sm text-red-900">
          <p>{loadError || 'No encontrado.'}</p>
          <Link
            href={shell === 'portal-cliente' ? '/portal-cliente' : '/portal-crecimiento'}
            className="font-semibold text-violet-700 underline"
          >
            {shell === 'portal-cliente' ? '← Portal cliente' : '← Portal Crecimiento'}
          </Link>
        </div>
      </main>
    );
  }

  if (!isFreePortalPlan(usage?.planKey)) {
    return null;
  }

  const base =
    shell === 'portal-cliente'
      ? `/portal-cliente/reporte/${runId}`
      : `/portal-crecimiento/reporte/${runId}/cliente`;

  const latestDetailHref = latestReport
    ? shell === 'portal-cliente'
      ? `/portal-cliente/reporte/${latestReport.id}`
      : `/portal-crecimiento/reporte/${latestReport.id}/cliente`
    : null;

  const equipoFreeSection = (
    <section
      id="equipo"
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
    >
      <div className="p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-bold text-slate-900 sm:text-sm">Equipo (1/2 miembros usados)</h2>
          <Link
            href={`/portal-crecimiento/reporte/${runId}/premium/equipo`}
            className="text-[10px] font-semibold text-violet-700 hover:underline sm:text-[11px]"
          >
            Gestionar equipo →
          </Link>
        </div>

        <div className="mt-3 flex flex-col gap-2.5 sm:gap-3 lg:flex-row lg:items-stretch">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/90 p-2.5 sm:p-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-[10px] font-bold text-violet-800 ring-1 ring-violet-200/60"
              aria-hidden
            >
              {initialsFromDisplayName(displayNameFromEmail(usage?.account?.email))}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-xs font-semibold text-slate-900 sm:text-sm">
                  {displayNameFromEmail(usage?.account?.email)} (Tú)
                </p>
                <span className="rounded-md bg-violet-100 px-1.5 py-px text-[9px] font-semibold text-violet-800">
                  Admin
                </span>
              </div>
              <p className="mt-0.5 truncate text-[10px] text-slate-500 sm:text-[11px]">
                {usage?.account?.email ?? 'Sin email en sesión'}
              </p>
            </div>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 bg-white px-2.5 py-3 text-center">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100">
              <Plus className="h-3.5 w-3.5 text-violet-600" aria-hidden />
            </span>
            <button
              type="button"
              disabled
              className="cursor-not-allowed text-[11px] font-semibold text-violet-700"
            >
              Invitar miembro
            </button>
            <p className="text-[9px] leading-snug text-slate-500">Hasta 2 miembros en plan Free.</p>
            <p className="text-[9px] leading-snug text-slate-500">
              Solo podés <span className="font-medium text-slate-600">invitar a 1 persona</span> más.
            </p>
          </div>

          <div className="flex flex-1 flex-col justify-center gap-1.5 rounded-xl border border-violet-100 bg-violet-50/90 p-2.5 sm:p-3">
            <div className="flex gap-2">
              <Lock className="mt-0.5 h-3 w-3 shrink-0 text-violet-600" aria-hidden />
              <p className="text-[10px] leading-snug text-violet-950 sm:text-[11px]">
                Premium permite hasta 10 miembros del equipo.
              </p>
            </div>
            <Link
              href="/planes"
              className="pl-[1.25rem] text-[10px] font-semibold text-violet-700 hover:underline sm:text-[11px]"
            >
              Actualizar plan →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );

  const freeMainColumn = (
    <div className="min-w-0 space-y-4">
      <PortalPlanFreeHeaderKpis
        run={run}
        latestReport={latestReport}
        latestDetailHref={latestDetailHref}
        currentScore={currentScore}
        deltaVsPrevious={deltaVsPrevious}
        previousComparable={previousComparable}
        analysesUsed={analysesUsed}
        analysesLimit={analysesLimitRaw ?? null}
        analysesLabel={analysesLabel}
      />

          <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
            <section className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
              <div className="flex flex-1 flex-col p-4 sm:p-5">
                <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
                  <h2 className="text-xs font-bold text-slate-900 sm:text-sm">Cleexs Score</h2>
                  <span className="text-[11px] font-normal text-slate-500">(vista parcial)</span>
                </div>
                <div className="mt-4 grid flex-1 items-center gap-4 sm:grid-cols-2 sm:gap-5">
                  <div className="flex flex-col items-center justify-center">
                    <SemiGauge value={currentScore} showNeedle={false} />
                    <p className={`mt-0.5 text-center text-[11px] font-bold ${scoreLevelClass}`}>{scoreLevel}</p>
                  </div>
                  <p className="self-center text-[11px] leading-relaxed text-slate-600 sm:text-xs">
                    Probabilidad de que una IA recomiende o priorice tu marca frente a otras opciones.
                  </p>
                </div>
              </div>
              <LockFooter
                action={
                  <Link href="/planes" className="font-semibold text-violet-700 hover:underline">
                    Actualizar plan →
                  </Link>
                }
              >
                Accedé al detalle por intención, evolución y factores que impactan tu score con el plan Premium.
              </LockFooter>
            </section>

            <section
              className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
            >
              <div className="flex flex-1 flex-col p-4 sm:p-5">
                <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
                  <h2 className="text-xs font-bold text-slate-900 sm:text-sm">Desempeño por intención</h2>
                  <span className="text-[11px] font-normal text-slate-500">(vista parcial)</span>
                </div>
                {intentionScores.length === 0 ? (
                  <p className="mt-4 text-[11px] text-slate-600 sm:text-xs">Sin datos por intención en esta corrida.</p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {intentionScores.map((row) => (
                      <li key={row.key}>
                        <div className="mb-1 flex justify-between text-[11px] text-slate-800 sm:text-xs">
                          <span className="font-medium">{row.label}</span>
                          <span className="font-semibold tabular-nums text-slate-900">{Math.round(row.score)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-violet-600"
                            style={{ width: `${Math.min(100, row.score)}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <LockFooter
                action={
                  <Link href="/planes" className="font-semibold text-violet-700 hover:underline">
                    Actualizar plan →
                  </Link>
                }
              >
                Ver análisis completo por intención y recomendaciones.
              </LockFooter>
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
            <section
              id="comparacion"
              className="flex h-full flex-col scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
            >
              <div className="flex flex-1 flex-col p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-slate-900">
                    Comparación con competidores (vista parcial)
                  </h2>
                  <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                    Vista parcial
                  </span>
                </div>
                {comparisonRows.length === 0 ? (
                  <p className="mt-6 text-sm text-slate-600">Aún no hay filas en el panel comparativo.</p>
                ) : (
                  <div className="mt-6 overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full min-w-[360px] text-left text-sm">
                      <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-3 py-3">#</th>
                          <th className="px-3 py-3">Marca</th>
                          <th className="px-3 py-3 text-right">Cleexs Score</th>
                          <th className="px-3 py-3 text-right">Diferencia</th>
                          <th className="px-3 py-3">Tendencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonRows.map((row) => (
                          <tr key={`${row.rank}-${row.name}`} className="border-b border-slate-50 last:border-0">
                            <td className="px-3 py-3 text-slate-600">{row.rank}</td>
                            <td className="px-3 py-3 font-medium text-slate-900">
                              {row.name}
                              {row.tag === 'mi_empresa' ? (
                                <span className="ml-2 text-xs font-normal text-violet-600">(Tú)</span>
                              ) : null}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums font-semibold">
                              {row.displayScore ?? '—'}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums text-slate-600">
                              {row.diff == null ? '—' : row.diff > 0 ? `+${row.diff}` : row.diff}
                            </td>
                            <td className="px-3 py-3">
                              <MiniSpark />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <LockFooter>
                Desbloqueá el ranking completo, detalle por prompt y brecha vs líder.{' '}
                <Link href="/planes" className="font-semibold text-violet-700 hover:underline">
                  Actualizar plan →
                </Link>
              </LockFooter>
            </section>

            <section
              id="competidores"
              className="flex h-full flex-col scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
            >
              <div className="flex flex-1 flex-col p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-slate-900">
                    Competidores ({Math.min(configuredCompetitors.length, 5)}/5)
                  </h2>
                  {configuredCompetitors.length > 0 ? (
                    <Link
                      href={`${base}#competidores`}
                      className="text-xs font-semibold text-violet-700 hover:underline"
                    >
                      Ver todos →
                    </Link>
                  ) : null}
                </div>
                <ul className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-100">
                  {configuredCompetitors.length === 0 ? (
                    <li className="px-4 py-4 text-sm text-slate-600">Sin competidores configurados en cuenta.</li>
                  ) : (
                    configuredCompetitors.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3.5 text-sm">
                        <div>
                          <p className="font-semibold text-slate-900">{c.name}</p>
                          <p className="text-xs text-slate-500">{c.domain || 'sin dominio'}</p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                          Activo
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <LockFooter>
                Detectá nuevos competidores y recibí alertas.{' '}
                <Link href="/planes" className="font-semibold text-violet-700 hover:underline">
                  Actualizar plan →
                </Link>
              </LockFooter>
            </section>
          </div>

          {equipoFreeSection}

          <section className="rounded-2xl border border-violet-200/80 bg-gradient-to-r from-violet-50 via-white to-violet-50/80 p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-5 w-5 text-violet-600" aria-hidden />
                <div>
                  <p className="font-semibold text-violet-950">Más datos. Mejores decisiones.</p>
                  <p className="mt-1 text-sm text-violet-900/85">
                    Desbloqueá prompts, historial completo, reportes avanzados, exportaciones y más.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/planes"
                  className="inline-flex items-center justify-center rounded-lg border border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-900 shadow-sm hover:bg-violet-50"
                >
                  Ver planes y precios
                </Link>
                <Link
                  href="/planes"
                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
                >
                  Actualizar plan <ArrowUpRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>
          </section>

          <p className="text-center text-[11px] text-slate-400">
            <Link
              href={shell === 'portal-cliente' ? '/portal-cliente' : '/portal-crecimiento'}
              className="text-violet-600 hover:underline"
            >
              {shell === 'portal-cliente' ? '← Inicio portal cliente' : '← Inicio Crecimiento'}
            </Link>
            {' · '}
            {shell === 'portal-cliente' ? (
              <>
                <Link
                  href={`/portal-crecimiento/reporte/${runId}/cliente`}
                  className="text-violet-600 hover:underline"
                >
                  Ver con menú Crecimiento
                </Link>
                {' · '}
              </>
            ) : (
              <>
                <Link href={`/portal-cliente/reporte/${runId}`} className="text-violet-600 hover:underline">
                  Ver con menú Free
                </Link>
                {' · '}
              </>
            )}
            <Link href={`/portal-crecimiento/reporte/${runId}`} className="text-violet-600 hover:underline">
              Anexo técnico (corrida)
            </Link>
          </p>
    </div>
  );


  const hubMainColumn = (
    <div className="min-w-0 space-y-4">
      <PortalPlanFreeHeaderKpis
        run={run}
        latestReport={latestReport}
        latestDetailHref={latestDetailHref}
        currentScore={currentScore}
        deltaVsPrevious={deltaVsPrevious}
        previousComparable={previousComparable}
        analysesUsed={analysesUsed}
        analysesLimit={analysesLimitRaw ?? null}
        analysesLabel={analysesLabel}
        belowKpis={
          <>
            <Link
              href={`/portal-crecimiento/reporte/${latestReport?.id || run.id}`}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Ver último diagnóstico
            </Link>
            <button
              type="button"
              onClick={() => void runNewDiagnostic()}
              disabled={runningMes || !run.brand?.id}
              className="rounded-lg bg-violet-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {runningMes ? 'Iniciando…' : 'Generar nuevo análisis'}
            </button>
            <Link
              href={`/portal-crecimiento/reporte/${run.id}`}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Compartir reporte
            </Link>
          </>
        }
      />

      {hubActionError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">{hubActionError}</p>
      ) : null}

      <div className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-[11px] text-amber-950">
        Plan Free: algunas lecturas son parciales. Desbloqueá el detalle completo con{' '}
        <Link href="/planes" className="font-semibold text-violet-700 underline">
          Premium
        </Link>
        .
      </div>

      <section
        id="resumen-ejecutivo"
        className="scroll-mt-24 grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-2 lg:items-stretch"
      >
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50/40">
            <div className="flex flex-1 flex-col p-3.5 sm:p-4">
              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
                <p className="text-xs font-bold text-slate-900">Cleexs Score</p>
                <span className="text-[11px] font-normal text-slate-500">(vista parcial)</span>
              </div>
              <div className="mt-3 grid flex-1 items-center gap-3 sm:grid-cols-2 sm:gap-4">
                <div className="flex flex-col items-center">
                  <SemiGauge value={currentScore} showNeedle={false} />
                  <p className={`mt-0.5 text-center text-[11px] font-bold ${scoreLevelClass}`}>{scoreLevel}</p>
                </div>
                <p className="self-center text-[11px] leading-relaxed text-slate-600">
                  Probabilidad de que una IA recomiende o priorice esta marca frente a otras opciones.
                </p>
              </div>
            </div>
            <LockFooter
              className="rounded-b-xl"
              action={
                <Link href="/planes" className="font-semibold text-violet-700 hover:underline">
                  Actualizar plan →
                </Link>
              }
            >
              Accedé al detalle por intención, evolución y factores que impactan tu score con el plan Premium.
            </LockFooter>
          </div>
          {equipoFreeSection}
        </div>
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50/40">
          <div className="flex flex-1 flex-col p-3.5 sm:p-4">
            <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
              <p className="text-xs font-bold text-slate-900">Desempeño por intención</p>
              <span className="text-[11px] font-normal text-slate-500">(vista parcial)</span>
            </div>
            {intentionScores.length === 0 ? (
              <p className="mt-3 text-[11px] text-slate-600">Sin datos por intención en esta corrida.</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {intentionScores.map((row) => (
                  <li key={row.key}>
                    <div className="mb-0.5 flex items-center justify-between text-[11px] text-slate-700">
                      <span className="font-medium">{row.label}</span>
                      <span className="font-semibold tabular-nums">{Math.round(row.score)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-violet-600"
                        style={{ width: `${Math.max(0, Math.min(100, row.score))}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <LockFooter
            className="rounded-b-xl"
            action={
              <Link href="/planes" className="font-semibold text-violet-700 hover:underline">
                Actualizar plan →
              </Link>
            }
          >
            Ver análisis completo por intención y recomendaciones.
          </LockFooter>
        </div>
      </section>

      <section id="comparacion" className="scroll-mt-24 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-900">Comparación</h2>
          <p className="mt-1 text-xs text-slate-600">
            Evolución frente a tu última corrida y posición en el panel comparativo (vista resumida · plan Free).
          </p>
        </div>

        {previousComparable ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-[11px] text-slate-500">Corrida actual</p>
              <p className="text-2xl font-bold text-slate-900">{currentScore}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-[11px] text-slate-500">Corrida anterior</p>
              <p className="text-2xl font-bold text-slate-900">{Math.round(toPct(previousComparable.score))}</p>
              <p className="mt-1 text-[10px] text-slate-500">
                {new Date(previousComparable.createdAt).toLocaleString('es-AR')}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-[11px] text-slate-500">Diferencia</p>
              <p
                className={`text-2xl font-bold ${deltaVsPrevious != null && deltaVsPrevious >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}
              >
                {deltaVsPrevious == null ? '—' : `${deltaVsPrevious > 0 ? '+' : ''}${deltaVsPrevious}`}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-600">No hay una corrida anterior con score disponible para comparar.</p>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <HubMetricCard icon={Gauge} label="Cleexs Score" value={String(currentScore)} sub={scoreLevel} />
          <HubMetricCard
            icon={Medal}
            label="Ranking"
            value={rank ? `#${rank}` : '—'}
            sub={`de ${Math.max(1, panel?.compareRows.length ?? 0)} marcas`}
          />
          <HubMetricCard icon={ListChecks} label="Reportes generados" value={String(brandReports.length)} />
          <HubMetricCard icon={BarChart3} label="Promedio desempeño" value={`${avgIntentionScore}%`} />
          <HubMetricCard
            icon={LineChart}
            label="Brecha vs líder"
            value={gapVsLeader == null ? '—' : `${gapVsLeader > 0 ? '+' : ''}${gapVsLeader} pts`}
            sub={gapVsLeader == null ? 'Sin datos' : undefined}
          />
          <HubMetricCard
            icon={Rocket}
            label="Mejor intención"
            value={intentionScores[0] ? intentionScores[0].label : '—'}
            sub={intentionScores[0] ? `${Math.round(intentionScores[0].score)}%` : 'Sin dato'}
          />
        </div>

        <div id="competidores" className="scroll-mt-24">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Ranking del panel</h3>
          {sortedPanel.length === 0 ? (
            <p className="mt-2 text-xs text-slate-600">Sin filas del panel comparativo.</p>
          ) : (
            <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[320px] text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Marca</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2 text-right">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPanel.map((row) => (
                    <tr key={`${row.rank}-${row.name}`} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-700">{row.rank}</td>
                      <td className="px-3 py-2 text-slate-900">{row.name}</td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            row.tag === 'mi_empresa'
                              ? 'rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800'
                              : 'rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700'
                          }
                        >
                          {row.tag === 'mi_empresa' ? 'Tu marca' : 'Competidor'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-900">
                        {row.score == null ? '—' : Math.round(Number(row.score))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Link
          href={`/portal-crecimiento/reporte/${run.id}`}
          className="inline-flex rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
        >
          Ver informe completo (Top 3 y anexo por prompt) →
        </Link>
      </section>

      <section className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-violet-950">Más datos con Premium</p>
          <Link
            href="/planes"
            className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-semibold text-violet-900"
          >
            Ver planes y precios →
          </Link>
        </div>
        <p className="mt-1 text-xs text-violet-900/80">
          Desbloqueá interpretación ampliada, prompts, histórico y exportaciones desde el mismo hub.
        </p>
      </section>

      <p className="text-center text-[11px] text-slate-400">
        <Link href="/portal-crecimiento" className="text-violet-600 hover:underline">
          ← Inicio Crecimiento
        </Link>
        {' · '}
        <Link href={`/portal-cliente/reporte/${runId}`} className="text-violet-600 hover:underline">
          Vista menú Free
        </Link>
        {' · '}
        <Link href={`/portal-crecimiento/reporte/${runId}`} className="text-violet-600 hover:underline">
          Anexo técnico
        </Link>
      </p>
    </div>
  );

  const mainColumn = shell === 'portal-cliente' ? freeMainColumn : hubMainColumn;

  return (
    <main className="min-h-screen scroll-smooth bg-slate-50 p-3 sm:p-5">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[280px_1fr]">
        {shell === 'portal-cliente' ? (
          <PortalFreeTierNav
            basePath={base}
            analysesUsed={analysesUsed}
            analysesLimit={analysesLimitForNav}
            renewalLabel={nextRenewalLabel()}
          />
        ) : (
          <PortalCrecimientoTierNav
            basePath={base}
            runId={runId}
            planLabel={usage?.planDisplay || usage?.planKey || 'Free'}
            analysesUsed={analysesUsed}
            analysesLimit={analysesLimitForNav}
            renewalLabel={nextRenewalLabel()}
          />
        )}
        {mainColumn}
      </div>
    </main>
  );
}
