'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CleexsMark } from '@/components/brand/cleexs-mark';
import { CLEEXS_MARKETING_URL } from '@/lib/site';

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

const isBrandMentioned = (text: string, brandName: string, aliases: string[]) => {
  if (!text) return false;
  if (normalizeName(text).includes(normalizeName(brandName))) return true;
  return aliases.some((a) => normalizeName(text).includes(normalizeName(a)));
};

const isBrandEntry = (entryName: string, brandName: string, aliases: string[]) => {
  const n = normalizeName(entryName);
  if (n === normalizeName(brandName)) return true;
  return aliases.some((a) => normalizeName(a) === n);
};

const extractIntention = (promptText: string) => {
  const match = promptText.match(/Intención:\s*([^\(\n]+)\s*\((\d+)%\)/i);
  if (!match) return null;
  return { name: match[1].trim().toLowerCase(), weight: Number(match[2]) };
};

const normalizeIntentionKey = (value: string) => {
  const n = normalizeName(value);
  if (n.includes('urgencia')) return 'urgencia';
  if (n.includes('consideracion')) return 'consideracion';
  if (n.includes('calidad')) return 'calidad';
  if (n.includes('precio')) return 'precio';
  return null;
};

const INTENTION_LABELS: Record<string, string> = {
  urgencia: 'Urgencia',
  consideracion: 'Consideración',
  calidad: 'Calidad',
  precio: 'Precio',
};

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

function scoreLabel(score: number) {
  if (score >= 80) return 'Nivel alto';
  if (score >= 60) return 'Nivel medio';
  if (score >= 40) return 'Nivel bajo';
  return 'Muy bajo';
}

function SectionTitle({ n, title, subtitle }: { n: number; title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="flex items-start gap-3 text-lg font-semibold text-slate-900">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">
          {n}
        </span>
        <span className="min-w-0">
          {title}
          {subtitle ? <p className="mt-1 text-xs font-normal text-slate-600">{subtitle}</p> : null}
        </span>
      </h2>
    </div>
  );
}

function SemiGauge({ value }: { value: number }) {
  const v = Math.min(100, Math.max(0, value));
  const angleDeg = -90 + (v / 100) * 180;
  return (
    <div className="relative mx-auto flex h-[110px] w-full max-w-[200px] justify-center">
      <svg viewBox="0 0 120 72" className="h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="gaugeArc" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>
        <path
          d="M 14 64 A 46 46 0 0 1 106 64"
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M 14 64 A 46 46 0 0 1 106 64"
          fill="none"
          stroke="url(#gaugeArc)"
          strokeWidth="10"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${v} ${100 - v}`}
        />
        <g transform={`rotate(${angleDeg} 60 64)`}>
          <line x1="60" y1="64" x2="60" y2="28" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" />
        </g>
        <circle cx="60" cy="64" r="5" fill="#0f172a" />
      </svg>
      <p className="absolute bottom-0 left-0 right-0 text-center text-[11px] text-slate-500">
        Indicador 0-100 de recomendación en IA
      </p>
    </div>
  );
}

export default function PortalReporteRunPage() {
  const params = useParams();
  const runId = params.runId as string;
  const [run, setRun] = useState<PortalRunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setShareUrl(typeof window !== 'undefined' ? window.location.href : '');
  }, []);

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
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar el diagnóstico');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  const diag = useMemo(() => {
    if (!run) return null;
    const brandName = run.brand.name;
    const brandAliases = run.brand.aliases.map((a) => a.alias).filter(Boolean);
    const results = run.promptResults;
    const totalPrompts = results.length;
    const latestPria = run.priaReports?.[0];
    const pria = latestPria?.priaTotal;
    const priaCategories = parsePriaCategories(latestPria?.priaByCategoryJson);

    const parseableCount = results.filter((r) => {
      const t = (r.top3Json as Top3Entry[]) || [];
      return t.length > 0;
    }).length;
    const mentionCount = results.filter((r) => isBrandMentioned(r.responseText ?? '', brandName, brandAliases)).length;
    const top3Count = results.filter((r) =>
      ((r.top3Json as Top3Entry[]) || []).some((e) => isBrandEntry(e.name, brandName, brandAliases))
    ).length;
    const top1Count = results.filter((r) =>
      ((r.top3Json as Top3Entry[]) || []).some(
        (e) => e.position === 1 && isBrandEntry(e.name, brandName, brandAliases)
      )
    ).length;

    const formatConfidence = totalPrompts ? Math.round((parseableCount / totalPrompts) * 100) : 0;
    const mentionRate = totalPrompts ? Math.round((mentionCount / totalPrompts) * 100) : 0;
    const top3Rate = totalPrompts ? Math.round((top3Count / totalPrompts) * 100) : 0;
    const top1Rate = totalPrompts ? Math.round((top1Count / totalPrompts) * 100) : 0;

    const intentionBuckets: Record<string, { scores: number[]; weight: number }> = {};
    results.forEach((result) => {
      const extracted = extractIntention(result.prompt?.promptText || '');
      if (!extracted) return;
      const key = normalizeIntentionKey(extracted.name);
      if (!key) return;
      if (!intentionBuckets[key]) intentionBuckets[key] = { scores: [], weight: extracted.weight };
      const s = Number(result.score);
      intentionBuckets[key].scores.push(Number.isFinite(s) && s <= 1 ? s * 100 : s);
    });
    const intentionScores = Object.entries(intentionBuckets).map(([key, data]) => ({
      key,
      score: data.scores.length ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : 0,
      weight: data.weight,
    }));
    const weightSum = intentionScores.reduce((s, i) => s + i.weight, 0) || 1;
    const cleexsScoreByIntention = intentionScores.reduce(
      (s, i) => s + i.score * (i.weight / weightSum),
      0
    );
    const promptAvg =
      results.length > 0
        ? results.reduce((s, r) => {
            const sc = Number(r.score);
            return s + (Number.isFinite(sc) && sc <= 1 ? sc * 100 : sc || 0);
          }, 0) / results.length
        : 0;
    const cleexsFromRuns = intentionScores.length > 0 ? cleexsScoreByIntention : promptAvg;
    const displayScore = pria != null ? Math.round(pria) : Math.round(cleexsFromRuns || 0);

    const comparison = buildComparisonSummary(results);
    const brandRow = comparison.find(
      (r) => r.type === 'brand' || isBrandEntry(r.name, brandName, brandAliases)
    );
    const leaderRow = comparison[0];
    const competitorLeader = comparison.find((r) => r.type === 'competitor');
    const sortedByShare = [...comparison].sort((a, b) => b.share - a.share);
    const rankNum =
      brandRow != null ? sortedByShare.findIndex((r) => r.name === brandRow.name && r.type === brandRow.type) + 1 : 0;
    const totalBrands = comparison.length;
    const gapToLeader =
      competitorLeader && brandRow
        ? Math.max(0, (competitorLeader.share || 0) - (brandRow.share || 0))
        : leaderRow && brandRow && leaderRow.name !== brandRow.name
          ? Math.max(0, (leaderRow.share || 0) - (brandRow.share || 0))
          : 0;

    const strongestIntention = [...intentionScores].sort((a, b) => b.score - a.score)[0];
    const weakestIntention = [...intentionScores].sort((a, b) => a.score - b.score)[0];

    const topRanked = sortedByShare[0];
    const leaderDisplayName = topRanked
      ? isBrandEntry(topRanked.name, brandName, brandAliases)
        ? `${brandName} (vos)`
        : topRanked.name
      : '—';
    const leaderDisplayShare = topRanked?.share ?? 0;

    const convMentionToTop3 =
      mentionCount > 0 ? Math.min(100, Math.round((top3Count / mentionCount) * 100)) : 0;
    const convTop3ToFirst =
      top3Count > 0 ? Math.min(100, Math.round((top1Count / top3Count) * 100)) : 0;

    const barData = comparison.slice(0, 8).map((row) => ({
      name: isBrandEntry(row.name, brandName, brandAliases) ? 'Tu marca' : row.name,
      value: row.share,
      isBrand: row.type === 'brand' || isBrandEntry(row.name, brandName, brandAliases),
    }));

    type ActionCard = {
      badge: string;
      badgeClass: string;
      title: string;
      body: string;
      footer: string;
    };
    const actionCards: ActionCard[] = [];
    if (weakestIntention && weakestIntention.score < 60) {
      const lab = INTENTION_LABELS[weakestIntention.key] ?? weakestIntention.key;
      actionCards.push({
        badge: 'PRIORITARIO',
        badgeClass: 'bg-amber-100 text-amber-900',
        title: `Atacar “${lab}”`,
        body:
          gapToLeader > 0
            ? `Hay espacio para ganar cuota en respuestas de IA frente al grupo. Reforzá contenidos y señales alineados a ${lab}.`
            : `Mejorá el desempeño en consultas con intención ${lab} (aprox. ${Math.round(weakestIntention.score)}% en esta corrida).`,
        footer:
          gapToLeader > 0
            ? `Brecha intención / Top 3: ~${gapToLeader.toFixed(1)} pts`
            : `${lab}: ${Math.round(weakestIntention.score)}%`,
      });
    }
    if (competitorLeader && gapToLeader > 0) {
      actionCards.push({
        badge: 'PRIORITARIO',
        badgeClass: 'bg-amber-100 text-amber-900',
        title: `Cerrar brecha con ${competitorLeader.name}`,
        body: `Ocupás ~${brandRow?.share.toFixed(1) ?? '0'}% del Top 3 vs ~${competitorLeader.share.toFixed(1)}% de ${competitorLeader.name}. Priorizá contenido AEO y consistencia de entidades.`,
        footer: `Brecha: ~${gapToLeader.toFixed(1)} pts`,
      });
    }
    if (strongestIntention && strongestIntention.score >= 55) {
      const lab = INTENTION_LABELS[strongestIntention.key] ?? strongestIntention.key;
      actionCards.push({
        badge: 'CAPITALIZAR',
        badgeClass: 'bg-emerald-100 text-emerald-900',
        title: `Capitalizar fuerza en ${lab}`,
        body: `Tu mejor eje en esta corrida es ${lab} (~${Math.round(strongestIntention.score)}%). Extendé el mensaje a intenciones adyacentes para escalar el Cleexs Score.`,
        footer: `${lab}: ${Math.round(strongestIntention.score)}%`,
      });
    }
    while (actionCards.length < 3) {
      actionCards.push({
        badge: 'SEGUIMIENTO',
        badgeClass: 'bg-slate-200 text-slate-800',
        title: 'Mantener ritmo de medición',
        body: 'Programá corridas periódicas y monitoreá si aparecen nuevos competidores en las respuestas.',
        footer: `${totalPrompts} prompts en esta corrida`,
      });
    }

    return {
      brandName,
      brandAliases,
      results,
      totalPrompts,
      parseableCount,
      mentionCount,
      top3Count,
      top1Count,
      formatConfidence,
      mentionRate,
      top3Rate,
      top1Rate,
      priaCategories,
      displayScore,
      comparison,
      brandRow,
      leaderRow,
      competitorLeader,
      rankNum,
      totalBrands,
      gapToLeader,
      strongestIntention,
      weakestIntention,
      leaderDisplayName,
      leaderDisplayShare,
      convMentionToTop3,
      convTop3ToFirst,
      barData,
      intentionScores,
      actionCards: actionCards.slice(0, 3),
    };
  }, [run]);

  const copyShare = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  }, [shareUrl]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <p className="text-center text-sm text-slate-600">Cargando resultado del diagnóstico…</p>
      </main>
    );
  }

  if (error || !run || !diag) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          <p>{error || 'Diagnóstico no encontrado.'}</p>
          <Link href="/portal-crecimiento" className="font-medium text-violet-700 underline">
            ← Volver al portal
          </Link>
        </div>
      </main>
    );
  }

  const detectedCompetitors = competitorsDetectedInRun(run.promptResults);
  const competidorRows = run.brand.competitors;
  const runKindLabel = run.runType === 'deep_report' ? 'Reporte profundo' : 'Corrida Cleexs';
  const shareText = `Resultado Cleexs — ${run.brand.name}`;
  const industryLine = [run.brand.industry, run.brand.productType].filter(Boolean).join(' · ');

  return (
    <main className="min-h-screen bg-slate-50 p-4 pb-14 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/portal-crecimiento" className="text-sm font-medium text-violet-700 hover:underline">
            ← Volver al panel
          </Link>
          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-500">
              <span className="font-mono">{run.id.slice(0, 8)}…</span> · {run.status}
            </p>
            <CleexsMark className="h-7 w-7 shrink-0" />
          </div>
        </div>

        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-700">
                <span aria-hidden>📋</span> Resultado del diagnóstico
              </p>
              <h1 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{run.brand.name}</h1>
              <p className="mt-1 text-sm text-slate-600">
                {[industryLine, run.brand.domain].filter(Boolean).join(' · ') || 'Marca'}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Este es el <strong>informe ejecutivo</strong> de la corrida ({runKindLabel}), alineado a la vista de
                diagnóstico. El <strong>panel resumido</strong> (KPIs de cuenta y tabla comparativa) está en{' '}
                <Link href="/portal-crecimiento" className="font-medium text-violet-700 underline">
                  portal
                </Link>
                .
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase text-slate-500">Ver datos por modelo</p>
            <p className="mt-1 text-xs text-slate-600">
              Esta corrida se muestra como <span className="font-semibold text-slate-800">consolidado</span>. Si en el
              futuro tenés desglose ChatGPT / Gemini, aparecerá el selector aquí.
            </p>
          </div>
        </header>

        {run.status === 'failed' ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <p className="font-medium">Esta ejecución falló antes de completar el análisis.</p>
            <p className="mt-2 text-red-800">
              Volvé a ejecutar desde el portal. Igual podés revisar competidores y el{' '}
              <strong>anexo técnico por prompt</strong> si hay datos parciales.
            </p>
          </div>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            n={1}
            title="Resumen ejecutivo"
            subtitle="Estado actual, posición frente al líder y desempeño por intención (esta corrida)."
          />
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
              <div className="flex gap-2">
                <span className="rounded-md bg-violet-600 px-2 py-1 text-[10px] font-semibold text-white">
                  CLEEXS SCORE
                </span>
                <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600">
                  COMPETIDORES
                </span>
              </div>
              <p className="mt-4 text-5xl font-bold text-violet-600">{diag.displayScore}</p>
              <p className="mt-2 text-xs text-slate-600">
                {diag.rankNum > 0 && diag.totalBrands > 0 ? (
                  <>
                    #{diag.rankNum} en ranking · líder: {diag.leaderDisplayName}{' '}
                    {diag.leaderDisplayShare > 0 ? `${diag.leaderDisplayShare.toFixed(1)}%` : ''} en Top 3
                    {diag.strongestIntention ? (
                      <>
                        {' '}
                        · mejor intención: {INTENTION_LABELS[diag.strongestIntention.key] ?? diag.strongestIntention.key}{' '}
                        {Math.round(diag.strongestIntention.score)}%
                      </>
                    ) : null}
                  </>
                ) : (
                  'Sin ranking suficiente hasta que el Top 3 sea parseable en más prompts.'
                )}
              </p>
            </div>
            <div className="flex flex-col justify-center rounded-xl border border-slate-100 p-4">
              <SemiGauge value={diag.displayScore} />
            </div>
            <div className="rounded-xl border border-slate-100 p-4">
              <p className="text-xs font-semibold text-slate-800">% en prompts · tu marca vs líder (proxy Top 3)</p>
              <p className="mt-1 text-[11px] text-slate-500">
                Por intención detectada en el texto del prompt (si aplica).
              </p>
              <div className="mt-3 space-y-3">
                {diag.intentionScores.length === 0 ? (
                  <p className="text-xs text-slate-500">No se detectó patrón “Intención:” en los prompts.</p>
                ) : (
                  diag.intentionScores.map((row) => {
                    const brandPct = row.score;
                    const leaderPct = Math.min(100, brandPct + diag.gapToLeader);
                    return (
                      <div key={row.key}>
                        <div className="flex justify-between text-[11px] text-slate-600">
                          <span>{INTENTION_LABELS[row.key] ?? row.key}</span>
                          <span>
                            {Math.round(brandPct)}% · líder ~{Math.round(leaderPct)}%
                          </span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-violet-500"
                            style={{ width: `${Math.min(100, brandPct)}%` }}
                          />
                        </div>
                        {diag.gapToLeader > 0 ? (
                          <p className="mt-0.5 text-[10px] text-slate-500">
                            ~{diag.gapToLeader.toFixed(1)} pts por detrás del líder en Top 3 agregado
                          </p>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle n={2} title="KPIs clave" subtitle="Lectura rápida del desempeño en esta corrida." />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <p className="text-[10px] font-semibold uppercase text-slate-500">Cleexs Score</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{diag.displayScore}</p>
              <p className="text-xs text-slate-600">{scoreLabel(diag.displayScore)}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <p className="text-[10px] font-semibold uppercase text-slate-500">Ranking</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {diag.rankNum > 0 ? `#${diag.rankNum}` : '—'}
              </p>
              <p className="text-xs text-slate-600">
                {diag.totalBrands > 0 ? `de ${diag.totalBrands} marcas en Top 3` : 'sin datos'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <p className="text-[10px] font-semibold uppercase text-slate-500">Brecha vs líder</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {diag.gapToLeader > 0 ? `-${diag.gapToLeader.toFixed(1)} pts` : '—'}
              </p>
              <p className="text-xs text-slate-600">
                {diag.leaderDisplayName !== '—' ? `vs ${diag.leaderDisplayName}` : 'sin líder claro'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <p className="text-[10px] font-semibold uppercase text-slate-500">Mejor intención</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {diag.strongestIntention
                  ? `${INTENTION_LABELS[diag.strongestIntention.key] ?? diag.strongestIntention.key} ${Math.round(diag.strongestIntention.score)}%`
                  : '—'}
              </p>
              <p className="text-xs text-slate-600">Mayor fortaleza relativa</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            n={3}
            title="Comparativa principal"
            subtitle={`Competidores en cuenta: ${competidorRows.length}. En la corrida (IA): ${detectedCompetitors.length} detectados en Top 3.`}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-100 p-4">
              <p className="text-xs font-semibold text-slate-800">Tu marca vs competidores</p>
              <p className="text-[11px] text-slate-500">% de aparición en slots del Top 3 (agregado).</p>
              {diag.barData.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">Aún no hay Top 3 parseable.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {diag.barData.map((row) => (
                    <li key={row.name} className="flex items-center gap-2">
                      <span className="w-40 shrink-0 truncate text-xs font-medium text-slate-800 sm:w-48">
                        {row.isBrand ? (
                          <span className="rounded bg-orange-100 px-1.5 py-0.5 text-orange-900">{row.name}</span>
                        ) : (
                          row.name
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${row.isBrand ? 'bg-violet-500' : 'bg-sky-400'}`}
                            style={{ width: `${Math.min(100, row.value)}%` }}
                          />
                        </div>
                      </div>
                      <span className="w-12 shrink-0 text-right text-xs tabular-nums text-slate-600">
                        {row.value.toFixed(1)}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-slate-100 p-4">
              <p className="text-xs font-semibold text-slate-800">Funnel de presencia</p>
              <p className="text-[11px] text-slate-500">
                De {diag.totalPrompts} prompts hasta la recomendación #1 (tu marca).
              </p>
              <div className="mt-4 space-y-2">
                <div className="rounded-lg bg-slate-800 px-3 py-3 text-white">
                  <p className="text-[10px] font-semibold uppercase text-slate-300">Prompts analizados</p>
                  <p className="text-2xl font-bold">
                    {diag.totalPrompts} · {diag.totalPrompts ? 100 : 0}%
                  </p>
                </div>
                <div className="rounded-lg bg-slate-700 px-3 py-2 text-white">
                  <p className="text-[10px] font-semibold uppercase text-slate-300">Menciones de marca</p>
                  <p className="text-lg font-semibold">
                    {diag.mentionCount} · {diag.mentionRate}%
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-slate-600 px-2 py-2 text-center text-white">
                    <p className="text-[9px] font-semibold uppercase text-slate-200">Top 3</p>
                    <p className="text-sm font-bold">
                      {diag.top3Count} · {diag.top3Rate}%
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-600 px-2 py-2 text-center text-white">
                    <p className="text-[9px] font-semibold uppercase text-slate-200">Posición #1</p>
                    <p className="text-sm font-bold">
                      {diag.top1Count} · {diag.top1Rate}%
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 text-[10px] text-slate-600">
                  <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                    Conv. menciones → Top 3: <strong>{diag.convMentionToTop3}%</strong>
                  </span>
                  <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                    Conv. Top 3 → #1: <strong>{diag.convTop3ToFirst}%</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
          {competidorRows.length > 0 ? (
            <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
              <p className="text-[10px] font-semibold uppercase text-slate-500">Configurados en tu cuenta</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {competidorRows.map((c) => (
                  <li key={c.id} className="rounded-full bg-white px-2 py-0.5 text-xs ring-1 ring-slate-200">
                    {c.name}
                    {c.domain ? ` · ${c.domain}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            n={4}
            title="Métricas del análisis"
            subtitle="Cobertura de formato y presencia de tu marca en las respuestas."
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: 'Confianza de formato',
                pct: diag.formatConfidence,
                sub: `${diag.parseableCount}/${diag.totalPrompts} con Top 3 parseable`,
                icon: '📄',
                ring: 'ring-violet-200 bg-violet-50',
              },
              {
                label: 'Mención de marca',
                pct: diag.mentionRate,
                sub: `${diag.mentionCount}/${diag.totalPrompts} respuestas`,
                icon: '📣',
                ring: 'ring-sky-200 bg-sky-50',
              },
              {
                label: 'Aparición en Top 3',
                pct: diag.top3Rate,
                sub: `${diag.top3Count}/${diag.totalPrompts} en Top 3`,
                icon: '📊',
                ring: 'ring-amber-200 bg-amber-50',
              },
              {
                label: 'Posición #1',
                pct: diag.top1Rate,
                sub: `${diag.top1Count}/${diag.totalPrompts} en primer lugar`,
                icon: '🏆',
                ring: 'ring-emerald-200 bg-emerald-50',
              },
            ].map((m) => (
              <div key={m.label} className={`rounded-xl border border-slate-100 p-4 ring-1 ${m.ring}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase text-slate-700">{m.label}</p>
                  <span className="text-lg" aria-hidden>
                    {m.icon}
                  </span>
                </div>
                <p className="mt-2 text-3xl font-bold text-slate-900">{m.pct}%</p>
                <p className="text-[11px] text-slate-600">{m.sub}</p>
              </div>
            ))}
          </div>
          {diag.priaCategories.length > 0 ? (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold text-slate-700">PRIA por categoría</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {diag.priaCategories.map((row) => (
                  <span
                    key={row.label}
                    className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-800"
                  >
                    {row.label}: {Math.round(row.score)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            n={5}
            title="Visualizaciones adicionales"
            subtitle="Tendencia (un punto por corrida en esta vista) e intenciones."
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-100 p-4">
              <p className="text-xs font-semibold text-violet-800">Tendencia · evolución del score</p>
              <div className="mt-4 flex h-40 items-end justify-center gap-4 border-b border-l border-slate-200 pl-2 pb-0">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="w-10 rounded-t-md bg-violet-500"
                    style={{ height: `${Math.min(120, (diag.displayScore / 100) * 120)}px` }}
                  />
                  <span className="text-[10px] text-slate-500">Corrida 1</span>
                  <span className="text-xs font-semibold text-slate-800">{diag.displayScore}</span>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-slate-500">Con más corridas comparables, el gráfico mostrará la serie.</p>
            </div>
            <div className="rounded-xl border border-slate-100 p-4">
              <p className="text-xs font-semibold text-violet-800">Intenciones · score por intención</p>
              {diag.intentionScores.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600">Sin intenciones etiquetadas en los prompts.</p>
              ) : (
                <div className="mt-4 flex h-40 items-end justify-center gap-4 border-b border-l border-slate-200 px-2">
                  {diag.intentionScores.map((row, i) => {
                    const h = Math.min(120, (row.score / 100) * 120);
                    const colors = ['bg-violet-500', 'bg-fuchsia-500', 'bg-sky-500', 'bg-teal-500'];
                    return (
                      <div key={row.key} className="flex flex-col items-center gap-1">
                        <div
                          className={`w-10 rounded-t-md ${colors[i % colors.length]}`}
                          style={{ height: `${Math.max(8, h)}px` }}
                        />
                        <span className="max-w-[72px] text-center text-[10px] text-slate-600">
                          {INTENTION_LABELS[row.key] ?? row.key}
                        </span>
                        <span className="text-xs font-semibold">{Math.round(row.score)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            n={6}
            title="Top 3 acciones prioritarias"
            subtitle="Acciones personalizadas según los resultados de esta corrida."
          />
          <div className="grid gap-3 md:grid-cols-3">
            {diag.actionCards.map((a) => (
              <div key={a.title} className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-sm">
                <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${a.badgeClass}`}>
                  {a.badge}
                </span>
                <p className="mt-2 font-semibold text-slate-900">{a.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{a.body}</p>
                <p className="mt-3 text-[11px] font-medium text-violet-800">{a.footer}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-[11px] italic text-slate-500">
            La lectura pasa de análisis disperso a narrativa: estado actual → comparación → métricas → tendencias →
            acciones.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            n={7}
            title="Compartir e invitar"
            subtitle="Difundí el enlace a este resultado (sesión requerida para verlo en el portal)."
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-100 p-4">
              <p className="text-xs font-semibold text-slate-900">Compartir resultado</p>
              <p className="text-[11px] text-slate-500">Copiá el enlace o enviálo por tus canales.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void copyShare()}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50"
                >
                  {copied ? 'Copiado' : 'Copiar enlace'}
                </button>
                <a
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700"
                  href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp
                </a>
                <a
                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                  href={`mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(shareUrl)}`}
                >
                  Email
                </a>
                <a
                  className="rounded-lg bg-[#0a66c2] px-3 py-2 text-xs font-medium text-white hover:opacity-95"
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  LinkedIn
                </a>
                <a
                  className="rounded-lg bg-black px-3 py-2 text-xs font-medium text-white hover:opacity-90"
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  X
                </a>
              </div>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
              <p className="text-xs font-semibold text-emerald-950">Invitar a tu equipo</p>
              <p className="text-[11px] text-emerald-900/80">Compartí el mismo enlace; cada persona inicia sesión con su cuenta.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void copyShare()}
                  className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-medium text-emerald-950 hover:bg-emerald-50"
                >
                  Copiar enlace
                </button>
                <a
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700"
                  href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp
                </a>
                <a
                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                  href={`mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(shareUrl)}`}
                >
                  Email
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle n={8} title="Próximos pasos" subtitle="" />
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={CLEEXS_MARKETING_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              🚀 Ver planes
            </a>
            <Link
              href="/portal-crecimiento"
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-blue-600 bg-white px-6 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              📄 Otro diagnóstico
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Anexo · detalle por consulta (prompt)</h2>
          <p className="mt-1 text-xs text-slate-600">
            <strong>No forma parte del informe ejecutivo.</strong> Es la transcripción técnica: texto del prompt,
            respuesta del modelo, Top 3 y score por ítem. Usalo para auditoría puntual.
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
