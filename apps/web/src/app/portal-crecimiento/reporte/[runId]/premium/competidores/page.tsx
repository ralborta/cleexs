'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { BarChart3, ExternalLink, Info, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { CleexsMark } from '@/components/brand/cleexs-mark';

const TOKEN_KEY = 'cleexs_portal_token';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type UsageResponse = { planKey?: string; planDisplay?: string };

type Top3Entry = { position?: number; name?: string };

type PromptRow = {
  top3Json: unknown;
};

type RunDetail = {
  id: string;
  brand: {
    id?: string;
    name: string;
    domain?: string | null;
    aliases?: Array<{ id: string; alias: string }>;
  };
  promptResults: PromptRow[];
};

type PanelRow = {
  rank: number;
  name: string;
  domain: string | null;
  tag: 'mi_empresa' | 'competidor';
  score: number | null;
};

type PanelResponse = { compareRows: PanelRow[] };

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Match top-3 name from API vs marca del panel */
function matchesRowTop3(entryNameRaw: string, rowDisplayName: string): boolean {
  const e = normalizeName(entryNameRaw);
  const n = normalizeName(rowDisplayName);
  if (!e || !n) return false;
  if (e === n) return true;
  if (e.includes(n)) return n.length >= 4;
  if (n.includes(e)) return e.length >= 4;
  return false;
}

function displayScore(score: number | null | undefined) {
  if (score == null || !Number.isFinite(Number(score))) return null;
  const v = Number(score);
  const pct = v <= 1 ? v * 100 : v;
  return Math.round(pct);
}

