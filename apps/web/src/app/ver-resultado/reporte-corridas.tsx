'use client';

import { Card, CardContent } from '@/components/ui/card';
import type {
  PublicDiagnosticRunResult,
  PublicDiagnosticPromptResult,
  PublicDiagnosticTrendPoint,
} from '@/lib/api';
import {
  ArrowUpRight,
  BarChart3,
  Gauge,
  Medal,
  Share2,
  Target,
  TrendingUp,
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

function scoreTone(score: number) {
  if (score >= 70) return 'text-emerald-600';
  if (score >= 45) return 'text-amber-600';
  return 'text-red-500';
}

function sectionHeading(num: number, title: string, subtitle?: string) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
        {num}
      </span>
      <div>
        <p className="text-xl font-semibold text-slate-900">{title}</p>
        {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
      </div>
    </div>
  );
}

function GaugeSimple({ value }: { value: number }) {
  const safe = Math.min(100, Math.max(0, value));
  const r = 54;
  const cx = 62;
  const cy = 62;
  const circumference = Math.PI * r;
  const offset = circumference - (safe / 100) * circumference;
  const stroke = safe >= 70 ? '#34d399' : safe >= 45 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative h-[120px] w-[124px]">
      <svg width="124" height="124" viewBox="0 0 124 124">
        <path
          d={`M 8 ${cy} A ${r} ${r} 0 0 1 116 ${cy}`}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d={`M 8 ${cy} A ${r} ${r} 0 0 1 116 ${cy}`}
          fill="none"
          stroke={stroke}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <p className="text-5xl font-bold leading-none text-slate-900">{Math.round(safe)}</p>
      </div>
    </div>
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

  const comparisonSummary = buildComparisonSummary(results);
  const brandRow =
    comparisonSummary.find(
      (row) => row.type === 'brand' || isBrandEntry(row.name, brandName, brandAliases)
    ) || null;
  const leaderRow = comparisonSummary[0] || null;
  const leaderGap = leaderRow && brandRow ? leaderRow.share - brandRow.share : 0;

  const strongestIntention = [...intentionScores].sort((a, b) => b.score - a.score)[0];
  const topCompetitors = comparisonSummary.slice(0, 5).map((row) => ({
    name: isBrandEntry(row.name, brandName, brandAliases) ? 'Tu marca' : row.name,
    share: Number(row.share.toFixed(1)),
    isBrand: row.type === 'brand' || isBrandEntry(row.name, brandName, brandAliases),
  }));

  const intentionChart = intentionScores.slice(0, 4).map((item) => {
    const leaderByIntention = comparisonSummary.find((row) => row.type === 'competitor')?.share ?? 0;
    return {
      intention: item.label,
      tuMarca: Number(item.score.toFixed(0)),
      lider: Number(Math.min(100, Math.max(0, leaderByIntention)).toFixed(0)),
    };
  });

  const kpis = [
    {
      label: 'Cleexs Score',
      value: Math.round(cleexsScore),
      sub: `Nivel ${cleexsScore >= 70 ? 'alto' : cleexsScore >= 45 ? 'medio' : 'bajo'}`,
      icon: Gauge,
    },
    {
      label: 'Ranking',
      value: brandRow ? `#${Math.max(1, comparisonSummary.indexOf(brandRow) + 1)}` : '—',
      sub: `de ${Math.max(comparisonSummary.length, 1)} marcas`,
      icon: Medal,
    },
    {
      label: 'Brecha vs líder',
      value: leaderRow && brandRow ? `${leaderGap.toFixed(1)} pts` : '—',
      sub: leaderRow ? `vs ${leaderRow.name} (${leaderRow.share.toFixed(1)}%)` : 'Sin líder',
      icon: TrendingUp,
    },
    {
      label: 'Mejor intención',
      value: strongestIntention ? `${strongestIntention.label} ${Math.round(strongestIntention.score)}%` : '—',
      sub: 'Mayor fortaleza',
      icon: Target,
    },
  ];

  const actions: Array<{ title: string; desc: string }> = [];
  if (!brandRow || !leaderRow) {
    actions.push({
      title: 'Completar corrida',
      desc: 'No hay datos suficientes para comparar. Ejecuta más prompts para obtener ranking y acciones.',
    });
  } else {
    actions.push({
      title: leaderGap > 8 ? 'Mejorar posición #1' : 'Consolidar liderazgo',
      desc:
        leaderGap > 8
          ? 'Aumenta tu visibilidad en respuestas donde hoy domina el líder.'
          : 'Defiende el posicionamiento actual con foco en consistencia y claridad de marca.',
    });
    actions.push({
      title: top1Rate < 45 ? 'Subir tasa de #1' : 'Mantener top 1',
      desc:
        top1Rate < 45
          ? 'Optimiza activos para que la IA te recomiende primero en más consultas.'
          : 'Sostén las señales que hoy te ubican primero en los prompts clave.',
    });
    actions.push({
      title: strongestIntention ? `Reforzar ${strongestIntention.label.toLowerCase()}` : 'Reforzar intención más débil',
      desc: 'Prioriza contenido y señales de autoridad en la intención con mayor oportunidad de mejora.',
    });
  }

  return (
    <div className="space-y-7">
      <section>
        {sectionHeading(1, 'Resumen ejecutivo')}
        <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="grid gap-4 p-4 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500">Cleexs Score</p>
              <p className={`text-3xl font-bold ${scoreTone(cleexsScore)}`}>{Math.round(cleexsScore)}</p>
              <p className="mt-1 text-sm text-slate-600">
                {brandRow
                  ? `#${comparisonSummary.indexOf(brandRow) + 1} en ranking · líder: ${leaderRow?.name ?? '-'}`
                  : 'Sin ranking disponible'}
              </p>
            </div>
            <div className="flex items-center justify-center rounded-xl border border-slate-200 p-2">
              <div className="text-center">
                <p className="mb-1 text-sm font-medium text-slate-600">Cleexs Score</p>
                <GaugeSimple value={cleexsScore} />
                <p className="text-xs text-slate-500">Indicador 0-100 de recomendación en IA</p>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="mb-1 text-sm font-medium text-slate-600">Tendencia</p>
              <ResponsiveContainer width="100%" height={130}>
                <LineChart data={trendData && trendData.length > 0 ? trendData : [{ label: 'Corrida 1', score: Math.round(cleexsScore) }]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [Math.round(v), 'Score']} />
                  <Line dataKey="score" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        {sectionHeading(2, 'KPIs clave')}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.label} className="rounded-xl border border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center gap-2 text-slate-500">
                    <Icon className="h-4 w-4" />
                    <p className="text-sm">{kpi.label}</p>
                  </div>
                  <p className="text-3xl font-bold text-slate-900">{kpi.value}</p>
                  <p className="text-sm text-slate-500">{kpi.sub}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        {sectionHeading(3, 'Comparativa principal')}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="rounded-xl border border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <p className="mb-3 text-sm font-medium text-slate-700">Tu marca vs competidores</p>
              {topCompetitors.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topCompetitors} layout="vertical" margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => [`${v}%`, '% Top 3']} />
                    <Bar dataKey="share" radius={[0, 6, 6, 0]}>
                      {topCompetitors.map((entry, idx) => (
                        <Cell key={idx} fill={entry.isBrand ? '#2563eb' : '#94a3b8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-500">Sin datos comparativos.</p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <p className="mb-3 text-sm font-medium text-slate-700">Por intención</p>
              {intentionChart.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={intentionChart} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="intention" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [`${v}%`, '']} />
                    <Legend />
                    <Bar dataKey="tuMarca" name="Tu marca" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="lider" name="Líder" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-500">Sin datos por intención.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        {sectionHeading(4, 'Top 3 acciones prioritarias', 'Acciones sugeridas para mejorar tu Cleexs Score')}
        <Card className="rounded-xl border border-slate-200 shadow-sm">
          <CardContent className="grid gap-3 p-4 md:grid-cols-3">
            {actions.slice(0, 3).map((action, idx) => (
              <div key={action.title} className="rounded-lg border border-slate-200 p-3">
                <p className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">
                  {idx + 1}
                </p>
                <p className="font-semibold text-slate-900">{action.title}</p>
                <p className="mt-1 text-sm text-slate-600">{action.desc}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section>
        {sectionHeading(5, 'Métricas del análisis')}
        <details className="group rounded-xl border border-slate-200 bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-slate-700">
            Ver métricas detalladas
            <span className="text-slate-400 group-open:rotate-180 transition-transform">⌄</span>
          </summary>
          <div className="grid gap-3 border-t border-slate-100 p-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Confianza de formato</p>
              <p className="text-2xl font-bold text-slate-900">{formatConfidence}%</p>
              <p className="text-xs text-slate-500">{parseableCount}/{totalPrompts} parseables</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Mención de marca</p>
              <p className="text-2xl font-bold text-slate-900">{mentionRate}%</p>
              <p className="text-xs text-slate-500">{mentionCount}/{totalPrompts} respuestas</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Aparición Top 3</p>
              <p className="text-2xl font-bold text-slate-900">{top3Rate}%</p>
              <p className="text-xs text-slate-500">{top3Count}/{totalPrompts} en Top 3</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Posición #1</p>
              <p className="text-2xl font-bold text-slate-900">{top1Rate}%</p>
              <p className="text-xs text-slate-500">{top1Count}/{totalPrompts} primero</p>
            </div>
          </div>
        </details>
      </section>

      <section>
        {sectionHeading(6, 'Visualizaciones adicionales')}
        <details className="group rounded-xl border border-slate-200 bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-slate-700">
            Ver visualizaciones extendidas
            <span className="text-slate-400 group-open:rotate-180 transition-transform">⌄</span>
          </summary>
          <div className="grid gap-4 border-t border-slate-100 p-4 lg:grid-cols-2">
            <Card className="rounded-lg border border-slate-200 shadow-none">
              <CardContent className="p-3">
                <p className="mb-2 text-sm font-medium text-slate-700">Evolución de score</p>
                <ResponsiveContainer width="100%" height={190}>
                  <LineChart data={trendData && trendData.length > 0 ? trendData : [{ label: 'Corrida 1', score: Math.round(cleexsScore) }]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [Math.round(v), 'Score']} />
                    <Line dataKey="score" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="rounded-lg border border-slate-200 shadow-none">
              <CardContent className="p-3">
                <p className="mb-2 text-sm font-medium text-slate-700">Distribución por intención</p>
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart
                    data={
                      intentionScores.length > 0
                        ? intentionScores.map((item) => ({
                            name: item.label,
                            score: Number(item.score.toFixed(0)),
                          }))
                        : [{ name: 'General', score: Math.round(cleexsScore) }]
                    }
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [`${v}%`, '']} />
                    <Bar dataKey="score" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </details>
      </section>

      <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/60 p-3 text-xs text-slate-600">
        <p className="flex items-center gap-2">
          <Share2 className="h-4 w-4 text-violet-600" />
          La lectura pasa de análisis disperso a narrativa: estado actual → comparación → acciones → difusión.
          <ArrowUpRight className="h-4 w-4 text-violet-600" />
        </p>
      </div>
    </div>
  );
}
