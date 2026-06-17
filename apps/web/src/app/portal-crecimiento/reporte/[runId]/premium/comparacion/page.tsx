'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  Gauge,
  GitCompareArrows,
  Info,
  LineChart,
  ListChecks,
  Medal,
  Rocket,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { PortalPremiumSidebarNav } from '@/components/portal/portal-premium-sidebar-nav';
import {
  DomainRatingPanel,
  DomainRatingTableCell,
  buildDomainRatingFromCompareRows,
} from '@/components/report/domain-rating-block';

const TOKEN_KEY = 'cleexs_portal_token';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ── Types ─────────────────────────────────────────────────────────────────────
type UsageResponse = {
  planKey?: string;
  planDisplay?: string;
  usage?: { scoreViews?: number };
  limits?: { scoreViews?: number | null };
};
type RunDetail = {
  id: string;
  brand: { id?: string; name: string; domain?: string | null };
  priaReports?: Array<{ priaTotal: number }>;
  promptResults: Array<{
    score: number;
    prompt?: { category?: { name?: string } | null };
  }>;
};
type ReportItem = {
  id: string;
  createdAt: string;
  score: number | null;
  brand: { id?: string; name: string };
};
type PanelRow = {
  rank: number;
  name: string;
  domain?: string | null;
  tag: 'mi_empresa' | 'competidor';
  score: number | null;
  domainRating?: number | null;
};
type PanelResponse = { compareRows: PanelRow[] };

// ── Helpers ───────────────────────────────────────────────────────────────────
function toPct(v: number | null | undefined) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return n <= 1 ? n * 100 : n;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const AVATAR_COLORS = ['bg-violet-500','bg-blue-500','bg-emerald-500','bg-amber-500','bg-rose-500','bg-indigo-500'];
function avatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]!; }
function initials(name: string) { return name.split(' ').slice(0,2).map(p=>p[0]?.toUpperCase()??'').join(''); }

// ── Sparkline SVG ──────────────────────────────────────────────────────────────
function TrendLine({ points, w = 200, h = 60 }: { points: number[]; w?: number; h?: number }) {
  if (points.length < 2) return <p className="text-xs text-slate-400 text-center">Sin datos suficientes</p>;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const xs = points.map((_, i) => (i / (points.length - 1)) * (w - 4) + 2);
  const ys = points.map(p => h - 4 - ((p - min) / range) * (h - 12));
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${ys[i]!.toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="tl-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.15"/>
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={`${d} L ${xs[xs.length-1]!.toFixed(1)} ${h} L 2 ${h} Z`} fill="url(#tl-grad)"/>
      <path d={d} fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={ys[i]!} r="3" fill="#7c3aed"/>
      ))}
    </svg>
  );
}

