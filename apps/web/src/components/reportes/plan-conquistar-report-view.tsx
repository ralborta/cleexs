'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileCheck,
  Flag,
  Gauge,
  Layers3,
  Lightbulb,
  Loader2,
  Lock,
  Share2,
  Sparkles,
} from 'lucide-react';
import { ShareScoreButtons } from '@/components/share/share-score-buttons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ReporteCorridas, sectionHeading } from '@/app/ver-resultado/reporte-corridas';
import { SatelliteModuleCard } from '@/components/diagnostico/satellite-aeo-report';
import { CrawlerAccessPlanSection } from '@/components/diagnostico/crawler-access-plan-section';
import { CrawlerAccessTeaser } from '@/components/diagnostico/crawler-access-teaser';
import { DomainRatingPanel } from '@/components/report/domain-rating-block';
import { buildCrawlerAccessReport } from '@/lib/crawler-access';
import { buildImmediateActionPlan } from '@/lib/plan-immediate-action';
import type {
  DomainRatingSnapshot,
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
  domainRating?: DomainRatingSnapshot | null;
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

// Prioridad real: sube cuando hay más margen de mejora (score bajo) y el esfuerzo es bajo.
function priorityForScore(score: number, impact: string, effort: string) {
  const gain = Math.max(0, 100 - score);
  const impactBonus = impact === 'Alto' ? 12 : impact === 'Medio' ? 6 : 0;
  const effortBonus = effort === 'Bajo' ? 8 : effort === 'Medio' ? 4 : 0;
  return Math.min(100, Math.round(gain * 0.8 + impactBonus + effortBonus));
}

// Nombre legible de la consulta real (intención + tipo), tal como se generó en la corrida.
function cleanPromptName(name?: string | null) {
  if (!name) return '';
  return name.replace(/\s*-\s*/g, ' · ').replace(/\s+/g, ' ').trim();
}

// Escenario real del usuario: la línea de contexto del prompt (ej: "Estoy evaluando opciones...").
function extractScenario(promptText?: string | null) {
  if (!promptText) return '';
  const lines = promptText.split('\n').map((s) => s.trim()).filter(Boolean);
  const ctx = lines[1] || '';
  return ctx.length > 160 ? `${ctx.slice(0, 157)}…` : ctx;
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

export function PlanConquistarReportView({
  runId,
  variant = 'admin',
  onBack,
}: {
  runId: string;
  variant?: 'admin' | 'public';
  onBack?: () => void;
}) {
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
  const [visibilityLift, setVisibilityLift] = useState('10');

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
        const impact = impactForScore(score);
        const effort = effortForScore(score, hasCompetitor);
        const label =
          cleanPromptName(prompt.prompt?.name) ||
          intention?.label ||
          prompt.prompt?.category?.name ||
          'Consulta de visibilidad';
        const scenario = extractScenario(prompt.prompt?.promptText);
        return {
          id: prompt.id,
          score,
          priority: priorityForScore(score, impact, effort),
          impact,
          effort,
          label,
          scenario,
          intention: intention?.label || prompt.prompt?.category?.name || 'Intención crítica',
          action:
            score >= 70
              ? `Sostené el liderazgo en «${intention?.label || label}»: convertilo en contenido público, casos y FAQs para no perder la posición.`
              : firstCompetitor
                ? `Creá una pieza que responda mejor esta consulta y contraste de forma honesta contra ${firstCompetitor.name}.`
                : 'Creá contenido claro para esta consulta y reforzá señales de autoridad en el sitio.',
        };
      })
      .sort((a, b) => b.priority - a.priority)
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

  const isPublic = variant === 'public';
  const sharePath = `/reporte/plan-conquistar/${encodeURIComponent(runId)}`;

  const backButton = onBack ? (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
    >
      <ArrowLeft className="h-4 w-4" /> Elegir otra corrida
    </button>
  ) : null;

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
  const improveNow = [...analysis.opportunities].sort((a, b) => a.score - b.score).slice(0, 5);
  const defendNow = [...analysis.opportunities].sort((a, b) => b.score - a.score).slice(0, 5);
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
  const crawlerAccessReport = buildCrawlerAccessReport(context?.satelliteModule, siteUrl);

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
        {!isPublic ? (
          <button
            type="button"
            onClick={() => generateEngines(pendingEngineTargets)}
            disabled={pendingEngineTargets.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generar todos los pendientes
          </button>
        ) : null}
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
              {isExtra && available && !isPublic ? (
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

  const domainRating = context?.domainRating ?? null;
  const showDomainRatingPanel =
    domainRating &&
    (domainRating.brand.rating != null || domainRating.competitors.some((c) => c.rating != null));

  const premiumAfterSummarySlot = engineScoreSlot;

  const premiumBeforeSatelliteSlot =
    context?.satelliteModule && context.satelliteModule.status !== 'pending' && siteUrl ? (
      <CrawlerAccessTeaser module={context.satelliteModule} siteUrl={siteUrl} />
    ) : null;

  const primaryOpportunity = analysis.opportunities[0];
  const topCompetitor = analysis.competitors[0];
  const weeklyPriorities = analysis.opportunities.slice(0, 3);
  const implementationPrompts = [
    {
      title: 'Convertir la prioridad #1 en página',
      source: primaryOpportunity
        ? `Basado en: ${primaryOpportunity.label} · prioridad ${primaryOpportunity.priority} · score actual ${primaryOpportunity.score}`
        : 'Basado en la oportunidad prioritaria del reporte',
      prompt: primaryOpportunity
        ? `Actuá como consultor de AI Visibility para ${run.brand.name}. Necesito convertir esta oportunidad prioritaria en una página publicable: "${primaryOpportunity.label}".${primaryOpportunity.scenario ? ` Escenario del usuario: "${primaryOpportunity.scenario}".` : ''} Intención: ${primaryOpportunity.intention}. Score actual: ${primaryOpportunity.score}/100. Acción recomendada: ${primaryOpportunity.action}. Proponé estructura de página, títulos H2/H3, FAQs, evidencias a incluir y un checklist de publicación.`
        : `Actuá como consultor de AI Visibility para ${run.brand.name}. Revisá la oportunidad prioritaria del reporte y convertíla en una página publicable con estructura, FAQs, evidencias y checklist.`,
    },
    {
      title: 'Cerrar brecha contra competidor',
      source: topCompetitor
        ? `Basado en: ${topCompetitor.name} · ${topCompetitor.appearances} apariciones`
        : 'Basado en el competidor principal detectado',
      prompt: topCompetitor
        ? `Actuá como estratega de AI Visibility. Compará ${run.brand.name} contra ${topCompetitor.name} usando un tono honesto y verificable. Explicá en qué casos conviene elegir ${run.brand.name}, qué prueba social o datos faltan para sostener esa comparación y qué contenido deberíamos crear para que ChatGPT, Claude, Gemini y Perplexity entiendan mejor la diferencia.`
        : `Actuá como estratega de AI Visibility. Si el reporte detecta competidores relevantes, armá una comparativa honesta para ${run.brand.name}: cuándo elegir la marca, qué pruebas faltan y qué contenido crear para mejorar recomendaciones en motores de IA.`,
    },
    {
      title: 'Tareas concretas de esta semana',
      source:
        weeklyPriorities.length > 0
          ? `Basado en las prioridades: ${weeklyPriorities.map((o) => `#${o.priority}`).join(', ')}`
          : 'Basado en las primeras prioridades del reporte',
      prompt:
        weeklyPriorities.length > 0
          ? `Convertí estas prioridades de ${run.brand.name} en un plan de 7 días con tareas claras, responsable sugerido y entregable final: ${weeklyPriorities
              .map((o, idx) => `${idx + 1}) ${o.label} (score ${o.score}, prioridad ${o.priority}): ${o.action}`)
              .join(' | ')}. Evitá teoría: quiero acciones publicables o verificables.`
          : `Convertí las primeras prioridades del reporte de ${run.brand.name} en un plan de 7 días con tareas claras, responsable sugerido y entregable final. Evitá teoría: quiero acciones publicables o verificables.`,
    },
  ];

  const formatOpportunity = (item: { label: string; score: number; priority: number }) =>
    `${item.label} (score ${item.score}, prioridad ${item.priority})`;

  const personalizedRoadmap = buildImmediateActionPlan({
    brandName: run.brand.name,
    primaryOpportunity,
    improveNow,
    topCompetitor,
    formatOpportunity,
  });

  // Resto del entregable (Premium + Plan Conquistar), numeración continúa desde la sección 8.
  let planSectionNum = 8;

  const planSlot = (
    <>
      {crawlerAccessReport ? (
        <section>
          {sectionHeading(
            planSectionNum++,
            'Acceso de crawlers de IA',
            '¿ChatGPT y otros motores pueden rastrear tu sitio? Revisión de robots.txt, bots clave y checklist de verificación.'
          )}
          <CrawlerAccessPlanSection report={crawlerAccessReport} siteUrl={siteUrl} />
        </section>
      ) : null}

      {showDomainRatingPanel ? (
        <section>
          {sectionHeading(
            planSectionNum++,
            'Autoridad del dominio (SEO)',
            'Domain Rating (Ahrefs) de tu dominio vs competidores. Mide autoridad por backlinks; no es lo mismo que tu Cleexs Score en IA.'
          )}
          <DomainRatingPanel data={domainRating} />
        </section>
      ) : null}

      <section>
        {sectionHeading(planSectionNum++, 'Oportunidades priorizadas', 'Ordenadas por prioridad (mayor a menor). La prioridad sube cuando hay más margen de mejora y el esfuerzo es bajo.')}
        <div className="grid gap-3 md:grid-cols-2">
          {analysis.opportunities.map((opportunity, idx) => (
            <div key={opportunity.id} className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-100/60">
              <div className="flex items-start justify-between gap-3">
                <p className="flex min-w-0 items-start gap-2 text-sm font-semibold text-slate-900">
                  <span className="mt-0.5 inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-violet-100 px-1.5 text-[11px] font-bold tabular-nums text-violet-700">
                    {idx + 1}
                  </span>
                  <span className="min-w-0">{opportunity.label}</span>
                </p>
                <span className="shrink-0 rounded-full bg-violet-600 px-2 py-0.5 text-xs font-semibold text-white">
                  Prioridad {opportunity.priority}
                </span>
              </div>
              {opportunity.scenario ? (
                <p className="mt-1.5 pl-7 text-xs italic leading-relaxed text-slate-500">“{opportunity.scenario}”</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone={opportunity.impact === 'Alto' ? 'rose' : opportunity.impact === 'Medio' ? 'amber' : 'emerald'}>
                  Impacto {opportunity.impact}
                </Badge>
                <Badge tone={opportunity.effort === 'Bajo' ? 'emerald' : 'amber'}>Esfuerzo {opportunity.effort}</Badge>
                <Badge>Score actual {opportunity.score}</Badge>
                <Badge>{opportunity.intention}</Badge>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{opportunity.action}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        {sectionHeading(
          planSectionNum++,
          'Mapa de ejecución',
          'Dónde enfocar primero según el score real de cada consulta y qué señales externas reforzar (sugeridas).'
        )}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-100/60">
            <div className="mb-4 flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-violet-600" />
              <p className="text-sm font-bold text-slate-900">Dónde enfocar</p>
            </div>
            <div className="space-y-3">
              {[
                { title: 'Mejorar ahora', hint: 'menor score = más margen', tone: 'rose' as const, items: improveNow },
                { title: 'Defender', hint: 'mayor score = ya ganás', tone: 'emerald' as const, items: defendNow },
              ].map((group) => (
                <div key={group.title} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{group.title}</h4>
                      <p className="text-xs text-slate-500">{group.hint}</p>
                    </div>
                    <Badge tone={group.tone}>{group.items.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {group.items.length === 0 ? (
                      <p className="rounded-lg bg-white p-3 text-sm text-slate-400 ring-1 ring-slate-100">
                        Sin datos suficientes en esta corrida.
                      </p>
                    ) : (
                      group.items.map((item) => (
                        <div
                          key={`${group.title}-${item.id}`}
                          className="flex items-center justify-between gap-4 rounded-lg bg-white px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-100"
                        >
                          <span className="min-w-0 flex-1 leading-snug">{item.label}</span>
                          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold tabular-nums text-slate-600">
                            {item.score}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-100/60">
            <div className="mb-3 flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-violet-600" />
              <p className="text-sm font-bold text-slate-900">Autoridad externa (sugerida)</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
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
        {sectionHeading(planSectionNum++, 'Plan de acción inmediato', 'Tres bloques concretos basados en esta corrida: qué hacer primero, esta semana y el siguiente paso.')}
        <div className="space-y-2.5">
          {personalizedRoadmap.map((phase) => (
            <div
              key={phase.range}
              className="flex flex-col gap-3 rounded-xl border border-violet-100 bg-violet-50/40 p-4 lg:flex-row lg:items-start"
            >
              <div className="flex gap-2 lg:w-64 lg:shrink-0">
                <Flag className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900">{phase.range}</h3>
                  <p className="text-xs font-semibold text-violet-700">{phase.theme}</p>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-slate-500">{phase.evidence}</p>
                </div>
              </div>
              <div className="flex flex-1 flex-wrap gap-2">
                {phase.tasks.map((item) => (
                  <span
                    key={item}
                    className="inline-flex max-w-full items-start gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs leading-relaxed text-slate-700 ring-1 ring-slate-100"
                  >
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-600" />
                    <span>{item}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        {sectionHeading(
          planSectionNum++,
          'Escenario económico (hipótesis)',
          'Calculadora con supuestos editables. Úsala para conversar con el cliente; no es proyección garantizada.'
        )}
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-100/60">
          <p className="mb-3 text-xs leading-relaxed text-slate-600">
            Completá con datos reales del cliente si los tenés. El resultado es{' '}
            <strong className="font-semibold text-slate-800">visitas × conversión × valor × mejora de visibilidad</strong> — una
            hipótesis de leads o ingreso incremental, no un compromiso de Cleexs.
          </p>
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
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Hipótesis mensual</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{money(estimatedExtraRevenue)} / mes</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              {money(estimatedAnnualRevenue)} al año si se cumplen los supuestos ({monthlyVisits || 0} visitas ·{' '}
              {conversionRate || 0}% conv. · {visibilityLift || 0}% mejora visibilidad).
            </p>
          </div>
        </div>
      </section>

      <section>
        {sectionHeading(planSectionNum++, 'Kit IA de implementación', 'Prompts listos para copiar en ChatGPT o Claude, basados en los datos de esta corrida.')}
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-100/60">
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-violet-600" />
            <p className="text-sm font-bold text-slate-900">Prompts personalizados</p>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-slate-500">
            Borradores de ejecución con datos reales del reporte. Siempre conviene validar antes de publicar.
          </p>
          <div className="space-y-3">
            {implementationPrompts.map((item) => (
              <div key={item.title} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-bold text-slate-900">{item.title}</p>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-violet-100">
                    Personalizado
                  </span>
                </div>
                <p className="mt-1 text-[11px] font-medium text-slate-500">{item.source}</p>
                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-white p-3 text-xs leading-relaxed text-slate-700 ring-1 ring-slate-100">
                  {item.prompt}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        {sectionHeading(planSectionNum++, 'Checklist de implementación', 'Guía operativa para ejecutar el plan sin perder tiempo.')}
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            'Definir las 5 intenciones principales donde querés ser recomendado.',
            'Crear o mejorar una página para cada intención crítica.',
            'Agregar FAQs claras con respuestas directas y verificables.',
            'Publicar comparativas honestas contra competidores relevantes.',
            'Actualizar datos de marca, rubro, ubicación y propuesta de valor.',
            'Sumar casos, pruebas sociales y evidencia de autoridad.',
            'Medir nuevamente las oportunidades de menor score.',
            'Correr un nuevo diagnóstico cuando ejecutes las acciones principales.',
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
        {!isPublic ? <span className="text-xs text-slate-400">runId: {run.id}</span> : null}
      </div>

      {!isPublic ? (
        <div className="rounded-2xl border border-indigo-200/70 bg-white p-4 shadow-sm ring-1 ring-indigo-100/80">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                <Share2 className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">Compartir informe</p>
                <p className="text-[11px] text-indigo-700/80">Enlace público para el cliente · mismo contenido, sin panel admin</p>
              </div>
            </div>
          </div>
          <ShareScoreButtons
            path={sharePath}
            intent="team"
            brandName={run.brand.name}
            domain={domain || null}
          />
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-5xl">
          <Card className="border-0 bg-white shadow-md shadow-slate-200/50">
            <CardHeader className="space-y-1 p-4 pb-3 sm:p-5 sm:pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <FileCheck className="h-5 w-5 shrink-0 text-primary-600 sm:h-6 sm:w-6" />
                    AI Visibility Accelerator · Informe completo
                  </CardTitle>
                  <CardDescription className="mt-1 text-xs sm:text-sm">
                    Premium + Plan Conquistar ·{' '}
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
                beforeSatelliteSlot={premiumBeforeSatelliteSlot}
                afterSummarySlot={premiumAfterSummarySlot}
                appendSlot={planSlot}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
