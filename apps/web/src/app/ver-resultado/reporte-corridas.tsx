'use client';

import { useId, useState, type ReactNode } from 'react';
import type {
  PublicDiagnosticRunResult,
  PublicDiagnosticPromptResult,
  PublicDiagnosticTrendPoint,
} from '@/lib/api';
import { CompetitorNameLink } from '@/components/report/competitor-name-link';
import {
  BarChart3,
  ChevronDown,
  FileCheck,
  Gauge,
  LineChart as LineChartIcon,
  ListOrdered,
  Medal,
  Megaphone,
  Sparkle,
  Tag,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import {
  Area,
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

const filterComparisonSummaryToTrackedParticipants = (
  rows: ComparisonRow[],
  brandName: string,
  aliases: string[],
  competitors: string[],
) => {
  if (rows.length === 0) return rows;
  const trackedNames = new Set(
    [brandName, ...aliases, ...competitors]
      .map((value) => normalizeName(value || ''))
      .filter(Boolean),
  );
  return rows.filter(
    (row) => isBrandEntry(row.name, brandName, aliases) || trackedNames.has(normalizeName(row.name)),
  );
};

/** Incluye competidores configurados que no aparecieron en ningún Top 3 (0% de share). */
const mergeConfiguredCompetitorsWithZeroShare = (
  filteredRows: ComparisonRow[],
  competitorsList: string[],
  brandNm: string,
  aliases: string[],
): ComparisonRow[] => {
  const rowKeys = (name: string) => {
    const n = normalizeName(name);
    const base = name.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const nb = normalizeName(base);
    return new Set([n, nb].filter(Boolean));
  };
  const covered = new Set<string>();
  for (const r of filteredRows) {
    for (const k of rowKeys(r.name)) covered.add(k);
  }
  const merged = [...filteredRows];
  for (const raw of competitorsList) {
    const t = raw.trim();
    if (!t || isBrandEntry(t, brandNm, aliases)) continue;
    const keys = [...rowKeys(t)];
    if (keys.some((k) => covered.has(k))) continue;
    merged.push({
      name: t,
      type: 'competitor',
      appearances: 0,
      averagePosition: 0,
      share: 0,
    });
    keys.forEach((k) => covered.add(k));
  }
  return merged.sort((a, b) => b.share - a.share);
};

function scoreLabelEs(score: number) {
  if (score >= 70) return 'alto';
  if (score >= 45) return 'medio';
  return 'bajo';
}

export function sectionHeading(num: number, title: string, subtitle?: string) {
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

export function ReporteCorridas({
  runResult,
  brandName,
  trendData,
  satelliteBlock,
  beforeSatelliteSlot,
  afterSummarySlot,
  appendSlot,
}: {
  runResult: PublicDiagnosticRunResult;
  brandName: string;
  trendData?: PublicDiagnosticTrendPoint[];
  /** Módulo AEO / satélite (mismo contenido que en vista legacy), entre KPIs y comparativa. */
  satelliteBlock?: ReactNode;
  /** Resumen de acceso de crawlers (J9), justo antes del bloque AEO satélite. */
  beforeSatelliteSlot?: ReactNode;
  /** Contenido extra inyectado justo después del resumen ejecutivo (ej: score por motor). */
  afterSummarySlot?: ReactNode;
  /** Contenido extra inyectado al final del reporte, manteniendo el mismo flujo (ej: roadmap, calculadora). */
  appendSlot?: ReactNode;
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

  const rawComparisonSummary = buildComparisonSummary(results);
  const competitorsUsed =
    runResult.competitors?.length > 0
      ? runResult.competitors
      : Array.from(new Set(rawComparisonSummary.filter((row) => row.type === 'competitor').map((row) => row.name)));
  const comparisonSummary = mergeConfiguredCompetitorsWithZeroShare(
    filterComparisonSummaryToTrackedParticipants(
      rawComparisonSummary,
      brandName,
      brandAliases,
      competitorsUsed,
    ),
    competitorsUsed,
    brandName,
    brandAliases,
  );
  const competitorUrlMap = new Map(
    (runResult.competitorDetails ?? [])
      .map((item) => [normalizeName(item.name || ''), item.domain ?? null] as const)
      .filter(([key]) => Boolean(key)),
  );
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

  const intentionPodiums = intentionKeysOrdered.map((intKey) => {
    const row = intentionMatrixPct[intKey]!;
    const ranked = Object.entries(row)
      .map(([name, pct]) => ({
        name,
        isBrand: isBrandEntry(name, brandName, brandAliases),
        pct: Math.round(pct),
      }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3);
    const brandEntry = Object.entries(row)
      .map(([name, pct]) => ({
        name,
        isBrand: isBrandEntry(name, brandName, brandAliases),
        pct: Math.round(pct),
      }))
      .find((e) => e.isBrand);
    const brandInPodium = ranked.some((e) => e.isBrand);
    return {
      key: intKey,
      label: INTENTION_LABELS[intKey] ?? intKey,
      podium: ranked,
      brandEntry: brandEntry ?? null,
      brandInPodium,
    };
  });

  const topCompetitors = comparisonSummary.map((row) => ({
    name: isBrandEntry(row.name, brandName, brandAliases) ? 'Tu marca' : row.name,
    sourceName: row.name,
    share: Number(row.share.toFixed(1)),
    isBrand: row.type === 'brand' || isBrandEntry(row.name, brandName, brandAliases),
  }));

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

  type ActionTone = 'critical' | 'warning' | 'opportunity' | 'positive';
  type ActionIcon = typeof LineChartIcon;
  type ActionCandidate = {
    id: string;
    title: string;
    desc: string;
    metric: string;
    Icon: ActionIcon;
    tone: ActionTone;
    priority: number;
  };

  const actions: ActionCandidate[] = [];

  if (!brandRow || !leaderRow || totalPrompts === 0) {
    actions.push(
      {
        id: 'sin-datos',
        title: 'Completar el diagnóstico',
        desc:
          totalPrompts === 0
            ? 'No se registraron resultados de prompts en esta corrida. Volvé a ejecutar el diagnóstico para recibir acciones personalizadas.'
            : 'Faltan señales para calcular ranking y brechas. Aumentá la cantidad de prompts o asegurate de que el Top 3 sea parseable.',
        metric: `${totalPrompts} prompts ejecutados`,
        Icon: LineChartIcon,
        tone: 'warning',
        priority: 100,
      },
      {
        id: 'definir-competidores',
        title: 'Definir competidores claros',
        desc:
          'Configurá una lista de competidores concreta en el diagnóstico para obtener una comparativa y ranking confiables.',
        metric: `${comparisonSummary.length} marcas detectadas`,
        Icon: Tag,
        tone: 'warning',
        priority: 80,
      },
      {
        id: 'revisar-formato',
        title: 'Revisar el formato de respuesta',
        desc:
          'Solo el Top 3 parseable habilita métricas de ranking. Ajustá el prompt del diagnóstico para obtener listas consistentes.',
        metric: `${formatConfidence}% de respuestas parseables`,
        Icon: Gauge,
        tone: 'warning',
        priority: 60,
      }
    );
  } else {
    const candidates: ActionCandidate[] = [];

    if (mentionRate < 40) {
      candidates.push({
        id: 'awareness',
        title: 'Reforzar awareness de marca',
        desc: `Solo el ${mentionRate}% de las respuestas te mencionan. Sumá señales de autoridad (PR digital, Wikipedia, reseñas verificadas) para que la IA te reconozca más seguido.`,
        metric: `Menciones: ${mentionCount}/${totalPrompts}`,
        Icon: Sparkle,
        tone: mentionRate < 20 ? 'critical' : 'warning',
        priority: 100 - mentionRate,
      });
    }

    if (top3Rate < 30) {
      candidates.push({
        id: 'top3',
        title: 'Entrar al Top 3 con más frecuencia',
        desc: `Aparecés en Top 3 en el ${top3Rate}% de los prompts. Generá contenido comparativo (listados, reviews, alternativas) para las intenciones donde la IA recomienda.`,
        metric: `Top 3: ${top3Count}/${totalPrompts}`,
        Icon: Medal,
        tone: top3Rate < 15 ? 'critical' : 'warning',
        priority: 95 - top3Rate,
      });
    } else if (top3Rate >= 30 && top3Rate < 60) {
      candidates.push({
        id: 'top3-consolidar',
        title: 'Consolidar presencia en Top 3',
        desc: `Ya aparecés en el ${top3Rate}% de los prompts: trabajá las intenciones donde aún no lográs entrar para llegar a ≥60%.`,
        metric: `Top 3: ${top3Count}/${totalPrompts}`,
        Icon: Medal,
        tone: 'opportunity',
        priority: 70 - (top3Rate - 30),
      });
    }

    if (!brandIsLeader && top1Rate < 10) {
      candidates.push({
        id: 'top1',
        title: `Disputar la posición #1`,
        desc: `Conseguís #1 solo en el ${top1Rate}% de los prompts. Para desbancar a ${leaderDisplay}, reforzá señales de autoridad donde la IA hoy lo prioriza.`,
        metric: `Posición #1: ${top1Count}/${totalPrompts}`,
        Icon: Trophy,
        tone: top1Rate === 0 ? 'critical' : 'warning',
        priority: 85 - top1Rate,
      });
    }

    if (!brandIsLeader && leaderRow) {
      const gap = Math.max(0, Math.round(leaderGapPts * 10) / 10);
      if (gap > 0) {
        candidates.push({
          id: 'gap-lider',
          title:
            gap < 5
              ? `Sobrepaso táctico a ${leaderDisplay}`
              : `Cerrar brecha con ${leaderDisplay}`,
          desc:
            gap < 5
              ? `Estás a solo ${gap} pts del líder en % Top 3. Refuerzos puntuales en ${weakestIntention?.label ?? 'tu intención más débil'} pueden cruzarlo en la próxima corrida.`
              : `Hay ${gap} pts de diferencia vs ${leaderDisplay} (${leaderRow.share.toFixed(1)}% Top 3). Priorizá contenido AEO en sus intenciones ganadoras para recortar distancia.`,
          metric: `Brecha: ${gap} pts`,
          Icon: TrendingUp,
          tone: gap < 5 ? 'opportunity' : gap > 15 ? 'critical' : 'warning',
          priority: 60 + Math.min(gap, 30),
        });
      }
    }

    if (brandIsLeader) {
      const runnerUp = comparisonSummary.find(
        (c) => !isBrandEntry(c.name, brandName, brandAliases)
      );
      const marginPts = runnerUp && brandRow ? Math.max(0, brandRow.share - runnerUp.share) : 0;
      candidates.push({
        id: 'defender',
        title: 'Defender el liderazgo',
        desc: runnerUp
          ? `Liderás con ${brandRow.share.toFixed(1)}% Top 3 · ${marginPts.toFixed(1)} pts sobre ${runnerUp.name}. Monitoreá trimestralmente y reforzá contenido en las intenciones donde se acerca.`
          : `Sostené la visibilidad que te ubica primero y monitoreá ingreso de nuevos competidores.`,
        metric: runnerUp ? `Ventaja: ${marginPts.toFixed(1)} pts` : 'Liderás la categoría',
        Icon: Trophy,
        tone: marginPts < 5 ? 'warning' : 'positive',
        priority: marginPts < 5 ? 85 : 40,
      });
    }

    if (weakestIntention && weakestIntention.score < 60) {
      const pct = Math.round(weakestIntention.score);
      const key = weakestIntention.key;
      const tacticas: Record<string, string> = {
        precio: 'Comunicá valor y costo-beneficio con comparativas claras, testimonios y casos de uso.',
        calidad: 'Publicá reseñas verificadas, certificaciones y resultados medibles de clientes.',
        urgencia: 'Sumá señales de disponibilidad inmediata, entrega y respuesta rápida.',
        consideracion: 'Producí contenidos comparativos vs. alternativas para la fase de evaluación.',
      };
      candidates.push({
        id: `weak-${key}`,
        title: `Reforzar ${weakestIntention.label}`,
        desc: `Tu peor desempeño es en ${weakestIntention.label} (${pct}%). ${tacticas[key] ?? 'Generá contenido específico que responda esa intención de búsqueda.'}`,
        metric: `${weakestIntention.label}: ${pct}%`,
        Icon: Target,
        tone: pct < 30 ? 'critical' : 'warning',
        priority: 80 - pct,
      });
    }

    const worstVsLeader = intentionChartRows
      .filter((r) => r.lider - r.tuMarca > 10)
      .sort((a, b) => (b.lider - b.tuMarca) - (a.lider - a.tuMarca))[0];
    if (worstVsLeader && !brandIsLeader) {
      const delta = worstVsLeader.lider - worstVsLeader.tuMarca;
      candidates.push({
        id: `gap-${worstVsLeader.intention}`,
        title: `Atacar "${worstVsLeader.intention}"`,
        desc: `En ${worstVsLeader.intention} la brecha con ${leaderDisplay} es de ${delta} pts (${worstVsLeader.tuMarca}% vs ${worstVsLeader.lider}%). Es la intención de mayor upside si producís contenido específico.`,
        metric: `Brecha intención: ${delta} pts`,
        Icon: Target,
        tone: delta > 25 ? 'critical' : 'warning',
        priority: 70 + Math.min(delta, 25),
      });
    }

    if (strongestIntention && strongestIntention.score >= 60) {
      const pct = Math.round(strongestIntention.score);
      candidates.push({
        id: `strong-${strongestIntention.key}`,
        title: `Capitalizar fuerza en ${strongestIntention.label}`,
        desc: `Rendís ${pct}% en ${strongestIntention.label}. Producí más contenido de ese eje y extendé el mensaje a intenciones adyacentes para escalar el Cleexs Score.`,
        metric: `${strongestIntention.label}: ${pct}%`,
        Icon: TrendingUp,
        tone: 'positive',
        priority: 45 + (pct - 60) / 2,
      });
    }

    if (formatConfidence < 60) {
      candidates.push({
        id: 'formato',
        title: 'Mejorar estructura de respuestas',
        desc: `Solo el ${formatConfidence}% del Top 3 fue parseable. Ajustá el prompt del diagnóstico para obtener listas consistentes y métricas más confiables.`,
        metric: `Formato: ${parseableCount}/${totalPrompts}`,
        Icon: Gauge,
        tone: formatConfidence < 40 ? 'critical' : 'warning',
        priority: 65 - formatConfidence,
      });
    }

    candidates.sort((a, b) => b.priority - a.priority);

    const picked: ActionCandidate[] = [];
    const usedKinds = new Set<string>();
    for (const c of candidates) {
      const kind = c.id.split('-')[0] ?? c.id;
      if (!usedKinds.has(kind) || picked.length < 2) {
        picked.push(c);
        usedKinds.add(kind);
      }
      if (picked.length === 3) break;
    }

    if (picked.length < 3) {
      const fallbacks: ActionCandidate[] = [
        {
          id: 'fallback-monitoreo',
          title: 'Monitoreo continuo',
          desc: `Programá corridas periódicas para detectar cambios en ${leaderDisplay} y nuevos competidores.`,
          metric: `${comparisonSummary.length} marcas en ranking`,
          Icon: Users,
          tone: 'opportunity',
          priority: 20,
        },
        {
          id: 'fallback-contenido',
          title: 'Plan de contenido AEO',
          desc: `Con Cleexs Score ${displayScore}, un plan de contenido dirigido a las intenciones clave acelera la subida del score.`,
          metric: `Score actual: ${displayScore}`,
          Icon: Tag,
          tone: 'opportunity',
          priority: 15,
        },
      ];
      for (const f of fallbacks) {
        if (picked.length >= 3) break;
        picked.push(f);
      }
    }

    actions.push(...picked.slice(0, 3));
  }

  const trendChartData =
    trendData && trendData.length > 0
      ? trendData
      : [{ label: 'Corrida 1', score: displayScore }];

  const intentionBarData =
    intentionScores.length > 0
      ? intentionScores.map((item) => ({
          name: item.label,
          score: Math.round(item.score),
        }))
      : [{ name: 'General', score: displayScore }];

  const vizGradBase = `${gaugeGradientId}-viz`;
  const intentionBarStops: [string, string][] = [
    ['#8b5cf6', '#6366f1'],
    ['#a855f7', '#ec4899'],
    ['#06b6d4', '#2563eb'],
    ['#14b8a6', '#059669'],
  ];

  const chartTooltipStyle = {
    borderRadius: 14,
    border: 'none',
    boxShadow: '0 12px 40px -12px rgb(15 23 42 / 0.25)',
    padding: '10px 14px',
    background: '#fff',
  } as const;

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
                    Orden por % en Top 3 ({topCompetitors.filter((c) => !c.isBrand).length} competidores)
                  </p>
                  {topCompetitors.length === 0 ? (
                    <p className="text-xs text-slate-500">Sin competidores suficientes en esta corrida.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {topCompetitors.map((c, idx) => (
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
                          {c.isBrand ? (
                            <span
                              className={cn(
                                'flex-1 truncate font-medium',
                                c.isBrand ? 'text-violet-700' : 'text-slate-700'
                              )}
                              title={c.name}
                            >
                              {c.name}
                            </span>
                          ) : (
                            <CompetitorNameLink
                              name={c.name}
                              url={competitorUrlMap.get(normalizeName(c.sourceName)) ?? undefined}
                              className="flex-1 truncate font-medium text-slate-700"
                            />
                          )}
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
            <div className="border-t border-slate-100 bg-gradient-to-br from-slate-50/80 via-white to-violet-50/30 p-3 sm:p-4 lg:border-t-0">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-slate-800">Desempeño por intención</p>
                  <p className="text-[10px] text-slate-500">% Top 3 · tu marca vs líder</p>
                </div>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-violet-100 ring-1 ring-violet-200">
                  <Target className="h-3.5 w-3.5 text-violet-600" aria-hidden />
                </span>
              </div>
              {intentionChartRows.length === 0 ? (
                <p className="text-[11px] text-slate-500">Sin datos suficientes por intención.</p>
              ) : (
                <ul className="space-y-2">
                  {intentionChartRows.slice(0, 4).map((row) => {
                    const brandPct = Math.max(0, Math.min(100, row.tuMarca));
                    const leaderPct = Math.max(0, Math.min(100, row.lider));
                    const leads = brandPct >= leaderPct;
                    return (
                      <li key={row.intention}>
                        <div className="mb-0.5 flex items-center justify-between gap-2">
                          <span className="truncate text-[11px] font-medium text-slate-700">{row.intention}</span>
                          <span className="flex items-baseline gap-1 tabular-nums">
                            <span className="text-[11px] font-bold text-violet-700">{brandPct}%</span>
                            <span className="text-[9px] text-slate-400">· líder {leaderPct}%</span>
                          </span>
                        </div>
                        <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-200/60">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-[width] duration-700"
                            style={{ width: `${brandPct}%` }}
                          />
                          {leaderPct > 0 && (
                            <div
                              className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-sm bg-slate-700/70 ring-1 ring-white"
                              style={{ left: `calc(${leaderPct}% - 1px)` }}
                              title={`Líder: ${leaderPct}%`}
                            />
                          )}
                        </div>
                        <p
                          className={cn(
                            'mt-0.5 text-[9.5px] font-medium',
                            leads ? 'text-emerald-600' : 'text-slate-500'
                          )}
                        >
                          {leads
                            ? brandPct === leaderPct
                              ? 'Empatás con el líder'
                              : `Superás al líder por ${brandPct - leaderPct} pts`
                            : `${leaderPct - brandPct} pts por detrás del líder`}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>

      {afterSummarySlot ? <div className="space-y-5">{afterSummarySlot}</div> : null}

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

      {beforeSatelliteSlot ?? null}

      {/* 3 Análisis técnico AEO (satélite) */}
      {satelliteBlock ? (
        <section>
          {sectionHeading(
            3,
            'Análisis técnico del sitio (AEO)',
            'Herramientas del sitio y acciones concretas según el análisis técnico (AEO).'
          )}
          <div className="mt-1">{satelliteBlock}</div>
        </section>
      ) : null}

      {/* 4 Comparativa principal */}
      <section>
        {sectionHeading(4, 'Comparativa principal')}
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm ring-1 ring-slate-100/60">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div>
                <p className="text-sm font-bold text-slate-900">Tu marca vs competidores</p>
                <p className="mt-0.5 text-[11px] text-slate-500">% de aparición en Top 3</p>
              </div>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-indigo-50 ring-1 ring-indigo-100">
                <Medal className="h-3.5 w-3.5 text-indigo-700" aria-hidden />
              </span>
            </div>
            {topCompetitors.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">Sin datos comparativos.</p>
            ) : (
              (() => {
                const maxShare = Math.max(...topCompetitors.map((c) => c.share), 1);
                return (
                  <ul className="mt-3 space-y-3">
                    {topCompetitors.map((c, idx) => {
                      const pct = (c.share / maxShare) * 100;
                      const rankStyles = [
                        'bg-amber-100 text-amber-700 ring-amber-200',
                        'bg-slate-100 text-slate-700 ring-slate-200',
                        'bg-orange-100 text-orange-700 ring-orange-200',
                      ];
                      return (
                        <li key={`comp-${idx}`}>
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className={cn(
                                  'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums ring-1',
                                  rankStyles[idx] ?? 'bg-slate-50 text-slate-500 ring-slate-200'
                                )}
                              >
                                {idx + 1}
                              </span>
                              {c.isBrand ? (
                                <span
                                  className={cn(
                                    'truncate text-xs font-semibold',
                                    c.isBrand ? 'text-indigo-700' : 'text-slate-700'
                                  )}
                                  title={c.name}
                                >
                                  {c.name}
                                </span>
                              ) : (
                                <CompetitorNameLink
                                  name={c.name}
                                  url={competitorUrlMap.get(normalizeName(c.sourceName)) ?? undefined}
                                  className="truncate text-xs font-semibold text-slate-700"
                                />
                              )}
                              {c.isBrand && (
                                <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-700 ring-1 ring-indigo-100">
                                  Tu marca
                                </span>
                              )}
                            </div>
                            <span
                              className={cn(
                                'shrink-0 text-sm font-bold tabular-nums',
                                c.isBrand ? 'text-indigo-700' : 'text-slate-800'
                              )}
                            >
                              {c.share.toFixed(1)}%
                            </span>
                          </div>
                          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={cn(
                                'h-full rounded-full transition-[width] duration-700',
                                c.isBrand
                                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-500'
                                  : 'bg-gradient-to-r from-slate-400 to-slate-300'
                              )}
                              style={{ width: `${Math.max(4, pct)}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                );
              })()
            )}
          </div>

          {(() => {
            const stages = [
              {
                key: 'prompts',
                label: 'Prompts analizados',
                count: totalPrompts,
                pct: totalPrompts > 0 ? 100 : 0,
                bg: 'from-slate-500 to-slate-600',
                ring: 'ring-slate-300/60',
                hint: 'Base del análisis',
              },
              {
                key: 'menciones',
                label: 'Menciones de marca',
                count: mentionCount,
                pct: mentionRate,
                bg: 'from-slate-600 to-slate-700',
                ring: 'ring-slate-400/50',
                hint: 'La IA te reconoce',
              },
              {
                key: 'top3',
                label: 'Aparición en Top 3',
                count: top3Count,
                pct: top3Rate,
                bg: 'from-indigo-700 to-indigo-800',
                ring: 'ring-indigo-300/60',
                hint: 'La IA te recomienda',
              },
              {
                key: 'top1',
                label: 'Posición #1',
                count: top1Count,
                pct: top1Rate,
                bg: 'from-indigo-900 to-slate-900',
                ring: 'ring-indigo-400/50',
                hint: 'Primera recomendación',
              },
            ];
            const maxWidth = 100;
            const minWidth = 38;
            return (
              <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm ring-1 ring-slate-100/60">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Funnel de presencia</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      De {totalPrompts} prompts hasta la recomendación #1
                    </p>
                  </div>
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 ring-1 ring-slate-200">
                    <TrendingUp className="h-3.5 w-3.5 text-slate-700" aria-hidden />
                  </span>
                </div>

                {totalPrompts === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">
                    Sin prompts analizados en esta corrida.
                  </p>
                ) : (
                  <div className="mt-3 space-y-1.5">
                    {stages.map((s, idx) => {
                      const pct = Math.max(0, Math.min(100, s.pct));
                      const width = minWidth + ((maxWidth - minWidth) * pct) / 100;
                      const prev = idx > 0 ? stages[idx - 1]! : null;
                      const dropPts = prev ? Math.max(0, Math.round(prev.pct - s.pct)) : 0;
                      return (
                        <div key={s.key}>
                          {prev && (
                            <div className="flex items-center justify-center py-0.5">
                              <div className="flex items-center gap-1 rounded-full bg-slate-50 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 ring-1 ring-slate-200">
                                <ChevronDown className="h-2.5 w-2.5" aria-hidden />
                                {dropPts > 0 ? `-${dropPts} pts` : 'se mantiene'}
                              </div>
                            </div>
                          )}
                          <div className="relative mx-auto" style={{ width: `${width}%` }}>
                            <div
                              className={cn(
                                'relative flex items-center justify-between gap-2 overflow-hidden rounded-lg bg-gradient-to-r px-2.5 py-2 text-white shadow-sm ring-1',
                                s.bg,
                                s.ring
                              )}
                            >
                              <div className="min-w-0">
                                <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-white/85">
                                  {s.label}
                                </p>
                                <p className="text-[9px] font-medium text-white/70">{s.hint}</p>
                              </div>
                              <div className="flex shrink-0 items-baseline gap-1 text-right">
                                <span className="text-base font-extrabold tabular-nums leading-none">
                                  {s.count}
                                </span>
                                <span className="text-[10px] font-semibold tabular-nums text-white/80">
                                  · {pct}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2.5">
                      <div className="rounded-md bg-slate-50/80 px-2 py-1.5 ring-1 ring-slate-100">
                        <p className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-500">
                          Conv. Menciones → Top 3
                        </p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
                          {mentionCount > 0 ? Math.round((top3Count / mentionCount) * 100) : 0}%
                        </p>
                      </div>
                      <div className="rounded-md bg-slate-50/80 px-2 py-1.5 ring-1 ring-slate-100">
                        <p className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-500">
                          Conv. Top 3 → #1
                        </p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
                          {top3Count > 0 ? Math.round((top1Count / top3Count) * 100) : 0}%
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </section>

      {/* 4 Métricas — siempre visibles */}
      <section>
        {sectionHeading(5, 'Métricas del análisis')}
        <p className="mb-3 text-xs text-slate-500">
          Cuatro señales clave calculadas sobre las respuestas de esta corrida.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(
            [
              {
                label: 'Confianza de formato',
                value: `${formatConfidence}%`,
                hint: `${parseableCount}/${totalPrompts} con Top 3 parseable`,
                icon: FileCheck,
                accent: 'from-violet-500 to-fuchsia-500',
                iconBg: 'bg-violet-500/10 text-violet-600',
              },
              {
                label: 'Mención de marca',
                value: `${mentionRate}%`,
                hint: `${mentionCount}/${totalPrompts} respuestas`,
                icon: Megaphone,
                accent: 'from-sky-500 to-cyan-500',
                iconBg: 'bg-sky-500/10 text-sky-600',
              },
              {
                label: 'Aparición en Top 3',
                value: `${top3Rate}%`,
                hint: `${top3Count}/${totalPrompts} en Top 3`,
                icon: ListOrdered,
                accent: 'from-amber-500 to-orange-500',
                iconBg: 'bg-amber-500/10 text-amber-700',
              },
              {
                label: 'Posición #1',
                value: `${top1Rate}%`,
                hint: `${top1Count}/${totalPrompts} en primer lugar`,
                icon: Trophy,
                accent: 'from-emerald-500 to-teal-500',
                iconBg: 'bg-emerald-500/10 text-emerald-700',
              },
            ] as const
          ).map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.label}
                className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-100/60 transition-shadow hover:shadow-md"
              >
                <div
                  className={cn('absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-90', m.accent)}
                  aria-hidden
                />
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{m.label}</p>
                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', m.iconBg)}>
                    <Icon className="h-4 w-4" strokeWidth={2} />
                  </div>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-slate-900">{m.value}</p>
                <p className="mt-1 text-xs leading-snug text-slate-500">{m.hint}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5 Visualizaciones — siempre visibles */}
      <section>
        {sectionHeading(6, 'Visualizaciones adicionales')}
        <p className="mb-3 text-xs text-slate-500">
          Tendencia del Cleexs Score y reparto medio por intención de búsqueda en esta corrida.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-100/60 transition-shadow hover:shadow-md">
            <div
              className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-indigo-500 to-sky-500 opacity-95"
              aria-hidden
            />
            <div className="flex items-start justify-between gap-3 px-4 pb-1 pt-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Tendencia</p>
                <p className="text-sm font-bold text-slate-900">Evolución del Cleexs Score</p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
                <LineChartIcon className="h-5 w-5" strokeWidth={2} aria-hidden />
              </div>
            </div>
            <div className="h-[176px] px-1 pb-4 sm:px-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendChartData} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
                  <defs>
                    <linearGradient id={`${vizGradBase}-line`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#7c3aed" />
                      <stop offset="55%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#38bdf8" />
                    </linearGradient>
                    <linearGradient id={`${vizGradBase}-area`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.22} />
                      <stop offset="70%" stopColor="#6366f1" stopOpacity={0.06} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="5 6" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }}
                    dy={8}
                  />
                  <YAxis
                    domain={[0, 100]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    width={38}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    labelStyle={{ color: '#64748b', fontSize: 11, fontWeight: 600 }}
                    formatter={(v: number) => [Math.round(v), 'Score']}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="none"
                    fill={`url(#${vizGradBase}-area)`}
                    fillOpacity={1}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke={`url(#${vizGradBase}-line)`}
                    strokeWidth={2.75}
                    dot={{
                      r: 5,
                      strokeWidth: 2,
                      stroke: '#fff',
                      fill: '#5b21b6',
                    }}
                    activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff', fill: '#4c1d95' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-100/60 transition-shadow hover:shadow-md">
            <div
              className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-fuchsia-500 via-violet-500 to-indigo-500 opacity-95"
              aria-hidden
            />
            <div className="flex items-start justify-between gap-3 px-4 pb-1 pt-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Intenciones</p>
                <p className="text-sm font-bold text-slate-900">Score por intención</p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
                <BarChart3 className="h-5 w-5" strokeWidth={2} aria-hidden />
              </div>
            </div>
            <div className="h-[176px] px-1 pb-4 sm:px-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={intentionBarData} margin={{ top: 10, right: 12, left: 0, bottom: 4 }} barCategoryGap="28%">
                  <defs>
                    {intentionBarData.map((_, i) => {
                      const [c0, c1] = intentionBarStops[i % intentionBarStops.length]!;
                      return (
                        <linearGradient key={i} id={`${vizGradBase}-bar-${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={c0} />
                          <stop offset="100%" stopColor={c1} />
                        </linearGradient>
                      );
                    })}
                  </defs>
                  <CartesianGrid strokeDasharray="5 6" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }}
                    dy={8}
                  />
                  <YAxis
                    domain={[0, 100]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    width={38}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    labelStyle={{ color: '#64748b', fontSize: 11, fontWeight: 600 }}
                    formatter={(v: number) => [`${v}%`, 'Score medio']}
                  />
                  <Bar dataKey="score" radius={[10, 10, 0, 0]} maxBarSize={52}>
                    {intentionBarData.map((_, index) => (
                      <Cell key={`bar-cell-${index}`} fill={`url(#${vizGradBase}-bar-${index})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {/* 6 Top 3 acciones */}
      <section>
        {sectionHeading(7, 'Top 3 acciones prioritarias', 'Acciones personalizadas según los resultados de esta corrida')}
        <div className="grid gap-3 md:grid-cols-3">
          {actions.slice(0, 3).map((action, idx) => {
            const AIcon = action.Icon;
            const toneStyles: Record<ActionTone, { badge: string; icon: string; bar: string; chip: string }> = {
              critical: {
                badge: 'Urgente',
                icon: 'bg-rose-50 text-rose-600 ring-1 ring-rose-100',
                bar: 'from-rose-500 to-red-500',
                chip: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
              },
              warning: {
                badge: 'Prioritario',
                icon: 'bg-amber-50 text-amber-600 ring-1 ring-amber-100',
                bar: 'from-amber-500 to-orange-500',
                chip: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
              },
              opportunity: {
                badge: 'Oportunidad',
                icon: 'bg-violet-50 text-violet-600 ring-1 ring-violet-100',
                bar: 'from-violet-500 to-fuchsia-500',
                chip: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
              },
              positive: {
                badge: 'Capitalizar',
                icon: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100',
                bar: 'from-emerald-500 to-teal-500',
                chip: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
              },
            };
            const t = toneStyles[action.tone];
            return (
              <div
                key={`${action.id}-${idx}`}
                className="relative overflow-hidden rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm ring-1 ring-slate-100/60"
              >
                <div className={cn('absolute inset-x-0 top-0 h-1 bg-gradient-to-r', t.bar)} />
                <div className="absolute right-2 top-2.5 text-lg font-black tabular-nums text-slate-100">
                  {idx + 1}
                </div>
                <div className="mb-2 flex items-center gap-2">
                  <div className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg', t.icon)}>
                    <AIcon className="h-4 w-4" strokeWidth={2} />
                  </div>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide',
                      t.chip
                    )}
                  >
                    {t.badge}
                  </span>
                </div>
                <p className="pr-7 text-sm font-bold text-slate-900">{action.title}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{action.desc}</p>
                <p className="mt-2 text-[10.5px] font-semibold tabular-nums text-slate-500">{action.metric}</p>
              </div>
            );
          })}
        </div>
      </section>

      {appendSlot ?? null}

      <p className="text-center text-[11px] italic leading-relaxed text-slate-400">
        La lectura pasa de análisis disperso a narrativa: estado actual → comparación → métricas → tendencias → acciones.
      </p>
    </div>
  );
}
