'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  FileCheck,
  Flag,
  Gauge,
  Layers3,
  Lightbulb,
  ListChecks,
  Loader2,
  Lock,
  Search,
  Sparkles,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ReporteCorridas, sectionHeading } from '@/app/ver-resultado/reporte-corridas';
import { SatelliteModuleCard } from '@/components/diagnostico/satellite-aeo-report';
import type {
  PublicDiagnosticRunResult,
  PublicDiagnosticSatelliteModule,
  PublicDiagnosticTrendPoint,
} from '@/lib/api';

type Top3Entry = { position: number; name: string; type: string; reason?: string };

type PortalRunDetail = {
  id: string;
  status: string;
  runType?: string;
  modelMeta?: unknown;
  brand: {
    id?: string;
    name: string;
    domain?: string | null;
    industry?: string | null;
    productType?: string | null;
    competitors?: Array<{ id: string; name: string; domain?: string | null }>;
    aliases?: Array<{ id: string; alias: string }>;
  };
  promptResults: Array<{
    id: string;
    score: number;
    responseText: string;
    top3Json: unknown;
    prompt?: {
      id?: string;
      name?: string | null;
      promptText?: string;
      category?: { name?: string } | null;
    };
  }>;
  priaReports?: Array<{ priaTotal: number; priaByCategoryJson?: unknown }>;
};

type EngineKey = 'gemini' | 'perplexity' | 'claude';

type EnginesResponse = {
  ok: boolean;
  chatgpt: { status: string; score: number | null };
  engines: Array<{ engine: EngineKey; status: string; score: number | null }>;
  configured: { gemini: boolean; openrouter: boolean };
};

type RunListItem = {
  id: string;
  status: string;
  runType?: string | null;
  createdAt: string;
  brandName: string;
  domain: string | null;
  prompts: number;
};

type PlanConquistarContext = {
  ok: boolean;
  diagnostic: {
    id: string;
    domain: string;
    brandName: string;
    primaryRunId: string | null;
  } | null;
  satelliteModule: PublicDiagnosticSatelliteModule | null;
  trendData: PublicDiagnosticTrendPoint[];
};

function normalizePromptScore(score: number) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  return n <= 1 ? n : n / 100;
}

function portalRunToPublicRunResult(run: PortalRunDetail): PublicDiagnosticRunResult {
  const prompts = run.promptResults || [];
  const cleexsScore =
    run.priaReports?.[0]?.priaTotal ??
    (prompts.length ? prompts.reduce((sum, p) => sum + scoreToPct(p.score), 0) / prompts.length : 0);

  return {
    brandId: run.brand.id,
    brandName: run.brand.name,
    cleexsScore: Math.round(cleexsScore),
    competitors: run.brand.competitors?.map((c) => c.name) ?? [],
    competitorDetails: run.brand.competitors?.map((c) => ({ name: c.name, domain: c.domain })) ?? [],
    brandAliases: run.brand.aliases?.map((a) => a.alias) ?? [],
    promptResults: prompts.map((pr) => ({
      category: pr.prompt?.category?.name ?? 'General',
      score: normalizePromptScore(pr.score),
      promptText: pr.prompt?.promptText ?? '',
      responseText: pr.responseText ?? '',
      top3Json: top3Entries(pr.top3Json),
    })),
  };
}

const ENGINE_LABEL: Record<string, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  perplexity: 'Perplexity',
  claude: 'Claude',
};

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const EXTERNAL_AUTHORITY_CHANNELS = [
  {
    name: 'Crunchbase / perfiles corporativos',
    goal: 'Unificar descripción, categoría, sitio y propuesta de valor en perfiles externos.',
  },
  {
    name: 'Clutch / directorios del sector',
    goal: 'Conseguir pruebas sociales y categorías claras donde los modelos suelen buscar validación.',
  },
  {
    name: 'Reddit / comunidades relevantes',
    goal: 'Aparecer en conversaciones donde usuarios preguntan por alternativas y recomendaciones.',
  },
  {
    name: 'YouTube / demos y comparativas',
    goal: 'Publicar respuestas concretas que puedan ser resumidas por motores de IA.',
  },
  {
    name: 'Podcasts / entrevistas / prensa nicho',
    goal: 'Construir señales externas de autoridad y contexto de marca.',
  },
  {
    name: 'Directorios de industria',
    goal: 'Alinear categoría, ubicación, casos de uso y público objetivo en fuentes verificables.',
  },
];

