'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const TOKEN_KEY = 'cleexs_portal_token';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Top3Entry = { position: number; name: string; type: string; reason?: string };

type PortalRunDetail = {
  id: string;
  status: string;
  brand: {
    id: string;
    name: string;
    domain?: string | null;
    industry?: string | null;
    productType?: string | null;
    competitors: Array<{ id: string; name: string }>;
    aliases: Array<{ id: string; alias: string }>;
  };
  promptResults: Array<{
    id: string;
    score: number;
    top3Json: unknown;
    responseText: string;
    prompt: { promptText: string; category?: { name: string } | null };
  }>;
  priaReports: Array<{ priaTotal: number }>;
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

  const pria = run.priaReports?.[0]?.priaTotal;
  const promptAvg =
    run.promptResults.length > 0
      ? run.promptResults.reduce((s, r) => s + (Number(r.score) || 0), 0) / run.promptResults.length
      : null;
  const displayScore =
    pria != null ? Math.round(pria) : promptAvg != null ? Math.round(promptAvg * 100) : null;

  const comparison = buildComparisonSummary(run.promptResults);
  const competidorNames = run.brand.competitors.map((c) => c.name).filter(Boolean);

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
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-100">Reporte profundo</p>
          <h1 className="mt-1 text-2xl font-bold">{run.brand.name}</h1>
          {run.brand.domain ? <p className="mt-1 text-sm text-violet-100">{run.brand.domain}</p> : null}
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Cleexs Score</h2>
          <p className="mt-1 text-xs text-slate-600">
            {pria != null
              ? 'Agregado PRIA de esta corrida.'
              : 'Estimación hasta que exista PRIA completo (promedio de scores por prompt).'}
          </p>
          <p className="mt-4 text-5xl font-bold text-slate-900">{displayScore ?? '—'}</p>
          {run.status !== 'completed' ? (
            <p className="mt-3 text-sm text-amber-800">
              Este run todavía está <strong>{run.status}</strong>. Los números pueden completarse cuando termine la
              ejecución; actualizá desde el portal.
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Competidores configurados</h2>
          <p className="mt-1 text-xs text-slate-600">
            Se comparan en los prompts junto con tu marca (según lo cargado en la marca).
          </p>
          {competidorNames.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">
              No hay competidores cargados para esta marca. Desde el equipo Cleexs se pueden asociar competidores al
              perfil para enriquecer el Top 3.
            </p>
          ) : (
            <ul className="mt-3 list-inside list-disc text-sm text-slate-800">
              {competidorNames.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Presencia en la IA: tu marca vs competencia</h2>
          <p className="mt-1 text-xs text-slate-600">
            Resumen de apariciones en el Top 3 de las respuestas del modelo (marca propia y competidores citados en
            cada respuesta).
          </p>
          {comparison.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">
              {run.promptResults.length === 0
                ? 'Todavía no hay resultados de prompts. Si acabás de generar el reporte, esperá unos minutos y actualizá.'
                : 'No se pudo armar un Top 3 a partir de las respuestas. Si el run falló, generá otro desde el portal.'}
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
      </div>
    </main>
  );
}
