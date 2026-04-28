'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const TOKEN_KEY = 'cleexs_portal_token';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Top3Entry = { position: number; name: string; type: string; reason?: string };

type PortalRunDetail = {
  id: string;
  status: string;
  runType?: string;
  brand: {
    id: string;
    name: string;
    domain?: string | null;
    industry?: string | null;
    productType?: string | null;
    competitors: Array<{ id: string; name: string; domain?: string | null }>;
    aliases: Array<{ id: string; alias: string }>;
  };
  promptResults: Array<{
    id: string;
    score: number;
    top3Json: unknown;
    responseText: string;
    prompt: {
      id?: string;
      name?: string | null;
      promptText: string;
      category?: { name: string } | null;
    };
  }>;
  priaReports: Array<{ priaTotal: number; priaByCategoryJson?: unknown }>;
};

const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .trim();

function buildComparisonSummary(promptResults: Array<{ top3Json: unknown }>) {
  const totals = new Map<
    string,
    { name: string; type: string; count: number; positionSum: number; sampleReason?: string }
  >();
  let totalEntries = 0;
  for (const result of promptResults) {
    const top3 = (result.top3Json as Top3Entry[]) || [];
    for (const entry of top3) {
      totalEntries += 1;
      const key = `${normalizeName(entry.name)}|${entry.type}`;
      const current = totals.get(key) || {
        name: entry.name,
        type: entry.type,
        count: 0,
        positionSum: 0,
      };
      totals.set(key, {
        ...current,
        count: current.count + 1,
        positionSum: current.positionSum + entry.position,
        sampleReason: current.sampleReason || entry.reason,
      });
    }
  }
  return Array.from(totals.values())
    .map((row) => ({
      name: row.name,
      type: row.type,
      appearances: row.count,
      averagePosition: row.count ? row.positionSum / row.count : 0,
      share: totalEntries ? (row.count / totalEntries) * 100 : 0,
      sampleReason: row.sampleReason,
    }))
    .sort((a, b) => b.appearances - a.appearances);
}

