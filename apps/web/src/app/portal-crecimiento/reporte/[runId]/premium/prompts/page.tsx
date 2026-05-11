'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  MessageSquare,
  Pencil,
  Play,
  Save,
  Sparkles,
  Target,
  Trash2,
  Wand2,
  X,
  XCircle,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PortalPremiumSidebarNav } from '@/components/portal/portal-premium-sidebar-nav';
import { PORTAL_SESSION_TOKEN_KEY } from '@/components/portal/portal-sign-out';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type WeeklySlotApi = {
  slot: number;
  id: string | null;
  title: string;
  promptText: string;
  updatedAt: string | null;
  lastExecutedAt: string | null;
  resultsCount: number;
};

type WeeklyPromptsPayload = {
  brandId: string;
  runSchedule: string | null;
  selectedWeeklyPortalPromptId: string | null;
  maxSlots: number;
  slots: WeeklySlotApi[];
};

type UsageResponse = {
  planKey?: string;
  planDisplay?: string;
  usage?: { scoreViews?: number };
  limits?: { scoreViews?: number | null };
};

type Top3Entry = { position: number; name: string; type: string };

type PromptRow = {
  id?: string;
  score: number;
  responseText: string;
  top3Json: unknown;
  prompt?: {
    id?: string;
    name?: string | null;
    promptText?: string;
    category?: { name?: string } | null;
  };
};

type RunDetail = {
  id: string;
  brand: { id?: string; name: string; domain?: string | null; aliases?: Array<{ id: string; alias: string }> };
  promptResults: PromptRow[];
};

type ReportItem = {
  id: string;
  createdAt: string;
  score: number | null;
  brand: { id?: string; name: string };
};

function toPct(score: number | null | undefined) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  return n <= 1 ? n * 100 : n;
}

const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .trim();

function isBrandInTop3(brandName: string, aliases: string[], top3Json: unknown): 'yes' | 'partial' | 'no' {
  const arr = Array.isArray(top3Json) ? (top3Json as Top3Entry[]) : [];
  const inSlots = arr.filter((e) => e && e.position >= 1 && e.position <= 3);
  if (inSlots.length === 0 && arr.length === 0) return 'partial';
  if (inSlots.length === 0) return 'partial';
  const matched = inSlots.some((e) => {
    const n = normalizeName(String(e.name));
    if (n === normalizeName(brandName)) return true;
    return aliases.some((a) => n === normalizeName(a));
  });
  return matched ? 'yes' : 'no';
}

function classifyValidity(pr: PromptRow): 'valid' | 'partial' | 'invalid' {
  const score = Number(pr.score);
  const resp = (pr.responseText ?? '').trim();
  const finite = Number.isFinite(score);
  if (!finite) return 'invalid';
  if (resp.length < 20) return 'partial';
  return 'valid';
}

