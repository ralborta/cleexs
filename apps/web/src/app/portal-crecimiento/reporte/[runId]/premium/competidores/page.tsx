'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Download,
  ExternalLink,
  Eye,
  Info,
  RefreshCw,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CleexsMark } from '@/components/brand/cleexs-mark';

const TOKEN_KEY = 'cleexs_portal_token';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type UsageResponse = { planKey?: string; planDisplay?: string };

type Top3Entry = { position?: number; name?: string; type?: string };

type ReportItem = {
  id: string;
  status: string;
  createdAt: string;
  score: number | null;
  brand: { id?: string; name: string };
};

type CompetitorBrief = { id: string; name: string; domain?: string | null };

type ExpandedRun = {
  id: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  modelMeta?: unknown;
  brand: {
    id?: string;
    name: string;
    domain?: string | null;
    competitors: CompetitorBrief[];
    aliases?: Array<{ id: string; alias: string }>;
  };
  promptResults: Array<{ top3Json: unknown }>;
  priaReports: Array<{ priaTotal: number }>;
};

type ComparisonRow = {
  name: string;
  type: string;
  appearances: number;
  averagePosition: number;
  share: number;
};

/** Fila ordenada tipo panel (solo tu marca + competidores configurados) */
type RankRow = {
  normKey: string;
  rank: number;
  name: string;
  domain: string | null;
  isMine: boolean;
  score: number | null;
  avgTop3Pos: number | null;
  /** % de prompts donde apareció en Top 3 */
  top3AppearPct: number;
  promptsEvaluatedLabel: string;
  top3PromptHits: number;
};

type HistorySnap = {
  runId: string;
  createdAt: string;
  /** normalizado nombre → Cleexs score (-100 display) */
  scores: Record<string, number | null>;
  top3Pct: Record<string, number>;
};

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesRowTop3(entryNameRaw: string, rowDisplayName: string): boolean {
  const e = normalizeName(entryNameRaw);
  const n = normalizeName(rowDisplayName);
  if (!e || !n) return false;
  if (e === n) return true;
  if (e.includes(n)) return n.length >= 4;
  if (n.includes(e)) return e.length >= 4;
  return false;
}

function displayScore(score: number | null | undefined): number | null {
  if (score == null || !Number.isFinite(Number(score))) return null;
  const v = Number(score);
  const pct = v <= 1 ? v * 100 : v;
  return Math.round(pct);
}

