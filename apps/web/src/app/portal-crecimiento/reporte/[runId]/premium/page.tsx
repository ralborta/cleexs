'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
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
    score: number;
    responseText: string;
    top3Json: unknown;
    prompt?: { promptText?: string; category?: { name?: string } | null };
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

export default function PortalReportePremiumInterpretacionPage() {
  const params = useParams();
  const runId = params.runId as string;
  const [run, setRun] = useState<PortalRunDetail | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [panel, setPanel] = useState<PanelResponse | null>(null);
  const [runningMes, setRunningMes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        let token: string | null = null;
        try {
          token = sessionStorage.getItem(TOKEN_KEY);
        } catch {
          token = null;
        }
        if (!token) {
          setError('No hay sesión. Volvé al portal e iniciá sesión.');
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
          setError('Sesión vencida. Volvé al portal e iniciá sesión.');
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
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar');
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

  const premium = isPremiumPlan(usage?.planKey);

  const brandReports = useMemo(() => {
    if (!run) return [];
    return reports
      .filter((r) => (r.brand?.id && run.brand.id ? r.brand.id === run.brand.id : r.brand.name === run.brand.name))
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [reports, run]);

  const previousReports = useMemo(() => brandReports.filter((r) => r.id !== runId), [brandReports, runId]);

  const competitorRows = useMemo(
    () => (panel?.compareRows ?? []).filter((row) => row.tag === 'competidor'),
    [panel]
  );

  async function runNewDiagnostic() {
    if (!run?.brand.id) {
      setError('No se pudo identificar la marca para ejecutar una nueva corrida.');
      return;
    }
    let token: string | null = null;
    try {
      token = sessionStorage.getItem(TOKEN_KEY);
    } catch {
      token = null;
    }
    if (!token) {
      setError('Sesión vencida. Volvé al portal e iniciá sesión.');
      return;
    }

    setRunningMes(true);
    setError(null);
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
      setError(e instanceof Error ? e.message : 'Error al iniciar la corrida');
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

  if (error || !run) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6">
        <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-red-200/80 bg-red-50/90 p-6 text-sm text-red-900">
          <p>{error || 'No encontrado.'}</p>
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
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50/80 p-4 pb-16 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/portal-crecimiento/reporte/${runId}`}
            className="text-sm font-semibold text-primary-700 underline-offset-2 hover:underline"
          >
            ← Volver al informe
          </Link>
          <CleexsMark className="h-7 w-7 shrink-0" />
        </div>

        <header className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-100/60 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Premium · lectura extendida</p>
          <h1 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{run.brand.name}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Misma vista base + extras Premium para operar diagnósticos y comparar corridas.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-700">
              <p className="font-semibold text-slate-900">URL de la marca (solo propia)</p>
              <p className="mt-1 font-mono text-[11px]">{run.brand.domain || 'sin dominio cargado'}</p>
            </div>
            <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-3">
              <p className="text-xs font-semibold text-violet-900">Nuevo diagnóstico</p>
              <p className="mt-1 text-xs text-violet-800/90">
                Ejecuta una nueva corrida para esta misma marca/URL y la agrega al historial.
              </p>
              <button
                type="button"
                onClick={() => void runNewDiagnostic()}
                disabled={runningMes || !run.brand.id}
                className="mt-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {runningMes ? 'Iniciando…' : 'Ejecutar nuevo diagnóstico'}
              </button>
            </div>
          </div>
        </header>

        {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p> : null}

        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-100/60 sm:p-6">
          <h2 className="text-sm font-bold text-slate-900">Comparar con corridas anteriores</h2>
          {previousReports.length === 0 ? (
            <p className="mt-2 text-xs text-slate-600">Todavía no hay corridas previas para comparar.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {previousReports.slice(0, 6).map((rep) => (
                <li key={rep.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3">
                  <div className="text-xs text-slate-700">
                    <p className="font-semibold text-slate-900">{new Date(rep.createdAt).toLocaleString()}</p>
                    <p>
                      Estado: {rep.status} · Score: {rep.score ?? '—'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/portal-crecimiento/reporte/${rep.id}`} className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-800">
                      Ver corrida anterior
                    </Link>
                    <Link href={`/portal-crecimiento/reporte/${rep.id}/premium`} className="rounded-md border border-violet-300 bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-900">
                      Ver Premium
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-100/60 sm:p-6">
          <h2 className="text-sm font-bold text-slate-900">Historial de resultados (esta marca)</h2>
          <ul className="mt-3 space-y-2">
            {brandReports.slice(0, 10).map((rep) => (
              <li key={rep.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-xs">
                <div>
                  <p className="font-semibold text-slate-900">{new Date(rep.createdAt).toLocaleString()}</p>
                  <p className="text-slate-700">{rep.reportType === 'deep_report' ? 'Reporte profundo' : 'Corrida Cleexs'}</p>
                </div>
                <div className="text-slate-700">Score: <span className="font-semibold">{rep.score ?? '—'}</span></div>
                <Link href={`/portal-crecimiento/reporte/${rep.id}`} className="rounded-md border border-slate-300 px-2 py-1 font-semibold text-slate-800">
                  Abrir
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-100/60 sm:p-6">
          <h2 className="text-sm font-bold text-slate-900">Competidores y Cleexs Score</h2>
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

        <InterpretacionAmpliadaCorridasBlock parrafos={parrafos} winnerLabels={winnerLabels} />
      </div>
    </main>
  );
}