const COURSE_MODULES = [
  'Cómo funcionan las respuestas de ChatGPT y otros LLMs',
  'Qué señales hacen que una marca sea recomendada',
  'Cómo leer tu Cleexs Score sin perderte en métricas',
  'Cómo convertir intenciones débiles en páginas útiles',
  'Cómo construir comparativas que los modelos entienden',
  'Cómo usar FAQs y schema para responder mejor',
  'Cómo generar autoridad externa sin depender de SEO clásico',
  'Cómo monitorear competidores durante 90 días',
  'Cómo ejecutar 3 quick wins por semana',
  'Cómo prepararte para el re-análisis del día 75',
];

const ROADMAP_WEEKS = [
  {
    range: 'Semana 1',
    theme: 'Base de claridad',
    tasks: ['Definir 5 intenciones críticas', 'Ajustar propuesta de valor', 'Ordenar páginas principales'],
  },
  {
    range: 'Semana 2',
    theme: 'Respuestas directas',
    tasks: ['Crear FAQs por intención', 'Responder objeciones frecuentes', 'Agregar datos verificables'],
  },
  {
    range: 'Semana 3',
    theme: 'Comparación competitiva',
    tasks: ['Publicar comparativas honestas', 'Explicar diferencias por caso de uso', 'Nombrar alternativas relevantes'],
  },
  {
    range: 'Semana 4',
    theme: 'Autoridad en sitio',
    tasks: ['Sumar casos y testimonios', 'Actualizar about/categoría', 'Estructurar contenido evergreen'],
  },
  {
    range: 'Semanas 5-6',
    theme: 'Autoridad externa',
    tasks: ['Revisar perfiles externos', 'Buscar menciones sectoriales', 'Participar en comunidades relevantes'],
  },
  {
    range: 'Semanas 7-8',
    theme: 'Expansión de contenido',
    tasks: ['Cubrir intenciones con peor score', 'Crear demos o guías cortas', 'Publicar recursos comparables'],
  },
  {
    range: 'Semanas 9-10',
    theme: 'Medición y ajuste',
    tasks: ['Revisar prompts débiles', 'Reforzar páginas que ya aparecen', 'Cerrar gaps contra competidores'],
  },
  {
    range: 'Semanas 11-12',
    theme: 'Re-análisis día 75',
    tasks: ['Preparar nueva corrida', 'Comparar score inicial vs actual', 'Definir continuidad Premium'],
  },
];

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .trim();
}

function isBrandEntry(entryName: string, brandName: string, aliases: string[]) {
  const entry = normalizeName(entryName);
  return entry === normalizeName(brandName) || aliases.some((a) => normalizeName(a) === entry);
}

function extractIntention(promptText?: string | null) {
  const match = (promptText || '').match(/Intención:\s*([^\(\n]+)\s*\((\d+)%\)/i);
  if (!match) return null;
  return { label: match[1].trim(), weight: Number(match[2]) };
}

function scoreToPct(score: number | null | undefined) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n <= 1 ? n * 100 : n);
}

function scoreLabel(score: number) {
  if (score >= 75) return 'Fuerte';
  if (score >= 50) return 'Mejorable';
  if (score >= 25) return 'Débil';
  return 'Crítico';
}

function impactForScore(score: number) {
  if (score < 35) return 'Alto';
  if (score < 65) return 'Medio';
  return 'Defensivo';
}

function effortForScore(score: number, hasCompetitor: boolean) {
  if (score < 35 && hasCompetitor) return 'Medio';
  if (score < 55) return 'Bajo';
  return 'Bajo';
}

