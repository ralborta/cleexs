'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  MessageSquare,
  Sparkles,
  Target,
  Wand2,
  XCircle,
} from 'lucide-react';
import { CleexsMark } from '@/components/brand/cleexs-mark';

const TOKEN_KEY = 'cleexs_portal_token';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const DRAFT_KEY = 'cleexs_custom_prompt_draft';

type UsageResponse = { planKey?: string; planDisplay?: string };

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

function Donut({
  segments,
  total,
}: {
  segments: Array<{ key: string; count: number; color: string; label: string }>;
  total: number;
}) {
  const r = 52;
  const cx = 62;
  const cy = 62;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const visible = segments.filter((s) => s.count > 0);
  if (total <= 0 || visible.length === 0) return <p className="py-8 text-center text-xs text-slate-400">Sin datos</p>;
  return (
    <svg viewBox="0 0 124 124" className="mx-auto h-36 w-36">
      {visible.map((seg, i) => {
        const dash = (seg.count / total) * circ;
        const ring = (
          <circle
            key={seg.key}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth="22"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        );
        offset += dash;
        return ring;
      })}
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="20" fontWeight="700" fill="#0f172a">
        {total}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="9" fill="#64748b">
        prompts
      </text>
    </svg>
  );
}

export default function PromptsCorridaPage() {
  const params = useParams();
  const runId = params.runId as string;
  const basePath = `/portal-crecimiento/reporte/${runId}/premium`;

  const [run, setRun] = useState<RunDetail | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [draftOpen, setDraftOpen] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [draftNotice, setDraftNotice] = useState(false);

  useEffect(() => {
    if (!run) return;
    try {
      const key = `${DRAFT_KEY}:${run.brand?.id ?? run.brand?.name ?? 'default'}`;
      const s = localStorage.getItem(key);
      if (s?.trim()) setDraftNotice(true);
    } catch {
      /* ignore */
    }
  }, [run]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
        const [runRes, usageRes] = await Promise.all([
          fetch(`${API_URL}/api/reports/app/reports/${encodeURIComponent(runId)}`, { cache: 'no-store', headers }),
          fetch(`${API_URL}/api/me/usage`, { cache: 'no-store', headers }),
        ]);
        if (runRes.status === 401 || usageRes.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
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

  const donutCounts = useMemo(() => {
    const m = new Map<string, number>();
    results.forEach((pr) => {
      const txt = pr.prompt?.promptText ?? '';
      const cat = pr.prompt?.category?.name ?? null;
      const k = normalizeIntentionKey(cat, txt);
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return m;
  }, [results]);

  const donutSegments = useMemo(() => {
    const keys = ['urgencia', 'calidad', 'precio', 'consideracion', 'otros'] as const;
    return keys.map((k) => ({
      key: k,
      label: INTENTION_STYLE[k]?.label ?? k,
      color: INTENTION_STYLE[k]?.donutColor ?? '#94a3b8',
      count: donutCounts.get(k) ?? 0,
    }));
  }, [donutCounts]);

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

  function openDraft() {
    try {
      const stored = localStorage.getItem(`${DRAFT_KEY}:${run?.brand?.id ?? run?.brand?.name ?? 'default'}`);
      setDraftText(stored ?? '');
    } catch {
      setDraftText('');
    }
    setDraftOpen(true);
  }

  function saveDraft() {
    try {
      localStorage.setItem(`${DRAFT_KEY}:${run?.brand?.id ?? run?.brand?.name ?? 'default'}`, draftText.trim());
      setDraftNotice(true);
      setDraftOpen(false);
    } catch {
      /* ignore */
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
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <CleexsMark className="h-6 w-6" />
            <p className="font-bold text-slate-900">Cleexs</p>
          </div>
          <nav className="space-y-1 text-sm">
            <Link href={`/portal-crecimiento/reporte/${runId}/cliente`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">
              Portal cliente
            </Link>
            <Link href={`${basePath}/comparacion`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">
              Comparación
            </Link>
            <Link href={`${basePath}/prompts`} className="block rounded-lg bg-violet-50 px-3 py-2 font-semibold text-violet-900">
              Prompts
            </Link>
            <Link href={`${basePath}/competidores`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">
              Competidores
            </Link>
            <Link href={`${basePath}/historial`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">
              Historial
            </Link>
            <Link href={`${basePath}/reportes`} className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50">
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
            <p className="font-semibold text-slate-900">{loading ? '…' : (usage?.planDisplay || usage?.planKey || 'Premium')}</p>
          </div>
        </aside>

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

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <StatCard
                  icon={<Sparkles className="h-4 w-4 text-violet-600" />}
                  label="Prompts ejecutados"
                  value={String(executed)}
                  sub={executed ? '100% en esta corrida' : '—'}
                />
                <StatCard
                  icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                  label="Válidos"
                  value={String(validityBuckets.valid)}
                  sub="Con datos utilizables"
                />
                <StatCard
                  icon={<span className="block h-3 w-3 rounded-full bg-amber-400" />}
                  label="Parcialmente válidos"
                  value={String(validityBuckets.partial)}
                  sub="Datos limitados"
                />
                <StatCard icon={<XCircle className="h-4 w-4 text-red-500" />} label="No válidos" value={String(validityBuckets.invalid)} sub="Sin datos útiles" />
                <StatCard icon={<BarChart3 className="h-4 w-4 text-blue-600" />} label="Promedio desempeño" value={`${avgPct}%`} sub="Sobre todas las consultas" />
              </div>

              {(draftNotice || draftText.trim()) && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
                  Tenés un <strong>borrador de prompt personalizado</strong> guardado en este navegador. La corrida oficial no cambia hasta que ejecutes una nueva desde el portal.
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100">
                    <Wand2 className="h-5 w-5 text-violet-700" />
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">Generá tu propio prompt</p>
                    <p className="mt-1 max-w-xl text-xs text-slate-600">
                      Probá una consulta personalizada y definí cómo medirías un escenario concreto de marca. Tu borrador
                      no modifica esta corrida; queda solo en este dispositivo hasta que lo pegues en una nueva corrida o
                      lo compartas con tu equipo.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openDraft}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
                >
                  Crear prompt personalizado
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <Target className="h-5 w-5 text-violet-600" />
                    <h2 className="font-bold text-slate-900">Consultas (prompts) de esta corrida</h2>
                  </div>

                  {!executed ? (
                    <p className="text-sm text-slate-500">No hay prompts ejecutados en esta corrida.</p>
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
                                    Categoría API: <span className="font-medium text-slate-700">{pr.prompt.category.name}</span>
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
                                {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
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

                <aside className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="mb-3 text-xs font-bold text-slate-900">Distribución por intención</p>
                    <Donut segments={donutSegments} total={executed} />
                    <ul className="mt-2 space-y-1.5 border-t border-slate-100 pt-3">
                      {donutSegments
                        .filter((s) => s.count > 0)
                        .map((s) => (
                          <li key={s.key} className="flex justify-between text-xs">
                            <span className="flex items-center gap-2 text-slate-600">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                              {s.label}
                            </span>
                            <span className="font-semibold text-slate-900">
                              {s.count} ({Math.round((s.count / Math.max(1, executed)) * 100)}%)
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="mb-2 text-xs font-bold text-slate-900">¿Qué es cada intención?</p>
                    <ul className="space-y-2 text-[11px] text-slate-600">
                      {Object.entries(INTENTION_STYLE).map(([k, v]) =>
                        k === 'otros' ? null : (
                          <li key={k} className="flex gap-2">
                            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${v.dot}`} />
                            <span>
                              <strong className="text-slate-800">{v.label}:</strong> agrupa prompts asociados a esa fase del
                              viaje según nombre de categoría o texto del prompt.
                            </span>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="mb-2 text-xs font-bold text-slate-900">Sobre los scores</p>
                    <ul className="space-y-1 text-[11px] text-slate-600">
                      <li>
                        <span className="font-semibold text-violet-700">80–100</span> Excelente
                      </li>
                      <li>
                        <span className="font-semibold text-blue-700">60–79</span> Bueno
                      </li>
                      <li>
                        <span className="font-semibold text-amber-700">40–59</span> Regular
                      </li>
                      <li>
                        <span className="font-semibold text-red-700">0–39</span> Bajo
                      </li>
                    </ul>
                  </div>
                </aside>
              </div>
            </>
          )}
        </div>
      </div>

      {draftOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]"
          onClick={() => setDraftOpen(false)}
          role="presentation"
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-lg font-bold text-slate-900">Prompt personalizado</h3>
            <p className="mt-1 text-xs text-slate-600">
              Escribí la consulta que quisieras probar frente a la IA. Este borrador{' '}
              <strong>no ejecuta llamadas</strong> ni altera esta corrida: queda guardado solo en este navegador para que lo
              reutilices o lo compartas.
            </p>
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder="Ej: ¿Qué marca recomendarías para [caso de uso] en [ubicación]?…"
              className="mt-4 h-40 w-full resize-y rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(draftText)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Copiar
              </button>
              <button type="button" onClick={saveDraft} className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700">
                Guardar borrador
              </button>
              <button type="button" onClick={() => setDraftOpen(false)} className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100">
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
