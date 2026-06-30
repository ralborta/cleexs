'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  ChevronDown,
  Eye,
  FileStack,
  History,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { PortalPremiumSidebarNav } from '@/components/portal/portal-premium-sidebar-nav';
import { PortalResponsiveShell } from '@/components/portal/portal-responsive-shell';

const TOKEN_KEY = 'cleexs_portal_token';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type UsageResponse = {
  planKey?: string;
  planDisplay?: string;
  usage?: { scoreViews?: number };
  limits?: { scoreViews?: number | null };
};

type ReportItem = {
  id: string;
  status: string;
  createdAt: string;
  reportType?: string;
  score: number | null;
  brand: { id?: string; name: string; domain?: string };
};

type RunBrand = {
  id?: string;
  name: string;
  domain?: string | null;
};

type RunBrief = {
  brand: RunBrand;
};

function toPct(score: number | null | undefined) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  return n <= 1 ? n * 100 : n;
}

const MONTH_OPTS = [
  { value: '6', label: 'Últimos 6 meses' },
  { value: '12', label: 'Últimos 12 meses' },
  { value: '999', label: 'Todo el historial' },
] as const;

/** Carga cuenta de prompts por corrida sin bloquear el primer render completo */
async function fetchPromptCountForRun(id: string, headers: HeadersInit): Promise<{ id: string; count: number }> {
  try {
    const res = await fetch(`${API_URL}/api/reports/app/reports/${encodeURIComponent(id)}`, {
      cache: 'no-store',
      headers,
    });
    const data = await res.json().catch(() => ({})) as { promptResults?: unknown[] };
    if (!res.ok) return { id, count: -1 };
    const n = Array.isArray(data.promptResults) ? data.promptResults.length : 0;
    return { id, count: n };
  } catch {
    return { id, count: -1 };
  }
}

async function loadPromptCountsBatched(ids: string[], chunk: number, headers: HeadersInit) {
  const out = new Map<string, number>();
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const results = await Promise.all(slice.map((id) => fetchPromptCountForRun(id, headers)));
    results.forEach((r) => {
      if (r.count >= 0) out.set(r.id, r.count);
    });
  }
  return out;
}

function statusBadge(status: string) {
  switch (status) {
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Completado
        </span>
      );
    case 'running':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-800">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
          En curso
        </span>
      );
    case 'pending':
      return (
        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800">
          Pendiente
        </span>
      );
    default:
      return (
        <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-800">
          {status || 'Sin estado'}
        </span>
      );
  }
}

