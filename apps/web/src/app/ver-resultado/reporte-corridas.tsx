'use client';

import { useId, useState, type ReactNode } from 'react';
import type {
  PublicDiagnosticRunResult,
  PublicDiagnosticPromptResult,
  PublicDiagnosticTrendPoint,
} from '@/lib/api';
import {
  ChevronDown,
  Gauge,
  LineChart as LineChartIcon,
  Medal,
  Sparkle,
  Tag,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';

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
  return aliases.some((alias) => normalizeName(text).includes(normalizeName(alias)));
};

const isBrandEntry = (entryName: string, brandName: string, aliases: string[]) => {
  const n = normalizeName(entryName);
  if (n === normalizeName(brandName)) return true;
  return aliases.some((alias) => normalizeName(alias) === n);
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

/** Orden visual alineado con la maqueta (Urgencia, Calidad, Precio primero). */
const INTENTION_CHART_ORDER = ['urgencia', 'calidad', 'precio', 'consideracion'];

interface ComparisonRow {
  name: string;
  type: string;
  appearances: number;
  averagePosition: number;
  share: number;
}

const buildComparisonSummary = (results: PublicDiagnosticPromptResult[]): ComparisonRow[] => {
  const totals = new Map<
    string,
    { name: string; type: string; count: number; positionSum: number }
  >();
  let totalEntries = 0;

  results.forEach((result) => {
    (result.top3Json || []).forEach((entry) => {
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
      });
    });
  });

  return Array.from(totals.values())
    .map((row) => ({
      name: row.name,
      type: row.type,
      appearances: row.count,
      averagePosition: row.count ? row.positionSum / row.count : 0,
      share: totalEntries ? (row.count / totalEntries) * 100 : 0,
    }))
    .sort((a, b) => b.share - a.share);
};

function scoreLabelEs(score: number) {
  if (score >= 70) return 'alto';
  if (score >= 45) return 'medio';
  return 'bajo';
}

function sectionHeading(num: number, title: string, subtitle?: string) {
  return (
    <div className="mb-2 flex items-start gap-2">
      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-[10px] font-bold text-white shadow shadow-violet-500/20">
        {num}
      </span>
      <div>
        <h2 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
    </div>
  );
}