function fmtDateTime(iso: string | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Nivel visual alineado al mockup */
function niveLabel(score: number | null): { text: string; className: string } {
  if (score == null) return { text: 'Sin dato', className: 'bg-slate-100 text-slate-600 border-slate-200' };
  if (score >= 80) return { text: 'Nivel excelente', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
  if (score >= 65) return { text: 'Nivel alto', className: 'bg-teal-50 text-teal-800 border-teal-200' };
  if (score >= 50) return { text: 'Nivel medio', className: 'bg-amber-50 text-amber-900 border-amber-200' };
  return { text: 'Por mejorar', className: 'bg-rose-50 text-rose-800 border-rose-200' };
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return (parts[0]!.slice(0, 2) || '?').toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

const AVATAR_COLORS = [
  'bg-violet-500',
  'bg-indigo-500',
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-fuchsia-500',
];

function avatarClass(name: string) {
  return AVATAR_COLORS[normalizeName(name).split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
}

function buildComparisonSummary(promptResults: Array<{ top3Json: unknown }>): ComparisonRow[] {
  const totals = new Map<
    string,
    { name: string; type: string; count: number; positionSum: number }
  >();
  let totalEntries = 0;
  for (const result of promptResults) {
    const top3 = (Array.isArray(result.top3Json) ? result.top3Json : []) as Top3Entry[];
    for (const entry of top3) {
      if (!entry?.name || entry.position == null) continue;
      totalEntries += 1;
      const key = `${normalizeName(String(entry.name))}|${String(entry.type ?? '').toLowerCase()}`;
      const cur = totals.get(key) ?? {
        name: String(entry.name),
        type: String(entry.type ?? ''),
        count: 0,
        positionSum: 0,
      };
      totals.set(key, {
        ...cur,
        count: cur.count + 1,
        positionSum: cur.positionSum + Number(entry.position),
      });
    }
  }
  return Array.from(totals.values()).map((row) => ({
    name: row.name,
    type: row.type,
    appearances: row.count,
    averagePosition: row.count ? row.positionSum / row.count : 0,
    share: totalEntries ? (row.count / totalEntries) * 100 : 0,
  }));
}

function pseudoCompetitorScore(row: ComparisonRow): number {
  const share = row.share;
  const pos = row.averagePosition;
  return Math.min(
    100,
    Math.max(0, Math.round(38 + share * 0.42 + (4 - pos) * 9)),
  );
}

function findComparisonRow(comp: ComparisonRow[], competitorName: string): ComparisonRow | undefined {
  return (
    comp.find(
      (r) =>
        normalizeName(r.name) === normalizeName(competitorName) && String(r.type).toLowerCase() === 'competitor',
    ) ||
    comp.find((r) => normalizeName(r.name) === normalizeName(competitorName))
  );
}

function engineMode(meta: unknown): 'gemini' | 'openai' {
  if (!meta || typeof meta !== 'object') return 'openai';
  const m = meta as Record<string, unknown>;
  if (String(m.provider) === 'gemini') return 'gemini';
  return 'openai';
}

function top3StatsForName(
  name: string,
  promptResults: Array<{ top3Json: unknown }>,
): { hits: number; posSum: number } {
  let hits = 0;
  let posSum = 0;
  let totalSlots = 0;
  promptResults.forEach((pr) => {
    totalSlots++;
    const raw = Array.isArray(pr.top3Json) ? (pr.top3Json as Top3Entry[]) : [];
    for (const e of raw) {
      const pos = Number(e.position);
      if (!Number.isFinite(pos) || pos < 1 || pos > 3) continue;
      const nm = typeof e.name === 'string' ? e.name : '';
      if (!matchesRowTop3(nm, name)) continue;
      hits += 1;
      posSum += pos;
      break;
    }
  });
  return { hits, posSum };
}

/** Extrae historia útil desde un reporte completo (corrida puntual). */
function snapFromRun(r: ExpandedRun): HistorySnap {
  const comp = buildComparisonSummary(r.promptResults);
  const nPrompts = r.promptResults?.length ?? 0;
  const brandName = r.brand.name;
  const brandKey = normalizeName(brandName);
  const marcaPria = r.priaReports?.[0]?.priaTotal;
  const scores: Record<string, number | null> = {};
  const top3Pct: Record<string, number> = {};

  scores[brandKey] = displayScore(marcaPria);

  for (const c of r.brand.competitors ?? []) {
    const row = findComparisonRow(comp, c.name);
    const k = normalizeName(c.name);
    scores[k] = row ? pseudoCompetitorScore(row) : null;
  }

  const writeTop3Pct = (label: string) => {
    const { hits } = top3StatsForName(label, r.promptResults);
    top3Pct[normalizeName(label)] = nPrompts > 0 ? Math.round((hits / nPrompts) * 1000) / 10 : 0;
  };

  writeTop3Pct(brandName);
  for (const c of r.brand.competitors ?? []) writeTop3Pct(c.name);

  return { runId: r.id, createdAt: r.createdAt ?? r.updatedAt ?? new Date().toISOString(), scores, top3Pct };
}

function buildRankRows(run: ExpandedRun): RankRow[] {
  const comp = buildComparisonSummary(run.promptResults);
  const marca = run.brand;
  const nPrompts = run.promptResults?.length ?? 0;
  const marcaScore = displayScore(run.priaReports?.[0]?.priaTotal) ?? null;

  const candidates: Omit<RankRow, 'rank'>[] = [];

  const mTop = top3StatsForName(marca.name, run.promptResults);
  candidates.push({
    normKey: normalizeName(marca.name),
    name: marca.name,
    domain: marca.domain ?? null,
    isMine: true,
    score: marcaScore,
    avgTop3Pos: mTop.hits ? Math.round((mTop.posSum / mTop.hits) * 10) / 10 : null,
    top3AppearPct: nPrompts > 0 ? Math.round(((mTop.hits / nPrompts) * 1000)) / 10 : 0,
    promptsEvaluatedLabel: `${mTop.hits} / ${nPrompts}`, // hits Top 3 / total prompts
    top3PromptHits: mTop.hits,
  });

  for (const c of marca.competitors ?? []) {
    const rowComp = findComparisonRow(comp, c.name);
    const sc = rowComp ? pseudoCompetitorScore(rowComp) : null;
    const t = top3StatsForName(c.name, run.promptResults);
    candidates.push({
      normKey: normalizeName(c.name),
      name: c.name,
      domain: c.domain ?? null,
      isMine: false,
      score: sc,
      avgTop3Pos: t.hits ? Math.round((t.posSum / t.hits) * 10) / 10 : null,
      top3AppearPct: nPrompts > 0 ? Math.round(((t.hits / nPrompts) * 1000)) / 10 : 0,
      promptsEvaluatedLabel: `${t.hits} / ${nPrompts}`,
      top3PromptHits: t.hits,
    });
  }

  const sorted = [...candidates].sort((a, b) => {
    const sa = a.score ?? -1;
    const sb = b.score ?? -1;
    if (sb !== sa) return sb - sa;
    return normalizeName(a.name).localeCompare(normalizeName(b.name));
  });

  return sorted.map((r, i) => ({ ...r, rank: i + 1 }));
}

function TrendMini({ points, color = '#6366f1' }: { points: number[]; color?: string }) {
  if (points.length < 2) {
    return <span className="text-[11px] text-slate-400">—</span>;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 72;
  const h = 28;
  const xs = points.map((_, i) => (i / (points.length - 1)) * (w - 4) + 2);
  const ys = points.map((p) => h - 2 - ((p - min) / range) * (h - 6));
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${ys[i]!.toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-[72px]" preserveAspectRatio="none" aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function escapeCsv(cell: string) {
  const s = String(cell ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function CompetidoresPortalPage() {
  const params = useParams();
  const runId = params.runId as string;
  const basePath = `/portal-crecimiento/reporte/${runId}/premium`;

  const [run, setRun] = useState<ExpandedRun | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [historySnaps, setHistorySnaps] = useState<HistorySnap[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

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
          if (!cancelled) {
            setLoadError('No hay sesión. Volvé al portal e iniciá sesión.');
            setLoading(false);
          }
          return;
        }
        const headers = { Authorization: `Bearer ${token}` };
        const [runRes, usageRes, listRes] = await Promise.all([
          fetch(`${API_URL}/api/reports/app/reports/${encodeURIComponent(runId)}`, { cache: 'no-store', headers }),
          fetch(`${API_URL}/api/me/usage`, { cache: 'no-store', headers }),
          fetch(`${API_URL}/api/reports/app/reports`, { cache: 'no-store', headers }),
        ]);

        if (runRes.status === 401 || usageRes.status === 401 || listRes.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
          if (!cancelled) {
            setLoadError('Sesión vencida.');
            setLoading(false);
          }
          return;
        }
        if (!runRes.ok) {
          const b = await runRes.json().catch(() => ({}));
          throw new Error((b as { error?: string }).error || `Error ${runRes.status}`);
        }

        const runData = (await runRes.json()) as ExpandedRun;
        const usageData = usageRes.ok ? ((await usageRes.json()) as UsageResponse) : {};
        const rawList = listRes.ok ? ((await listRes.json()) as ReportItem[]) : [];

        if (!cancelled) {
          setRun(runData);
          setUsage(usageData as UsageResponse);
          setReports(Array.isArray(rawList) ? rawList : []);
          setLoadError(null);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Error');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [runId, tick]);

  const brandReports = useMemo(() => {
    if (!run?.brand?.id && !run?.brand?.name) return [];
    const bid = run.brand.id;
    const bname = run.brand.name;
    const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000;
    return [...reports]
      .filter((r) => (bid ? r.brand?.id === bid : r.brand?.name === bname))
      .filter((r) => r.status === 'completed' && new Date(r.createdAt).getTime() >= sixMonthsAgo)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [reports, run?.brand]);

  useEffect(() => {
    if (!run) return;
    let cancelled = false;
    const token =
      typeof window !== 'undefined'
        ? (() => {
            try {
              return sessionStorage.getItem(TOKEN_KEY);
            } catch {
              return null;
            }
          })()
        : null;
    if (!token) return;

    const ids = [...new Set(brandReports.slice(0, 6).map((r) => r.id))];
    if (ids.length === 0) {
      setHistorySnaps([]);
      return;
    }

    (async () => {
      setHistoryLoading(true);
      const headers = { Authorization: `Bearer ${token}` };
      try {
        const results = await Promise.all(
          ids.map(async (id) => {
            const res = await fetch(`${API_URL}/api/reports/app/reports/${encodeURIComponent(id)}`, {
              cache: 'no-store',
              headers,
            });
            if (!res.ok) return null;
            const data = (await res.json()) as ExpandedRun;
            return snapFromRun(data);
          }),
        );
        if (cancelled) return;
        const snaps = results.filter(Boolean) as HistorySnap[];
        snaps.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setHistorySnaps(snaps);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [run, brandReports]);

  const rankRows = useMemo(() => (run ? buildRankRows(run) : []), [run]);

  const miRow = useMemo(() => rankRows.find((r) => r.isMine) ?? null, [rankRows]);

  const competidorRows = useMemo(() => rankRows.filter((r) => !r.isMine), [rankRows]);

  const leaderRow = useMemo(() => rankRows.reduce((best, row) => {
    if (row.score == null) return best;
    if (!best || row.score > (best.score ?? -1)) return row;
    return best;
  }, null as RankRow | null), [rankRows]);

  const bestCompetidorOnly = useMemo(() => {
    return competidorRows.reduce((best, row) => {
      if (row.score == null) return best;
      if (!best || row.score > (best.score ?? -1)) return row;
      return best;
    }, null as RankRow | null);
  }, [competidorRows]);

  const avgPanelScore = useMemo(() => {
    const vals = rankRows.map((r) => r.score).filter((x): x is number => x != null);
    if (!vals.length) return null;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }, [rankRows]);

  const marcaPctTop3Avg = miRow?.top3AppearPct ?? null;

  const prevSnap = useMemo(() => {
    const chain = [...historySnaps].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const idx = chain.findIndex((s) => s.runId === runId);
    if (idx <= 0) return null;
    return chain[idx - 1] ?? null;
  }, [historySnaps, runId]);

  const deltaPctTop3Marca =
    marcaPctTop3Avg != null && miRow != null && prevSnap
      ? Math.round((marcaPctTop3Avg - (prevSnap.top3Pct[miRow.normKey] ?? 0)) * 10) / 10
      : null;

  const marcaPosVsTotal = miRow ? `${miRow.rank} de ${rankRows.length}` : '—';

  const modelo = run ? engineMode(run.modelMeta) : 'openai';

  const promptsTotal = run?.promptResults?.length ?? 0;

  /** Barras ordenadas descendente Cleexs Score como en mockup */
  const barData = useMemo(() => {
    return [...rankRows]
      .filter((r) => r.score != null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .map((r) => ({
        short: initials(r.name),
        fullName: r.isMine ? `${r.name} (Tu marca)` : r.name,
        score: r.score as number,
        isMine: r.isMine,
        normKey: r.normKey,
      }));
  }, [rankRows]);

  const LINE_COLORS = ['#4f46e5', '#2563eb', '#059669', '#ca8a04', '#dc2626'];

  const lineSeriesParticipants = useMemo(() => {
    const ordered = [...rankRows].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    const mine = ordered.find((r) => r.isMine);
    const comps = ordered.filter((r) => !r.isMine && r.score != null).slice(0, 4);
    const list: RankRow[] = [];
    if (mine) list.push(mine);
    comps.forEach((c) => {
      if (!list.some((x) => x.normKey === c.normKey)) list.push(c);
    });
    return list.slice(0, 5);
  }, [rankRows]);

  const evolutionChartRows = useMemo(() => {
    const snapsAsc = [...historySnaps].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const labelFmt = (iso: string) =>
      new Date(iso).toLocaleDateString('es-AR', { month: 'short', day: '2-digit' });
    return snapsAsc.map((s) => {
      const row: Record<string, string | number> = {
        label: labelFmt(s.createdAt),
        rawDate: s.createdAt,
      };
      lineSeriesParticipants.forEach((p, idx) => {
        const raw = s.scores[p.normKey];
        row[`ser${idx}`] = typeof raw === 'number' ? raw : Number.NaN;
      });
      return row;
    });
  }, [historySnaps, lineSeriesParticipants]);

  const streakByKey = useMemo(() => {
    const snapsAsc = [...historySnaps].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const map: Record<string, number[]> = {};
    rankRows.forEach((r) => {
      map[r.normKey] = snapsAsc
        .map((s) => s.scores[r.normKey])
        .filter((v): v is number => v != null && Number.isFinite(v));
    });
    return map;
  }, [historySnaps, rankRows]);

  function csvExport() {
    const lines: string[][] = [];
    lines.push([
      '#',
      'Competidor',
      'Cleexs Score',
      'Variacion vs corrida anterior (pts)',
      'Aparición Top 3 %',
      'ChatGPT aparece %',
      'ChatGPT prom posición',
      'Gemini aparece %',
      'Gemini prom posición',
      'Prompts Top3/total',
    ]);
    rankRows.forEach((r) => {
      const prevScore = prevSnap?.scores[r.normKey];
      const delta =
        prevScore != null && r.score != null ? Math.round(((r.score - prevScore) * 10)) / 10 : '';
      const chatGAppear = modelo === 'openai' ? String(r.top3AppearPct) : '—';
      const chatGAvgPos = modelo === 'openai' && r.avgTop3Pos != null ? String(r.avgTop3Pos) : '—';
      const gemAppear = modelo === 'gemini' ? String(r.top3AppearPct) : '—';
      const gemAvgPos = modelo === 'gemini' && r.avgTop3Pos != null ? String(r.avgTop3Pos) : '—';
      lines.push([
        String(r.rank),
        r.isMine ? `${r.name} (Tu marca)` : r.name,
        r.score != null ? String(r.score) : '',
        delta === '' ? '' : String(delta),
        String(r.top3AppearPct),
        chatGAppear,
        chatGAvgPos,
        gemAppear,
        gemAvgPos,
        r.promptsEvaluatedLabel,
      ]);
    });
    const csv = `${lines.map((ln) => ln.map(escapeCsv).join(',')).join('\n')}\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `competidores-cleexs-${runId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const brechaVsLider =
    miRow?.score != null && leaderRow?.score != null
      ? miRow.score - leaderRow.score
      : null;

  if (loadError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-red-700">{loadError}</p>
          <Link
            href="/portal-crecimiento"
            className="mt-4 inline-block text-sm font-semibold text-violet-700 hover:underline"
          >
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
          <nav className="flex flex-wrap items-center gap-x-2 text-xs text-violet-700">
            <Link href={`${basePath}/competidores`} className="font-medium hover:underline">
              Competidores
            </Link>
            <span className="text-slate-300">›</span>
            <span className="font-medium text-slate-700">{run?.brand?.name ?? (loading ? 'Cargando…' : '')}</span>
          </nav>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Competidores y Cleexs Score</h1>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
                  Métricas del <strong className="text-slate-800">panel oficial</strong> sobre esta corrida: Cleexs Score derivado del PRIA de tu marca y del desempeño en Top&nbsp;3 de tus competidores
                  configurados. La aparición en Top&nbsp;3 se cuenta por cada prompt ejecutado ({modelo === 'gemini' ? 'motor Gemini en esta corrida' : 'motor ChatGPT/OpenAI en esta corrida'}).
                </p>
              </div>
              <div className="flex flex-shrink-0 flex-col items-end gap-2">
                <div className="flex flex-wrap justify-end gap-2">
                  <Link
                    href={`${basePath}/comparacion`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Ver comparación completa
                  </Link>
                  <Link
                    href={`/portal-crecimiento/reporte/${runId}`}
                    className="inline-flex items-center gap-2 rounded-xl border-2 border-violet-600 bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700"
                  >
                    Informe con Top 3
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </Link>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Última corrida:</span>
                  <span className="font-semibold text-slate-700">{fmtDateTime(run?.updatedAt || run?.createdAt)}</span>
                  <button
                    type="button"
                    onClick={() => setTick((x) => x + 1)}
                    className="rounded-lg border border-slate-200 bg-white p-1.5 text-violet-700 hover:bg-slate-50"
                    aria-label="Refrescar"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <p className="mt-8 text-center text-sm text-slate-500">Cargando competidores…</p>
            ) : (
              <>
                {competidorRows.length === 0 ? (
                  <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                    Aún no cargaste competidores en la marca <strong>{run?.brand?.name ?? ''}</strong>. Mostramos sólo tu Cleexs Score hasta
                    que agregues ≈10 competidores en la configuración.
                  </div>
                ) : null}

                {/* KPI */}
                <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Cleexs Score de tu marca</p>
                    <p className="mt-1 text-3xl font-bold text-slate-900">{miRow?.score ?? '—'}</p>
                    {(() => {
                      const n = niveLabel(miRow?.score ?? null);
                      return (
                        <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${n.className}`}>
                          {n.text}
                        </span>
                      );
                    })()}
                    <p className="mt-2 text-xs text-slate-600">Posición #{marcaPosVsTotal}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Promedio del panel</p>
                    <p className="mt-1 text-3xl font-bold text-slate-900">{avgPanelScore ?? '—'}</p>
                    <p className="mt-2 text-xs text-slate-600">{competidorRows.length} competidores + tu marca</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Mejor referente</p>
                    <p className="mt-1 text-3xl font-bold text-violet-700">{leaderRow?.score ?? '—'}</p>
                    <p className="mt-2 truncate text-xs text-slate-600" title={leaderRow?.name}>
                      {leaderRow?.name ?? '—'} {leaderRow?.isMine ? '(Tu marca)' : ''}
                    </p>
                    {bestCompetidorOnly && !leaderRow?.isMine ? (
                      <p className="truncate text-[11px] text-slate-400">Top entre competidores: {bestCompetidorOnly.name}</p>
                    ) : null}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Brecha vs líder</p>
                    <p
                      className={`mt-1 text-3xl font-bold ${
                        brechaVsLider == null
                          ? 'text-slate-400'
                          : brechaVsLider < 0
                            ? 'text-rose-600'
                            : brechaVsLider === 0
                              ? 'text-emerald-600'
                              : 'text-emerald-600'
                      }`}
                    >
                      {brechaVsLider == null ? '—' : `${brechaVsLider > 0 ? '+' : ''}${brechaVsLider} pts`}
                    </p>
                    <p className="mt-2 text-xs text-slate-600">vs {leaderRow?.name ?? '—'}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Aparición en Top 3 (promedio)
                    </p>
                    <p className="mt-1 text-3xl font-bold text-slate-900">
                      {marcaPctTop3Avg != null ? `${marcaPctTop3Avg}%` : '—'}
                    </p>
                    <p
                      className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${
                        deltaPctTop3Marca != null ? (deltaPctTop3Marca >= 0 ? 'text-emerald-600' : 'text-rose-600') : 'text-slate-400'
                      }`}
                    >
                      {deltaPctTop3Marca != null ? (
                        <>
                          {deltaPctTop3Marca >= 0 ? '+' : ''}
                          {deltaPctTop3Marca}% vs corrida anterior
                          {deltaPctTop3Marca >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                        </>
                      ) : prevSnap ? (
                        'Sin variación conocida'
                      ) : (
                        'Corrida anterior no disponible'
                      )}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Prompts evaluados</p>
                    <p className="mt-1 text-3xl font-bold text-slate-900">
                      {promptsTotal}
                      {promptsTotal ? <span className="text-xl font-semibold text-slate-400"> / {promptsTotal}</span> : null}
                    </p>
                    <p className="mt-2 text-xs text-slate-600">
                      {promptsTotal === 0
                        ? 'Sin prompts en corrida'
                        : run?.status === 'completed'
                          ? '100% con resultados (corrida completada)'
                          : `Estado: ${run?.status ?? '—'} · prompts con resultado: ${promptsTotal}`}
                    </p>
                  </div>
                </div>

                {/* Gráficos */}
                <div className="mt-6 grid gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h2 className="text-sm font-bold text-slate-900">Comparativa de Cleexs Score</h2>
                    <p className="text-[11px] text-slate-500">
                      Todas las marcas panel con valor (iniciales · tu marca destacada)
                    </p>
                    <div className="mt-4 h-[280px] w-full">
                      {barData.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={barData} margin={{ top: 28, right: 8, left: -8, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="short" tick={{ fontSize: 11, fill: '#64748b' }} />
                            <YAxis hide domain={[0, 105]} />
                            <Tooltip
                              formatter={(v: number | string) => [v, 'Cleexs Score']}
                              labelFormatter={(_, payload: readonly { payload?: { fullName?: string } }[]) =>
                                payload?.[0]?.payload?.fullName ?? ''
                              }
                            />
                            <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={48}>
                              {barData.map((entry, i) => (
                                <Cell key={i} fill={entry.isMine ? '#4338ca' : '#c4b5fd'} />
                              ))}
                              <LabelList dataKey="score" position="top" fill="#334155" fontSize={11} fontWeight={700} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-slate-400">
                          Datos insuficientes para el gráfico de barras
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">Evolución Cleexs Score (últimas corridas)</h2>
                        <p className="text-[11px] text-slate-500">
                          Hasta 6 corridas completadas últimos meses · {historyLoading ? 'cargando…' : `${evolutionChartRows.length} punto(s)`}
                        </p>
                      </div>
                      <BarChart3 className="h-8 w-8 shrink-0 text-violet-200" aria-hidden />
                    </div>
                    <div className="mt-2 h-[280px] w-full">
                      {evolutionChartRows.length >= 2 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={evolutionChartRows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                            <YAxis domain={[0, 'auto']} width={36} tick={{ fontSize: 10 }} />
                            <Tooltip
                              formatter={(v: unknown) =>
                                typeof v === 'number' && !Number.isNaN(v) ? [v, 'score'] : ['—', 'score']
                              }
                            />
                            <Legend wrapperStyle={{ fontSize: '11px' }} />
                            {lineSeriesParticipants.map((p, idx) => (
                              <Line
                                key={p.normKey}
                                type="monotone"
                                dataKey={`ser${idx}`}
                                name={`${initials(p.name)} · ${p.isMine ? 'Tu marca' : p.name}`}
                                stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                                strokeWidth={2}
                                dot={{ r: 3 }}
                                connectNulls={false}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-slate-500">
                          <p>Necesitamos al menos 2 corridas completadas en esta ventana para la tendencia.</p>
                          {historyLoading ? <span className="text-xs text-violet-600">Cargando historial…</span> : null}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tabla */}
                <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-4">
                    <h2 className="text-base font-bold text-slate-900">
                      Ranking de competidores (Cleexs Score y visibilidad en Top 3)
                    </h2>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Ordenadas por Cleexs Score descendente sobre esta corrida. Motor activo:&nbsp;
                      <strong>{modelo === 'gemini' ? 'Gemini' : 'ChatGPT / OpenAI'}</strong>
                      . La otra columna queda vacía hasta haber corrida dual.
                    </p>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full min-w-[1100px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                          <th className="whitespace-nowrap px-3 py-3 text-slate-500">#</th>
                          <th className="whitespace-nowrap px-3 py-3 text-slate-500">Competidor</th>
                          <th className="whitespace-nowrap px-3 py-3 text-slate-500">Cleexs Score ↕</th>
                          <th className="whitespace-nowrap px-3 py-3 text-slate-500">Variación vs anterior</th>
                          <th className="whitespace-nowrap px-3 py-3 text-slate-500">Top 3 (prom)</th>
                          <th className="whitespace-nowrap border-l border-violet-100 px-3 py-3 text-center text-violet-800" colSpan={2}>
                            ChatGPT Top 3
                          </th>
                          <th className="whitespace-nowrap px-3 py-3 text-center text-violet-800" colSpan={2}>
                            Gemini Top 3
                          </th>
                          <th className="whitespace-nowrap px-3 py-3 text-slate-500">Prompts · Top 3 hits</th>
                          <th className="whitespace-nowrap px-3 py-3 text-slate-500">Tendencia</th>
                          <th className="whitespace-nowrap px-3 py-3 text-slate-500">Acciones</th>
                        </tr>
                        <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                          <th colSpan={5} />
                          <th className="border-l border-violet-100 px-3 py-1">Aparece %</th>
                          <th className="px-3 py-1">Prom pos.</th>
                          <th className="px-3 py-1">Aparece %</th>
                          <th className="px-3 py-1">Prom pos.</th>
                          <th colSpan={3} />
                        </tr>
                      </thead>
                      <tbody>
                        {rankRows.map((r) => {
                          const prevScore = prevSnap?.scores[r.normKey];
                          const deltaSc =
                            prevScore != null && r.score != null ? Math.round((r.score - prevScore) * 10) / 10 : null;
                          const chatAppear = modelo === 'openai' ? `${r.top3AppearPct}%` : '—';
                          const chatPos = modelo === 'openai' && r.avgTop3Pos != null ? String(r.avgTop3Pos) : '—';
                          const gemAppear = modelo === 'gemini' ? `${r.top3AppearPct}%` : '—';
                          const gemPos = modelo === 'gemini' && r.avgTop3Pos != null ? String(r.avgTop3Pos) : '—';

                          const streakPts = streakByKey[r.normKey] ?? [];

                          return (
                            <tr
                              key={r.normKey}
                              className={`border-t border-slate-100 hover:bg-slate-50/80 ${r.isMine ? 'bg-violet-50/60' : ''}`}
                            >
                              <td className="whitespace-nowrap px-3 py-3 align-middle font-semibold text-slate-600">{r.rank}</td>
                              <td className="max-w-[200px] px-3 py-3 align-middle">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white ${avatarClass(r.name)}`}
                                  >
                                    {initials(r.name)}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="truncate font-semibold text-slate-900">
                                      {r.name}
                                      {r.isMine ? <span className="ml-1 text-violet-700">(Tu marca)</span> : null}
                                    </p>
                                    {r.domain ? <p className="truncate text-[11px] text-slate-500">{r.domain}</p> : null}
                                  </div>
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 align-middle text-xl font-bold text-violet-700">
                                {r.score ?? <span className="text-base font-normal text-slate-400">—</span>}
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 align-middle text-sm font-semibold">
                                {deltaSc != null ? (
                                  <span
                                    className={deltaSc >= 0 ? 'text-emerald-600' : deltaSc <= 0 ? 'text-rose-600' : 'text-slate-600'}
                                  >
                                    {deltaSc >= 0 ? '+' : ''}
                                    {deltaSc}
                                    {' · '}
                                    {deltaSc > 0 ? '↑' : deltaSc < 0 ? '↓' : '='}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 align-middle font-medium text-slate-800">{r.top3AppearPct}%</td>
                              <td className="whitespace-nowrap border-l border-violet-100 px-3 py-3 align-middle text-center">{chatAppear}</td>
                              <td className="whitespace-nowrap px-3 py-3 align-middle text-center">{chatPos}</td>
                              <td className="whitespace-nowrap px-3 py-3 align-middle text-center">{gemAppear}</td>
                              <td className="whitespace-nowrap px-3 py-3 align-middle text-center">{gemPos}</td>
                              <td className="whitespace-nowrap px-3 py-3 align-middle tabular-nums text-slate-700">{r.promptsEvaluatedLabel}</td>
                              <td className="whitespace-nowrap px-3 py-3 align-middle">
                                <TrendMini points={streakPts} color={r.isMine ? '#4338ca' : '#8b5cf6'} />
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 align-middle">
                                <Link
                                  href={`${basePath}/comparacion`}
                                  className="inline-flex rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                                  aria-label="Ver detalle"
                                >
                                  <Eye className="h-4 w-4" />
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <Link href={`${basePath}/prompts`} className="text-sm font-semibold text-violet-700 hover:underline">
                      Ver detalle por prompt (apariciones y posiciones) →
                    </Link>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs text-slate-500">
                        Mostrando {rankRows.length} de {rankRows.length} participantes
                      </span>
                      <button
                        type="button"
                        onClick={csvExport}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Download className="h-4 w-4 text-violet-600" />
                        Exportar CSV
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-violet-100 bg-violet-50/70 p-4 text-xs leading-relaxed text-violet-900">
                  <div className="flex gap-3">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-violet-700" aria-hidden />
                    <p className="text-violet-900/95">
                      <strong>Cómo se calculan las columnas:</strong> el <strong>Cleexs Score</strong> de tu marca corresponde al PRIA
                      agregado de esta corrida; el de cada competidor se estima desde su presencia ponderada en el Top&nbsp;3 (misma
                      fórmula que el panel público Cleexs). Los porcentajes de aparición en Top&nbsp;3 son prompts donde la marca figura en
                      posiciones 1 a 3 sobre el total de prompts. La posición promedio se calcula solo sobre esas apariciones. Las variantes ChatGPT/Gemini
                      reflejan el único motor usado por corrida; cuando existan corridas híbridas en el backend, estas columnas se completarán con datos
                      segregados por motor.
                    </p>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