export default function HistorialDiagnosticosPage() {
  const params = useParams();
  const runId = params.runId as string;
  const basePath = `/portal-crecimiento/reporte/${runId}/premium`;

  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [runBrief, setRunBrief] = useState<RunBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [monthsWindow, setMonthsWindow] = useState<string>('6');
  const [promptCounts, setPromptCounts] = useState<Map<string, number>>(new Map());
  const [loadingPrompts, setLoadingPrompts] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
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

        const [runRes, usageRes, listRes] = await Promise.all([
          fetch(`${API_URL}/api/reports/app/reports/${encodeURIComponent(runId)}`, { cache: 'no-store', headers }),
          fetch(`${API_URL}/api/me/usage`, { cache: 'no-store', headers }),
          fetch(`${API_URL}/api/reports/app/reports`, { cache: 'no-store', headers }),
        ]);

        if (runRes.status === 401 || usageRes.status === 401 || listRes.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
          setLoadError('Sesión vencida.');
          setLoading(false);
          return;
        }

        if (!runRes.ok) {
          const b = await runRes.json().catch(() => ({}));
          throw new Error((b as { error?: string }).error || `Error corrida ${runRes.status}`);
        }
        const runData = (await runRes.json()) as { brand?: RunBrand };

        const usageData = usageRes.ok ? ((await usageRes.json()) as UsageResponse) : {};
        const rawList = listRes.ok ? ((await listRes.json()) as ReportItem[]) : [];

        if (!cancelled) {
          setRunBrief(runData?.brand ? { brand: runData.brand } : null);
          setUsage(usageData as UsageResponse);
          setReports(Array.isArray(rawList) ? rawList : []);
          setLoading(false);
        }

        let brandReports = Array.isArray(rawList) ? [...rawList] : [];
        if (runData?.brand) {
          const bid = runData.brand.id;
          const bname = runData.brand.name;
          brandReports = brandReports.filter((r) =>
            bid ? r.brand?.id === bid : r.brand?.name === bname,
          );
        }

        if (!cancelled && brandReports.length && token) {
          setLoadingPrompts(true);
          const idsForCounts = [...new Set(brandReports.map((r) => r.id))].slice(0, 50);
          const map = await loadPromptCountsBatched(idsForCounts, 6, headers);
          if (!cancelled) {
            setPromptCounts(map);
            setLoadingPrompts(false);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Error al cargar');
          setLoading(false);
          setLoadingPrompts(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  const brandReports = useMemo(() => {
    if (!runBrief?.brand) return [];
    const bid = runBrief.brand.id;
    const bname = runBrief.brand.name;
    return [...reports]
      .filter((r) => (bid ? r.brand?.id === bid : r.brand?.name === bname))
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [reports, runBrief?.brand]);

  const filteredByPeriod = useMemo(() => {
    const m = Number(monthsWindow);
    if (!Number.isFinite(m) || m >= 999) return brandReports;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - m);
    return brandReports.filter((r) => +new Date(r.createdAt) >= +cutoff);
  }, [brandReports, monthsWindow]);

  /** Gráfico: hasta 12 puntos ordenados viejo → nuevo (izquierda a derecha) */
  const chartPoints = useMemo(() => {
    const withScore = filteredByPeriod.filter((r) => r.score != null);
    const asc = [...withScore].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    const last = asc.slice(-12);
    return last.map((r) => ({ id: r.id, score: toPct(r.score), createdAt: r.createdAt }));
  }, [filteredByPeriod]);

  const lastTwoDelta = useMemo(() => {
    const newestFirst = [...filteredByPeriod]
      .filter((r) => r.score != null)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    if (newestFirst.length < 2) return null;
    const a = toPct(newestFirst[0]!.score);
    const b = toPct(newestFirst[1]!.score);
    return Math.round((a - b) * 10) / 10;
  }, [filteredByPeriod]);

  const tableRows = useMemo(() => {
    const desc = [...filteredByPeriod].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return desc.map((row, idx) => {
      const pct = Math.round(toPct(row.score));
      let delta: number | null = null;
      const older = desc[idx + 1];
      if (older?.score != null && row.score != null) {
        delta = Math.round((pct - Math.round(toPct(older.score))) * 10) / 10;
      }
      const total = promptCounts.get(row.id);
      const denom = total !== undefined ? total : null;
      return { row, pct, delta, denom };
    });
  }, [filteredByPeriod, promptCounts]);

  if (loadError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-red-700">{loadError}</p>
          <Link href="/portal-crecimiento" className="mt-4 inline-block text-sm font-semibold text-violet-700 hover:underline">
            ← Portal
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-3 sm:p-5">
      <PortalResponsiveShell
        mobileTitle="Historial"
        sidebar={<PortalPremiumSidebarNav runId={runId} usage={usage} loadingPlan={loading} />}
      >
        <div className="min-w-0 space-y-4">
          {loading ? (
            <p className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
              Cargando historial…
            </p>
          ) : (
            <>
              {/* Gráfico + header */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100">
                      <BarChart3 className="h-5 w-5 text-violet-700" />
                    </span>
                    <div>
                      <h1 className="text-xl font-bold text-slate-900">Historial de diagnósticos</h1>
                      <p className="mt-0.5 text-sm text-slate-600">Evolución de tu Cleexs Score en las últimas corridas realizadas.</p>
                    </div>
                  </div>
                  <div className="relative">
                    <select
                      value={monthsWindow}
                      onChange={(e) => setMonthsWindow(e.target.value)}
                      className="appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-xs font-semibold text-slate-800 shadow-sm"
                    >
                      {MONTH_OPTS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-600" />
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                {chartPoints.length === 0 ? (
                  <p className="mt-10 text-center text-sm text-slate-500">Sin corridas con score en este período.</p>
                ) : (
                  <div className="mt-8">
                    <div className="relative flex h-[220px] gap-3 pl-8">
                      {/* Eje Y */}
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex w-8 flex-col justify-between text-[10px] tabular-nums text-slate-400">
                        <span>100</span>
                        <span>75</span>
                        <span>50</span>
                        <span>25</span>
                        <span>0</span>
                      </div>
                      {/* Líneas guía */}
                      <div className="absolute inset-0 left-8 flex flex-col justify-between py-0">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <div key={i} className="h-px w-full bg-slate-100" />
                        ))}
                      </div>
                      {/* Barras */}
                      <div className="relative z-10 flex flex-1 items-end justify-evenly gap-2 pl-4 pr-2">
                        {chartPoints.map((p) => {
                          const nh = Math.max(10, Math.round((Math.min(100, p.score) / 100) * 155));
                          return (
                            <div key={p.id} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                              <span className="text-xs font-bold tabular-nums text-slate-800">{Math.round(p.score)}</span>
                              <div
                                className="w-full max-w-[48px] rounded-t-lg bg-gradient-to-t from-violet-600 via-violet-500 to-violet-300 shadow-sm transition-all"
                                style={{ height: nh }}
                              />
                              <span className="text-center text-[10px] tabular-nums text-slate-500">
                                {new Date(p.createdAt).toLocaleDateString('es-AR')}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold">
                      {lastTwoDelta != null && lastTwoDelta < 0 ? (
                        <>
                          <TrendingDown className="h-4 w-4 text-rose-600" />
                          <span className="text-rose-700">
                            {lastTwoDelta} pts evolución del score vs. corrida anterior.
                          </span>
                        </>
                      ) : lastTwoDelta != null && lastTwoDelta > 0 ? (
                        <>
                          <TrendingUp className="h-4 w-4 text-emerald-600" />
                          <span className="text-emerald-700">
                            +{lastTwoDelta} pts evolución del score vs. corrida anterior.
                          </span>
                        </>
                      ) : (
                        <span className="font-normal text-slate-600 text-xs font-medium">
                          Necesitamos al menos dos corridas con score en este filtro para mostrar variación entre la última
                          y la anterior.
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </section>

              {/* Tabla */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <History className="h-5 w-5 text-violet-600" />
                  <h2 className="font-bold text-slate-900">Últimas corridas</h2>
                </div>
                {tableRows.length === 0 ? (
                  <p className="text-sm text-slate-500">No hay corridas en el período seleccionado para esta marca.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Fecha</th>
                          <th className="px-4 py-3 text-right">Cleexs Score</th>
                          <th className="px-4 py-3 text-right">Variación</th>
                          <th className="px-4 py-3 text-right">Consultas ejecutadas</th>
                          <th className="px-4 py-3">Estado</th>
                          <th className="px-4 py-3 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.map(({ row, pct, delta, denom }) => (
                          <tr key={row.id} className="border-t border-slate-100 hover:bg-violet-50/30">
                            <td className="px-4 py-3 text-xs text-slate-800">
                              {new Date(row.createdAt).toLocaleDateString('es-AR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })}
                              <span className="text-slate-400">
                                {' '}
                                ·{' '}
                                {new Date(row.createdAt).toLocaleTimeString('es-AR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-lg font-bold text-slate-900">{pct}</td>
                            <td className="px-4 py-3 text-right text-sm font-semibold">
                              {delta == null ? (
                                <span className="font-normal text-slate-400">—</span>
                              ) : (
                                <span
                                  className={delta >= 0 ? 'inline-flex items-center gap-1 text-emerald-600' : 'inline-flex items-center gap-1 text-rose-600'}
                                >
                                  {delta > 0 ? `+${delta}` : delta}{' '}
                                  {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-slate-700 font-medium">
                              {loadingPrompts && denom === null ? (
                                <span className="text-slate-400">…</span>
                              ) : denom != null ? (
                                <span>{denom}</span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">{statusBadge(row.status)}</td>
                            <td className="px-4 py-3 text-right">
                              <Link
                                href={`/portal-crecimiento/reporte/${row.id}`}
                                className="inline-flex rounded-lg border border-violet-200 bg-violet-50 p-2 text-violet-700 hover:bg-violet-100"
                                title="Ver informe"
                              >
                                <Eye className="h-4 w-4" />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {loadingPrompts ? (
                  <p className="mt-3 text-[11px] text-slate-400">Actualizando conteo de prompts por corrida desde la API…</p>
                ) : null}
              </section>

              {/* Footer CTA */}
              <footer className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-violet-200 bg-gradient-to-br from-white to-violet-50 px-6 py-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
                    <FileStack className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-bold text-slate-900">¿Querés comparar dos corridas?</p>
                    <p className="mt-0.5 text-sm text-slate-600">
                      Abrí la vista de comparación con score, métricas y ranking del panel.
                    </p>
                  </div>
                </div>
                <Link
                  href={`${basePath}/comparacion`}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border-2 border-violet-600 bg-white px-4 py-2.5 text-sm font-semibold text-violet-800 shadow-sm hover:bg-violet-50"
                >
                  Comparar corridas
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </footer>
            </>
          )}
        </div>
      </PortalResponsiveShell>
    </main>
  );
}