function money(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function top3Entries(value: unknown): Top3Entry[] {
  return Array.isArray(value) ? (value as Top3Entry[]) : [];
}

function Badge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'violet' | 'emerald' | 'amber' | 'rose' }) {
  const classes: Record<typeof tone, string> = {
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
    violet: 'bg-violet-100 text-violet-700 ring-violet-200',
    emerald: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    amber: 'bg-amber-100 text-amber-800 ring-amber-200',
    rose: 'bg-rose-100 text-rose-700 ring-rose-200',
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${classes[tone]}`}>
      {children}
    </span>
  );
}

export default function AdminPlanConquistarPage() {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  if (selectedRunId) {
    return <ReportView runId={selectedRunId} onBack={() => setSelectedRunId(null)} />;
  }
  return <RunPicker onSelect={setSelectedRunId} />;
}

function RunPicker({ onSelect }: { onSelect: (runId: string) => void }) {
  const [query, setQuery] = useState('');
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [opening, setOpening] = useState(false);

  const loadRuns = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const url = `/api/admin-ui/plan-conquistar/runs${q ? `?q=${encodeURIComponent(q)}` : ''}`;
      const res = await fetch(url, { cache: 'no-store' });
      const body = (await res.json().catch(() => ({}))) as { items?: RunListItem[]; error?: string };
      if (!res.ok) throw new Error(body.error || `Error ${res.status}`);
      setRuns(body.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la lista de corridas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRuns('');
  }, [loadRuns]);

  function termFromInput(raw: string): string {
    let term = raw.trim();
    try {
      if (/^https?:\/\//i.test(term)) term = new URL(term).hostname;
    } catch {
      // input no es URL válida; lo usamos tal cual como término de búsqueda
    }
    return term.replace(/^www\./i, '').replace(/\/.*$/, '').trim();
  }

  async function openManual() {
    const raw = manual.trim();
    if (!raw) return;
    setError(null);
    setNotice(null);

    const uuid = raw.match(UUID_RE);
    if (uuid) {
      onSelect(uuid[0]);
      return;
    }

    const term = termFromInput(raw);
    if (!term) {
      setError('Pegá un runId, un dominio o el nombre de una marca.');
      return;
    }

    setOpening(true);
    try {
      const res = await fetch(`/api/admin-ui/plan-conquistar/runs?q=${encodeURIComponent(term)}`, {
        cache: 'no-store',
      });
      const body = (await res.json().catch(() => ({}))) as { items?: RunListItem[]; error?: string };
      if (!res.ok) throw new Error(body.error || `Error ${res.status}`);
      const items = body.items || [];
      if (items.length === 0) {
        setRuns([]);
        setError(`No hay corridas para "${term}". Probá con otro dominio o buscá un cliente.`);
        return;
      }
      if (items.length === 1) {
        onSelect(items[0].id);
        return;
      }
      setRuns(items);
      setQuery(term);
      setNotice(`Encontré ${items.length} corridas para "${term}". Elegí cuál abrir abajo.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo buscar por ese dominio.');
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-700 to-indigo-700 p-6 text-white shadow-sm">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-xs font-semibold ring-1 ring-white/20">
          <Trophy className="h-4 w-4" />
          AI Visibility Accelerator · Plan Conquistar
        </div>
        <h1 className="mt-3 text-2xl font-bold">Generá el reporte de 90 días desde admin</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-violet-50">
          Elegí una corrida de un cliente para abrir su entregable completo, o pegá un runId / URL para probar el reporte.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Probar con un dominio, runId o URL</p>
        <p className="mt-1 text-xs text-slate-500">
          Pegá un dominio (ej: nivea.com.ar), el nombre de una marca, un runId o una URL. Busco la corrida del cliente y abro el reporte.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="nivea.com.ar  ·  marca  ·  runId  ·  URL"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
            onKeyDown={(e) => {
              if (e.key === 'Enter') openManual();
            }}
          />
          <button
            type="button"
            onClick={openManual}
            disabled={!manual.trim() || opening}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Abrir reporte
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-900">Corridas recientes</p>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar marca o dominio"
                className="w-64 rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') loadRuns(query.trim());
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => loadRuns(query.trim())}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Buscar
            </button>
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
        {notice ? <p className="mt-4 text-sm text-violet-700">{notice}</p> : null}

        {loading ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-violet-600" /> Cargando corridas...
          </div>
        ) : runs.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">No se encontraron corridas.</p>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {runs.map((run) => (
              <button
                key={run.id}
                type="button"
                onClick={() => onSelect(run.id)}
                className="flex w-full items-center justify-between gap-4 py-3 text-left transition hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{run.brandName}</p>
                  <p className="truncate text-xs text-slate-500">
                    {run.domain || 'sin dominio'} · {run.prompts} prompts · {new Date(run.createdAt).toLocaleDateString('es-AR')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge tone={run.status === 'completed' ? 'emerald' : 'amber'}>{run.status}</Badge>
                  <span className="text-xs font-semibold text-violet-700">Abrir →</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReportView({ runId, onBack }: { runId: string; onBack: () => void }) {
  const [run, setRun] = useState<PortalRunDetail | null>(null);
  const [context, setContext] = useState<PlanConquistarContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [engineData, setEngineData] = useState<EnginesResponse | null>(null);
  const [busyEngines, setBusyEngines] = useState<EngineKey[]>([]);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [monthlyVisits, setMonthlyVisits] = useState('1000');
  const [conversionRate, setConversionRate] = useState('2');
  const [leadValue, setLeadValue] = useState('250');
  const [visibilityLift, setVisibilityLift] = useState('20');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [runRes, contextRes] = await Promise.all([
          fetch(`/api/admin-ui/plan-conquistar/runs/${encodeURIComponent(runId)}`, { cache: 'no-store' }),
          fetch(`/api/admin-ui/plan-conquistar/runs/${encodeURIComponent(runId)}/context`, { cache: 'no-store' }),
        ]);
        if (!runRes.ok) {
          const body = await runRes.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error || `Error ${runRes.status}`);
        }
        if (!cancelled) {
          setRun((await runRes.json()) as PortalRunDetail);
          if (contextRes.ok) {
            setContext((await contextRes.json()) as PlanConquistarContext);
          } else {
            setContext(null);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudo cargar el reporte.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin-ui/plan-conquistar/runs/${encodeURIComponent(runId)}/engines`, {
          cache: 'no-store',
        });
        if (res.ok && !cancelled) setEngineData((await res.json()) as EnginesResponse);
      } catch {
        // El estado de motores es opcional; no bloquea el reporte.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  const analysis = useMemo(() => {
    if (!run) return null;
    const prompts = run.promptResults || [];
    const aliases = run.brand.aliases?.map((a) => a.alias).filter(Boolean) ?? [];
    const totalPrompts = prompts.length;
    const cleexsScore =
      run.priaReports?.[0]?.priaTotal ??
      (totalPrompts ? prompts.reduce((sum, p) => sum + scoreToPct(p.score), 0) / totalPrompts : 0);

    const parseable = prompts.filter((p) => top3Entries(p.top3Json).length > 0).length;
    const top3 = prompts.filter((p) =>
      top3Entries(p.top3Json).some((entry) => isBrandEntry(entry.name, run.brand.name, aliases))
    ).length;
    const top1 = prompts.filter((p) =>
      top3Entries(p.top3Json).some((entry) => entry.position === 1 && isBrandEntry(entry.name, run.brand.name, aliases))
    ).length;
    const mentions = prompts.filter((p) => normalizeName(p.responseText || '').includes(normalizeName(run.brand.name))).length;

    const competitors = new Map<string, { name: string; appearances: number; positions: number[]; reasons: string[] }>();
    for (const prompt of prompts) {
      for (const entry of top3Entries(prompt.top3Json)) {
        if (isBrandEntry(entry.name, run.brand.name, aliases)) continue;
        if (`${entry.type}`.toLowerCase() !== 'competitor') continue;
        const key = normalizeName(entry.name);
        const current = competitors.get(key) || { name: entry.name, appearances: 0, positions: [], reasons: [] };
        current.appearances += 1;
        current.positions.push(entry.position);
        if (entry.reason && current.reasons.length < 2) current.reasons.push(entry.reason.replace(/\*+/g, '').trim());
        competitors.set(key, current);
      }
    }

    const intentionScores = new Map<string, { label: string; scores: number[]; weight: number }>();
    for (const prompt of prompts) {
      const intention = extractIntention(prompt.prompt?.promptText);
      if (!intention) continue;
      const key = normalizeName(intention.label);
      const current = intentionScores.get(key) || { label: intention.label, scores: [], weight: intention.weight };
      current.scores.push(scoreToPct(prompt.score));
      intentionScores.set(key, current);
    }

    const opportunities = prompts
      .map((prompt) => {
        const intention = extractIntention(prompt.prompt?.promptText);
        const score = scoreToPct(prompt.score);
        const firstCompetitor = top3Entries(prompt.top3Json).find(
          (entry) => !isBrandEntry(entry.name, run.brand.name, aliases)
        );
        const hasCompetitor = Boolean(firstCompetitor);
        return {
          id: prompt.id,
          score,
          impact: impactForScore(score),
          effort: effortForScore(score, hasCompetitor),
          label: prompt.prompt?.category?.name || intention?.label || prompt.prompt?.name || 'Oportunidad de visibilidad',
          intention: intention?.label || prompt.prompt?.category?.name || 'Intención crítica',
          action:
            score >= 70
              ? 'Convertir esta ventaja en contenido público, casos y FAQs para sostener la posición.'
              : firstCompetitor
                ? `Crear una pieza que responda mejor esta intención y contraste contra ${firstCompetitor.name}.`
                : 'Crear contenido claro para esta intención y reforzar señales de autoridad en el sitio.',
        };
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, 20);

    return {
      cleexsScore: Math.round(cleexsScore),
      totalPrompts,
      parseableRate: totalPrompts ? Math.round((parseable / totalPrompts) * 100) : 0,
      mentionRate: totalPrompts ? Math.round((mentions / totalPrompts) * 100) : 0,
      top3Rate: totalPrompts ? Math.round((top3 / totalPrompts) * 100) : 0,
      top1Rate: totalPrompts ? Math.round((top1 / totalPrompts) * 100) : 0,
      competitors: Array.from(competitors.values())
        .map((c) => ({
          ...c,
          avgPosition: c.positions.reduce((a, b) => a + b, 0) / Math.max(c.positions.length, 1),
          gap:
            c.appearances >= Math.max(2, Math.ceil(totalPrompts * 0.25))
              ? 'Te supera de forma recurrente'
              : 'Aparece en oportunidades puntuales',
        }))
        .sort((a, b) => b.appearances - a.appearances)
        .slice(0, 8),
      intentionScores: Array.from(intentionScores.values()).map((i) => ({
        label: i.label,
        score: Math.round(i.scores.reduce((a, b) => a + b, 0) / Math.max(i.scores.length, 1)),
        weight: i.weight,
      })),
      opportunities,
    };
  }, [run]);

  async function generateEngines(targets: EngineKey[]) {
    if (targets.length === 0) return;
    setBusyEngines((prev) => Array.from(new Set([...prev, ...targets])));
    setEngineError(null);
    try {
      const postRes = await fetch(`/api/admin-ui/plan-conquistar/runs/${encodeURIComponent(runId)}/engines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engines: targets }),
      });
      const postBody = (await postRes.json().catch(() => ({}))) as { error?: string };
      if (!postRes.ok) throw new Error(postBody.error || 'No se pudo iniciar el análisis por motor.');

      const deadline = Date.now() + 4 * 60 * 1000;
      const poll = async (): Promise<void> => {
        const res = await fetch(`/api/admin-ui/plan-conquistar/runs/${encodeURIComponent(runId)}/engines`, {
          cache: 'no-store',
        });
        if (res.ok) {
          const data = (await res.json()) as EnginesResponse;
          setEngineData(data);
          const pending = data.engines.some(
            (e) => targets.includes(e.engine) && (e.status === 'pending' || e.status === 'running')
          );
          if (!pending || Date.now() > deadline) return;
        }
        await new Promise((r) => setTimeout(r, 4000));
        return poll();
      };
      await poll();
    } catch (e) {
      setEngineError(e instanceof Error ? e.message : 'No se pudo generar el score por motor.');
    } finally {
      setBusyEngines((prev) => prev.filter((e) => !targets.includes(e)));
    }
  }

  const backButton = (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
    >
      <ArrowLeft className="h-4 w-4" /> Elegir otra corrida
    </button>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {backButton}
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
          <p className="text-sm text-slate-600">Armando el Plan Conquistar...</p>
        </div>
      </div>
    );
  }

  if (error || !run || !analysis) {
    return (
      <div className="space-y-4">
        {backButton}
        <div className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-rose-700">{error || 'No se pudo cargar el reporte.'}</p>
        </div>
      </div>
    );
  }

  const visits = Math.max(0, Number(monthlyVisits) || 0);
  const conv = Math.max(0, Number(conversionRate) || 0) / 100;
  const value = Math.max(0, Number(leadValue) || 0);
  const lift = Math.max(0, Number(visibilityLift) || 0) / 100;
  const estimatedExtraRevenue = visits * lift * conv * value;
  const estimatedAnnualRevenue = estimatedExtraRevenue * 12;
  const quickWins = analysis.opportunities.filter((o) => o.impact === 'Alto' && o.effort !== 'Alto').slice(0, 6);
  const strategicPlays = analysis.opportunities.filter((o) => o.impact !== 'Defensivo').slice(0, 6);
  const publicRunResult = portalRunToPublicRunResult(run);
  const domain =
    context?.diagnostic?.domain && !context.diagnostic.domain.startsWith('brand-')
      ? context.diagnostic.domain
      : run.brand.domain ?? '';
  const siteUrl = domain ? (domain.startsWith('http') ? domain : `https://${domain}`) : '';
  const satelliteBlock: ReactNode =
    context?.satelliteModule && context.satelliteModule.status !== 'pending' ? (
      <SatelliteModuleCard module={context.satelliteModule} siteUrl={siteUrl} />
    ) : null;

  // Score por los 4 motores: va pegado al resumen ejecutivo, como continuación del Cleexs Score.
  const extraEngines: EngineKey[] = ['gemini', 'claude', 'perplexity'];
  const isEngineAvailable = (engine: EngineKey) => !engineData || engineData.engines.some((e) => e.engine === engine);
  const engineEntryOf = (engine: EngineKey) => engineData?.engines.find((e) => e.engine === engine);
  const isEngineDone = (engine: EngineKey) => {
    const entry = engineEntryOf(engine);
    return entry?.status === 'completed' && entry.score != null;
  };
  const pendingEngineTargets = extraEngines.filter(
    (engine) => isEngineAvailable(engine) && !isEngineDone(engine) && !busyEngines.includes(engine)
  );
  const engineCards: Array<{ key: string; score: number | null; status: string }> = [
    { key: 'chatgpt', score: engineData?.chatgpt.score ?? analysis.cleexsScore, status: 'completed' },
    ...extraEngines.map((engine) => {
      const entry = engineEntryOf(engine);
      return { key: engine, score: entry?.score ?? null, status: entry?.status ?? 'not_started' };
    }),
  ];

  const engineScoreSlot = (
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700 ring-1 ring-violet-200">
            <Gauge className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900 sm:text-base">Cleexs Score por los 4 motores</h3>
            <p className="text-[11px] text-slate-500">ChatGPT sale de la corrida. Generá Gemini, Claude y Perplexity: uno, varios o todos.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => generateEngines(pendingEngineTargets)}
          disabled={pendingEngineTargets.length === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Generar todos los pendientes
        </button>
      </div>
      {engineError ? <p className="mb-2 text-xs text-amber-700">{engineError}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {engineCards.map((card) => {
          const inProgress = card.status === 'pending' || card.status === 'running';
          const done = card.status === 'completed' && card.score != null;
          const engineKey = card.key as EngineKey;
          const isExtra = card.key !== 'chatgpt';
          const busy = isExtra && busyEngines.includes(engineKey);
          const available = !isExtra || isEngineAvailable(engineKey);
          return (
            <div key={card.key} className="flex flex-col rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-100/60">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-slate-900">{ENGINE_LABEL[card.key]}</p>
                {inProgress || busy ? (
                  <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                ) : done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Lock className="h-4 w-4 text-slate-400" />
                )}
              </div>
              <p className="mt-3 text-3xl font-bold text-slate-900">{card.score ?? '—'}</p>
              <p className="mt-1 text-xs text-slate-500">
                {!isExtra
                  ? 'Disponible'
                  : !available
                    ? 'No disponible en el servidor'
                    : busy || inProgress
                      ? 'Generando...'
                      : done
                        ? 'Disponible'
                        : card.status === 'failed'
                          ? 'Falló, reintentá'
                          : 'Sin generar'}
              </p>
              {isExtra && available ? (
                <button
                  type="button"
                  onClick={() => generateEngines([engineKey])}
                  disabled={busy || inProgress}
                  className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-50 disabled:cursor-wait disabled:opacity-60"
                >
                  {busy || inProgress ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generando
                    </>
                  ) : done ? (
                    'Regenerar'
                  ) : (
                    'Generar'
                  )}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );

  // Resto del entregable Plan Conquistar, en el mismo flujo numerado del reporte (continúa después de la sección 7).
  const planSlot = (
    <>
      <section>
        {sectionHeading(8, 'Top oportunidades priorizadas', 'Ordenadas por score, impacto esperado y esfuerzo. Las que conviene ejecutar primero.')}
        <div className="grid gap-3 md:grid-cols-2">
          {analysis.opportunities.map((opportunity, idx) => (
            <div key={opportunity.id} className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-100/60">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">
                  {idx + 1}. {opportunity.label}
                </p>
                <span className="rounded-full bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                  Score {opportunity.score}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone={opportunity.impact === 'Alto' ? 'rose' : opportunity.impact === 'Medio' ? 'amber' : 'emerald'}>
                  Impacto {opportunity.impact}
                </Badge>
                <Badge tone={opportunity.effort === 'Bajo' ? 'emerald' : 'amber'}>Esfuerzo {opportunity.effort}</Badge>
                <Badge>{opportunity.intention}</Badge>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{opportunity.action}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        {sectionHeading(9, 'Mapa de ejecución', 'Dónde poner el foco primero y qué señales externas reforzar.')}
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-100/60">
            <div className="mb-3 flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-violet-600" />
              <p className="text-sm font-bold text-slate-900">Impacto / esfuerzo</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { title: 'Hacer ahora', tone: 'emerald' as const, items: quickWins },
                { title: 'Apostar estratégicamente', tone: 'violet' as const, items: strategicPlays },
              ].map((group) => (
                <div key={group.title} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900">{group.title}</h4>
                    <Badge tone={group.tone}>{group.items.length}</Badge>
                  </div>
                  <div className="space-y-1.5">
                    {group.items.slice(0, 4).map((item) => (
                      <div key={`${group.title}-${item.id}`} className="rounded-md bg-white p-2 text-xs text-slate-700 ring-1 ring-slate-100">
                        {item.label}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-100/60">
            <div className="mb-3 flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-violet-600" />
              <p className="text-sm font-bold text-slate-900">Autoridad externa</p>
            </div>
            <div className="grid gap-2">
              {EXTERNAL_AUTHORITY_CHANNELS.map((channel) => (
                <div key={channel.name} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                  <p className="text-sm font-semibold text-slate-900">{channel.name}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{channel.goal}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        {sectionHeading(10, 'Plan de acción de 90 días', 'Secuencia semanal para transformar el diagnóstico en ejecución y llegar al re-análisis del día 75.')}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {ROADMAP_WEEKS.map((phase) => (
            <div key={phase.range} className="rounded-xl border border-violet-100 bg-violet-50/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{phase.range}</h3>
                <Flag className="h-4 w-4 text-violet-600" />
              </div>
              <p className="mt-1 text-sm font-semibold text-violet-700">{phase.theme}</p>
              <ul className="mt-3 space-y-2">
                {phase.tasks.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        {sectionHeading(11, 'Oportunidad económica estimada', 'Estimación simple para dimensionar cuánto podría valer mejorar la visibilidad. No es promesa de revenue.')}
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-100/60">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Visitas mensuales estimadas', value: monthlyVisits, setter: setMonthlyVisits, suffix: '' },
              { label: 'Conversión a lead (%)', value: conversionRate, setter: setConversionRate, suffix: '%' },
              { label: 'Valor promedio por lead (USD)', value: leadValue, setter: setLeadValue, suffix: 'USD' },
              { label: 'Mejora de visibilidad esperada (%)', value: visibilityLift, setter: setVisibilityLift, suffix: '%' },
            ].map((field) => (
              <label key={field.label} className="block rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                <span className="text-xs font-semibold text-slate-500">{field.label}</span>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={field.value}
                    onChange={(e) => field.setter(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                  />
                  {field.suffix ? <span className="text-xs font-semibold text-slate-400">{field.suffix}</span> : null}
                </div>
              </label>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-gradient-to-br from-emerald-50 to-violet-50 p-4 ring-1 ring-emerald-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Oportunidad aproximada</p>
            <p className="mt-1 text-3xl font-black text-slate-900">{money(estimatedExtraRevenue)} / mes</p>
            <p className="mt-1 text-sm text-slate-600">{money(estimatedAnnualRevenue)} estimados al año si las variables se cumplen.</p>
          </div>
        </div>
      </section>

      <section>
        {sectionHeading(12, 'Materiales de implementación', 'Curso express y prompts listos para ejecutar el plan.')}
        <div className="grid gap-3 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-100/60">
            <div className="mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-violet-600" />
              <p className="text-sm font-bold text-slate-900">Curso Express de Visibilidad IA</p>
            </div>
            <div className="space-y-2">
              {COURSE_MODULES.map((module, idx) => (
                <div key={module} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-xs font-bold text-violet-700">
                    {idx + 1}
                  </div>
                  <p className="text-sm font-medium text-slate-800">{module}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-100/60">
            <div className="mb-3 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-violet-600" />
              <p className="text-sm font-bold text-slate-900">AI Visibility GPT / Prompt Pack</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  title: 'Mejorar una intención',
                  prompt: `Actuá como consultor de AI Visibility. Para la marca ${run.brand.name}, proponé una página que responda mejor una intención débil del reporte.`,
                },
                {
                  title: 'Comparativa competitiva',
                  prompt: `Compará ${run.brand.name} contra sus competidores principales y redactá una sección honesta que explique cuándo elegir cada opción.`,
                },
                {
                  title: 'Checklist semanal',
                  prompt: `Convertí el roadmap de 90 días de ${run.brand.name} en 3 tareas concretas para ejecutar esta semana.`,
                },
              ].map((item) => (
                <div key={item.title} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                  <p className="text-sm font-bold text-slate-900">{item.title}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{item.prompt}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {['Sin 50 PDFs', 'Sin 100 recomendaciones imposibles', 'Sin teoría SEO eterna', 'Sin G2 en esta versión'].map((item) => (
                <span key={item} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                  <ListChecks className="h-3 w-3" /> {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        {sectionHeading(13, 'Re-análisis día 75 y continuidad', 'Se vuelve a medir el avance y se ofrece continuidad Premium anual.')}
        <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-700 to-indigo-700 p-6 text-white shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-xs font-semibold ring-1 ring-white/20">
                <TrendingUp className="h-4 w-4" />
                Día 75
              </div>
              <h3 className="mt-3 text-2xl font-bold">Re-análisis y continuidad Premium</h3>
              <p className="mt-2 text-sm leading-relaxed text-violet-50">
                En el día 75 se vuelve a medir el avance: score inicial vs actual, nuevas apariciones, oportunidades
                detectadas y recomendación para mantener el progreso con el plan anual.
              </p>
            </div>
            <div className="rounded-2xl bg-white/12 p-4 ring-1 ring-white/20 md:w-64">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-100">Oferta de continuidad</p>
              <p className="mt-1 text-2xl font-black">USD 499/año</p>
              <p className="mt-1 text-xs text-violet-100">Premium 365 días con descuento especial post-implementación.</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        {sectionHeading(14, 'Checklist de implementación', 'Guía operativa para ejecutar el plan sin perder tiempo.')}
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            'Definir las 5 intenciones principales donde querés ser recomendado.',
            'Crear o mejorar una página para cada intención crítica.',
            'Agregar FAQs claras con respuestas directas y verificables.',
            'Publicar comparativas honestas contra competidores relevantes.',
            'Actualizar datos de marca, rubro, ubicación y propuesta de valor.',
            'Sumar casos, pruebas sociales y evidencia de autoridad.',
            'Medir nuevamente las oportunidades de menor score.',
            'Preparar la corrida de control del día 75.',
          ].map((item) => (
            <div key={item} className="flex gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {backButton}
        <span className="text-xs text-slate-400">runId: {run.id}</span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-5xl">
          <Card className="border-0 bg-white shadow-md shadow-slate-200/50">
            <CardHeader className="space-y-1 p-4 pb-3 sm:p-5 sm:pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <FileCheck className="h-5 w-5 shrink-0 text-primary-600 sm:h-6 sm:w-6" />
                    AI Visibility Accelerator · Plan Conquistar
                  </CardTitle>
                  <CardDescription className="mt-1 text-xs sm:text-sm">
                    <span className="font-medium">{run.brand.name}</span>
                    {domain ? ` · ${domain}` : null}
                    {context?.diagnostic ? ` · diagnóstico ${context.diagnostic.id.slice(0, 8)}…` : ' · corrida de portal'}
                  </CardDescription>
                </div>
                <img src="/CleexsLogo.png" alt="Cleexs" className="h-14 w-auto shrink-0 object-contain sm:h-16" />
              </div>
            </CardHeader>
            <CardContent className="space-y-5 px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
              <ReporteCorridas
                runResult={publicRunResult}
                brandName={run.brand.name}
                trendData={context?.trendData}
                satelliteBlock={satelliteBlock}
                afterSummarySlot={engineScoreSlot}
                appendSlot={planSlot}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
