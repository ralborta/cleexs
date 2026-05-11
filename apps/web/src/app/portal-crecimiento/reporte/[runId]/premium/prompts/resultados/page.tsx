'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, Loader2, Sparkles } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PortalPremiumSidebarNav } from '@/components/portal/portal-premium-sidebar-nav';
import { PORTAL_SESSION_TOKEN_KEY } from '@/components/portal/portal-sign-out';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const CHART_COLORS = ['#7c3aed', '#6366f1', '#a78bfa', '#c4b5fd', '#8b5cf6'];

type UsageResponse = {
  planKey?: string;
  planDisplay?: string;
  usage?: { scoreViews?: number };
  limits?: { scoreViews?: number | null };
};

type RunDetail = {
  id: string;
  brand: { id?: string; name: string; domain?: string | null };
};

type PortalAnalysisApi = {
  resumen: string;
  puntos_clave: string[];
  graficos: Array<{ titulo: string; items: Array<{ etiqueta: string; valor: number }> }>;
};

type SavedPromptResultsPayload = {
  results: Array<{
    id: string;
    createdAt: string;
    source: string;
    promptTextSnapshot: string;
    responseText: string;
    analysis: PortalAnalysisApi | null;
    runId: string | null;
    savedPrompt: {
      id: string;
      slot: number;
      title: string;
      promptText: string;
    };
  }>;
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function AnalysisBarChart({
  title,
  data,
}: {
  title: string;
  data: Array<{ etiqueta: string; valor: number }>;
}) {
  const chartData = data.map((d) => ({ name: d.etiqueta.slice(0, 28), valor: d.valor }));
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
      <p className="mb-2 text-[11px] font-bold text-slate-800">{title}</p>
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 9 }} interval={0} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: number) => [`${v}`, 'Relevancia']} />
            <Bar dataKey="valor" radius={[0, 6, 6, 0]} maxBarSize={22}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function PromptResultsPage() {
  const params = useParams();
  const runId = params.runId as string;
  const basePath = `/portal-crecimiento/reporte/${runId}/premium`;

  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [run, setRun] = useState<RunDetail | null>(null);
  const [payload, setPayload] = useState<SavedPromptResultsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let token: string | null = null;
        try {
          token = sessionStorage.getItem(PORTAL_SESSION_TOKEN_KEY);
        } catch {
          token = null;
        }
        if (!token) {
          if (!cancelled) {
            setError('No hay sesión. Volvé al portal e iniciá sesión.');
            setLoading(false);
          }
          return;
        }

        const headers = { Authorization: `Bearer ${token}` };
        const [runRes, usageRes] = await Promise.all([
          fetch(`${API_URL}/api/reports/app/reports/${encodeURIComponent(runId)}`, { cache: 'no-store', headers }),
          fetch(`${API_URL}/api/me/usage`, { cache: 'no-store', headers }),
        ]);

        if (!runRes.ok) {
          const body = await runRes.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error || `Error ${runRes.status}`);
        }

        const runBody = (await runRes.json()) as RunDetail;
        const usageBody = usageRes.ok ? ((await usageRes.json()) as UsageResponse) : {};

        if (!runBody.brand?.id) throw new Error('La corrida no tiene marca asociada.');

        const resultsRes = await fetch(
          `${API_URL}/api/portal/brands/${encodeURIComponent(runBody.brand.id)}/weekly-prompts/results`,
          { cache: 'no-store', headers },
        );
        const resultsBody = await resultsRes.json().catch(() => ({}));
        if (!resultsRes.ok) {
          throw new Error((resultsBody as { error?: string }).error || `Error ${resultsRes.status}`);
        }

        if (!cancelled) {
          setRun(runBody);
          setUsage(usageBody);
          setPayload(resultsBody as SavedPromptResultsPayload);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'No se pudieron cargar los resultados.');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [runId]);

  return (
    <main className="min-h-screen bg-slate-50 p-3 sm:p-5">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[280px_1fr]">
        <PortalPremiumSidebarNav runId={runId} usage={usage} loadingPlan={loading} />

        <div className="min-w-0 space-y-4">
          {loading ? (
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-10 shadow-sm">
              <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
              <p className="text-sm text-slate-600">Cargando resultados…</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-rose-700">{error}</p>
              <Link href={`${basePath}/prompts`} className="mt-4 inline-flex text-xs font-semibold text-violet-700 hover:underline">
                Volver a prompts
              </Link>
            </div>
          ) : payload ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div>
                  <Link
                    href={`${basePath}/prompts`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:underline"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Volver a prompts
                  </Link>
                  <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">Resultados</h1>
                  <p className="mt-1 text-sm text-slate-600">
                    Historial de ejecuciones de prompts guardados, mezclado por fecha y mostrando de qué prompt viene cada resultado.
                  </p>
                </div>
                <div className="rounded-2xl border border-violet-100 bg-violet-50/80 px-4 py-3 text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-violet-700">Resultados cargados</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{payload.results.length}</p>
                  <p className="text-[11px] text-slate-600">últimos snapshots guardados</p>
                </div>
              </div>

              {payload.results.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-violet-200 bg-white p-8 text-center shadow-sm">
                  <p className="text-sm font-semibold text-slate-800">Todavía no hay resultados históricos visibles.</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Ejecutá un prompt guardado y se va a sumar automáticamente a esta pantalla.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {payload.results.map((result) => (
                    <section key={result.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                        <div>
                          <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-[11px] font-semibold text-violet-800">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {formatDateTime(result.createdAt)}
                          </div>
                          <p className="mt-2 text-sm font-bold text-slate-900">{result.savedPrompt.title}</p>
                          <p className="mt-1 text-xs text-slate-500">{result.savedPrompt.promptText}</p>
                        </div>
                        {result.runId ? (
                          <Link
                            href={`/portal-crecimiento/reporte/${result.runId}`}
                            className="text-xs font-semibold text-violet-700 hover:underline"
                          >
                            Ver corrida
                          </Link>
                        ) : null}
                      </div>

                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-700">
                          Respuesta original de ChatGPT
                        </p>
                        <pre className="mt-3 max-h-[360px] overflow-y-auto whitespace-pre-wrap text-[12px] leading-relaxed text-slate-700">
                          {result.responseText}
                        </pre>
                      </div>

                      <div className="mt-5">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-violet-600" />
                          <p className="text-sm font-bold text-slate-900">Análisis histórico</p>
                        </div>

                        {result.analysis ? (
                          <>
                            <p className="mt-3 text-sm leading-relaxed text-slate-700">{result.analysis.resumen}</p>
                            {result.analysis.puntos_clave?.length ? (
                              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
                                {result.analysis.puntos_clave.map((item, idx) => (
                                  <li key={idx}>{item}</li>
                                ))}
                              </ul>
                            ) : null}
                            <div className="mt-4 grid gap-3 lg:grid-cols-2">
                              {result.analysis.graficos?.slice(0, 2).map((chart, idx) => (
                                <AnalysisBarChart key={idx} title={chart.titulo} data={chart.items ?? []} />
                              ))}
                            </div>
                          </>
                        ) : (
                          <p className="mt-3 text-sm text-slate-500">
                            Esta ejecución no tiene análisis histórico almacenado.
                          </p>
                        )}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
