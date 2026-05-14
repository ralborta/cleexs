'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Brush,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Lightbulb,
  Loader2,
  Medal,
  Plus,
  Search,
  Share2,
  TrendingUp,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PortalPremiumSidebarNav } from '@/components/portal/portal-premium-sidebar-nav';

const TOKEN_KEY = 'cleexs_portal_token';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type UsageResponse = {
  planKey?: string;
  planDisplay?: string;
  usage?: { scoreViews?: number };
  limits?: { scoreViews?: number | null };
};

type ReportItem = {
  id: string;
  status: string;
  createdAt: string;
  reportType?: string;
  score: number | null;
  brand: { id?: string; name: string; domain?: string };
};

type RunDetailBrief = {
  id: string;
  status?: string;
  brand: { id?: string; name: string };
};

type RunDetailPanel = {
  id: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  runType?: string;
  modelMeta?: unknown;
  promptResults?: unknown[];
  priaReports?: Array<{ priaTotal: number }>;
};

function toPct(score: number | null | undefined) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  return n <= 1 ? n * 100 : n;
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtTimeShort(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function reportTypeLabel(t?: string | null) {
  if (t === 'deep_report') return 'Profundo';
  return 'Consolidado';
}

async function fetchPromptCountForRun(id: string, headers: HeadersInit): Promise<number> {
  try {
    const res = await fetch(`${API_URL}/api/reports/app/reports/${encodeURIComponent(id)}`, {
      cache: 'no-store',
      headers,
    });
    const data = (await res.json().catch(() => ({}))) as { promptResults?: unknown[] };
    if (!res.ok) return -1;
    return Array.isArray(data.promptResults) ? data.promptResults.length : 0;
  } catch {
    return -1;
  }
}

function chronologicalOrdering(reports: ReportItem[]): ReportItem[] {
  return [...reports].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
}

function reportSequentialNumber(reportId: string, chronAsc: ReportItem[]): number {
  const i = chronAsc.findIndex((r) => r.id === reportId);
  return i >= 0 ? i + 1 : 0;
}

function statusBadgeVisual(status: string) {
  switch (status) {
    case 'completed':
      return (
        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
          Completado
        </span>
      );
    case 'running':
      return (
        <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-900">
          En curso
        </span>
      );
    case 'pending':
      return (
        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
          Pendiente
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-800">
          Error
        </span>
      );
    default:
      return (
        <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-900">
          Parcial
        </span>
      );
  }
}

function ScoreRing({ value }: { value: number }) {
  const v = Math.min(100, Math.max(0, value));
  const r = 48;
  const c = 2 * Math.PI * r;
  const dash = (v / 100) * c;
  return (
    <div className="flex shrink-0 flex-col items-center justify-center rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white px-6 py-4">
      <svg width="136" height="136" viewBox="0 0 120 120" className="drop-shadow-sm" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e9e3ff" strokeWidth="11" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#6366f1"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform="rotate(-90 60 60)"
        />
        <text x="60" y="64" textAnchor="middle" fontSize="26" fontWeight="700" fill="#111827">
          {Math.round(value)}
        </text>
        <text x="60" y="84" textAnchor="middle" fontSize="9" fill="#64748b">
          Score general
        </text>
      </svg>
      <p className="mt-2 text-[11px] font-medium text-violet-800">Cleexs Score</p>
    </div>
  );
}

function motorsFromMeta(meta: unknown): { chatgpt: boolean; gemini: boolean } {
  if (!meta || typeof meta !== 'object') return { chatgpt: true, gemini: false };
  const m = meta as Record<string, unknown>;
  if (String(m.provider) === 'gemini') return { chatgpt: false, gemini: true };
  return { chatgpt: true, gemini: false };
}

export default function ReportesClientePage() {
  const params = useParams();
  const runId = params.runId as string;
  const basePath = `/portal-crecimiento/reporte/${runId}/premium`;

  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [runBrief, setRunBrief] = useState<RunDetailBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [shareDone, setShareDone] = useState(false);

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPeriod, setFilterPeriod] = useState<string>('12');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [chosenId, setChosenId] = useState<string | null>(null);

  const [detail, setDetail] = useState<RunDetailPanel | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [promptCountMap, setPromptCountMap] = useState<Map<string, number>>(new Map());

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
        const [runRes, usageRes, listRes] = await Promise.all([
          fetch(`${API_URL}/api/reports/app/reports/${encodeURIComponent(runId)}`, { cache: 'no-store', headers }),
          fetch(`${API_URL}/api/me/usage`, { cache: 'no-store', headers }),
          fetch(`${API_URL}/api/reports/app/reports`, { cache: 'no-store', headers }),
        ]);

        if (runRes.status === 401 || usageRes.status === 401 || listRes.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
          setLoadError('Sesión vencida.');
          setLoading(false);
          return;
        }
        if (!runRes.ok) {
          const b = await runRes.json().catch(() => ({}));
          throw new Error((b as { error?: string }).error || `Error ${runRes.status}`);
        }
        const runData = (await runRes.json()) as RunDetailBrief;
        const usageData = usageRes.ok ? ((await usageRes.json()) as UsageResponse) : {};
        const rawList = listRes.ok ? ((await listRes.json()) as ReportItem[]) : [];

        if (!cancelled) {
          setRunBrief(runData);
          setUsage(usageData as UsageResponse);
          setReports(Array.isArray(rawList) ? rawList : []);
          setLoading(false);
        }

        let brandSlice = Array.isArray(rawList) ? [...rawList] : [];
        const bid = runData.brand?.id;
        const bname = runData.brand?.name;
        if (bid || bname) {
          brandSlice = brandSlice.filter((r) => (bid ? r.brand?.id === bid : r.brand?.name === bname));
        }
        brandSlice.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
        const ids = brandSlice.slice(0, 40).map((r) => r.id);
        if (!cancelled && ids.length && token) {
          const map = new Map<string, number>();
          for (const id of ids) {
            const c = await fetchPromptCountForRun(id, headers);
            if (c >= 0) map.set(id, c);
          }
          if (!cancelled) setPromptCountMap(map);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Error al cargar');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  const brandReportsAll = useMemo(() => {
    if (!runBrief?.brand) return [];
    const bid = runBrief.brand.id;
    const bname = runBrief.brand.name;
    return [...reports].filter((r) => (bid ? r.brand?.id === bid : r.brand?.name === bname));
  }, [reports, runBrief?.brand]);

  const chronAscAll = useMemo(() => chronologicalOrdering(brandReportsAll), [brandReportsAll]);

  const kpiReports12m = useMemo(() => {
    const cut = new Date();
    cut.setMonth(cut.getMonth() - 12);
    return brandReportsAll.filter((r) => +new Date(r.createdAt) >= +cut);
  }, [brandReportsAll]);

  const kpis = useMemo(() => {
    const scored = kpiReports12m.filter((r) => r.score != null);
    const pct = scored.map((r) => toPct(r.score));
    const avgScore = pct.length ? Math.round(pct.reduce((a, b) => a + b, 0) / pct.length) : null;

    let bestRep: ReportItem | null = null;
    let bestPct = -1;
    for (const r of scored) {
      const p = toPct(r.score);
      if (p >= bestPct) {
        bestPct = p;
        bestRep = r;
      }
    }

    /** Promedio de variación corrida vs corrida inmediata anterior cronológica (últimos 12 meses) */
    let avgDelta: number | null = null;
    const ascScored = [...scored].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    if (ascScored.length >= 2) {
      let sum = 0;
      let n = 0;
      for (let i = 1; i < ascScored.length; i++) {
        sum += Math.round((toPct(ascScored[i]!.score) - toPct(ascScored[i - 1]!.score)) * 10) / 10;
        n++;
      }
      avgDelta = n ? Math.round((sum / n) * 10) / 10 : null;
    }

    const latest = [...brandReportsAll].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0] ?? null;
    const lastPct = latest?.score != null ? Math.round(toPct(latest.score)) : null;

    return {
      count12m: kpiReports12m.length,
      avgScore,
      bestRep,
      bestPct: bestPct >= 0 ? Math.round(bestPct) : null,
      bestSeq: bestRep ? reportSequentialNumber(bestRep.id, chronAscAll) : null,
      avgDelta,
      latest,
      lastPct,
    };
  }, [kpiReports12m, brandReportsAll, chronAscAll]);

  const filteredList = useMemo(() => {
    let list = [...brandReportsAll];
    const m = Number(filterPeriod);
    if (Number.isFinite(m) && m > 0 && m < 900) {
      const cut = new Date();
      cut.setMonth(cut.getMonth() - m);
      list = list.filter((r) => +new Date(r.createdAt) >= +cut);
    }
    if (filterType !== 'all') {
      list = list.filter((r) => {
        const t = String(r.reportType || '');
        return t === filterType;
      });
    }
    if (filterStatus !== 'all') {
      list = list.filter((r) => r.status === filterStatus);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const n = reportSequentialNumber(r.id, chronAscAll);
        const lbl = `#${n} ${fmtDateShort(r.createdAt)} ${reportTypeLabel(r.reportType)} ${r.status}`.toLowerCase();
        return r.id.includes(q) || lbl.includes(q);
      });
    }
    list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return list;
  }, [brandReportsAll, filterPeriod, filterType, filterStatus, search, chronAscAll]);

  const activeReportId = useMemo(() => {
    if (filteredList.find((r) => r.id === chosenId)) return chosenId;
    if (filteredList.find((r) => r.id === runId)) return runId;
    return filteredList[0]?.id ?? null;
  }, [filteredList, chosenId, runId]);



  const totalFiltered = filteredList.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedSlice = filteredList.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [filterType, filterPeriod, filterStatus, search, pageSize]);

  const newestId =
    filteredList[0]?.id ??
    [...brandReportsAll].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0]?.id ??
    null;

  useEffect(() => {
    if (!activeReportId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      let token: string | null = null;
      try {
        token = sessionStorage.getItem(TOKEN_KEY);
      } catch {
        token = null;
      }
      if (!token) return;
      setDetailLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/reports/app/reports/${encodeURIComponent(activeReportId)}`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as RunDetailPanel;
        if (!cancelled) setDetail(data);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeReportId]);

  const activeRow = filteredList.find((r) => r.id === activeReportId) ?? null;
  const activeSeq = activeRow ? reportSequentialNumber(activeRow.id, chronAscAll) : 0;
  const displayScoreDetail = detail?.priaReports?.[0]?.priaTotal != null ? Math.round(toPct(detail.priaReports[0]!.priaTotal)) : activeRow?.score != null ? Math.round(toPct(activeRow.score)) : 0;

  const evolutionPreview = useMemo(() => {
    const scored = [...brandReportsAll].filter((r) => r.score != null).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)).slice(-6);
    return scored.map((r) => ({
      label: fmtDateShort(r.createdAt),
      score: Math.round(toPct(r.score)),
    }));
  }, [brandReportsAll]);

  const executiveSummaryText = useMemo(() => {
    const s = displayScoreDetail;
    const tipo = detail?.runType ?? activeRow?.reportType;
    const label = reportTypeLabel(tipo);
    if (!activeRow) return 'Seleccioná un reporte para ver el resumen.';
    const st = activeRow.status;
    if (st !== 'completed') {
      return `Este reporte está en estado "${st}". Cuando esté completado vas a tener el Cleexs Score cerrado en el centro de métricas. Tipo solicitado: ${label}.`;
    }
    const hint =
      s >= 80 ? 'Tu posición en IA se mantiene sólida; conviene defender el liderazgo en las mismas categorías donde ya aparecés en Top 3.' : s >= 60 ? 'Hay margen positivo pero conviene revisar prompts débiles y la presencia competitiva versus top marcas citadas por el modelo.' : 'Hay oportunidad de mejora prioritaria: reforzá cobertura de intención y contenidos que aumenten probabilidad de cita.';
    return `En este ${label?.toLowerCase()} el Cleexs Score resumido ronda ${Math.round(s)} puntos (${new Date(activeRow.createdAt).toLocaleDateString('es-AR')}). ${hint}`;
  }, [displayScoreDetail, detail?.runType, activeRow]);

  const motorsDetail = motorsFromMeta(detail?.modelMeta);
  const promptsEval = detail?.promptResults?.length ?? promptCountMap.get(activeReportId ?? '') ?? 0;

  async function generateNewMonthly() {
    const brandId = runBrief?.brand?.id;
    if (!brandId) {
      setActionMsg('No se pudo obtener la marca para generar.');
      return;
    }
    let token: string | null = null;
    try {
      token = sessionStorage.getItem(TOKEN_KEY);
    } catch {
      token = null;
    }
    if (!token) return;
    setGenerating(true);
    setActionMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/runs/portal/mes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ brandId }),
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) throw new Error(body.message || body.error || `Error HTTP ${res.status}`);
      setActionMsg('Corrida lanzada correctamente (consolidado). Volvé en unos minutos al portal para ver los resultados.');
      window.location.href = '/portal-crecimiento';
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setGenerating(false);
    }
  }

  async function copyShareAccess() {
    const id = activeReportId ?? runId;
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/portal-crecimiento/reporte/${id}`
        : '';
    try {
      await navigator.clipboard.writeText(url);
      setShareDone(true);
      window.setTimeout(() => setShareDone(false), 2000);
    } catch {
      setActionMsg('No se pudo copiar el enlace. Copiá manualmente desde la barra.');
    }
  }

  function clearFilters() {
    setSearch('');
    setFilterType('all');
    setFilterPeriod('12');
    setFilterStatus('all');
  }

  const sidebar = <PortalPremiumSidebarNav runId={runId} usage={usage} loadingPlan={loading} />;

  if (loadError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-red-700">{loadError}</p>
          <Link href="/portal-crecimiento" className="mt-4 block text-sm font-semibold text-violet-700 hover:underline">
            ← Portal
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-3 sm:p-5">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[280px_1fr]">
        {sidebar}

        <div className="min-w-0 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-14 text-sm text-slate-500 shadow-sm">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-violet-600" />
              Cargando reportes…
            </div>
          ) : (
            <>
              <nav className="flex flex-wrap items-center gap-x-2 text-xs text-violet-700">
                <span className="font-medium text-violet-700">Reportes</span>
                <span className="text-slate-300">›</span>
                <span className="font-medium text-slate-700">{runBrief?.brand?.name ?? ''}</span>
              </nav>

              <header className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reportes del cliente</h1>
                  <p className="mt-2 max-w-2xl text-sm text-slate-600">
                    Centro unificado para consultar corridas consolidadas, reportes profundos de Cleexs Score y lanzar nuevas corridas cuando
                    tengás cupo disponible.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => copyShareAccess()}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    <Share2 className="h-3.5 w-3.5 text-slate-500" />
                    {shareDone ? 'Copiado' : 'Compartir acceso'}
                  </button>
                  <button
                    type="button"
                    disabled={generating}
                    onClick={() => generateNewMonthly()}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
                  >
                    {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Generar nuevo reporte
                  </button>
                </div>
              </header>
              {actionMsg ? (
                <p className={`rounded-xl border px-3 py-2 text-xs ${actionMsg.includes('Corrida lanzada') ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
                  {actionMsg}
                </p>
              ) : null}

              {/* KPIs */}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100">
                      <FileText className="h-4 w-4 text-violet-700" />
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Reportes generados</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{kpis.count12m}</p>
                  <p className="text-[11px] text-slate-500">Últimos 12 meses · marca actual</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100">
                      <BarChart3 className="h-4 w-4 text-violet-700" />
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Score promedio</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{kpis.avgScore ?? '—'}</p>
                  <p className="text-[11px] text-slate-500">En reportes del período KPI</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                      <Medal className="h-4 w-4 text-emerald-700" />
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Mejor score</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-emerald-700">{kpis.bestPct ?? '—'}</p>
                  <p className="truncate text-[11px] text-slate-500" title={kpis.bestRep ? `${kpis.bestRep.id}` : ''}>
                    {kpis.bestRep && kpis.bestSeq ? `Reporte #${kpis.bestSeq}` : ''}
                    {kpis.bestRep ? ` · ${fmtDateShort(kpis.bestRep.createdAt)}` : ''}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Variación promedio</span>
                  </div>
                  <p className={`mt-2 text-2xl font-bold ${kpis.avgDelta != null && kpis.avgDelta >= 0 ? 'text-emerald-600' : kpis.avgDelta != null ? 'text-rose-600' : 'text-slate-400'}`}>
                    {kpis.avgDelta != null ? `${kpis.avgDelta > 0 ? '+' : ''}${kpis.avgDelta}` : '—'}
                  </p>
                  <p className="text-[11px] text-slate-500">Δ entre corridas consecutivas (12m)</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100">
                      <CalendarDays className="h-4 w-4 text-violet-700" />
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Último reporte</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-violet-800">{kpis.lastPct ?? '—'}</p>
                  <p className="truncate text-[11px] text-slate-600">
                    {kpis.latest ? `${fmtDateShort(kpis.latest.createdAt)} · ${reportTypeLabel(kpis.latest.reportType)}` : '—'}
                  </p>
                </div>
              </div>

              {/* Filtros */}
              <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-100/60 p-3">
                <div className="relative min-w-[180px] flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    placeholder="Buscar reportes…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-medium text-slate-700"
                  >
                    <option value="all">Tipo de reporte</option>
                    <option value="monthly">Consolidado</option>
                    <option value="deep_report">Profundo</option>
                  </select>
                  <select
                    value={filterPeriod}
                    onChange={(e) => setFilterPeriod(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-medium text-slate-700"
                  >
                    <option value="12">Últimos 12 meses</option>
                    <option value="6">Últimos 6 meses</option>
                    <option value="999">Todo</option>
                  </select>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-medium text-slate-700"
                  >
                    <option value="all">Estado</option>
                    <option value="completed">Completado</option>
                    <option value="running">En curso</option>
                    <option value="pending">Pendiente</option>
                    <option value="failed">Error</option>
                  </select>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    <Brush className="h-3.5 w-3.5 text-violet-600" />
                    Limpiar filtros
                  </button>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(280px,38%)_1fr]">
                {/* Lista izquierda */}
                <section className="flex min-h-[520px] flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-900">Historial de reportes</h2>
                  <div className="mt-4 flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
                    {pagedSlice.length === 0 ? (
                      <p className="text-sm text-slate-500">No hay reportes con estos filtros.</p>
                    ) : (
                      pagedSlice.map((rep) => {
                        const seq = reportSequentialNumber(rep.id, chronAscAll);
                        const sel = activeReportId === rep.id;
                        const pc = promptCountMap.get(rep.id);
                        const scoreDisp = rep.score != null ? Math.round(toPct(rep.score)) : '—';
                        return (
                          <button
                            key={rep.id}
                            type="button"
                            onClick={() => {
                              setChosenId(rep.id);
                            }}
                            className={`flex w-full flex-wrap items-start justify-between gap-2 rounded-xl border px-3 py-3 text-left transition ${
                              sel
                                ? 'border-violet-300 bg-violet-50 shadow-sm ring-2 ring-violet-100'
                                : 'border-slate-100 bg-white hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex gap-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                                <FileText className="h-4 w-4" />
                              </span>
                              <div>
                                <p className="text-sm font-bold text-slate-900">Reporte #{seq}</p>
                                <p className="text-[11px] text-slate-500">
                                  {fmtDateShort(rep.createdAt)} · {fmtTimeShort(rep.createdAt)}
                                </p>
                                <p className="mt-1 text-[11px] font-medium text-slate-600">{reportTypeLabel(rep.reportType)}</p>
                                {pc !== undefined ? (
                                  <p className="text-[10px] text-slate-400">{pc} prompts con resultado cargado</p>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              {statusBadgeVisual(rep.status)}
                              <span className="text-lg font-bold text-slate-900">{scoreDisp}</span>
                              <Link
                                href={`/portal-crecimiento/reporte/${rep.id}/premium`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-[11px] font-semibold text-violet-700 hover:underline"
                              >
                                Ver reporte →
                              </Link>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                    <span>
                      Mostrando {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, totalFiltered)} de {totalFiltered}{' '}
                      reportes
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={safePage <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="px-2 font-semibold">
                        Pág. {safePage}/{totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={safePage >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <select
                        value={String(pageSize)}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setPage(1);
                        }}
                        className="ml-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium"
                      >
                        <option value="7">7 por página</option>
                        <option value="10">10 por página</option>
                        <option value="15">15 por página</option>
                      </select>
                    </div>
                  </div>
                </section>

                {/* Detalle derecho */}
                <section className="flex min-h-[520px] flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  {!activeReportId ? (
                    <p className="text-sm text-slate-600">Seleccioná un reporte para previsualizar métricas.</p>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-xl font-bold text-slate-900">{activeSeq ? `Reporte #${activeSeq}` : 'Reporte'}</h2>
                            {activeReportId === newestId ? (
                              <span className="rounded-full bg-violet-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                Último
                              </span>
                            ) : null}
                            {detailLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-slate-500">
                            {fmtDateShort(activeRow!.createdAt)} · {fmtTimeShort(activeRow!.createdAt)}{' · '}
                            {statusBadgeVisual(activeRow!.status)}
                          </p>
                          <div className="mt-4 flex flex-wrap items-baseline gap-2">
                            <span className="text-4xl font-extrabold text-violet-700">{Math.round(displayScoreDetail)}</span>
                            <span className="text-sm font-semibold text-slate-600">Cleexs Score</span>
                          </div>
                        </div>
                        <Link
                          href={`/portal-crecimiento/reporte/${activeReportId}`}
                          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-violet-600 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-900 hover:bg-violet-100"
                        >
                          Ver reporte completo →
                          <Share2 className="h-3.5 w-3.5" />
                        </Link>
                      </div>

                      <div className="grid gap-6 border-t border-slate-100 pt-5 lg:grid-cols-[1fr_auto] lg:items-center">
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Resumen ejecutivo</h3>
                          <p className="mt-3 text-sm leading-relaxed text-slate-700">{executiveSummaryText}</p>
                        </div>
                        <ScoreRing value={displayScoreDetail} />
                      </div>

                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Evolución del Cleexs Score</h3>
                        <div className="mt-3 h-[200px] w-full rounded-xl border border-slate-100 bg-slate-50/50 p-2">
                          {evolutionPreview.length >= 2 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={evolutionPreview} margin={{ top: 28, right: 8, left: -12, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ece8ff" />
                                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                                <YAxis domain={[0, 100]} width={36} tick={{ fontSize: 10 }} />
                                <Tooltip />
                                <Line
                                  type="monotone"
                                  dataKey="score"
                                  stroke="#6366f1"
                                  strokeWidth={2}
                                  dot={{ r: 5, strokeWidth: 2, stroke: '#4f46e5', fill: '#fff' }}
                                  activeDot={{ r: 7 }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          ) : (
                            <p className="flex h-full items-center justify-center text-sm text-slate-500">
                              Necesitás al menos dos reportes con score para la curva temporal.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-violet-600 shadow-sm">
                            <FileText className="h-3.5 w-3.5" />
                          </span>
                          <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">Tipo de reporte</p>
                          <p className="mt-1 text-sm font-bold text-slate-900">{reportTypeLabel(detail?.runType ?? activeRow?.reportType)}</p>
                          <p className="mt-2 text-[11px] leading-snug text-slate-600">
                            {detail?.runType === 'deep_report'
                              ? 'Análisis ampliado y Cleexs Score consolidado cuando la corrida finaliza.'
                              : 'Agregación periódica Cleexs con los prompts configurados para la marca.'}
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-violet-600 shadow-sm">
                            <Search className="h-3.5 w-3.5" />
                          </span>
                          <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">Prompts evaluados</p>
                          <p className="mt-1 text-sm font-bold text-slate-900">
                            {detailLoading ? '…' : promptsEval}
                            {promptsEval > 0 ? <span className="text-xs font-semibold text-slate-400"> · prompts</span> : null}
                          </p>
                          <p className="mt-2 text-[11px] text-slate-600">
                            {activeRow?.status === 'completed' && promptsEval > 0
                              ? `${Math.round(100)}% de los prompts de esta corrida tienen resultado en portal.`
                              : activeRow?.status === 'completed'
                                ? 'Sin datos de prompts asociados aún.'
                                : 'Corrida aún sin completar · avance parcial opcional desde el estado.'}
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Modelos utilizados</p>
                          <ul className="mt-3 space-y-2 text-sm">
                            <li className={`flex items-center gap-2 font-medium ${motorsDetail.chatgpt ? 'text-slate-800' : 'text-slate-300'}`}>
                              <Check className={`h-4 w-4 ${motorsDetail.chatgpt ? 'text-emerald-500' : 'text-slate-200'}`} />
                              ChatGPT
                            </li>
                            <li className={`flex items-center gap-2 font-medium ${motorsDetail.gemini ? 'text-slate-800' : 'text-slate-300'}`}>
                              <Check className={`h-4 w-4 ${motorsDetail.gemini ? 'text-emerald-500' : 'text-slate-200'}`} />
                              Gemini
                            </li>
                          </ul>
                          <p className="mt-3 text-[10px] text-slate-500">Inferido desde la metadata de corrida ejecutada.</p>
                        </div>
                      </div>
                    </>
                  )}
                </section>
              </div>

              {/* Pie */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-100 bg-violet-50/80 px-4 py-3 text-xs text-violet-900">
                <div className="flex items-start gap-2">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <p>
                    <strong>Tip:</strong> unificá tus decisiones con el centro{' '}
                    <Link href={`${basePath}/comparacion`} className="font-semibold underline">
                      Comparación
                    </Link>{' '}
                    y el detalle Premium de cada marca.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={generating}
                  onClick={() => generateNewMonthly()}
                  className="font-semibold text-violet-800 underline underline-offset-2 hover:text-violet-950 disabled:opacity-50"
                >
                  Generar nuevo reporte →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