export default function CompetidoresPortalPage() {
  const params = useParams();
  const runId = params.runId as string;
  const basePath = `/portal-crecimiento/reporte/${runId}/premium`;

  const [run, setRun] = useState<RunDetail | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [panel, setPanel] = useState<PanelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
        const [runRes, usageRes] = await Promise.all([
          fetch(`${API_URL}/api/reports/app/reports/${encodeURIComponent(runId)}`, { cache: 'no-store', headers }),
          fetch(`${API_URL}/api/me/usage`, { cache: 'no-store', headers }),
        ]);
        if (runRes.status === 401 || usageRes.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
          setLoadError('Sesión vencida.');
          setLoading(false);
          return;
        }
        if (!runRes.ok) {
          const b = await runRes.json().catch(() => ({}));
          throw new Error((b as { error?: string }).error || `Error ${runRes.status}`);
        }
        const runData = (await runRes.json()) as RunDetail;
        const usageData = usageRes.ok ? ((await usageRes.json()) as UsageResponse) : {};
        const brandId = runData.brand.id;
        const panelRes = brandId
          ? await fetch(`${API_URL}/api/reports/app/portal-panel?brandId=${encodeURIComponent(brandId)}`, {
              cache: 'no-store',
              headers,
            })
          : null;
        const panelData = panelRes?.ok ? ((await panelRes.json()) as PanelResponse) : null;
        if (!cancelled) {
          setRun(runData);
          setUsage(usageData);
          setPanel(panelData);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Error');
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  const miRow = panel?.compareRows.find((r) => r.tag === 'mi_empresa') ?? null;
  const compRows =
    [...(panel?.compareRows ?? [])]
      .filter((r) => r.tag === 'competidor')
      .sort((a, b) => a.rank - b.rank);

  const withScoreCount = useMemo(() => compRows.filter((r) => r.score != null).length, [compRows]);
  const withoutScoreCount = compRows.length - withScoreCount;

  /** Apariciones en posiciones 1–3 dentro de cada prompt de esta corrida */
  const top3CountsPerRowKey = useMemo(() => {
    const rows = [...(panel?.compareRows ?? [])];
    const labels = rows.map((r) => r.name);
    const map = new Map<string, number>();
    labels.forEach((l) => map.set(normalizeName(l), 0));

    const prompts = run?.promptResults ?? [];
    prompts.forEach((pr) => {
      const raw = Array.isArray(pr.top3Json) ? (pr.top3Json as Top3Entry[]) : [];
      rows.forEach((row) => {
        const nm = normalizeName(row.name);
        const hit = raw.some((e) => {
          const pos = Number(e.position);
          if (!Number.isFinite(pos) || pos < 1 || pos > 3) return false;
          const nmEntry = typeof e.name === 'string' ? e.name : '';
          return matchesRowTop3(nmEntry, row.name);
        });
        if (hit) map.set(nm, (map.get(nm) ?? 0) + 1);
      });
    });
    return map;
  }, [run?.promptResults, panel?.compareRows]);

  const promptsTotal = run?.promptResults.length ?? 0;

  /** Brecha puntos contra tu marca (solo competidores con score ambos) */
  const gapsVsSelf = useMemo(() => {
    const selfScore = miRow?.score != null ? displayScore(miRow.score)! : null;
    if (selfScore == null) return new Map<string, number>();
    const m = new Map<string, number>();
    compRows.forEach((c) => {
      const cs = displayScore(c.score);
      if (cs == null) return;
      m.set(normalizeName(c.name), cs - selfScore);
    });
    return m;
  }, [miRow?.score, compRows]);

  if (loadError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
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
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[220px_1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <CleexsMark className="h-6 w-6" />
            <p className="font-bold text-slate-900">Cleexs</p>
          </div>
          <nav className="space-y-1 text-sm">
            <Link href={`${basePath}#portal-cliente`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">
              Portal cliente
            </Link>
            <Link href={`${basePath}/comparacion`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">
              Comparación
            </Link>
            <Link href={`${basePath}/prompts`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">
              Prompts
            </Link>
            <Link href={`${basePath}/competidores`} className="block rounded-lg bg-violet-50 px-3 py-2 font-semibold text-violet-900">
              Competidores
            </Link>
            <Link href={`${basePath}/historial`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">
              Historial
            </Link>
            <Link href={`${basePath}#reportes`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">
              Reportes
            </Link>
            <Link href={`${basePath}/suscripcion`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">
              Suscripción
            </Link>
            <Link href={`${basePath}/equipo`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">
              Equipo
            </Link>
            <Link href={`${basePath}/herramientas`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">
              Herramientas
            </Link>
          </nav>
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Plan actual</p>
            <p className="font-semibold text-slate-900">{loading ? '…' : (usage?.planDisplay ?? usage?.planKey ?? 'Premium')}</p>
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          <nav className="flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="font-medium text-violet-700">Competidores</span>
            <span>·</span>
            <span>{run?.brand?.name ?? (loading ? 'Cargando…' : '')}</span>
          </nav>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                  <Users className="h-3.5 w-3.5" />
                  Panel comparativo · Cleexs Score
                </div>
                <h1 className="mt-3 text-xl font-bold text-slate-900">Competidores y Cleexs Score</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Mediciones del panel oficial y apariciones en <strong className="text-slate-800">Top 3</strong> de esta corrida por
                  prompt (motor), normalizadas al nombre que devuelve la API.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`${basePath}/comparacion`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  Ver comparación completa
                </Link>
                <Link
                  href={`/portal-crecimiento/reporte/${runId}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border-2 border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800 hover:bg-violet-100"
                >
                  Informe con Top 3
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {loading ? (
              <p className="mt-6 text-center text-sm text-slate-500">Cargando competidores…</p>
            ) : compRows.length === 0 ? (
              <div className="mt-6 border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-500">
                  Con score:{' '}
                  <span className="font-semibold text-slate-800">{withScoreCount}</span> · Sin score:{' '}
                  <span className="font-semibold text-slate-800">{withoutScoreCount}</span>
                </p>
                <p className="mt-3 text-sm text-slate-500">Sin competidores detectados todavía en el panel comparativo.</p>
                <p className="mt-1 text-xs text-slate-400">Verificá la marca configurada en la API o ejecutá una corrida nueva.</p>
              </div>
            ) : (
              <div className="mt-6 space-y-4 border-t border-slate-100 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">
                    Competidores en panel: <span className="font-semibold text-slate-800">{compRows.length}</span>
                    {' · '}Con Cleexs Score:{' '}
                    <span className="font-semibold text-emerald-700">{withScoreCount}</span>
                    {' · '}Sin score:{' '}
                    <span className="font-semibold text-amber-700">{withoutScoreCount}</span>
                  </p>
                  {promptsTotal > 0 ? (
                    <p className="text-[11px] text-slate-400">
                      Apariciones Top 3 contadas sobre {promptsTotal} prompts de esta corrida
                    </p>
                  ) : null}
                </div>

                {miRow ? (
                  <div className="flex flex-wrap items-center gap-4 rounded-xl border border-violet-200 bg-violet-50/50 p-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-sm font-bold text-white">
                      TÚ
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900">{miRow.name}</p>
                      <p className="text-xs text-violet-800">Tu marca · Rank #{miRow.rank}</p>
                      {miRow.domain ? (
                        <p className="text-[11px] text-slate-500">{miRow.domain}</p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase text-slate-500">Cleexs Score</p>
                      <p className="text-3xl font-bold text-violet-700">{displayScore(miRow.score) ?? '—'}</p>
                    </div>
                    {promptsTotal > 0 && (
                      <div className="text-right border-l border-violet-200 pl-4">
                        <p className="text-[10px] uppercase text-slate-500">Top 3 prompts</p>
                        <p className="text-2xl font-bold text-slate-800">
                          {top3CountsPerRowKey.get(normalizeName(miRow.name)) ?? 0}
                          <span className="text-sm font-normal text-slate-500"> / {promptsTotal}</span>
                        </p>
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Competidor</th>
                        <th className="px-4 py-3 hidden sm:table-cell">Dominio</th>
                        <th className="px-4 py-3 text-right">Cleexs Score</th>
                        <th className="px-4 py-3 text-right">vs tu marca</th>
                        <th className="px-4 py-3 text-right">Top 3</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compRows.map((row) => {
                        const sc = displayScore(row.score);
                        const key = normalizeName(row.name);
                        const top3n = promptsTotal ? (top3CountsPerRowKey.get(key) ?? 0) : 0;
                        const gap = gapsVsSelf.get(key);
                        return (
                          <tr key={`${row.rank}-${row.name}`} className="border-t border-slate-50 hover:bg-slate-50/80">
                            <td className="px-4 py-3 align-middle font-semibold text-slate-600">{row.rank}</td>
                            <td className="px-4 py-3 align-middle font-semibold text-slate-900">{row.name}</td>
                            <td className="px-4 py-3 align-middle text-xs text-slate-600 hidden sm:table-cell">
                              {row.domain ?? '—'}
                            </td>
                            <td className="px-4 py-3 align-middle text-right">
                              <span className="text-xl font-bold text-violet-700">{sc ?? <span className="text-base text-slate-400 font-normal">—</span>}</span>
                              {sc == null ? (
                                <p className="text-[10px] text-slate-400 mt-0.5">Sin dato panel</p>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 align-middle text-right">
                              {gap != null ? (
                                <span
                                  className={`inline-flex items-center gap-1 text-sm font-semibold ${
                                    gap > 0 ? 'text-emerald-600' : gap < 0 ? 'text-rose-600' : 'text-slate-600'
                                  }`}
                                >
                                  {gap > 0 ? (
                                    <>
                                      +{gap} <TrendingUp className="h-3 w-3" />
                                    </>
                                  ) : gap < 0 ? (
                                    <>
                                      {gap} <TrendingDown className="h-3 w-3" />
                                    </>
                                  ) : (
                                    '0'
                                  )}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 align-middle text-right">
                              <div className="inline-flex flex-col items-end gap-1">
                                <span className="text-lg font-bold text-slate-900">
                                  {promptsTotal ? `${top3n}` : '—'}
                                </span>
                                {promptsTotal > 0 ? (
                                  <span className="text-[11px] text-slate-500">
                                    ({Math.round((top3n / promptsTotal) * 100)}% prompts)
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-slate-400">Sin prompts</span>
                                )}
                                <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className="h-full rounded-full bg-violet-500"
                                    style={{ width: `${promptsTotal ? Math.min(100, (top3n / promptsTotal) * 100) : 0}%` }}
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

                <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <p>
                    <strong>Top 3:</strong> veces que el nombre aparece entre las posiciones 1 y 3 en el JSON por prompt de esta corrida,
                    usando la misma lógica de coincidencia de marcas que en el portal. Score proviene únicamente del panel comparativo
                    oficial.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
