'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Gauge,
  LineChart,
  ListChecks,
  Medal,
  Rocket,
  TrendingUp,
} from 'lucide-react';
import { CleexsMark } from '@/components/brand/cleexs-mark';

const TOKEN_KEY = 'cleexs_portal_token';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ── Types ─────────────────────────────────────────────────────────────────────
type UsageResponse = { planKey?: string; planDisplay?: string };

type RunDetail = {
  id: string;
  status: string;
  brand: { id?: string; name: string; domain?: string | null };
  priaReports?: Array<{ priaTotal: number }>;
  promptResults: Array<{
    score: number;
    prompt?: { category?: { name?: string } | null };
  }>;
};

type ReportItem = {
  id: string;
  createdAt: string;
  score: number | null;
  brand: { id?: string; name: string };
};

type PanelRow = {
  rank: number;
  name: string;
  tag: 'mi_empresa' | 'competidor';
  score: number | null;
};

type PanelResponse = { compareRows: PanelRow[] };

// ── Helpers ───────────────────────────────────────────────────────────────────
function toPct(v: number | null | undefined) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return n <= 1 ? n * 100 : n;
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
      {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ComparacionPage() {
  const params = useParams();
  const runId = params.runId as string;
  const basePath = `/portal-crecimiento/reporte/${runId}/premium`;

  const [run, setRun] = useState<RunDetail | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [panel, setPanel] = useState<PanelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let token: string | null = null;
        try { token = sessionStorage.getItem(TOKEN_KEY); } catch { token = null; }
        if (!token) {
          setLoadError('No hay sesión. Volvé al portal e iniciá sesión.');
          setLoading(false);
          return;
        }
        const headers = { Authorization: `Bearer ${token}` };
        const [runRes, usageRes] = await Promise.all([
          fetch(`${API_URL}/api/reports/app/reports/${encodeURIComponent(runId)}`, { cache: 'no-store', headers }),
          fetch(`${API_URL}/api/me/usage`, { cache: 'no-store', headers }),
        ]);
        if (runRes.status === 401 || usageRes.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
          setLoadError('Sesión vencida. Volvé al portal e iniciá sesión.');
          setLoading(false);
          return;
        }
        const runData = runRes.ok ? (await runRes.json() as RunDetail) : null;
        const usageData = usageRes.ok ? (await usageRes.json() as UsageResponse) : {};

        const brandId = runData?.brand?.id;
        const [reportsRes, panelRes] = await Promise.all([
          fetch(`${API_URL}/api/reports/app/reports`, { cache: 'no-store', headers }),
          brandId
            ? fetch(`${API_URL}/api/reports/app/portal-panel?brandId=${encodeURIComponent(brandId)}`, { cache: 'no-store', headers })
            : Promise.resolve(null),
        ]);
        const reportsData = reportsRes.ok ? (await reportsRes.json() as ReportItem[]) : [];
        const panelData = panelRes?.ok ? (await panelRes.json() as PanelResponse) : null;

        if (!cancelled) {
          setRun(runData);
          setUsage(usageData);
          setReports(Array.isArray(reportsData) ? reportsData : []);
          setPanel(panelData);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) { setLoadError(e instanceof Error ? e.message : 'Error al cargar'); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [runId]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const brandReports = useMemo(() => {
    if (!run) return [];
    return [...reports]
      .filter((r) => (r.brand?.id && run.brand.id ? r.brand.id === run.brand.id : r.brand.name === run.brand.name))
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [reports, run]);

  const latestReport = brandReports[0] ?? null;
  const previousReports = brandReports.filter((r) => r.id !== runId);
  const previousComparable = previousReports.find((r) => r.score != null) ?? null;

  const cleexsScoreHint = run?.priaReports?.[0]?.priaTotal ?? null;
  const currentScore = Math.round(cleexsScoreHint ?? toPct(latestReport?.score ?? null));
  const deltaVsPrevious =
    previousComparable && Number.isFinite(currentScore)
      ? Math.round((currentScore - toPct(previousComparable.score)) * 10) / 10
      : null;

  const compareRows = panel?.compareRows ?? [];
  const miEmpresaRow = compareRows.find((r) => r.tag === 'mi_empresa') ?? null;
  const competitorRows = compareRows.filter((r) => r.tag === 'competidor');
  const rank = miEmpresaRow?.rank ?? null;
  const competitorScores = competitorRows.filter((c) => c.score != null).map((c) => Number(c.score));
  const leaderScore = competitorScores.length > 0 ? Math.max(...competitorScores) : null;
  const gapVsLeader =
    leaderScore != null && Number.isFinite(currentScore)
      ? Math.round((currentScore - leaderScore) * 10) / 10
      : null;

  // Prompts por categoría → promedio desempeño
  const promptScores = (run?.promptResults ?? []).map((p) => toPct(p.score));
  const avgPrompt = promptScores.length
    ? Math.round(promptScores.reduce((a, b) => a + b, 0) / promptScores.length)
    : currentScore;

  // Mejor intención (categoría con mayor score promedio)
  const catMap: Record<string, number[]> = {};
  (run?.promptResults ?? []).forEach((p) => {
    const cat = p.prompt?.category?.name ?? 'General';
    if (!catMap[cat]) catMap[cat] = [];
    catMap[cat]!.push(toPct(p.score));
  });
  const bestCat = Object.entries(catMap)
    .map(([k, v]) => ({ label: k, score: v.reduce((a, b) => a + b, 0) / v.length }))
    .sort((a, b) => b.score - a.score)[0] ?? null;

  // ── Render ────────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-rose-700">{loadError}</p>
          <Link href="/portal-crecimiento" className="mt-4 inline-block text-xs font-semibold text-violet-700 hover:underline">
            ← Volver al portal
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-3 sm:p-5">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[220px_1fr]">

        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <CleexsMark className="h-6 w-6" />
            <p className="font-bold text-slate-900">Cleexs</p>
          </div>
          <nav className="space-y-1 text-sm">
            <Link href={`${basePath}#portal-cliente`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">Portal cliente</Link>
            <Link href={`${basePath}/comparacion`} className="block rounded-lg bg-violet-50 px-3 py-2 font-semibold text-violet-900">Comparación</Link>
            <Link href={`${basePath}#prompts`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">Prompts</Link>
            <Link href={`${basePath}#competidores`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">Competidores</Link>
            <Link href={`${basePath}#historial`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">Historial</Link>
            <Link href={`${basePath}#reportes`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">Reportes</Link>
            <Link href={`${basePath}/suscripcion`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">Suscripción</Link>
            <Link href={`${basePath}/equipo`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">Equipo</Link>
            <Link href={`${basePath}/herramientas`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">Herramientas</Link>
          </nav>
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Plan actual</p>
            <p className="font-semibold text-slate-900">
              {loading ? '…' : (usage?.planDisplay || usage?.planKey || 'Premium')}
            </p>
          </div>
        </aside>

        {/* ── Contenido ────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                <TrendingUp className="h-3.5 w-3.5" />
                Comparación
              </div>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">
                {run ? run.brand.name : loading ? '…' : 'Comparación'}
              </h1>
              <p className="mt-0.5 text-xs text-slate-600">
                Evolución frente a tu última corrida con score y posición relativa frente al grupo (datos del panel comparativo de la API).
              </p>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <p className="text-sm text-slate-500">Cargando datos de comparación…</p>
            </div>
          ) : (
            <>
              {/* Corrida actual / anterior / diferencia */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] text-slate-500">Corrida actual</p>
                  <p className="mt-1 text-3xl font-bold text-slate-900">{currentScore || '—'}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] text-slate-500">Corrida anterior</p>
                  {previousComparable ? (
                    <>
                      <p className="mt-1 text-3xl font-bold text-slate-900">{Math.round(toPct(previousComparable.score))}</p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {new Date(previousComparable.createdAt).toLocaleString('es-AR')}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-slate-400">Sin corrida anterior</p>
                  )}
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] text-slate-500">Diferencia</p>
                  <p
                    className={`mt-1 text-3xl font-bold ${
                      deltaVsPrevious == null ? 'text-slate-400' : deltaVsPrevious >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {deltaVsPrevious == null
                      ? '—'
                      : `${deltaVsPrevious > 0 ? '+' : ''}${deltaVsPrevious}`}
                  </p>
                </div>
              </div>

              {/* 6 tarjetas métricas */}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                <MetricCard
                  icon={Gauge}
                  label="Cleexs Score"
                  value={currentScore ? String(currentScore) : '—'}
                  sub={currentScore >= 80 ? 'Nivel excelente' : currentScore > 0 ? 'Nivel medio' : undefined}
                />
                <MetricCard
                  icon={Medal}
                  label="Ranking"
                  value={rank ? `#${rank}` : '—'}
                  sub={`de ${Math.max(1, compareRows.length)} marcas`}
                />
                <MetricCard
                  icon={ListChecks}
                  label="Reportes generados"
                  value={String(brandReports.length)}
                />
                <MetricCard
                  icon={BarChart3}
                  label="Promedio desempeño"
                  value={promptScores.length ? `${avgPrompt}%` : '—'}
                />
                <MetricCard
                  icon={LineChart}
                  label="Brecha vs líder"
                  value={gapVsLeader == null ? '—' : `${gapVsLeader > 0 ? '+' : ''}${gapVsLeader} pts`}
                  sub={gapVsLeader == null ? 'Sin datos' : gapVsLeader >= 0 ? 'Sobre competidores' : 'Debajo del líder'}
                />
                <MetricCard
                  icon={Rocket}
                  label="Mejor intención"
                  value={bestCat ? bestCat.label : '—'}
                  sub={bestCat ? `${Math.round(bestCat.score)}%` : undefined}
                />
              </div>

              {/* Ranking del panel */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Ranking del panel
                </p>
                {compareRows.length === 0 ? (
                  <p className="text-sm text-slate-500">Sin filas del panel para esta marca.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-100">
                    <table className="w-full min-w-[380px] text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-2">#</th>
                          <th className="px-4 py-2">Marca</th>
                          <th className="px-4 py-2">Tipo</th>
                          <th className="px-4 py-2 text-right">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...compareRows]
                          .sort((a, b) => a.rank - b.rank)
                          .map((row) => (
                            <tr key={`${row.rank}-${row.name}`} className="border-t border-slate-100 hover:bg-slate-50/50">
                              <td className="px-4 py-2.5 font-medium text-slate-700">{row.rank}</td>
                              <td className="px-4 py-2.5 font-semibold text-slate-900">{row.name}</td>
                              <td className="px-4 py-2.5">
                                <span
                                  className={
                                    row.tag === 'mi_empresa'
                                      ? 'rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-semibold text-violet-800'
                                      : 'rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600'
                                  }
                                >
                                  {row.tag === 'mi_empresa' ? 'Tu marca' : 'Competidor'}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                                {row.score == null ? '—' : Math.round(Number(row.score))}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Link al informe */}
              <div>
                <Link
                  href={`/portal-crecimiento/reporte/${runId}`}
                  className="inline-flex rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                >
                  Ver informe completo (Top 3, funnel y anexo por prompt) →
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