// ── Donut SVG ─────────────────────────────────────────────────────────────────
function DonutChart({ segments, total }: { segments: Array<{ label: string; count: number; color: string }>; total: number }) {
  const r = 40; const cx = 60; const cy = 60; const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox="0 0 120 120" className="h-32 w-32 shrink-0">
      {segments.map((seg, i) => {
        const dash = (seg.count / total) * circ;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={seg.color} strokeWidth="18"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        );
        offset += dash;
        return el;
      })}
      <text x={cx} y={cy-4} textAnchor="middle" fontSize="16" fontWeight="700" fill="#1e293b">{total}</text>
      <text x={cx} y={cy+10} textAnchor="middle" fontSize="8" fill="#64748b">intenciones</text>
    </svg>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({ icon: Icon, label, value, sub, subColor }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; sub?: string; subColor?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-1.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-100">
          <Icon className="h-3 w-3 text-violet-700"/>
        </span>
        <p className="text-[10px] font-semibold text-slate-500">{label}</p>
      </div>
      <p className="mt-1.5 text-xl font-bold text-slate-900 leading-none">{value}</p>
      {sub && <p className={`mt-0.5 text-[10px] ${subColor ?? 'text-slate-500'}`}>{sub}</p>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ComparacionPage() {
  const params = useParams();
  const runId = params.runId as string;
  const basePath = `/portal-crecimiento/reporte/${runId}/premium`;

  const [run, setRun] = useState<RunDetail | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [panel, setPanel] = useState<PanelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let token: string | null = null;
        try { token = sessionStorage.getItem(TOKEN_KEY); } catch { token = null; }
        if (!token) { setLoadError('No hay sesión. Volvé al portal e iniciá sesión.'); setLoading(false); return; }
        const headers = { Authorization: `Bearer ${token}` };
        const [runRes, usageRes] = await Promise.all([
          fetch(`${API_URL}/api/reports/app/reports/${encodeURIComponent(runId)}`, { cache: 'no-store', headers }),
          fetch(`${API_URL}/api/me/usage`, { cache: 'no-store', headers }),
        ]);
        if (runRes.status === 401 || usageRes.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
          setLoadError('Sesión vencida. Volvé al portal e iniciá sesión.');
          setLoading(false); return;
        }
        const runData = runRes.ok ? (await runRes.json() as RunDetail) : null;
        const usageData = usageRes.ok ? (await usageRes.json() as UsageResponse) : {};
        const brandId = runData?.brand?.id;
        const [reportsRes, panelRes] = await Promise.all([
          fetch(`${API_URL}/api/reports/app/reports`, { cache: 'no-store', headers }),
          brandId ? fetch(`${API_URL}/api/reports/app/portal-panel?brandId=${encodeURIComponent(brandId)}`, { cache: 'no-store', headers }) : Promise.resolve(null),
        ]);
        const reportsData = reportsRes.ok ? (await reportsRes.json() as ReportItem[]) : [];
        const panelData = panelRes?.ok ? (await panelRes.json() as PanelResponse) : null;
        if (!cancelled) { setRun(runData); setUsage(usageData); setReports(Array.isArray(reportsData) ? reportsData : []); setPanel(panelData); setLoading(false); }
      } catch (e) { if (!cancelled) { setLoadError(e instanceof Error ? e.message : 'Error al cargar'); setLoading(false); } }
    })();
    return () => { cancelled = true; };
  }, [runId]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const brandReports = useMemo(() => {
    if (!run) return [];
    return [...reports]
      .filter(r => r.brand?.id && run.brand.id ? r.brand.id === run.brand.id : r.brand.name === run.brand.name)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [reports, run]);

  const latestReport = brandReports[0] ?? null;
  const previousReports = brandReports.filter(r => r.id !== runId);
  const previousComparable = previousReports.find(r => r.score != null) ?? null;

  const cleexsHint = run?.priaReports?.[0]?.priaTotal ?? null;
  const currentScore = Math.round(cleexsHint ?? toPct(latestReport?.score ?? null));
  const prevScore = previousComparable ? Math.round(toPct(previousComparable.score)) : null;
  const delta = prevScore != null ? Math.round((currentScore - prevScore) * 10) / 10 : null;
  const deltaPct = prevScore != null && prevScore > 0 ? Math.round(((currentScore - prevScore) / prevScore) * 1000) / 10 : null;

  const compareRows = panel?.compareRows ?? [];
  const miEmpresaRow = compareRows.find(r => r.tag === 'mi_empresa') ?? null;
  const competitorRows = compareRows.filter(r => r.tag === 'competidor');
  const rank = miEmpresaRow?.rank ?? null;
  const compScores = competitorRows.filter(c => c.score != null).map(c => Number(c.score));
  const leaderScore = compScores.length ? Math.max(...compScores) : null;
  const gapVsLeader = leaderScore != null ? Math.round((currentScore - leaderScore) * 10) / 10 : null;
  const domainRatingSnapshot = useMemo(
    () => buildDomainRatingFromCompareRows(compareRows),
    [compareRows]
  );
  const showDrColumn = compareRows.some((r) => r.domainRating != null);

  // Trend points (últimas 6 corridas con score)
  const trendPoints = useMemo(() =>
    [...brandReports].filter(r => r.score != null).sort((a,b) => +new Date(a.createdAt) - +new Date(b.createdAt)).slice(-6).map(r => Math.round(toPct(r.score))),
    [brandReports]);

  // Trend labels
  const trendLabels = useMemo(() =>
    [...brandReports].filter(r => r.score != null).sort((a,b) => +new Date(a.createdAt) - +new Date(b.createdAt)).slice(-6).map(r => fmtDate(r.createdAt)),
    [brandReports]);

  // Prompts
  const prompts = run?.promptResults ?? [];
  const promptScores = prompts.map(p => toPct(p.score));
  const avgPrompt = promptScores.length ? Math.round(promptScores.reduce((a,b) => a+b,0) / promptScores.length) : currentScore;

  // Categorías
  const catMap: Record<string, number[]> = {};
  prompts.forEach(p => {
    const cat = p.prompt?.category?.name ?? 'General';
    if (!catMap[cat]) catMap[cat] = [];
    catMap[cat]!.push(toPct(p.score));
  });
  const catStats = Object.entries(catMap)
    .map(([k,v]) => ({ label: k, avg: Math.round(v.reduce((a,b)=>a+b,0)/v.length), count: v.length }))
    .sort((a,b) => b.avg - a.avg);
  const bestCat = catStats[0] ?? null;

  // Distribución de desempeño (donut)
  const excelente = promptScores.filter(s => s >= 80).length;
  const bueno = promptScores.filter(s => s >= 60 && s < 80).length;
  const regular = promptScores.filter(s => s >= 40 && s < 60).length;
  const bajo = promptScores.filter(s => s < 40).length;
  const donutSegments = [
    { label: 'Excelente (80-100)', count: excelente, color: '#7c3aed' },
    { label: 'Bueno (60-79)', count: bueno, color: '#60a5fa' },
    { label: 'Regular (40-59)', count: regular, color: '#fbbf24' },
    { label: 'Bajo (0-39)', count: bajo, color: '#f87171' },
  ].filter(s => s.count > 0);
  const totalPrompts = prompts.length;

  // Auto-insights
  const insights: Array<{ icon: React.ComponentType<{className?:string}>; text: string; detail: string; badge: string; badgeColor: string }> = [];
  if (delta != null && delta > 0) insights.push({ icon: TrendingUp, text: `Mejoraste tu score en +${delta} puntos respecto a la última corrida.`, detail: 'Tu visibilidad en IA sigue en aumento.', badge: 'Positivo', badgeColor: 'bg-emerald-100 text-emerald-700' });
  if (rank === 1) insights.push({ icon: Star, text: 'Sos líder del grupo por posición actual.', detail: 'Mantené tu ventaja frente a la competencia.', badge: 'Destacado', badgeColor: 'bg-violet-100 text-violet-700' });
  if (bestCat) insights.push({ icon: Sparkles, text: `La intención "${bestCat.label}" es tu punto más fuerte con ${bestCat.avg}% de aparición.`, detail: 'Seguí potenciando este diferencial.', badge: 'Oportunidad', badgeColor: 'bg-amber-100 text-amber-700' });

  if (loadError) return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm text-rose-700">{loadError}</p>
        <Link href="/portal-crecimiento" className="mt-4 inline-block text-xs font-semibold text-violet-700 hover:underline">← Volver al portal</Link>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen bg-slate-50 p-3 sm:p-5">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[280px_1fr]">

        <PortalPremiumSidebarNav runId={runId} usage={usage} loadingPlan={loading} />

        {/* ── Contenido ────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-4">

          {/* Header */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-slate-900">Comparación</h1>
                <p className="mt-0.5 text-xs text-slate-500">Evolución frente a tu última corrida con score y posición relativa frente al grupo.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {latestReport && (
                  <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
                    <CalendarDays className="h-3.5 w-3.5 text-slate-400"/>
                    Última corrida: {fmtDate(latestReport.createdAt)}
                  </div>
                )}
                {previousComparable && (
                  <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
                    <GitCompareArrows className="h-3.5 w-3.5 text-slate-400"/>
                    Comparar con: {fmtDate(previousComparable.createdAt)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
              <p className="text-sm text-slate-400">Cargando datos…</p>
            </div>
          ) : (
            <>
              {/* ── Fila superior: 4 tarjetas ── */}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {/* Corrida actual */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[10px] font-semibold text-slate-500">Corrida actual</p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <p className="text-4xl font-bold text-slate-900">{currentScore || '—'}</p>
                    {delta != null && delta > 0 && (
                      <span className="flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        <TrendingUp className="h-3 w-3"/> +{delta} pts
                      </span>
                    )}
                  </div>
                  {latestReport && <p className="mt-1 text-[10px] text-slate-400">{fmtDateTime(latestReport.createdAt)}</p>}
                </div>

                {/* Corrida anterior */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[10px] font-semibold text-slate-500">Corrida anterior</p>
                  {previousComparable ? (
                    <>
                      <p className="mt-1 text-4xl font-bold text-slate-900">{prevScore}</p>
                      <p className="mt-1 text-[10px] text-slate-400">{fmtDateTime(previousComparable.createdAt)}</p>
                    </>
                  ) : <p className="mt-2 text-sm text-slate-400">Sin corrida anterior</p>}
                </div>

                {/* Diferencia */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[10px] font-semibold text-slate-500">Diferencia</p>
                  <p className={`mt-1 text-4xl font-bold ${delta == null ? 'text-slate-400' : delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta}`}
                  </p>
                  {deltaPct != null && (
                    <p className="mt-1 text-[10px] text-slate-400">{deltaPct > 0 ? '+' : ''}{deltaPct}% vs corrida anterior</p>
                  )}
                </div>

                {/* Tendencia */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-1">
                    <p className="text-[10px] font-semibold text-slate-500">Tendencia ({trendPoints.length} corridas)</p>
                    <Info className="h-3 w-3 text-slate-300"/>
                  </div>
                  <div className="mt-2 h-14">
                    {trendPoints.length >= 2 ? (
                      <TrendLine points={trendPoints} w={180} h={56}/>
                    ) : (
                      <p className="text-xs text-slate-400">Sin datos suficientes</p>
                    )}
                  </div>
                  {trendLabels.length >= 2 && (
                    <div className="mt-1 flex justify-between text-[9px] text-slate-400">
                      <span>{trendLabels[0]}</span>
                      <span>{trendLabels[trendLabels.length-1]}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Métricas ── */}
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 xl:grid-cols-7">
                <MetricCard icon={Gauge} label="Cleexs Score" value={currentScore ? String(currentScore) : '—'} sub={currentScore >= 80 ? 'Nivel excelente' : currentScore > 0 ? 'Nivel medio' : undefined} subColor="text-emerald-600"/>
                <MetricCard icon={Medal} label="Ranking" value={rank ? `#${rank}` : '—'} sub={`de ${compareRows.length || 1} marcas`}/>
                <MetricCard icon={ListChecks} label="Reportes generados" value={String(brandReports.length)} sub="Historial total"/>
                <MetricCard icon={BarChart3} label="Promedio desempeño" value={promptScores.length ? `${avgPrompt}%` : '—'} sub="Sobre todas las intenciones"/>
                <MetricCard icon={LineChart} label="Brecha vs líder" value={gapVsLeader == null ? '—' : `${gapVsLeader > 0 ? '+' : ''}${gapVsLeader}`} sub={gapVsLeader == null ? 'Sin datos' : gapVsLeader >= 0 ? 'Líder del grupo' : 'Debajo del líder'} subColor={gapVsLeader != null && gapVsLeader >= 0 ? 'text-emerald-600' : undefined}/>
                <MetricCard icon={Rocket} label="Mejor intención" value={bestCat?.label ?? '—'} sub={bestCat ? `${bestCat.avg}% de aparición` : undefined}/>
                <MetricCard icon={Zap} label="Intenciones evaluadas" value={String(totalPrompts)} sub={`${catStats.length} categorías`}/>
              </div>

              {domainRatingSnapshot ? (
                <DomainRatingPanel data={domainRatingSnapshot} />
              ) : null}

              {/* ── Fila inferior ── */}
              <div className="grid gap-4 xl:grid-cols-[1fr_1fr_auto]">

                {/* Ranking del panel */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-1.5">
                    <p className="text-xs font-bold text-slate-900">Ranking del panel</p>
                    <Info className="h-3.5 w-3.5 text-slate-300"/>
                  </div>
                  {compareRows.length === 0 ? (
                    <p className="text-xs text-slate-400">Sin datos del panel.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[340px] text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            <th className="pb-2 text-left">#</th>
                            <th className="pb-2 text-left">Marca</th>
                            <th className="pb-2 text-right">Score actual</th>
                            {showDrColumn ? <th className="pb-2 text-right">DR</th> : null}
                          </tr>
                        </thead>
                        <tbody>
                          {[...compareRows].sort((a,b) => a.rank - b.rank).map(row => (
                            <tr key={`${row.rank}-${row.name}`} className="border-t border-slate-50">
                              <td className="py-2 font-medium text-slate-600">{row.rank}</td>
                              <td className="py-2">
                                <div className="flex items-center gap-2">
                                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${avatarColor(row.name)}`}>
                                    {initials(row.name)}
                                  </span>
                                  <span className="font-medium text-slate-900">{row.name}</span>
                                  {row.tag === 'mi_empresa' && (
                                    <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700">Tu marca</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 text-right font-bold text-slate-900">
                                {row.score == null ? '—' : Math.round(Number(row.score))}
                              </td>
                              {showDrColumn ? <DomainRatingTableCell rating={row.domainRating} /> : null}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <Link href={`/portal-crecimiento/reporte/${runId}`} className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 hover:underline">
                    Ver ranking histórico completo →
                  </Link>
                </div>

                {/* Distribución de scores */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-1.5">
                    <p className="text-xs font-bold text-slate-900">Distribución de scores</p>
                    <Info className="h-3.5 w-3.5 text-slate-300"/>
                  </div>
                  {compareRows.length === 0 ? (
                    <p className="text-xs text-slate-400">Sin datos del panel.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {[...compareRows].sort((a,b) => a.rank - b.rank).map(row => {
                        const s = row.score == null ? 0 : Math.round(Number(row.score));
                        const pct = Math.min(100, Math.max(2, s));
                        const isMe = row.tag === 'mi_empresa';
                        return (
                          <div key={`bar-${row.rank}-${row.name}`}>
                            <div className="mb-1 flex items-center justify-between text-[11px]">
                              <span className={`font-medium ${isMe ? 'text-violet-700' : 'text-slate-700'}`}>
                                {row.name}{isMe ? ' (Tú)' : ''}
                              </span>
                              <span className="font-bold text-slate-900">{s}</span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full ${isMe ? 'bg-violet-500' : 'bg-slate-300'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Intenciones por desempeño */}
                {totalPrompts > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center gap-1.5">
                      <p className="text-xs font-bold text-slate-900">Intenciones por desempeño</p>
                      <Info className="h-3.5 w-3.5 text-slate-300"/>
                    </div>
                    <div className="flex flex-col items-center gap-3 sm:flex-row xl:flex-col">
                      <DonutChart segments={donutSegments} total={totalPrompts}/>
                      <ul className="space-y-1.5 text-[11px]">
                        {donutSegments.map(seg => (
                          <li key={seg.label} className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: seg.color }}/>
                            <span className="text-slate-600">{seg.label}</span>
                            <span className="ml-auto font-bold text-slate-900">{seg.count}</span>
                            <span className="text-slate-400">({Math.round((seg.count/totalPrompts)*100)}%)</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <Link href={`${basePath}/prompts`} className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 hover:underline">
                      Ver detalle por intención →
                    </Link>
                  </div>
                )}
              </div>

              {/* ── Insights + ver informe ── */}
              <div className="grid gap-4 xl:grid-cols-2">

                {/* Insights principales */}
                {insights.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="mb-3 text-xs font-bold text-slate-900">Insights principales</p>
                    <ul className="space-y-3">
                      {insights.map((ins, i) => (
                        <li key={i} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100">
                            <ins.icon className="h-4 w-4 text-violet-700"/>
                          </span>
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-slate-900">{ins.text}</p>
                            <p className="mt-0.5 text-[11px] text-slate-500">{ins.detail}</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ins.badgeColor}`}>
                            {ins.badge}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Profundizá en la comparación */}
                <div className="flex flex-col justify-between rounded-2xl border border-violet-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100">
                      <Users className="h-5 w-5 text-violet-700"/>
                    </span>
                    <div>
                      <p className="font-bold text-slate-900">Profundizá en la comparación</p>
                      <p className="mt-0.5 text-xs text-slate-500">Accedé al informe completo con Top 3, funnel y anexo por prompt.</p>
                    </div>
                  </div>
                  <Link
                    href={`/portal-crecimiento/reporte/${runId}`}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
                  >
                    Ver informe completo →
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