/** Velocímetro 0–100 tipo dashboard con zonas de color, ticks y aguja. */
function GaugeSemicircleMaqueta({ value, gradientId }: { value: number; gradientId: string }) {
  const size = 220;
  const height = 150;
  const cx = size / 2;
  const cy = height - 18;
  const rOuter = size / 2 - 10;
  const rInner = rOuter - 18;
  const rTick = rOuter + 2;
  const rTickInnerMajor = rOuter - 22;
  const rTickInnerMinor = rOuter - 14;
  const rLabel = rOuter - 32;
  const rNeedle = rInner - 2;

  const v = Math.min(100, Math.max(0, value));
  const angleFor = (val: number) => Math.PI * (1 - val / 100);
  const polar = (r: number, ang: number) => ({ x: cx + r * Math.cos(ang), y: cy - r * Math.sin(ang) });

  const arc = (r: number, from: number, to: number) => {
    const p1 = polar(r, angleFor(from));
    const p2 = polar(r, angleFor(to));
    const large = to - from > 50 ? 1 : 0;
    return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y}`;
  };

  const zoneArc = (from: number, to: number, color: string, opacity = 1) => {
    const outer1 = polar(rOuter, angleFor(from));
    const outer2 = polar(rOuter, angleFor(to));
    const inner2 = polar(rInner, angleFor(to));
    const inner1 = polar(rInner, angleFor(from));
    const large = to - from > 50 ? 1 : 0;
    const d = `M ${outer1.x} ${outer1.y} A ${rOuter} ${rOuter} 0 ${large} 1 ${outer2.x} ${outer2.y} L ${inner2.x} ${inner2.y} A ${rInner} ${rInner} 0 ${large} 0 ${inner1.x} ${inner1.y} Z`;
    return <path d={d} fill={color} opacity={opacity} />;
  };

  const needleAngle = angleFor(v);
  const needleTip = polar(rNeedle, needleAngle);
  const needleBaseL = polar(8, needleAngle - Math.PI / 2);
  const needleBaseR = polar(8, needleAngle + Math.PI / 2);

  const majorTicks = [0, 20, 40, 60, 80, 100];
  const minorTicks = Array.from({ length: 21 }, (_, i) => i * 5).filter((n) => !majorTicks.includes(n));

  const strokeColor = v >= 70 ? '#16a34a' : v >= 45 ? '#ca8a04' : '#dc2626';

  return (
    <div className="relative flex flex-col items-center" style={{ width: size }}>
      <svg
        width={size}
        height={height + 18}
        viewBox={`0 0 ${size} ${height + 18}`}
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
          <radialGradient id={`${gradientId}-hub`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1f2937" />
            <stop offset="100%" stopColor="#0f172a" />
          </radialGradient>
        </defs>

        {zoneArc(0, 45, '#fecaca', 0.85)}
        {zoneArc(45, 70, '#fde68a', 0.85)}
        {zoneArc(70, 100, '#bbf7d0', 0.9)}

        <path d={arc(rOuter, 0, 100)} fill="none" stroke="#e2e8f0" strokeWidth={1.5} />
        <path d={arc(rInner, 0, 100)} fill="none" stroke="#e2e8f0" strokeWidth={1} />

        {minorTicks.map((t) => {
          const a = angleFor(t);
          const p1 = polar(rTick, a);
          const p2 = polar(rTickInnerMinor, a);
          return (
            <line
              key={`minor-${t}`}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke="#94a3b8"
              strokeWidth={1}
            />
          );
        })}
        {majorTicks.map((t) => {
          const a = angleFor(t);
          const p1 = polar(rTick, a);
          const p2 = polar(rTickInnerMajor, a);
          const pl = polar(rLabel, a);
          return (
            <g key={`major-${t}`}>
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#475569" strokeWidth={1.8} />
              <text
                x={pl.x}
                y={pl.y + 3}
                fontSize={9}
                textAnchor="middle"
                fill="#64748b"
                fontFamily="ui-sans-serif, system-ui"
                fontWeight={600}
              >
                {t}
              </text>
            </g>
          );
        })}

        <path
          d={`M ${needleBaseL.x} ${needleBaseL.y} L ${needleTip.x} ${needleTip.y} L ${needleBaseR.x} ${needleBaseR.y} Z`}
          fill={strokeColor}
          stroke={strokeColor}
          strokeWidth={1}
          strokeLinejoin="round"
          className="transition-all duration-700"
          style={{ filter: 'drop-shadow(0 1px 1.5px rgba(15,23,42,0.25))' }}
        />
        <circle cx={cx} cy={cy} r={9} fill={`url(#${gradientId}-hub)`} />
        <circle cx={cx} cy={cy} r={3} fill="#f8fafc" />
      </svg>
      <div className="mt-1 text-center">
        <p className="text-2xl font-bold tabular-nums leading-none text-slate-900">{Math.round(v)}</p>
        <p className="mt-1 text-[11px] font-medium text-slate-500">Indicador 0-100 de recomendación en IA</p>
      </div>
    </div>
  );
}

function CollapsibleRow({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100/80">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-[11px] text-slate-500">{subtitle}</p>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="border-t border-slate-100 px-3 pb-3 pt-1.5">{children}</div>
    </details>
  );
}