function normalizeIntentionKey(category: string | null, promptText: string): string {
  const c = normalizeName(category ?? '');
  if (c.includes('urgencia')) return 'urgencia';
  if (c.includes('consideracion') || c.includes('consideración')) return 'consideracion';
  if (c.includes('calidad')) return 'calidad';
  if (c.includes('precio')) return 'precio';
  const m = promptText.match(/Intenci[oó]n:\s*([^\(\n]+)/i);
  const fromText = m ? normalizeName(m[1]!.trim()) : '';
  if (fromText.includes('urgencia')) return 'urgencia';
  if (fromText.includes('consideracion')) return 'consideracion';
  if (fromText.includes('calidad')) return 'calidad';
  if (fromText.includes('precio')) return 'precio';
  return 'otros';
}

const INTENTION_STYLE: Record<string, { label: string; pctClass: string; dot: string; donutColor: string }> = {
  urgencia: { label: 'Urgencia', pctClass: 'bg-rose-100 text-rose-800', dot: 'bg-rose-500', donutColor: '#f43f5e' },
  calidad: { label: 'Calidad', pctClass: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500', donutColor: '#3b82f6' },
  precio: { label: 'Precio', pctClass: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500', donutColor: '#f59e0b' },
  consideracion: {
    label: 'Consideración',
    pctClass: 'bg-indigo-100 text-indigo-800',
    dot: 'bg-indigo-500',
    donutColor: '#6366f1',
  },
  otros: { label: 'Información / otros', pctClass: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400', donutColor: '#94a3b8' },
};

function intentionWeightDisplay(category: string | null, promptText: string): string | undefined {
  const m = promptText.match(/Intenci[oó]n:\s*[^\n]*\((\d+)%\)/i);
  if (m) return `${m[1]}%`;
  return undefined;
}

type PortalAnalysisApi = {
  resumen: string;
  puntos_clave: string[];
  graficos: Array<{ titulo: string; items: Array<{ etiqueta: string; valor: number }> }>;
};

type QuickTryPayload = {
  responseText: string;
  analysis: PortalAnalysisApi | null;
  totalTokens?: number;
};

const CHART_COLORS = ['#7c3aed', '#6366f1', '#a78bfa', '#c4b5fd', '#8b5cf6'];

function AnalysisBarChart({
  title,
  data,
}: {
  title: string;
  data: Array<{ etiqueta: string; valor: number }>;
}) {
  const chartData = data.map((d) => ({ name: d.etiqueta.slice(0, 28), valor: d.valor }));
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
      <p className="mb-2 text-[11px] font-bold text-slate-800">{title}</p>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              tick={{ fontSize: 9 }}
              interval={0}
            />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8 }}
              formatter={(v: number) => [`${v}`, 'Relevancia']}
            />
            <Bar dataKey="valor" radius={[0, 6, 6, 0]} maxBarSize={22}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function firstEmptyWeeklySlot(slots: WeeklySlotApi[]): number | null {
  for (let i = 0; i <= 4; i++) {
    const row = slots.find((s) => s.slot === i);
    if (!row?.id || !row.promptText.trim()) return i;
  }
  return null;
}

function buildPromptHeadline(promptText: string, fallback = 'Prompt guardado') {
  const normalized = promptText.trim().replace(/\s+/g, ' ');
  const words = normalized.split(' ').filter(Boolean);
  if (!words.length) return fallback;
  const base = words.slice(0, 3).join(' ');
  const capped = `${base.charAt(0).toUpperCase()}${base.slice(1)}`;
  return words.length > 3 ? `${capped}...` : capped;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildLatestExecutionPayload(
  promptText: string,
  quickResult: QuickTryPayload | null,
  draftPrompt: string
) {
  if (!quickResult?.responseText?.trim()) return undefined;
  if (promptText.trim() !== draftPrompt.trim()) return undefined;
  return {
    responseText: quickResult.responseText,
    analysis: quickResult.analysis ?? null,
  };
}

function Donut({
  segments,
  total,
}: {
  segments: Array<{ label: string; count: number; color: string }>;
  total: number;
}) {
  const r = 40;
  const cx = 60;
  const cy = 60;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  if (total <= 0) {
    return (
      <svg viewBox="0 0 120 120" className="mx-auto h-36 w-36">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth="18" />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="16" fontWeight="700" fill="#1e293b">
          0
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8" fill="#64748b">
          prompts
        </text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 120" className="mx-auto h-36 w-36 shrink-0">
      {segments.map((seg, i) => {
        const dash = (seg.count / total) * circ;
        const el = (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth="18"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        );
        offset += dash;
        return el;
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="16" fontWeight="700" fill="#1e293b">
        {total}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8" fill="#64748b">
        prompts
      </text>
    </svg>
  );
}

export default function PromptsCorridaPage() {
  const params = useParams();
  const router = useRouter();
  const runId = params.runId as string;
  const basePath = `/portal-crecimiento/reporte/${runId}/premium`;

  const [run, setRun] = useState<RunDetail | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [weeklyData, setWeeklyData] = useState<WeeklyPromptsPayload | null>(null);
  const [weeklyLoadError, setWeeklyLoadError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorSlot, setEditorSlot] = useState(0);
  const [editorText, setEditorText] = useState('');
  const [weeklySaving, setWeeklySaving] = useState(false);
  const [executingSavedPromptId, setExecutingSavedPromptId] = useState<string | null>(null);

  /** Consulta rápida: escribe → ejecutá → ver mini análisis (no es la corrida diagnóstico guardada). */
  const [draftPrompt, setDraftPrompt] = useState('');
  const [quickTryLoading, setQuickTryLoading] = useState(false);
  const [quickTryError, setQuickTryError] = useState<string | null>(null);
  const [quickResult, setQuickResult] = useState<QuickTryPayload | null>(null);
  const [openedFromQuickTry, setOpenedFromQuickTry] = useState(false);
  const [inlineOk, setInlineOk] = useState<string | null>(null);
  const [customPromptOpen, setCustomPromptOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let token: string | null = null;
        try {
          token = sessionStorage.getItem(PORTAL_SESSION_TOKEN_KEY);
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
          sessionStorage.removeItem(PORTAL_SESSION_TOKEN_KEY);
          setLoadError('Sesión vencida.');
          setLoading(false);
          return;
        }
        if (!runRes.ok) {
          const b = await runRes.json().catch(() => ({}));
          throw new Error((b as { error?: string }).error || `Error ${runRes.status}`);
        }
        const runBody = (await runRes.json()) as RunDetail;
        const usageBody = usageRes.ok ? ((await usageRes.json()) as UsageResponse) : {};
        const reps = fetch(`${API_URL}/api/reports/app/reports`, { cache: 'no-store', headers });
        const r = await reps;
        const list = r.ok ? ((await r.json()) as ReportItem[]) : [];

        if (!cancelled) {
          setRun(runBody);
          setUsage(usageBody);
          setReports(Array.isArray(list) ? list : []);
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

  useEffect(() => {
    const brandId = run?.brand?.id;
    if (!brandId) {
      setWeeklyData(null);
      setWeeklyLoadError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        let token: string | null = null;
        try {
          token = sessionStorage.getItem(PORTAL_SESSION_TOKEN_KEY);
        } catch {
          token = null;
        }
        if (!token) return;
        const res = await fetch(`${API_URL}/api/portal/brands/${encodeURIComponent(brandId)}/weekly-prompts`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (res.status === 401) {
          sessionStorage.removeItem(PORTAL_SESSION_TOKEN_KEY);
          return;
        }
        if (!res.ok) {
          const b = await res.json().catch(() => ({}));
          setWeeklyLoadError((b as { error?: string }).error || `Error ${res.status}`);
          setWeeklyData(null);
          return;
        }
        setWeeklyLoadError(null);
        setWeeklyData((await res.json()) as WeeklyPromptsPayload);
      } catch {
        if (!cancelled) {
          setWeeklyLoadError('No se pudieron cargar los prompts guardados.');
          setWeeklyData(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [run?.brand?.id]);

  const aliases = run?.brand.aliases?.map((a) => a.alias).filter(Boolean) ?? [];
  const brandName = run?.brand.name ?? '';

  const brandReports = useMemo(() => {
    if (!run) return [];
    return [...reports]
      .filter((x) =>
        x.brand?.id && run.brand?.id ? x.brand.id === run.brand.id : x.brand.name === run.brand.name,
      )
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [reports, run]);

  const historyPoints = useMemo(
    () =>
      [...brandReports]
        .filter((r) => r.score != null)
        .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
        .slice(-8),
    [brandReports],
  );

  const evolutionDelta =
    historyPoints.length >= 2
      ? Math.round(
          (toPct(historyPoints[historyPoints.length - 1]!.score) - toPct(historyPoints[0]!.score)) * 10,
        ) / 10
      : 0;

  const corridaDisplay = brandReports.find((r) => r.id === runId)?.createdAt
    ?? brandReports[0]?.createdAt
    ?? '';

  const results = run?.promptResults ?? [];
  const executed = results.length;

  const validityBuckets = useMemo(() => {
    let v = 0;
    let p = 0;
    let i = 0;
    results.forEach((pr) => {
      const t = classifyValidity(pr);
      if (t === 'valid') v += 1;
      else if (t === 'partial') p += 1;
      else i += 1;
    });
    return { valid: v, partial: p, invalid: i };
  }, [results]);

  const avgPct = useMemo(() => {
    if (!results.length) return 0;
    const sum = results.reduce((a, pr) => a + toPct(pr.score), 0);
    return Math.round(sum / results.length);
  }, [results]);

  const hasSavedWeeklyPrompts = useMemo(
    () => Boolean(weeklyData?.slots.some((s) => s.id && s.promptText.trim())),
    [weeklyData],
  );

  const donutSegments = useMemo(() => {
    const counts: Record<string, number> = {};
    results.forEach((pr) => {
      const txt = pr.prompt?.promptText ?? '';
      const key = normalizeIntentionKey(pr.prompt?.category?.name ?? null, txt);
      counts[key] = (counts[key] ?? 0) + 1;
    });
    const order = ['urgencia', 'calidad', 'precio', 'consideracion', 'otros'] as const;
    return order
      .filter((k) => (counts[k] ?? 0) > 0)
      .map((k) => ({
        label: INTENTION_STYLE[k]?.label ?? k,
        count: counts[k] ?? 0,
        color: INTENTION_STYLE[k]?.donutColor ?? '#94a3b8',
      }));
  }, [results]);

  function csvEscape(s: string) {
    const t = String(s ?? '').replace(/"/g, '""');
    return `"${t}"`;
  }

  function downloadCsv() {
    const header = ['#', 'Título', 'Categoría / intención', 'Score %', 'Prompt', 'Respuesta truncada'];
    const lines = [
      header.join(','),
      ...results.map((pr, i) => {
        const title =
          (pr.prompt?.name && String(pr.prompt.name).trim()) ||
          pr.prompt?.category?.name ||
          `Prompt ${i + 1}`;
        const intKey = normalizeIntentionKey(pr.prompt?.category?.name ?? null, pr.prompt?.promptText ?? '');
        const cat =
          intKey === 'otros'
            ? pr.prompt?.category?.name?.trim() || '—'
            : INTENTION_STYLE[intKey]?.label ?? pr.prompt?.category?.name ?? '—';
        const pct = Math.round(toPct(pr.score));
        const promptText = pr.prompt?.promptText ?? '';
        const respSnippet = (pr.responseText ?? '').slice(0, 500);
        return [i + 1, title, cat, pct, promptText, respSnippet].map((cell) => csvEscape(String(cell))).join(',');
      }),
    ].join('\n');
    const blob = new Blob([lines], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cleexs-prompts-${runId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openEditorForSlot(slot: number) {
    setOpenedFromQuickTry(false);
    const row = weeklyData?.slots.find((s) => s.slot === slot);
    setEditorSlot(slot);
    setEditorText(row?.promptText ?? '');
    setEditorOpen(true);
  }

  function openSaveDraftToSlotModal() {
    const text = draftPrompt.trim();
    if (!text || !weeklyData || !run?.brand?.id) return;
    let slot = 0;
    for (let i = 0; i <= 4; i++) {
      const row = weeklyData.slots.find((s) => s.slot === i);
      if (!row?.id || !row.promptText.trim()) {
        slot = i;
        break;
      }
      slot = i;
    }
    setCustomPromptOpen(false);
    setOpenedFromQuickTry(true);
    setEditorSlot(slot);
    setEditorText(text);
    setEditorOpen(true);
  }

  async function runQuickConsulta() {
    const brandId = run?.brand?.id;
    if (!brandId) return;
    const text = draftPrompt.trim();
    if (!text || text.length < 5) {
      setQuickTryError('Escribí al menos una consulta (5 caracteres o más).');
      return;
    }
    let token: string | null = null;
    try {
      token = sessionStorage.getItem(PORTAL_SESSION_TOKEN_KEY);
    } catch {
      token = null;
    }
    if (!token) {
      setQuickTryError('No hay sesión.');
      return;
    }
    setQuickTryLoading(true);
    setQuickTryError(null);
    setQuickResult(null);
    try {
      const res = await fetch(`${API_URL}/api/portal/brands/${encodeURIComponent(brandId)}/prompt-try`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptText: text }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) {
        setQuickTryError((b as { error?: string }).error || `Error ${res.status}`);
        return;
      }
      const body = b as QuickTryPayload;
      if (!body.responseText || typeof body.responseText !== 'string') {
        setQuickTryError('Respuesta del servidor incompleta.');
        return;
      }
      setQuickResult(body);
    } catch {
      setQuickTryError('No se pudo ejecutar la consulta.');
    } finally {
      setQuickTryLoading(false);
    }
  }

  async function persistWeeklyPayload(): Promise<boolean> {
    const brandId = run?.brand?.id;
    if (!brandId) return false;
    const token = sessionStorage.getItem(PORTAL_SESSION_TOKEN_KEY);
    if (!token) return false;
    const res = await fetch(`${API_URL}/api/portal/brands/${encodeURIComponent(brandId)}/weekly-prompts`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setWeeklyData((await res.json()) as WeeklyPromptsPayload);
    return res.ok;
  }

  /** PUT slot; refresca lista. Devuelve id del guardado o null si falla. */
  async function putWeeklySlot(
    slot: number,
    promptText: string,
    latestExecution?: { responseText: string; analysis: PortalAnalysisApi | null }
  ): Promise<string | null> {
    const brandId = run?.brand?.id;
    if (!brandId) return null;
    const token = sessionStorage.getItem(PORTAL_SESSION_TOKEN_KEY);
    if (!token) return null;
    const res = await fetch(
      `${API_URL}/api/portal/brands/${encodeURIComponent(brandId)}/weekly-prompts/${slot}`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptText: promptText.trim(), latestExecution }),
      },
    );
    const b = await res.json().catch(() => ({}));
    if (!res.ok) {
      setWeeklyLoadError((b as { error?: string }).error || 'No se pudo guardar.');
      return null;
    }
    setWeeklyLoadError(null);
    const id = (b as { id?: string }).id;
    await persistWeeklyPayload();
    return id ?? null;
  }

  async function saveDraftFromToolbar() {
    setWeeklyLoadError(null);
    setInlineOk(null);
    setQuickTryError(null);
    const text = draftPrompt.trim();
    if (text.length < 1) {
      setQuickTryError('Escribí un texto para guardar.');
      return;
    }
    if (!run?.brand?.id || !weeklyData) {
      setQuickTryError('Esperá a que carguen los datos de la marca.');
      return;
    }
    const slot = firstEmptyWeeklySlot(weeklyData.slots);
    if (slot === null) {
      setWeeklyLoadError('Las 5 opciones están llenas. Editá o borrá una en la lista de la derecha.');
      return;
    }
    setWeeklySaving(true);
    try {
      const id = await putWeeklySlot(slot, text, buildLatestExecutionPayload(text, quickResult, draftPrompt));
      if (id) setInlineOk(`Guardado en la opción ${slot + 1}.`);
    } finally {
      setWeeklySaving(false);
    }
  }

  async function saveDraftAndWeeklyFromToolbar() {
    setWeeklyLoadError(null);
    setInlineOk(null);
    setQuickTryError(null);
    const text = draftPrompt.trim();
    if (text.length < 1) {
      setQuickTryError('Escribí un texto para la ejecución semanal.');
      return;
    }
    if (!run?.brand?.id || !weeklyData) return;
    const slot = firstEmptyWeeklySlot(weeklyData.slots);
    if (slot === null) {
      setWeeklyLoadError('Las 5 opciones están llenas. Liberá un espacio para guardar y marcar semanal.');
      return;
    }
    setWeeklySaving(true);
    try {
      const id = await putWeeklySlot(slot, text, buildLatestExecutionPayload(text, quickResult, draftPrompt));
      if (!id) return;
      const token = sessionStorage.getItem(PORTAL_SESSION_TOKEN_KEY);
      if (!token) return;
      const sel = await fetch(
        `${API_URL}/api/portal/brands/${encodeURIComponent(run.brand.id)}/weekly-prompts/selection`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ savedPromptId: id }),
        },
      );
      if (!sel.ok) {
        const b = await sel.json().catch(() => ({}));
        setWeeklyLoadError((b as { error?: string }).error || 'No se pudo marcar para semanal.');
        return;
      }
      await persistWeeklyPayload();
      setInlineOk(`Opción ${slot + 1} guardada y elegida para corridas weekly_portal.`);
    } finally {
      setWeeklySaving(false);
    }
  }

  async function saveEditorSlot() {
    const brandId = run?.brand?.id;
    if (!brandId) return;
    const token = sessionStorage.getItem(PORTAL_SESSION_TOKEN_KEY);
    if (!token) return;
    const text = editorText.trim();
    if (!text) return;
    setWeeklySaving(true);
    try {
      const res = await fetch(
        `${API_URL}/api/portal/brands/${encodeURIComponent(brandId)}/weekly-prompts/${editorSlot}`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            promptText: text,
            latestExecution: openedFromQuickTry ? buildLatestExecutionPayload(text, quickResult, draftPrompt) : undefined,
          }),
        },
      );
      if (res.ok) {
        setEditorOpen(false);
        setOpenedFromQuickTry(false);
        await persistWeeklyPayload();
      } else {
        const b = await res.json().catch(() => ({}));
        setWeeklyLoadError((b as { error?: string }).error || 'No se pudo guardar.');
      }
    } finally {
      setWeeklySaving(false);
    }
  }

  async function deleteSlot(slot: number) {
    const brandId = run?.brand?.id;
    if (!brandId) return;
    const token = sessionStorage.getItem(PORTAL_SESSION_TOKEN_KEY);
    if (!token) return;
    if (!confirm('¿Borrar esta opción guardada?')) return;
    setWeeklySaving(true);
    try {
      const res = await fetch(
        `${API_URL}/api/portal/brands/${encodeURIComponent(brandId)}/weekly-prompts/${slot}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok || res.status === 204) await persistWeeklyPayload();
    } finally {
      setWeeklySaving(false);
    }
  }

  async function setWeeklySelection(savedPromptId: string | null) {
    const brandId = run?.brand?.id;
    if (!brandId) return;
    const token = sessionStorage.getItem(PORTAL_SESSION_TOKEN_KEY);
    if (!token) return;
    setWeeklySaving(true);
    try {
      const res = await fetch(
        `${API_URL}/api/portal/brands/${encodeURIComponent(brandId)}/weekly-prompts/selection`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ savedPromptId }),
        },
      );
      if (res.ok) await persistWeeklyPayload();
      else {
        const b = await res.json().catch(() => ({}));
        setWeeklyLoadError((b as { error?: string }).error || 'No se pudo actualizar la selección.');
      }
    } finally {
      setWeeklySaving(false);
    }
  }

  async function executeSavedPrompt(savedPromptId: string) {
    const brandId = run?.brand?.id;
    if (!brandId) return;
    const token = sessionStorage.getItem(PORTAL_SESSION_TOKEN_KEY);
    if (!token) return;

    setQuickTryError(null);
    setInlineOk(null);
    setExecutingSavedPromptId(savedPromptId);
    try {
      const res = await fetch(
        `${API_URL}/api/portal/brands/${encodeURIComponent(brandId)}/weekly-prompts/${encodeURIComponent(savedPromptId)}/execute`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setWeeklyLoadError((body as { error?: string }).error || `Error ${res.status}`);
        return;
      }
      await persistWeeklyPayload();
      router.push(`${basePath}/prompts/resultados`);
    } finally {
      setExecutingSavedPromptId(null);
    }
  }

  if (loadError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-rose-700">{loadError}</p>
          <Link href="/portal-crecimiento" className="mt-4 block text-xs font-semibold text-violet-700 hover:underline">
            ← Portal
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-3 sm:p-5">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[280px_1fr]">
        <PortalPremiumSidebarNav runId={runId} usage={usage} loadingPlan={loading} />

        <div className="min-w-0 space-y-4">
          {loading ? (
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-10 shadow-sm">
              <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
              <p className="text-sm text-slate-600">Cargando prompts…</p>
            </div>
          ) : !run ? (
            <p className="text-sm text-slate-500">No se pudo cargar la corrida.</p>
          ) : (
            <>
              <nav className="flex flex-wrap gap-1 text-xs text-slate-500">
                <span className="font-medium text-violet-700">Prompts</span>
                <span>/</span>
                <span>
                  Corrida:{' '}
                  {corridaDisplay ? new Date(corridaDisplay).toLocaleDateString('es-AR') : '—'}
                </span>
              </nav>

              <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Prompts · corrida diagnóstico
                  </div>
                  <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Prompts de esta corrida</h1>
                  <p className="mt-1 text-sm text-slate-600">Detalle de las consultas ejecutadas en esta corrida de diagnóstico.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => executed && downloadCsv()}
                    disabled={!executed}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Descargar CSV
                  </button>
                  <Link
                    href={`/portal-crecimiento/reporte/${runId}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border-2 border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800 hover:bg-violet-100"
                  >
                    Ver informe completo
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              {historyPoints.length >= 2 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-100 bg-violet-50/80 p-4 shadow-sm">
                  <div className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
                    <div>
                      <p className="text-sm font-semibold text-violet-950">
                        {evolutionDelta >= 0
                          ? 'Buen ritmo de evolución en el score'
                          : 'Hay margen de mejora en la evolución'}
                      </p>
                      <p className="mt-0.5 text-xs text-violet-900/80">
                        Tu visibilidad en IA cambió{' '}
                        <strong>
                          {evolutionDelta >= 0 ? '+' : ''}
                          {evolutionDelta}
                        </strong>{' '}
                        puntos entre las primeras y últimas corridas con score en tu historial.
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`${basePath}/comparacion`}
                    className="shrink-0 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-800 hover:bg-violet-50"
                  >
                    Ver comparación vs competidores →
                  </Link>
                </div>
              )}

              {weeklyLoadError ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
                  {weeklyLoadError}
                </div>
              ) : null}

              <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:gap-8">
                <div className="min-w-0 flex-1 space-y-5">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-2 text-[11px] text-slate-600">
                    <strong className="text-slate-800">Corrida guardada</strong>{' '}
                    {corridaDisplay ? `(${new Date(corridaDisplay).toLocaleDateString('es-AR')})` : ''}{' '}
                    — resumen
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <StatCard
                      icon={<Sparkles className="h-4 w-4 text-violet-600" />}
                      label="Prompts ejecutados"
                      value={String(executed)}
                      sub={executed ? 'Esta corrida' : '—'}
                    />
                    <StatCard
                      icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                      label="Válidos"
                      value={String(validityBuckets.valid)}
                      sub="Datos utilizables"
                    />
                    <StatCard
                      icon={<span className="block h-3 w-3 rounded-full bg-amber-400" />}
                      label="Parciales"
                      value={String(validityBuckets.partial)}
                      sub="Limitados"
                    />
                    <StatCard
                      icon={<XCircle className="h-4 w-4 text-red-500" />}
                      label="No válidos"
                      value={String(validityBuckets.invalid)}
                      sub="Sin datos útiles"
                    />
                    <StatCard
                      icon={<BarChart3 className="h-4 w-4 text-blue-600" />}
                      label="Promedio corrida"
                      value={`${avgPct}%`}
                      sub="Sobre todas las consultas guardadas"
                    />
                  </div>

                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                      <Target className="h-5 w-5 text-violet-600" />
                      <h2 className="font-bold text-slate-900">Historial de prompts (corrida guardada)</h2>
                    </div>

                    {!executed ? (
                      <p className="text-sm text-slate-500">No hay prompts en esta corrida.</p>
                    ) : (
                      <ul className="space-y-2">
                        {results.map((pr, i) => {
                          const id = pr.id ?? pr.prompt?.id ?? `pr-${i}`;
                          const txt = pr.prompt?.promptText ?? '';
                          const keyHint = normalizeIntentionKey(pr.prompt?.category?.name ?? null, txt);
                          const style = INTENTION_STYLE[keyHint] ?? INTENTION_STYLE.otros;
                          const pct = intentionWeightDisplay(pr.prompt?.category?.name ?? null, txt);
                          const title =
                            (pr.prompt?.name && String(pr.prompt.name).trim()) || style.label + (pct ? ` ${pct}` : '');
                          const sc = Math.round(toPct(pr.score));
                          const t3 = isBrandInTop3(brandName, aliases, pr.top3Json);
                          const open = expandedId === id;

                          return (
                            <li
                              key={`${id}-${i}`}
                              className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/40 transition-colors hover:border-violet-200"
                            >
                              <button
                                type="button"
                                onClick={() => setExpandedId(open ? null : id)}
                                className="flex w-full items-start gap-3 p-3 text-left"
                              >
                                <span className="mt-0.5 w-5 shrink-0 text-center text-xs font-medium text-slate-400">{i + 1}</span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${style.pctClass}`}>
                                      {style.label}
                                      {pct ? ` ${pct}` : ''}
                                    </span>
                                  </div>
                                  <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900">{title}</p>
                                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{txt || '—'}</p>
                                  {pr.prompt?.category?.name ? (
                                    <p className="mt-1 text-[10px] text-slate-500">
                                      API:{' '}
                                      <span className="font-medium text-slate-700">{pr.prompt.category.name}</span>
                                    </p>
                                  ) : null}
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1 pr-1">
                                  <div className="text-right">
                                    <p className="text-[9px] uppercase text-slate-400">Score</p>
                                    <p className="text-lg font-bold text-violet-700">{sc}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[9px] uppercase text-slate-400">Top 3</p>
                                    <span
                                      className={`text-[10px] font-bold ${
                                        t3 === 'yes'
                                          ? 'text-emerald-600'
                                          : t3 === 'partial'
                                            ? 'text-amber-600'
                                            : 'text-slate-500'
                                      }`}
                                    >
                                      {t3 === 'yes' ? 'Sí' : t3 === 'partial' ? 'Parcial' : 'No'}
                                    </span>
                                  </div>
                                  {open ? (
                                    <ChevronUp className="h-4 w-4 text-slate-400" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 text-slate-400" />
                                  )}
                                </div>
                              </button>
                              {open && (
                                <div className="border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-700">
                                  <p className="font-semibold text-slate-800">Respuesta (extracto)</p>
                                  <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                                    {(pr.responseText ?? '').slice(0, 1200)}
                                    {(pr.responseText ?? '').length > 1200 ? '…' : ''}
                                  </p>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                </div>

                <div className="w-full shrink-0 space-y-3 xl:w-[300px] xl:sticky xl:top-4 xl:self-start">
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="mb-2 text-xs font-bold text-slate-900">Intenciones · esta corrida</p>
                      <Donut segments={donutSegments} total={executed} />
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="mb-2 text-[10px] font-bold text-slate-900">¿Qué es cada intención?</p>
                      <ul className="space-y-2 text-[10px] text-slate-600">
                        {Object.entries(INTENTION_STYLE).map(([k, v]) =>
                          k === 'otros' ? null : (
                            <li key={k} className="flex gap-2">
                              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${v.dot}`} />
                              <span>
                                <strong className="text-slate-800">{v.label}</strong> — desde categoría/texto del prompt.
                              </span>
                            </li>
                          ),
                        )}
                      </ul>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="mb-2 text-[10px] font-bold text-slate-900">Escala Cleexs</p>
                      <ul className="space-y-1 text-[10px] text-slate-600">
                        <li>
                          <span className="font-semibold text-violet-700">80–100</span> excelente
                        </li>
                        <li>
                          <span className="font-semibold text-blue-700">60–79</span> bien
                        </li>
                        <li>
                          <span className="font-semibold text-amber-700">40–59</span> regular
                        </li>
                        <li>
                          <span className="font-semibold text-red-700">0–39</span> muy bajo
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="space-y-4 border-t border-slate-200 pt-4">
                    {!run.brand?.id ? (
                      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                        Este informe no tiene marca vinculada.
                      </p>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomPromptOpen(true);
                            setInlineOk(null);
                            setQuickTryError(null);
                          }}
                          className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-indigo-600 p-[1px] shadow-lg shadow-violet-500/25 transition hover:shadow-violet-500/40"
                        >
                          <span className="flex w-full flex-col items-center gap-1 rounded-[15px] bg-gradient-to-b from-white/15 to-transparent px-4 py-4 text-center">
                            <span className="inline-flex items-center gap-2 text-sm font-bold tracking-tight text-white drop-shadow-sm">
                              <Sparkles className="h-5 w-5 shrink-0 text-amber-200" strokeWidth={2.2} />
                              Generá tu propio prompt
                            </span>
                            <span className="text-[11px] font-medium text-violet-100/95">
                              Abrí el asistente: ejecutar, analizar y guardar en tu cuenta
                            </span>
                          </span>
                        </button>

                        <Link
                          href={`${basePath}/prompts/resultados`}
                          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-200 bg-white px-4 py-3 text-sm font-bold text-violet-800 shadow-sm transition hover:bg-violet-50"
                        >
                          <BarChart3 className="h-4 w-4" />
                          Resultados
                        </Link>

                        {!weeklyData ? (
                          <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-4 text-xs text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
                            Cargando prompts guardados…
                          </div>
                        ) : hasSavedWeeklyPrompts ? (
                          <div className="rounded-2xl border border-violet-200/90 bg-gradient-to-br from-violet-50/90 via-white to-fuchsia-50/30 p-3 shadow-md ring-1 ring-violet-100/80">
                            <p className="text-[10px] font-black uppercase tracking-wider text-violet-800">Guardados en cuenta</p>
                            <p className="mt-0.5 text-[10px] text-slate-600">
                              Marcá uno para{' '}
                              <code className="rounded bg-white/90 px-0.5 font-mono text-[9px]">weekly_portal</code>
                            </p>
                            <ul className="mt-3 space-y-2">
                              {weeklyData.slots
                                .filter((s) => s.id && s.promptText.trim())
                                .map((s) => {
                                  const selected = weeklyData.selectedWeeklyPortalPromptId === s.id;
                                  const executionLabel = formatDateTime(s.lastExecutedAt);
                                  const updatedLabel = formatDateTime(s.updatedAt);
                                  const autoTitle = buildPromptHeadline(s.promptText, s.title?.trim() || 'Prompt guardado');
                                  return (
                                    <li
                                      key={s.slot}
                                      className={`rounded-xl border p-2.5 shadow-sm transition ${
                                        selected
                                          ? 'border-violet-400 bg-white ring-2 ring-violet-200/60'
                                          : 'border-white/80 bg-white/70 backdrop-blur-sm'
                                      }`}
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                          <span className="text-[9px] font-black text-slate-400">#{s.slot + 1}</span>
                                          <p className="truncate text-xs font-bold text-slate-900">
                                            {autoTitle}
                                          </p>
                                          <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-slate-500">
                                            {s.promptText}
                                          </p>
                                          <p className="mt-1 text-[9px] font-medium text-slate-500">
                                            {executionLabel
                                              ? `Ejecutado: ${executionLabel}`
                                              : updatedLabel
                                                ? `Guardado: ${updatedLabel}`
                                                : 'Aún sin ejecución'}
                                          </p>
                                        </div>
                                        <div className="flex shrink-0 flex-col items-end gap-1">
                                          <label className="inline-flex cursor-pointer items-center gap-1 text-[9px] font-bold text-violet-800">
                                            <input
                                              type="radio"
                                              name="weekly-prompt-pick-rail"
                                              checked={selected}
                                              disabled={weeklySaving || !s.id}
                                              onChange={() => s.id && void setWeeklySelection(s.id)}
                                              className="text-violet-600"
                                            />
                                            Semanal
                                          </label>
                                          <div className="flex gap-1">
                                            <button
                                              type="button"
                                              disabled={weeklySaving || executingSavedPromptId === s.id || !s.id}
                                              onClick={() => s.id && void executeSavedPrompt(s.id)}
                                              className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-800 shadow-sm hover:bg-emerald-100 disabled:opacity-50"
                                            >
                                              {executingSavedPromptId === s.id ? (
                                                <Loader2 className="mr-0.5 inline h-3 w-3 animate-spin align-text-bottom" />
                                              ) : (
                                                <Play className="mr-0.5 inline h-3 w-3 align-text-bottom" />
                                              )}
                                              Ejecutar
                                            </button>
                                            <button
                                              type="button"
                                              disabled={weeklySaving}
                                              onClick={() => openEditorForSlot(s.slot)}
                                              className="rounded-lg border border-slate-200/80 bg-white px-2 py-0.5 text-[9px] font-bold text-slate-700 shadow-sm hover:bg-violet-50 disabled:opacity-50"
                                            >
                                              <Pencil className="mr-0.5 inline h-3 w-3 align-text-bottom" />
                                              Editar
                                            </button>
                                            <button
                                              type="button"
                                              disabled={weeklySaving}
                                              onClick={() => void deleteSlot(s.slot)}
                                              className="rounded-lg border border-rose-100 bg-rose-50 px-2 py-0.5 disabled:opacity-50"
                                              aria-label="Borrar"
                                            >
                                              <Trash2 className="h-3 w-3 text-rose-700" />
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </li>
                                  );
                                })}
                            </ul>
                            {weeklyData.runSchedule === 'semanal' ? (
                              <p className="mt-3 rounded-lg bg-violet-100/90 px-2.5 py-1.5 text-[9px] font-semibold text-violet-950">
                                Plan semanal activo · n8n tipo <code className="font-mono">weekly_portal</code>
                              </p>
                            ) : null}
                            {weeklyData.selectedWeeklyPortalPromptId ? (
                              <button
                                type="button"
                                disabled={weeklySaving}
                                onClick={() => void setWeeklySelection(null)}
                                className="mt-2 w-full rounded-lg border border-slate-200/80 bg-white/80 py-2 text-[10px] font-semibold text-slate-600 hover:bg-white"
                              >
                                Quitar selección semanal
                              </button>
                            ) : (
                              <p className="mt-2 text-[9px] text-slate-500">
                                Sin radio marcado, <code className="rounded bg-white px-0.5">weekly_portal</code> puede fallar.
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="rounded-xl border border-dashed border-violet-200 bg-violet-50/40 px-3 py-3 text-center text-[11px] leading-snug text-slate-600">
                            Cuando guardes un prompt desde el popup, aparecerá una lista compacta acá para editarlo o marcarlo
                            semanal.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {customPromptOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 backdrop-blur-[2px] sm:p-4"
          onClick={() => {
            if (!weeklySaving && !quickTryLoading) setCustomPromptOpen(false);
          }}
          role="presentation"
        >
          <div
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-violet-100 bg-white shadow-2xl shadow-violet-900/10"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="custom-prompt-title"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-violet-100 bg-gradient-to-r from-violet-50/95 to-white px-5 py-4 backdrop-blur-sm">
              <div>
                <h2 id="custom-prompt-title" className="text-lg font-bold text-slate-900">
                  Tu propio prompt
                </h2>
                <p className="mt-0.5 text-xs text-slate-600">
                  La IA usa el contexto de tu marca de este portal. Ejecutá para ver la respuesta y un análisis con gráficos.
                </p>
              </div>
              <button
                type="button"
                disabled={weeklySaving || quickTryLoading}
                onClick={() => setCustomPromptOpen(false)}
                className="rounded-xl p-2 text-slate-500 transition hover:bg-white hover:text-slate-800 disabled:opacity-40"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              {!run?.brand?.id ? (
                <p className="text-sm text-amber-800">Este informe no tiene marca vinculada.</p>
              ) : (
                <>
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Consulta
                    </label>
                    <textarea
                      value={draftPrompt}
                      onChange={(e) => {
                        setDraftPrompt(e.target.value);
                        setInlineOk(null);
                      }}
                      placeholder="Ej: Estoy evaluando proveedores de software X en mi región. ¿Qué opciones recomendarías y por qué?"
                      rows={7}
                      className="w-full resize-y rounded-2xl border-2 border-slate-200/90 bg-slate-50/80 px-4 py-3.5 text-[15px] leading-relaxed text-slate-900 shadow-inner outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:shadow-[0_0_0_4px_rgba(139,92,246,0.12)]"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={
                          quickTryLoading || weeklySaving || !draftPrompt.trim() || draftPrompt.trim().length < 5
                        }
                        onClick={() => void runQuickConsulta()}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-violet-500/25 transition hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 min-[420px]:flex-none"
                      >
                        {quickTryLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        {quickTryLoading ? 'Ejecutando…' : 'Ejecutar'}
                      </button>
                      <button
                        type="button"
                        disabled={weeklySaving || quickTryLoading || !draftPrompt.trim() || !weeklyData}
                        onClick={() => void saveDraftFromToolbar()}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-violet-200 hover:bg-violet-50/50 disabled:opacity-50 min-[420px]:flex-none"
                      >
                        {weeklySaving ? (
                          <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
                        ) : (
                          <Save className="h-4 w-4 text-violet-600" />
                        )}
                        Guardar
                      </button>
                      <button
                        type="button"
                        disabled={weeklySaving || quickTryLoading || !draftPrompt.trim() || !weeklyData}
                        onClick={() => void saveDraftAndWeeklyFromToolbar()}
                        className="inline-flex flex-1 basis-full items-center justify-center gap-2 rounded-2xl border-2 border-violet-200 bg-violet-50/80 px-4 py-3 text-sm font-semibold text-violet-900 shadow-sm transition hover:bg-violet-100 disabled:opacity-50 sm:basis-auto"
                      >
                        <CalendarClock className="h-4 w-4 shrink-0" />
                        Ejecución semanal
                      </button>
                    </div>
                    {inlineOk ? <p className="mt-2 text-xs font-medium text-emerald-700">{inlineOk}</p> : null}
                    {quickTryError ? <p className="mt-2 text-xs font-medium text-rose-600">{quickTryError}</p> : null}
                  </div>

                  {quickResult ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4 sm:p-5">
                      <p className="text-xs font-bold uppercase tracking-wide text-violet-700">Análisis de la respuesta</p>
                      {quickResult.analysis ? (
                        <>
                          <p className="mt-2 text-sm leading-relaxed text-slate-800">{quickResult.analysis.resumen}</p>
                          {quickResult.analysis.puntos_clave?.length ? (
                            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
                              {quickResult.analysis.puntos_clave.map((pt, idx) => (
                                <li key={idx}>{pt}</li>
                              ))}
                            </ul>
                          ) : null}
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            {quickResult.analysis.graficos?.slice(0, 2).map((g, idx) => (
                              <AnalysisBarChart key={idx} title={g.titulo} data={g.items ?? []} />
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="mt-2 text-sm text-slate-600">No hubo análisis estructurado para esta respuesta.</p>
                      )}
                      <details className="group mt-4 rounded-xl border border-slate-200 bg-white">
                        <summary className="cursor-pointer px-4 py-2.5 text-xs font-semibold text-violet-800 hover:bg-violet-50/80">
                          Ver texto completo de la IA
                        </summary>
                        <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap border-t border-slate-100 p-4 text-[11px] leading-relaxed text-slate-600">
                          {(quickResult.responseText ?? '').slice(0, 12000)}
                        </pre>
                      </details>
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                        <button
                          type="button"
                          onClick={() => openSaveDraftToSlotModal()}
                          disabled={!weeklyData || weeklySaving || !draftPrompt.trim()}
                          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-45"
                        >
                          Guardar en tus opciones
                        </button>
                        <button
                          type="button"
                          disabled={weeklySaving}
                          onClick={() => setQuickResult(null)}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          Ocultar resultado
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {editorOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]"
          onClick={() => {
              if (!weeklySaving) {
                setEditorOpen(false);
                setOpenedFromQuickTry(false);
              }
            }}
          role="presentation"
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-lg font-bold text-slate-900">Opción {editorSlot + 1}</h3>
            <p className="mt-1 text-xs text-slate-600">
              {openedFromQuickTry
                ? 'Vas a guardar en tu cuenta el texto del popup (podés editarlo antes de confirmar). Después podés marcar esta opción para weekly_portal en la lista de la derecha.'
                : 'Guardá texto en tu cuenta para sincronizar con weekly_portal. Podés abrir “Generá tu propio prompt” para probar antes de guardar.'}
            </p>
            {openedFromQuickTry ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-500">Opción:</span>
                {[0, 1, 2, 3, 4].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setEditorSlot(s)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                      editorSlot === s
                        ? 'bg-violet-600 text-white shadow'
                        : 'border border-slate-200 bg-white text-slate-600 hover:border-violet-300'
                    }`}
                  >
                    {s + 1}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/60 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-violet-700">Nombre automático</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {buildPromptHeadline(editorText)}
              </p>
            </div>
            <textarea
              value={editorText}
              onChange={(e) => setEditorText(e.target.value)}
              placeholder="Ej: ¿Qué marca recomendarías para [caso de uso] en [ubicación]? Pedí Top 3 con motivos breves."
              className="mt-2 h-40 w-full resize-y rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(editorText)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Copiar texto
              </button>
              <button
                type="button"
                disabled={weeklySaving || !editorText.trim()}
                onClick={() => void saveEditorSlot()}
                className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {weeklySaving ? 'Guardando…' : 'Guardar en cuenta'}
              </button>
              <button
                type="button"
                disabled={weeklySaving}
                onClick={() => {
                  setEditorOpen(false);
                  setOpenedFromQuickTry(false);
                }}
                className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50">{icon}</span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-[11px] text-slate-500">{sub}</p>
    </div>
  );
}
