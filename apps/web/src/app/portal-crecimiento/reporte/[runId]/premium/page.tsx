'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarClock,
  Gauge,
  LineChart,
  ListChecks,
  Medal,
  Rocket,
  Users,
} from 'lucide-react';
import { CleexsMark } from '@/components/brand/cleexs-mark';
import { InterpretacionAmpliadaCorridasBlock } from '@/components/report/interpretacion-ampliada-corridas-block';
import {
  computeInterpretacionAmpliada,
  type CorridasPromptRow,
} from '@/lib/interpretacion-ampliada-corridas';

const TOKEN_KEY = 'cleexs_portal_token';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
    responseText: string;
    top3Json: unknown;
    prompt?: {
      id?: string;
      name?: string | null;
      promptText?: string;
      category?: { name?: string } | null;
    };
  }>;
};

type UsageResponse = {
  planKey?: string;
  planDisplay?: string;
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

function toPct(score: number | null | undefined) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  return n <= 1 ? n * 100 : n;
}

export default function PortalReportePremiumInterpretacionPage() {
  const params = useParams();
  const runId = params.runId as string;
  const [run, setRun] = useState<PortalRunDetail | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [panel, setPanel] = useState<PanelResponse | null>(null);
  const [runningMes, setRunningMes] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
          setLoadError('No hay sesión. Volvé al portal e iniciá sesión.');
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
          setLoadError('Sesión vencida. Volvé al portal e iniciá sesión.');
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
  }, [runId]);

  const prompts: CorridasPromptRow[] = useMemo(() => {
    if (!run) return [];
    return run.promptResults.map((pr) => ({
      score: pr.score,
      responseText: pr.responseText,
      top3Json: (pr.top3Json as CorridasPromptRow['top3Json']) ?? null,
      promptText: pr.prompt?.promptText ?? null,
      category: pr.prompt?.category?.name ?? null,
    }));
  }, [run]);

  const brandAliases = run?.brand.aliases.map((a) => a.alias).filter(Boolean) ?? [];
  const cleexsScoreHint = run?.priaReports?.[0]?.priaTotal ?? null;

  const { parrafos, winnerLabels } = useMemo(() => {
    if (!run) return { parrafos: [] as string[], winnerLabels: [] as string[] };
    return computeInterpretacionAmpliada(prompts, run.brand.name, brandAliases, cleexsScoreHint);
  }, [run, prompts, brandAliases, cleexsScoreHint]);

  const intentionScores = useMemo(() => {
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
    prompts.forEach((p) => {
      const key = keyOf(p.category || p.promptText || '');
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
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [prompts]);

  const premium = isPremiumPlan(usage?.planKey);

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
    [previousReports]
  );
  const competitorRows = useMemo(() => (panel?.compareRows ?? []).filter((row) => row.tag === 'competidor'), [panel]);
  const miEmpresaRow = useMemo(() => (panel?.compareRows ?? []).find((row) => row.tag === 'mi_empresa') ?? null, [panel]);
  const rank = miEmpresaRow?.rank ?? null;
  const competitorScores = competitorRows.filter((c) => c.score != null).map((c) => Number(c.score));
  const leaderCompetitor = competitorScores.length > 0 ? Math.max(...competitorScores) : null;
  const currentScore = Math.round(cleexsScoreHint ?? toPct(latestReport?.score ?? null));
  const avgIntentionScore =
    intentionScores.length > 0
      ? Math.round(intentionScores.reduce((acc, row) => acc + row.score, 0) / intentionScores.length)
      : currentScore;
  const gapVsLeader =
    leaderCompetitor != null && Number.isFinite(currentScore)
      ? Math.round((currentScore - leaderCompetitor) * 10) / 10
      : null;
  const deltaVsPrevious =
    previousComparable && Number.isFinite(currentScore)
      ? Math.round((currentScore - toPct(previousComparable.score)) * 10) / 10
      : null;

  const historyPoints = useMemo(
    () =>
      [...brandReports]
        .filter((r) => r.score != null)
        .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
        .slice(-6),
    [brandReports]
  );
  const minHist = Math.min(...historyPoints.map((p) => toPct(p.score)));
  const maxHist = Math.max(...historyPoints.map((p) => toPct(p.score)));
  const evolutionDelta =
    historyPoints.length >= 2
      ? Math.round((toPct(historyPoints[historyPoints.length - 1]!.score) - toPct(historyPoints[0]!.score)) * 10) / 10
      : 0;
  const competitorsWithScore = competitorRows.filter((row) => row.score != null).length;
  const competitorsWithoutScore = competitorRows.length - competitorsWithScore;

  async function runNewDiagnostic() {
    if (!run?.brand.id) {
      setActionError('No se pudo identificar la marca para ejecutar una nueva corrida.');
      return;
    }
    let token: string | null = null;
    try {
      token = sessionStorage.getItem(TOKEN_KEY);
    } catch {
      token = null;
    }
    if (!token) {
      setActionError('Sesión vencida. Volvé al portal e iniciá sesión.');
      return;
    }

    setRunningMes(true);
    setActionError(null);
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
      setActionError(e instanceof Error ? e.message : 'Error al iniciar la corrida');
    } finally {
      setRunningMes(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 p-6">
        <p className="text-center text-sm text-slate-600">Cargando…</p>
      </main>
    );
  }

  if (loadError || !run) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6">
        <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-red-200/80 bg-red-50/90 p-6 text-sm text-red-900">
          <p>{loadError || 'No encontrado.'}</p>
          <Link href="/portal-crecimiento" className="font-semibold text-primary-700 underline">
            ← Portal
          </Link>
        </div>
      </main>
    );
  }

  if (!premium) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50/80 p-4 pb-16 sm:p-6">
        <div className="mx-auto max-w-lg space-y-6">
          <Link
            href={`/portal-crecimiento/reporte/${runId}`}
            className="text-sm font-semibold text-primary-700 underline-offset-2 hover:underline"
          >
            ← Volver al informe
          </Link>
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/90 p-6 shadow-sm">
            <p className="text-base font-bold text-amber-950">Interpretación ampliada · Plan Premium</p>
            <p className="mt-2 text-sm leading-relaxed text-amber-900/90">
              Esta lectura detallada está incluida en el plan <strong>Premium</strong> (y superiores). Tu cuenta
              actualmente tiene el plan <strong>{usage?.planDisplay || usage?.planKey || 'Plan'}</strong>.
            </p>
            <Link
              href="/planes"
              className="mt-4 inline-flex rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
            >
              Ver Plan y Premium
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen scroll-smooth bg-slate-50 p-3 sm:p-5">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[220px_1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <CleexsMark className="h-6 w-6" />
            <p className="font-bold text-slate-900">Cleexs</p>
          </div>
          <nav className="space-y-1 text-sm">
            <a href="#portal-cliente" className="block rounded-lg bg-violet-50 px-3 py-2 font-semibold text-violet-900">
              Portal cliente
            </a>
            <a href="#comparacion" className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">
              Comparación
            </a>
            <a href="#prompts" className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">
              Prompts
            </a>
            <a href="#competidores" className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">
              Competidores
            </a>
            <a href="#historial" className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">
              Historial
            </a>
            <a href="#reportes" className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">
              Reportes
            </a>
            <Link href={`/portal-crecimiento/reporte/${runId}/premium/suscripcion`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">
              Suscripción
            </Link>
          </nav>
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Plan actual</p>
            <p className="font-semibold text-slate-900">{usage?.planDisplay || usage?.planKey || 'Premium'}</p>
          </div>
        </aside>

        <div className="space-y-4">
          <div id="portal-cliente" className="scroll-mt-24 space-y-4">
          <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Portal Cliente</p>
                <h1 className="text-2xl font-bold text-slate-900">{run.brand.name}</h1>
                <p className="text-xs text-slate-600">
                  {run.brand.domain || 'sin dominio'} · Plan {usage?.planDisplay || usage?.planKey || 'Premium'} · Estado{' '}
                  <span className="font-semibold text-emerald-700">{run.status}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/portal-crecimiento/reporte/${latestReport?.id || run.id}`}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  Ver último diagnóstico
                </Link>
                <button
                  type="button"
                  onClick={() => void runNewDiagnostic()}
                  disabled={runningMes || !run.brand.id}
                  className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {runningMes ? 'Iniciando…' : 'Generar nuevo análisis'}
                </button>
                <Link
                  href={`/portal-crecimiento/reporte/${run.id}`}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  Compartir reporte
                </Link>
              </div>
            </div>
          </header>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard icon={CalendarClock} label="Último análisis" value={latestReport ? new Date(latestReport.createdAt).toLocaleDateString() : '—'} />
            <MetricCard
              icon={LineChart}
              label="Comparación previa"
              value={
                deltaVsPrevious == null ? 'Sin base' : `${deltaVsPrevious > 0 ? '+' : ''}${deltaVsPrevious} pts`
              }
              sub={previousComparable ? new Date(previousComparable.createdAt).toLocaleDateString() : undefined}
            />
            <MetricCard icon={ListChecks} label="Reportes disponibles" value={String(brandReports.length)} />
            <MetricCard icon={BarChart3} label="Prompts activos" value={String(run.promptResults.length)} />
            <MetricCard icon={Users} label="Competidores" value={String(competitorRows.length)} />
          </section>
          </div>

          {actionError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">{actionError}</p>
          ) : null}

          <section
            id="resumen-ejecutivo"
            className="scroll-mt-24 grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-2"
          >
            <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
              <p className="text-sm font-bold text-slate-900">Cleexs Score</p>
              <div className="mt-4 space-y-2">
                <div className="h-4 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500"
                    style={{ width: `${Math.max(0, Math.min(100, currentScore))}%` }}
                  />
                </div>
                <p className="text-4xl font-black text-slate-900">{currentScore}</p>
                <p className="text-xs text-slate-600">Probabilidad de que una IA recomiende o priorice esta marca.</p>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
              <p className="text-sm font-bold text-slate-900">Desempeño por intención</p>
              {intentionScores.length === 0 ? (
                <p className="mt-2 text-xs text-slate-600">Sin datos por intención en esta corrida.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {intentionScores.map((row) => (
                    <li key={row.key}>
                      <div className="mb-0.5 flex items-center justify-between text-xs text-slate-700">
                        <span>{row.label}</span>
                        <span className="font-semibold">{Math.round(row.score)}%</span>
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
          </section>

          <section id="comparacion" className="scroll-mt-24 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-slate-900">Comparación</h2>
              <p className="mt-1 text-xs text-slate-600">
                Evolución frente a tu última corrida con score y posición relativa frente al grupo (datos del panel
                comparativo de la API).
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
                    {new Date(previousComparable.createdAt).toLocaleString()}
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
              <p className="text-xs text-slate-600">
                No hay una corrida anterior con score disponible para comparar en esta vista.
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <MetricCard icon={Gauge} label="Cleexs Score" value={String(currentScore)} sub={currentScore >= 80 ? 'Nivel excelente' : 'Nivel medio'} />
              <MetricCard icon={Medal} label="Ranking" value={rank ? `#${rank}` : '—'} sub={`de ${Math.max(1, panel?.compareRows.length ?? 0)} marcas`} />
              <MetricCard icon={ListChecks} label="Reportes generados" value={String(brandReports.length)} />
              <MetricCard icon={BarChart3} label="Promedio desempeño" value={`${avgIntentionScore}%`} />
              <MetricCard
                icon={LineChart}
                label="Brecha vs líder"
                value={gapVsLeader == null ? '—' : `${gapVsLeader > 0 ? '+' : ''}${gapVsLeader} pts`}
                sub={gapVsLeader == null ? 'Sin datos' : gapVsLeader >= 0 ? 'sobre competidores' : 'debajo del líder'}
              />
              <MetricCard
                icon={Rocket}
                label="Mejor intención"
                value={intentionScores[0] ? intentionScores[0].label : '—'}
                sub={intentionScores[0] ? `${Math.round(intentionScores[0].score)}%` : 'Sin dato'}
              />
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Ranking del panel</h3>
              {(panel?.compareRows ?? []).length === 0 ? (
                <p className="mt-2 text-xs text-slate-600">Sin filas del panel comparativo (revisá marca y última corrida en API).</p>
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
                      {[...(panel?.compareRows ?? [])]
                        .sort((a, b) => a.rank - b.rank)
                        .map((row) => (
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
              Ver informe completo (Top 3, funnel y anexo por prompt) →
            </Link>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div id="reportes" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900">Reportes del cliente</h2>
              <ul className="mt-3 space-y-2">
                {brandReports.slice(0, 6).map((rep, idx) => (
                  <li key={rep.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-xs">
                    <div>
                      <p className="font-semibold text-slate-900">Reporte #{brandReports.length - idx}</p>
                      <p className="text-slate-600">{new Date(rep.createdAt).toLocaleDateString()} · {rep.reportType === 'deep_report' ? 'Profundo' : 'Consolidado'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">{Math.round(toPct(rep.score))}</p>
                      <Link href={`/portal-crecimiento/reporte/${rep.id}/premium`} className="font-semibold text-violet-700">
                        Ver reporte →
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div id="historial" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900">Historial de diagnósticos</h2>
              {historyPoints.length === 0 ? (
                <p className="mt-2 text-xs text-slate-600">No hay histórico suficiente.</p>
              ) : (
                <div className="mt-3 flex h-44 items-end gap-3 rounded-lg border border-slate-200 bg-slate-50/40 p-3">
                  {historyPoints.map((p) => {
                    const s = toPct(p.score);
                    const h = maxHist === minHist ? 90 : 30 + ((s - minHist) / Math.max(1, maxHist - minHist)) * 95;
                    return (
                      <div key={p.id} className="flex flex-1 flex-col items-center justify-end gap-1">
                        <span className="text-[10px] font-semibold text-slate-700">{Math.round(s)}</span>
                        <div className="w-full rounded-t-md bg-gradient-to-t from-violet-600 to-violet-400" style={{ height: `${h}px` }} />
                        <span className="text-[10px] text-slate-500">{new Date(p.createdAt).toLocaleDateString()}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="mt-2 text-xs text-emerald-700">
                {evolutionDelta >= 0 ? `+${evolutionDelta}` : evolutionDelta} pts evolución del score.
              </p>
            </div>
          </section>

          <section id="competidores" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">Competidores y Cleexs Score</h2>
            <p className="mt-1 text-xs text-slate-600">
              Con score: {competitorsWithScore} · Sin score: {competitorsWithoutScore}
            </p>
            {competitorRows.length === 0 ? (
              <p className="mt-2 text-xs text-slate-600">Sin competidores detectados todavía en el panel comparativo.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {competitorRows.map((row) => (
                  <li key={`${row.rank}-${row.name}`} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-xs">
                    <div>
                      <p className="font-semibold text-slate-900">{row.name}</p>
                      <p className="text-slate-600">{row.domain || 'sin dominio'}</p>
                    </div>
                    <div className={row.score == null ? 'text-amber-700' : 'text-emerald-700'}>
                      {row.score == null ? 'Sin Cleexs Score aún' : `Cleexs Score: ${Math.round(row.score)}`}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-violet-950">
                {evolutionDelta >= 0 ? 'Estás evolucionando por encima del mercado' : 'Hay margen de mejora en la evolución'}
              </p>
              <Link
                href={`/portal-crecimiento/reporte/${run.id}`}
                className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-semibold text-violet-900"
              >
                Ver comparación vs competidores →
              </Link>
            </div>
            <p className="mt-1 text-xs text-violet-900/80">
              Tu visibilidad en IA cambió {evolutionDelta >= 0 ? `+${evolutionDelta}` : evolutionDelta} puntos en las últimas corridas registradas.
            </p>
          </section>

          <section id="prompts" className="scroll-mt-24 space-y-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-slate-900">Consultas (prompts) de esta corrida</h2>
              <p className="mt-1 text-xs text-slate-600">
                Datos reales de cada prompt ejecutado en esta corrida. El detalle técnico completo está en el informe
                estándar (anexo por consulta).
              </p>
              {run.promptResults.length === 0 ? (
                <p className="mt-2 text-xs text-slate-600">No hay prompts en esta corrida.</p>
              ) : (
                <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                  {run.promptResults.map((pr, i) => {
                    const title =
                      (pr.prompt?.name && String(pr.prompt.name).trim()) ||
                      pr.prompt?.category?.name ||
                      `Consulta ${i + 1}`;
                    const raw = (pr.prompt?.promptText ?? '').trim();
                    const snippet = raw.length > 160 ? `${raw.slice(0, 160)}…` : raw;
                    const sc = toPct(pr.score);
                    return (
                      <li key={pr.id ?? `pr-${i}`} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="font-semibold text-slate-900">{title}</p>
                          <span className="shrink-0 rounded-md bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-800">
                            {Math.round(sc)}
                          </span>
                        </div>
                        {pr.prompt?.category?.name ? (
                          <p className="mt-1 text-[11px] text-slate-500">Categoría: {pr.prompt.category.name}</p>
                        ) : null}
                        {snippet ? <p className="mt-1 leading-relaxed text-slate-700">{snippet}</p> : null}
                      </li>
                    );
                  })}
                </ul>
              )}
              <Link
                href={`/portal-crecimiento/reporte/${run.id}`}
                className="mt-3 inline-flex text-xs font-semibold text-violet-700 hover:underline"
              >
                Abrir anexo técnico por prompt en el informe →
              </Link>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Interpretación ampliada</h3>
              <p className="mt-1 text-xs text-slate-600">Lectura ejecutiva automática sobre los mismos datos.</p>
              <div className="mt-3">
                <InterpretacionAmpliadaCorridasBlock parrafos={parrafos} winnerLabels={winnerLabels} />
              </div>
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100">
          <Icon className="h-3.5 w-3.5 text-violet-700" />
        </span>
        <p className="text-[11px] font-semibold text-slate-600">{label}</p>
      </div>
      <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
      {sub ? <p className="text-[11px] text-slate-500">{sub}</p> : null}
    </div>
  );
}