export function ReporteCorridas({
  runResult,
  brandName,
  trendData,
}: {
  runResult: PublicDiagnosticRunResult;
  brandName: string;
  trendData?: PublicDiagnosticTrendPoint[];
}) {
  const gaugeGradientId = useId().replace(/:/g, '');
  const [summaryTab, setSummaryTab] = useState<'score' | 'competidores'>('score');
  const results = runResult.promptResults || [];
  const brandAliases = runResult.brandAliases || [];
  const totalPrompts = results.length;

  const parseableCount = results.filter((r) => r.top3Json && r.top3Json.length > 0).length;
  const mentionCount = results.filter((r) =>
    isBrandMentioned(r.responseText ?? '', brandName, brandAliases)
  ).length;
  const top3Count = results.filter((r) =>
    r.top3Json?.some((e) => isBrandEntry(e.name, brandName, brandAliases))
  ).length;
  const top1Count = results.filter((r) =>
    r.top3Json?.some((e) => e.position === 1 && isBrandEntry(e.name, brandName, brandAliases))
  ).length;

  const formatConfidence = totalPrompts ? Math.round((parseableCount / totalPrompts) * 100) : 0;
  const mentionRate = totalPrompts ? Math.round((mentionCount / totalPrompts) * 100) : 0;
  const top3Rate = totalPrompts ? Math.round((top3Count / totalPrompts) * 100) : 0;
  const top1Rate = totalPrompts ? Math.round((top1Count / totalPrompts) * 100) : 0;

  const intentionBuckets: Record<string, { scores: number[]; weight: number }> = {};
  results.forEach((result) => {
    const extracted = extractIntention(result.promptText || '');
    if (!extracted) return;
    const key = normalizeIntentionKey(extracted.name);
    if (!key) return;
    if (!intentionBuckets[key]) intentionBuckets[key] = { scores: [], weight: extracted.weight };
    intentionBuckets[key].scores.push((result.score || 0) * 100);
  });

  const intentionScores = Object.entries(intentionBuckets).map(([key, data]) => ({
    key,
    label: INTENTION_LABELS[key] ?? key,
    score: data.scores.length ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : 0,
    weight: data.weight,
  }));

  const weightSum = intentionScores.reduce((sum, item) => sum + item.weight, 0) || 1;
  const weightedScore = intentionScores.reduce(
    (sum, item) => sum + item.score * (item.weight / weightSum),
    0
  );
  const fallbackScore =
    results.length > 0
      ? results.reduce((sum, row) => sum + (row.score || 0) * 100, 0) / results.length
      : runResult.cleexsScore || 0;
  const cleexsScore = intentionScores.length > 0 ? weightedScore : fallbackScore;
  const displayScore = Math.round(cleexsScore || runResult.cleexsScore || 0);

  const comparisonSummary = buildComparisonSummary(results);
  const brandRow =
    comparisonSummary.find(
      (row) => row.type === 'brand' || isBrandEntry(row.name, brandName, brandAliases)
    ) || null;
  const leaderRow = comparisonSummary[0] || null;
  const leaderGapPts = leaderRow && brandRow ? leaderRow.share - brandRow.share : 0;
  const rank = brandRow ? Math.max(1, comparisonSummary.indexOf(brandRow) + 1) : null;

  const strongestIntention = [...intentionScores].sort((a, b) => b.score - a.score)[0];
  const weakestIntention = [...intentionScores].sort((a, b) => a.score - b.score)[0];

  const intentionMatrix: Record<string, Record<string, number>> = {};
  results.forEach((r) => {
    const extracted = extractIntention(r.promptText || '');
    const key = extracted ? normalizeIntentionKey(extracted.name) : null;
    if (!key) return;
    if (!intentionMatrix[key]) intentionMatrix[key] = {};
    (r.top3Json || []).forEach((e) => {
      const n = e.name.trim();
      if (!n) return;
      intentionMatrix[key]![n] = (intentionMatrix[key]![n] ?? 0) + 1;
    });
  });
  const promptsPerIntention: Record<string, number> = {};
  Object.keys(intentionBuckets).forEach((k) => {
    promptsPerIntention[k] = intentionBuckets[k]!.scores.length * 3;
  });
  const intentionMatrixPct: Record<string, Record<string, number>> = {};
  Object.keys(intentionMatrix).forEach((intKey) => {
    const total = promptsPerIntention[intKey] || 1;
    intentionMatrixPct[intKey] = {};
    Object.keys(intentionMatrix[intKey]!).forEach((name) => {
      intentionMatrixPct[intKey]![name] = (intentionMatrix[intKey]![name]! / total) * 100;
    });
  });

  const leaderName = leaderRow?.name ?? '';
  const brandIsLeader =
    Boolean(brandRow && leaderRow && normalizeName(brandRow.name) === normalizeName(leaderRow.name));
  const intentionKeysOrdered = [
    ...INTENTION_CHART_ORDER.filter((k) => intentionMatrixPct[k]),
    ...Object.keys(intentionMatrixPct).filter((k) => !INTENTION_CHART_ORDER.includes(k)),
  ];
  const intentionChartRows = intentionKeysOrdered.map((intKey) => {
    const row = intentionMatrixPct[intKey]!;
    const brandKey = Object.keys(row).find((k) => isBrandEntry(k, brandName, brandAliases));
    const brandVal = brandKey ? row[brandKey]! : 0;
    const leaderVal = leaderName ? (row[leaderName] ?? 0) : 0;
    return {
      intention: INTENTION_LABELS[intKey] ?? intKey,
      tuMarca: Math.round(brandVal),
      lider: Math.round(leaderVal),
    };
  });

  const topCompetitors = comparisonSummary.slice(0, 5).map((row) => ({
    name: isBrandEntry(row.name, brandName, brandAliases) ? 'Tu marca' : row.name,
    share: Number(row.share.toFixed(1)),
    isBrand: row.type === 'brand' || isBrandEntry(row.name, brandName, brandAliases),
  }));

  const barHeight = Math.max(150, topCompetitors.length * 32);

  const metaLine =
    brandRow && leaderRow
      ? `#${rank} en ranking · líder: ${leaderRow.name} ${leaderRow.share.toFixed(1)}%` +
        (strongestIntention
          ? ` · mejor intención: ${strongestIntention.label} ${Math.round(strongestIntention.score)}%`
          : '')
      : 'Sin datos de ranking suficientes para esta corrida.';

  const kpis = [
    {
      label: 'Cleexs Score',
      value: String(displayScore),
      sub: `Nivel ${scoreLabelEs(cleexsScore)}`,
      icon: Gauge,
      iconBg: 'bg-violet-100 text-violet-600',
    },
    {
      label: 'Ranking',
      value: brandRow ? `#${rank}` : '—',
      sub: `de ${Math.max(comparisonSummary.length, 1)} marcas`,
      icon: Medal,
      iconBg: 'bg-indigo-100 text-indigo-600',
    },
    {
      label: 'Brecha vs líder',
      value:
        leaderRow && brandRow
          ? brandIsLeader
            ? '0 pts'
            : `-${leaderGapPts.toFixed(1)} pts`
          : '—',
      sub: leaderRow
        ? brandIsLeader
          ? 'Sos el líder en % Top 3'
          : `vs ${leaderRow.name} (${leaderRow.share.toFixed(1)}%)`
        : 'Sin líder',
      icon: TrendingUp,
      iconBg: 'bg-sky-100 text-sky-600',
    },
    {
      label: 'Mejor intención',
      value: strongestIntention
        ? `${strongestIntention.label} ${Math.round(strongestIntention.score)}%`
        : '—',
      sub: 'Mayor fortaleza',
      icon: Target,
      iconBg: 'bg-fuchsia-100 text-fuchsia-700',
    },
  ];

  const leaderDisplay = leaderRow?.name ?? 'el líder';
  const actions: Array<{ title: string; desc: string; Icon: typeof LineChartIcon }> = [];
  if (!brandRow || !leaderRow) {
    actions.push(
      {
        title: 'Completar datos',
        desc: 'Ejecutá más prompts o verificá que el Top 3 sea parseable para ver ranking y acciones.',
        Icon: LineChartIcon,
      },
      { title: 'Revisar competidores', desc: 'Definí competidores claros en el diagnóstico para una comparativa fiel.', Icon: Tag },
      { title: 'Contactar soporte', desc: 'Si el informe no carga bien, podemos revisar el formato de respuestas del modelo.', Icon: Users }
    );
  } else {
    actions.push({
      title: rank === 1 ? 'Mantener liderazgo' : 'Mejorar posición #1',
      desc:
        rank === 1
          ? 'Sostené la visibilidad que te ubica primero frente a la competencia en IA.'
          : 'Aumentá tu visibilidad para alcanzar el liderazgo en las recomendaciones de IA.',
      Icon: LineChartIcon,
    });
    actions.push({
      title: weakestIntention?.key === 'precio' ? 'Reforzar precio' : 'Reforzar percepción de valor',
      desc:
        weakestIntention?.key === 'precio'
          ? 'Mejorá tu percepción de valor frente a la competencia en consultas sensibles al precio.'
          : 'Trabajá señales de confianza y propuesta de valor donde la IA aún no te prioriza.',
      Icon: Tag,
    });
    actions.push({
      title: 'Reducir brecha con el líder',
      desc: `Acortá la distancia con ${leaderDisplay} y ganá participación en el Top 3.`,
      Icon: Users,
    });
  }

  const trendChartData =
    trendData && trendData.length > 0
      ? trendData
      : [{ label: 'Corrida 1', score: displayScore }];

  return (
    <div className="space-y-6">
      {/* 1 Resumen ejecutivo — una tarjeta unificada, tres columnas como maqueta */}
      <section>
        {sectionHeading(1, 'Resumen ejecutivo')}
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/30 ring-1 ring-slate-100">
          <div className="grid gap-0 lg:grid-cols-3 lg:divide-x lg:divide-slate-100">
            <div className="flex flex-col bg-gradient-to-br from-violet-50 via-white to-indigo-50/50 p-4 sm:p-5">
              <div className="mb-3 inline-flex w-fit items-center gap-1 rounded-full border border-slate-200 bg-white p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => setSummaryTab('score')}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition',
                    summaryTab === 'score'
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-violet-700'
                  )}
                >
                  <Sparkle
                    className={cn(
                      'h-3 w-3',
                      summaryTab === 'score' ? 'fill-white text-white' : 'fill-violet-500 text-violet-500'
                    )}
                    aria-hidden
                  />
                  Cleexs Score
                </button>
                <button
                  type="button"
                  onClick={() => setSummaryTab('competidores')}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition',
                    summaryTab === 'competidores'
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-violet-700'
                  )}
                >
                  <Trophy className="h-3 w-3" aria-hidden />
                  Competidores
                </button>
              </div>

              {summaryTab === 'score' ? (
                <div className="flex flex-1 flex-col justify-center">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 ring-1 ring-violet-200">
                      <Sparkle className="h-4 w-4 fill-violet-600 text-violet-600" aria-hidden />
                    </span>
                    <p className="text-2xl font-bold tabular-nums text-violet-700">{displayScore}</p>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">{metaLine}</p>
                </div>
              ) : (
                <div className="flex flex-1 flex-col">
                  <p className="mb-2 text-[11px] font-medium text-slate-500">
                    Top {Math.min(topCompetitors.length, 5)} por % en Top 3
                  </p>
                  {topCompetitors.length === 0 ? (
                    <p className="text-xs text-slate-500">Sin competidores suficientes en esta corrida.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {topCompetitors.slice(0, 5).map((c, idx) => (
                        <li
                          key={`${c.name}-${idx}`}
                          className={cn(
                            'flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs',
                            c.isBrand
                              ? 'border-violet-200 bg-violet-50/70'
                              : 'border-slate-200/70 bg-white/80'
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums',
                              idx === 0
                                ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200'
                                : idx === 1
                                  ? 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
                                  : idx === 2
                                    ? 'bg-orange-100 text-orange-700 ring-1 ring-orange-200'
                                    : 'bg-slate-50 text-slate-500 ring-1 ring-slate-200'
                            )}
                          >
                            {idx + 1}
                          </span>
                          <span
                            className={cn(
                              'flex-1 truncate font-medium',
                              c.isBrand ? 'text-violet-700' : 'text-slate-700'
                            )}
                            title={c.name}
                          >
                            {c.name}
                          </span>
                          <span
                            className={cn(
                              'tabular-nums font-semibold',
                              c.isBrand ? 'text-violet-700' : 'text-slate-600'
                            )}
                          >
                            {c.share.toFixed(1)}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col items-center justify-center border-t border-slate-100 bg-white px-3 py-4 lg:border-t-0">
              <GaugeSemicircleMaqueta value={cleexsScore} gradientId={`g-${gaugeGradientId}`} />
            </div>
            <div className="border-t border-slate-100 bg-slate-50/40 p-3 sm:p-4 lg:border-t-0">
              <p className="mb-1.5 text-xs font-semibold text-slate-800">Tendencia</p>
              <div className="h-[118px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={32} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                      formatter={(v: number) => [Math.round(v), 'Score']}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#7c3aed"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#7c3aed', strokeWidth: 1, stroke: '#fff' }}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2 KPIs clave */}
      <section>
        {sectionHeading(2, 'KPIs clave')}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div
                key={kpi.label}
                className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm ring-1 ring-slate-100/60"
              >
                <div className={cn('mb-2 flex h-9 w-9 items-center justify-center rounded-lg', kpi.iconBg)}>
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </div>
                <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
                <p className="mt-0.5 text-xl font-bold tabular-nums tracking-tight text-slate-900">{kpi.value}</p>
                <p className="mt-0.5 text-xs text-slate-500">{kpi.sub}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3 Comparativa principal */}
      <section>
        {sectionHeading(3, 'Comparativa principal')}
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm ring-1 ring-slate-100/60">
            <p className="border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">Tu marca vs competidores</p>
            <div className="pt-2">
              {topCompetitors.length > 0 ? (
                <ResponsiveContainer width="100%" height={barHeight}>
                  <BarChart
                    data={topCompetitors}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                    barCategoryGap="18%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} unit="%" />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={88}
                      tick={{ fontSize: 11, fill: '#334155', fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(124, 58, 237, 0.06)' }}
                      contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
                      formatter={(v: number) => [`${Number(v).toFixed(1)}%`, '% en Top 3']}
                    />
                    <Bar dataKey="share" radius={[0, 6, 6, 0]} maxBarSize={20}>
                      {topCompetitors.map((entry, idx) => (
                        <Cell key={idx} fill={entry.isBrand ? '#2563eb' : '#94a3b8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-10 text-center text-sm text-slate-500">Sin datos comparativos.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm ring-1 ring-slate-100/60">
            <p className="border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">Por intención</p>
            <p className="mt-1.5 text-[11px] text-slate-500">Tu marca (azul) vs {leaderName || 'líder'} (gris)</p>
            <div className="h-[200px] pt-1.5">
              {intentionChartRows.length > 0 && leaderName ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={intentionChartRows} margin={{ top: 12, right: 8, left: 0, bottom: 8 }} barGap={6}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="intention" tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} width={36} unit="%" />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} formatter={(v: number) => [`${v}%`, '']} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="tuMarca" name="Tu marca" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={24} />
                    <Bar dataKey="lider" name={leaderName} fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="flex h-full items-center justify-center text-sm text-slate-500">
                  Sin datos por intención para comparar con el líder.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 4 Top 3 acciones */}
      <section>
        {sectionHeading(4, 'Top 3 acciones prioritarias', 'Acciones sugeridas para mejorar tu Cleexs Score')}
        <div className="grid gap-3 md:grid-cols-3">
          {actions.slice(0, 3).map((action, idx) => {
            const AIcon = action.Icon;
            return (
              <div
                key={`${action.title}-${idx}`}
                className="relative overflow-hidden rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm ring-1 ring-slate-100/60"
              >
                <div className="absolute right-2 top-2 text-lg font-black tabular-nums text-violet-100">{idx + 1}</div>
                <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                  <AIcon className="h-4 w-4" strokeWidth={2} />
                </div>
                <p className="pr-7 text-sm font-bold text-slate-900">{action.title}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{action.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5 Métricas — colapsable */}
      <section>
        {sectionHeading(5, 'Métricas del análisis')}
        <CollapsibleRow title="Métricas del análisis" subtitle="Colapsable · secundario">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
              <p className="text-[11px] font-medium text-slate-500">Confianza de formato</p>
              <p className="mt-0.5 text-lg font-bold text-slate-900">{formatConfidence}%</p>
              <p className="text-xs text-slate-500">{parseableCount}/{totalPrompts} con Top 3 parseable</p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
              <p className="text-[11px] font-medium text-slate-500">Mención de marca</p>
              <p className="mt-0.5 text-lg font-bold text-slate-900">{mentionRate}%</p>
              <p className="text-xs text-slate-500">{mentionCount}/{totalPrompts} respuestas</p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
              <p className="text-[11px] font-medium text-slate-500">Aparición en Top 3</p>
              <p className="mt-0.5 text-lg font-bold text-slate-900">{top3Rate}%</p>
              <p className="text-xs text-slate-500">{top3Count}/{totalPrompts} en Top 3</p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
              <p className="text-[11px] font-medium text-slate-500">Posición #1</p>
              <p className="mt-0.5 text-lg font-bold text-slate-900">{top1Rate}%</p>
              <p className="text-xs text-slate-500">{top1Count}/{totalPrompts} en primer lugar</p>
            </div>
          </div>
        </CollapsibleRow>
      </section>

      {/* 6 Visualizaciones adicionales */}
      <section>
        {sectionHeading(6, 'Visualizaciones adicionales')}
        <CollapsibleRow title="Visualizaciones adicionales" subtitle="Colapsable · secundario">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-100 bg-white p-3">
              <p className="mb-1.5 text-xs font-semibold text-slate-800">Evolución del score</p>
              <div className="h-[132px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} width={32} />
                    <Tooltip contentStyle={{ borderRadius: 12 }} formatter={(v: number) => [Math.round(v), 'Score']} />
                    <Line type="monotone" dataKey="score" stroke="#7c3aed" strokeWidth={2} dot={{ r: 4, fill: '#7c3aed' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-lg border border-slate-100 bg-white p-3">
              <p className="mb-1.5 text-xs font-semibold text-slate-800">Score por intención</p>
              <div className="h-[132px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={
                      intentionScores.length > 0
                        ? intentionScores.map((item) => ({
                            name: item.label,
                            score: Math.round(item.score),
                          }))
                        : [{ name: 'General', score: displayScore }]
                    }
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} width={32} />
                    <Tooltip formatter={(v: number) => [`${v}%`, '']} />
                    <Bar dataKey="score" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </CollapsibleRow>
      </section>

      <p className="text-center text-[11px] italic leading-relaxed text-slate-400">
        La lectura pasa de análisis disperso a narrativa: estado actual → comparación → acciones → difusión.
      </p>
    </div>
  );
}