/** Competidores citados en el Top 3 de las respuestas (nombre + veces). */
function competitorsDetectedInRun(promptResults: Array<{ top3Json: unknown }>) {
  const counts = new Map<string, number>();
  for (const result of promptResults) {
    const top3 = (result.top3Json as Top3Entry[]) || [];
    for (const entry of top3) {
      if (`${entry.type}`.toLowerCase() !== 'competitor') continue;
      const k = entry.name.trim();
      if (!k) continue;
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([name, mentionsInTop3Slots]) => ({ name, mentionsInTop3Slots }))
    .sort((a, b) => b.mentionsInTop3Slots - a.mentionsInTop3Slots);
}

function parsePriaCategories(json: unknown): { label: string; score: number }[] {
  if (!json || typeof json !== 'object') return [];
  return Object.entries(json as Record<string, unknown>)
    .map(([label, v]) => ({
      label,
      score: typeof v === 'number' ? v : Number(v) || 0,
    }))
    .filter((r) => r.label)
    .sort((a, b) => b.score - a.score);
}

export default function PortalReporteRunPage() {
  const params = useParams();
  const runId = params.runId as string;
  const [run, setRun] = useState<PortalRunDetail | null>(null);
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
        const res = await fetch(`${API_URL}/api/reports/app/reports/${encodeURIComponent(runId)}`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
          setError('Sesión vencida. Volvé al portal e iniciá sesión.');
          setLoading(false);
          return;
        }
        const body = (await res.json().catch(() => ({}))) as PortalRunDetail & { error?: string };
        if (!res.ok) {
          throw new Error(body.error || `Error ${res.status}`);
        }
        if (!cancelled) setRun(body as PortalRunDetail);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar el reporte');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  const detectedCompetitors = useMemo(
    () => (run ? competitorsDetectedInRun(run.promptResults) : []),
    [run]
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <p className="text-center text-sm text-slate-600">Cargando reporte…</p>
      </main>
    );
  }

  if (error || !run) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          <p>{error || 'Reporte no encontrado.'}</p>
          <Link href="/portal-crecimiento" className="font-medium text-violet-700 underline">
            ← Volver al portal
          </Link>
        </div>
      </main>
    );
  }

  const latestPria = run.priaReports?.[0];
  const pria = latestPria?.priaTotal;
  const priaCategories = parsePriaCategories(latestPria?.priaByCategoryJson);
  const promptAvg =
    run.promptResults.length > 0
      ? run.promptResults.reduce((s, r) => s + (Number(r.score) || 0), 0) / run.promptResults.length
      : null;
  const displayScore =
    pria != null ? Math.round(pria) : promptAvg != null ? Math.round(promptAvg * 100) : null;

  const comparison = buildComparisonSummary(run.promptResults);
  const competidorRows = run.brand.competitors;
  const referenceRows: { name: string; role: string }[] = [
    { name: run.brand.name, role: 'Tu marca (medida en los prompts)' },
    ...competidorRows.map((c) => ({
      name: c.domain ? `${c.name} (${c.domain})` : c.name,
      role: 'Competidor configurado',
    })),
  ];
  const runKindLabel = run.runType === 'deep_report' ? 'Reporte profundo' : 'Corrida Cleexs';

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/portal-crecimiento" className="text-sm font-medium text-violet-700 hover:underline">
            ← Volver al portal
          </Link>
          <p className="text-xs text-slate-500">
            Run: <span className="font-mono">{run.id.slice(0, 8)}…</span> · Estado:{' '}
            <span className="font-medium text-slate-800">{run.status}</span>
          </p>
        </div>

        <header className="rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-600 to-indigo-600 p-6 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-100">{runKindLabel}</p>
          <h1 className="mt-1 text-2xl font-bold">{run.brand.name}</h1>
          {run.brand.domain ? <p className="mt-1 text-sm text-violet-100">{run.brand.domain}</p> : null}
          <p className="mt-2 text-xs leading-relaxed text-violet-100/90">
            Reporte de análisis completo: métricas, comparativas y detalle por prompt. El panel resumido con KPIs y
            tabla comparativa está en <Link href="/portal-crecimiento" className="underline hover:text-white">portal</Link>
            .
          </p>
        </header>

        {run.status === 'failed' ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <p className="font-medium">Esta ejecución falló antes de completar el análisis.</p>
            <p className="mt-2 text-red-800">
              Volvé a ejecutar desde el portal tras desplegar la API (prompts del tenant 000,{' '}
              <code className="rounded bg-red-100 px-1">OPENAI_API_KEY</code> en Railway).
            </p>
            <p className="mt-2 text-red-800">
              Igual podés ver la <strong>configuración de competidores</strong> y, si hay datos parciales, el detalle
              por prompt más abajo.
            </p>
          </div>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Competidores</h2>
          <p className="mt-1 text-xs text-slate-600">
            Configurados en tu marca (lo que pedimos al modelo) y, si la corrida generó resultados, quiénes aparecieron
            en los Top 3 de las respuestas.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-xs font-semibold uppercase text-slate-600">En tu cuenta</p>
              {competidorRows.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600">
                  No hay competidores cargados. Cleexs puede asociarlos al perfil de marca; sin ellos el modelo igual
                  puede nombrar otras marcas en el texto.
                </p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm text-slate-900">
                  {competidorRows.map((c) => (
                    <li key={c.id}>
                      <span className="font-medium">{c.name}</span>
                      {c.domain ? (
                        <span className="text-slate-600"> · {c.domain}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
              <p className="text-xs font-semibold uppercase text-emerald-800">En esta corrida (IA)</p>
              {detectedCompetitors.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600">
                  {run.promptResults.length === 0
                    ? 'Aún no hay Top 3 guardados para esta ejecución.'
                    : 'No se detectaron entradas tipo “competidor” en el Top 3 parseado (o la corrida no terminó).'}
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5 text-sm">
                  {detectedCompetitors.map((d) => (
                    <li key={d.name} className="flex justify-between gap-2 text-emerald-950">
                      <span className="font-medium">{d.name}</span>
                      <span className="text-xs text-emerald-800">{d.mentionsInTop3Slots} menciones Top 3</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {(competidorRows.length === 0 && run.promptResults.length === 0) || comparison.length === 0 ? (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase text-slate-500">Referencia — universo del análisis</p>
              <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[320px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                      <th className="py-2 px-3">Marca / competidor</th>
                      <th className="py-2 px-3">Rol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referenceRows.map((row) => (
                      <tr key={`${row.name}-${row.role}`} className="border-b border-slate-100">
                        <td className="py-2 px-3 font-medium text-slate-900">{row.name}</td>
                        <td className="py-2 px-3 text-slate-600">{row.role}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Cleexs Score</h2>
          <p className="mt-1 text-xs text-slate-600">
            {pria != null
              ? 'PRIA agregado de esta corrida.'
              : 'Hasta que exista PRIA, estimación por promedio de scores por prompt.'}
          </p>
          <p className="mt-4 text-5xl font-bold text-slate-900">{displayScore ?? '—'}</p>
          {priaCategories.length > 0 ? (
            <div className="mt-6">
              <p className="text-xs font-medium uppercase text-slate-500">Por categoría (PRIA)</p>
              <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[280px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                      <th className="py-2 px-3 text-left">Categoría</th>
                      <th className="py-2 px-3 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priaCategories.map((row) => (
                      <tr key={row.label} className="border-b border-slate-100">
                        <td className="py-2 px-3 text-slate-800">{row.label}</td>
                        <td className="py-2 px-3 text-right font-medium text-slate-900">
                          {Math.round(row.score)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          {run.status !== 'completed' ? (
            <p className="mt-3 text-sm text-amber-800">
              Estado: <strong>{run.status}</strong>.
              {run.status === 'failed'
                ? ' Sin score completo hasta que una ejecución termine bien.'
                : ' Actualizá en unos minutos si sigue en proceso.'}
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Vista resumida: tu marca vs competencia en la IA</h2>
          <p className="mt-1 text-xs text-slate-600">Agrupado por todas las respuestas de esta corrida.</p>
          {comparison.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">
              Sin datos de Top 3 todavía. Cuando la corrida termine, verás apariciones y posición media por marca.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                    <th className="py-2 pr-2">Nombre</th>
                    <th className="py-2 pr-2">Tipo</th>
                    <th className="py-2 pr-2 text-right">Apariciones</th>
                    <th className="py-2 pr-2 text-right">Pos. media</th>
                    <th className="py-2 pr-2 text-right">% del Top 3</th>
                    <th className="py-2">Ejemplo de motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row) => (
                    <tr key={`${row.name}-${row.type}`} className="border-b border-slate-100">
                      <td className="py-2 pr-2 font-medium text-slate-900">{row.name}</td>
                      <td className="py-2 pr-2 text-slate-600">{row.type === 'brand' ? 'marca' : 'competidor'}</td>
                      <td className="py-2 pr-2 text-right text-slate-700">{row.appearances}</td>
                      <td className="py-2 pr-2 text-right text-slate-700">{row.averagePosition.toFixed(2)}</td>
                      <td className="py-2 pr-2 text-right text-slate-700">{row.share.toFixed(1)}%</td>
                      <td className="max-w-[220px] truncate py-2 text-xs text-slate-600" title={row.sampleReason}>
                        {row.sampleReason?.replace(/\*+/g, '').trim() || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Reporte completo — cada prompt</h2>
          <p className="mt-1 text-xs text-slate-600">
            Texto del prompt, respuesta del modelo, ranking Top 3 y score del prompt. Desplegá cada bloque para leer el
            detalle.
          </p>
          {run.promptResults.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">
              No hay resultados guardados en esta ejecución (pendiente, fallida o en curso).
            </p>
          ) : (
            <ol className="mt-4 space-y-3">
              {run.promptResults.map((pr, idx) => {
                const top3 = (pr.top3Json as Top3Entry[]) || [];
                const category = pr.prompt?.category?.name;
                const title =
                  pr.prompt?.name?.trim() ||
                  (category ? `${category} · Prompt ${idx + 1}` : `Prompt ${idx + 1}`);
                return (
                  <li
                    key={pr.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm shadow-sm"
                  >
                    <p className="text-xs font-semibold uppercase text-violet-700">
                      {idx + 1}. {title}
                    </p>
                    {category ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Categoría: <span className="text-slate-700">{category}</span>
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-slate-600">
                      Score prompt:{' '}
                      <span className="font-mono font-medium text-slate-900">
                        {Number(pr.score) <= 1 ? `${Math.round(Number(pr.score) * 100)} / 100` : String(pr.score)}
                      </span>
                    </p>
                    <details className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <summary className="cursor-pointer text-sm font-medium text-slate-800">
                        Texto del prompt
                      </summary>
                      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700">
                        {pr.prompt?.promptText || '—'}
                      </pre>
                    </details>
                    {top3.length > 0 ? (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-slate-700">Top 3 (extraído)</p>
                        <ul className="mt-1 list-inside list-decimal text-xs text-slate-800">
                          {top3.map((t, j) => (
                            <li key={`${t.name}-${j}`}>
                              <span className="font-medium">{t.name}</span>
                              <span className="text-slate-600">
                                {' '}
                                — {t.type === 'brand' ? 'marca' : 'competidor'}
                              </span>
                              {t.reason ? (
                                <span className="block pl-4 text-slate-600">
                                  {t.reason.replace(/\*+/g, '').trim()}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-amber-800">Sin Top 3 parseable en esta respuesta.</p>
                    )}
                    <details className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <summary className="cursor-pointer text-sm font-medium text-slate-800">
                        Respuesta del modelo (texto completo)
                      </summary>
                      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700">
                        {pr.responseText || '—'}
                      </pre>
                    </details>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}
