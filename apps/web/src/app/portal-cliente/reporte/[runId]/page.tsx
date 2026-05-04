'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Headphones,
  Lock,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { CleexsMark } from '@/components/brand/cleexs-mark';

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

function SemiGauge({ value }: { value: number }) {
  const v = Math.min(100, Math.max(0, value));
  const angleDeg = -90 + (v / 100) * 180;
  return (
    <div className="relative mx-auto flex h-[140px] w-full max-w-[260px] justify-center">
      <svg viewBox="0 0 120 72" className="h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="portalClienteGaugeArc" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
        <path
          d="M 14 64 A 46 46 0 0 1 106 64"
          fill="none"
          stroke="#ede9fe"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M 14 64 A 46 46 0 0 1 106 64"
          fill="none"
          stroke="url(#portalClienteGaugeArc)"
          strokeWidth="10"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${v} ${100 - v}`}
        />
        <g transform={`rotate(${angleDeg} 60 64)`}>
          <line x1="60" y1="64" x2="60" y2="28" stroke="#4c1d95" strokeWidth="2.2" strokeLinecap="round" />
        </g>
        <circle cx="60" cy="64" r="5" fill="#4c1d95" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
        <p className="text-3xl font-black tabular-nums text-violet-950">{Math.round(v)}</p>
        <p className="text-[10px] font-medium text-slate-500">de 100</p>
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

function LockFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-b-xl border-t border-violet-100 bg-violet-50/90 px-4 py-3 text-xs text-violet-950">
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" aria-hidden />
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

/** Portal cliente · plan Free — ruta propia (/portal-cliente), separado de Cleexs Crecimiento. */
export default function PortalClienteReportePage() {
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
          setLoadError('No hay sesión. Entrá desde /portal-cliente e iniciá sesión.');
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
          setLoadError('Sesión vencida. Volvé a /portal-cliente e iniciá sesión.');
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
  }, [runId, router]);

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

  const configuredCompetitors = run?.brand.competitors ?? [];
  const analysesUsed = usage?.usage?.scoreViews ?? 0;
  const analysesLimit = usage?.limits?.scoreViews ?? 2;
  const analysesLabel =
    analysesLimit == null ? `${analysesUsed} (sin tope declarado)` : `${analysesUsed} / ${analysesLimit}`;

  const scoreLevel =
    currentScore >= 80 ? 'Nivel excelente' : currentScore >= 60 ? 'Nivel alto' : currentScore >= 40 ? 'Nivel medio' : 'Nivel inicial';

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
          <Link href="/portal-cliente" className="font-semibold text-violet-700 underline">
            ← Portal cliente
          </Link>
        </div>
      </main>
    );
  }

  if (!isFreePortalPlan(usage?.planKey)) {
    return null;
  }

  const base = `/portal-cliente/reporte/${runId}`;

  return (
    <main className="min-h-screen scroll-smooth bg-slate-50 p-3 sm:p-5">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <CleexsMark className="h-7 w-7" />
            <p className="font-bold text-slate-900">Cleexs</p>
          </div>
          <nav className="space-y-1 text-sm">
            <a
              href={`${base}#portal-cliente`}
              className="flex items-center justify-between gap-2 rounded-lg bg-violet-50 px-3 py-2 font-semibold text-violet-900"
            >
              Portal cliente
              <span className="rounded bg-violet-200 px-1.5 py-0.5 text-[10px] font-bold text-violet-900">FREE</span>
            </a>
            <a
              href={`${base}#comparacion`}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50"
            >
              Comparación
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                Disponible
              </span>
            </a>
            <a
              href={`${base}#competidores`}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50"
            >
              Competidores
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                Disponible
              </span>
            </a>
            <a
              href={`${base}#equipo`}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50"
            >
              Equipo
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                Disponible
              </span>
            </a>
            {(['Prompts', 'Historial', 'Reportes', 'Herramientas', 'Suscripción'] as const).map((label) => (
              <div
                key={label}
                className="flex cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2 text-slate-400"
                title="Incluido en plan Crecimiento / Premium"
              >
                <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {label}
              </div>
            ))}
          </nav>

          <div className="mt-6 rounded-xl border border-violet-100 bg-violet-50/50 p-3">
            <p className="text-xs font-medium text-slate-500">Plan actual</p>
            <p className="mt-1 text-sm font-bold text-violet-950">
              Free <span className="font-normal text-slate-600">(Limitado)</span>
            </p>
            <p className="mt-2 text-[11px] text-slate-600">Análisis usados este mes</p>
            <p className="text-sm font-semibold text-slate-900">{analysesLabel} análisis</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-violet-100">
              <div
                className="h-full rounded-full bg-violet-500 transition-all"
                style={{
                  width: `${analysesLimit ? Math.min(100, (analysesUsed / Math.max(1, analysesLimit)) * 100) : 50}%`,
                }}
              />
            </div>
            <p className="mt-2 text-[11px] text-slate-500">Renueva el {nextRenewalLabel()}</p>
            <Link
              href="/planes"
              className="mt-3 block w-full rounded-lg bg-violet-600 py-2 text-center text-xs font-semibold text-white hover:bg-violet-700"
            >
              Actualizar plan
            </Link>
          </div>

          <div className="mt-4 flex flex-1 flex-col justify-end pt-6">
            <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <Headphones className="h-4 w-4 text-violet-600" aria-hidden />
              <span>¿Necesitás ayuda? Contactá a nuestro equipo</span>
            </div>
          </div>
        </aside>

        <div className="space-y-4">
          <div id="portal-cliente" className="scroll-mt-24 space-y-4">
            <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                    Portal cliente (plan Free)
                  </p>
                  <h1 className="mt-1 text-2xl font-bold text-slate-900">{run.brand.name}</h1>
                  <p className="mt-1 text-sm text-slate-600">
                    {run.brand.domain || 'sin dominio'} · Plan Free · Estado{' '}
                    <span className="font-semibold capitalize text-emerald-700">{run.status}</span>
                  </p>
                </div>
                <div className="max-w-sm rounded-xl border border-violet-100 bg-violet-50/80 p-4 text-sm text-violet-950 shadow-sm">
                  <p className="font-medium">Desbloqueá todo el potencial de Cleexs.</p>
                  <p className="mt-1 text-xs leading-relaxed text-violet-900/85">
                    Accedé a reportes completos, prompts, histórico y análisis avanzados.
                  </p>
                  <Link
                    href="/planes"
                    className="mt-3 inline-flex rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700"
                  >
                    Actualizar plan
                  </Link>
                </div>
              </div>
            </header>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                {
                  title: 'Último análisis',
                  value: latestReport ? new Date(latestReport.createdAt).toLocaleDateString('es-AR') : '—',
                  link: latestReport ? `/portal-cliente/reporte/${latestReport.id}` : undefined,
                  linkLabel: 'Ver detalle →',
                },
                {
                  title: 'Cleexs Score',
                  value: String(currentScore),
                  tag: 'Vista parcial',
                  sub: `Actualizado: ${latestReport ? new Date(latestReport.createdAt).toLocaleDateString('es-AR') : '—'}`,
                },
                {
                  title: 'Comparación previa',
                  value: deltaVsPrevious == null ? '—' : `${deltaVsPrevious > 0 ? '+' : ''}${deltaVsPrevious} pts`,
                  sub: previousComparable
                    ? `vs ${new Date(previousComparable.createdAt).toLocaleDateString('es-AR')}`
                    : undefined,
                  highlight: deltaVsPrevious != null && deltaVsPrevious >= 0,
                },
                {
                  title: 'Análisis disponibles',
                  value: analysesLabel,
                  link: '/planes',
                  linkLabel: 'Ver plan →',
                },
                {
                  title: 'Límite del plan',
                  value: analysesLimit == null ? '—' : `${analysesLimit} análisis / mes`,
                  sub: `Usados: ${analysesUsed}`,
                  ring: true,
                },
              ].map((card, i) => (
                <div
                  key={i}
                  className="relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{card.title}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <p
                      className={`text-xl font-bold tabular-nums ${'highlight' in card && card.highlight ? 'text-emerald-600' : 'text-slate-900'}`}
                    >
                      {'value' in card ? card.value : ''}
                    </p>
                    {'tag' in card && card.tag ? (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                        {card.tag}
                      </span>
                    ) : null}
                    {'highlight' in card && card.highlight ? (
                      <TrendingUp className="h-4 w-4 text-emerald-600" aria-hidden />
                    ) : null}
                  </div>
                  {'sub' in card && card.sub ? <p className="mt-1 text-[11px] text-slate-500">{card.sub}</p> : null}
                  {'link' in card && card.link ? (
                    <Link href={card.link} className="mt-2 inline-flex text-xs font-semibold text-violet-700 hover:underline">
                      {card.linkLabel}
                    </Link>
                  ) : null}
                  {'ring' in card && card.ring ? (
                    <div className="absolute right-3 top-3 h-10 w-10 rounded-full border-4 border-violet-100">
                      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
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
                          strokeDasharray={`${analysesLimit ? (analysesUsed / analysesLimit) * 88 : 44} 88`}
                          className="text-violet-600"
                        />
                      </svg>
                    </div>
                  ) : null}
                </div>
              ))}
            </section>
          </div>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-slate-900">Cleexs Score</h2>
                <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                  Vista parcial
                </span>
              </div>
              <div className="mt-4 grid gap-6 lg:grid-cols-2">
                <div className="flex flex-col items-center justify-center">
                  <SemiGauge value={currentScore} />
                  <p className="mt-2 text-center text-sm font-semibold text-slate-800">{scoreLevel}</p>
                  <p className="mx-auto mt-2 max-w-md text-center text-xs leading-relaxed text-slate-600">
                    Probabilidad de que una IA recomiende o priorice tu marca frente a otras opciones.
                  </p>
                </div>
                <div className="hidden lg:block" aria-hidden />
              </div>
            </div>
            <LockFooter>
              Accedé al detalle por intención, evolución y factores que impactan tu score con el plan Premium.{' '}
              <Link href="/planes" className="font-semibold text-violet-700 hover:underline">
                Actualizar plan →
              </Link>
            </LockFooter>
          </section>

          <section id="comparacion" className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-slate-900">Desempeño por intención</h2>
                <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                  Vista parcial
                </span>
              </div>
              {intentionScores.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600">Sin datos por intención en esta corrida.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {intentionScores.map((row) => (
                    <li key={row.key}>
                      <div className="mb-1 flex justify-between text-xs text-slate-700">
                        <span>{row.label}</span>
                        <span className="font-semibold tabular-nums">{Math.round(row.score)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-violet-500"
                          style={{ width: `${Math.min(100, row.score)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <LockFooter>
              Ver análisis completo por intención y recomendaciones.{' '}
              <Link href="/planes" className="font-semibold text-violet-700 hover:underline">
                Actualizar plan →
              </Link>
            </LockFooter>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-slate-900">Comparación con competidores</h2>
                <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                  Vista parcial
                </span>
              </div>
              {comparisonRows.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600">Aún no hay filas en el panel comparativo.</p>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-lg border border-slate-100">
                  <table className="w-full min-w-[360px] text-left text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Marca</th>
                        <th className="px-3 py-2 text-right">Cleexs Score</th>
                        <th className="px-3 py-2 text-right">Diferencia</th>
                        <th className="px-3 py-2">Tendencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonRows.map((row) => (
                        <tr key={`${row.rank}-${row.name}`} className="border-b border-slate-50">
                          <td className="px-3 py-2.5 text-slate-600">{row.rank}</td>
                          <td className="px-3 py-2.5 font-medium text-slate-900">
                            {row.name}
                            {row.tag === 'mi_empresa' ? (
                              <span className="ml-2 text-xs font-normal text-violet-600">(Tú)</span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
                            {row.displayScore ?? '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                            {row.diff == null ? '—' : row.diff > 0 ? `+${row.diff}` : row.diff}
                          </td>
                          <td className="px-3 py-2.5">
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

          <section id="competidores" className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="p-4 sm:p-5">
              <h2 className="text-base font-bold text-slate-900">
                Competidores ({Math.min(configuredCompetitors.length, 5)}/5)
              </h2>
              <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
                {configuredCompetitors.length === 0 ? (
                  <li className="px-3 py-3 text-sm text-slate-600">Sin competidores configurados en cuenta.</li>
                ) : (
                  configuredCompetitors.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-sm">
                      <div>
                        <p className="font-semibold text-slate-900">{c.name}</p>
                        <p className="text-xs text-slate-500">{c.domain || 'sin dominio'}</p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
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

          <section id="equipo" className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-slate-900">Equipo (1/2 miembros usados)</h2>
                <Lock className="h-4 w-4 text-slate-400" aria-hidden />
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                <div>
                  <p className="font-semibold text-slate-900">{displayNameFromEmail(usage?.account?.email)} (Tú)</p>
                  <p className="text-xs text-violet-700">Admin</p>
                </div>
                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-400"
                >
                  Invitar miembro
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">Hasta 2 miembros en plan Free</p>
            </div>
            <LockFooter>
              Premium permite hasta 10 miembros del equipo.{' '}
              <Link href="/planes" className="font-semibold text-violet-700 hover:underline">
                Actualizar plan →
              </Link>
            </LockFooter>
          </section>

          <section className="rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-indigo-50 p-5 shadow-sm">
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
            <Link href="/portal-cliente" className="text-violet-600 hover:underline">
              ← Inicio portal cliente
            </Link>
            {' · '}
            <Link href={`/portal-crecimiento/reporte/${runId}`} className="text-violet-600 hover:underline">
              Anexo técnico por prompt (corrida)
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
