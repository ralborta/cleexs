'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  Loader2,
  Lock,
  Sparkles,
  Target,
  Trophy,
  Users,
} from 'lucide-react';

const TOKEN_KEY = 'cleexs_portal_token';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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

type UsageResponse = {
  planKey?: string;
  planDisplay?: string;
};

type EngineKey = 'gemini' | 'perplexity' | 'claude';

type EnginesResponse = {
  ok: boolean;
  chatgpt: { status: string; score: number | null };
  engines: Array<{ engine: EngineKey; status: string; score: number | null }>;
  configured: { gemini: boolean; openrouter: boolean };
};

const ENGINE_LABEL: Record<string, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  perplexity: 'Perplexity',
  claude: 'Claude',
};

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

function top3Entries(value: unknown): Top3Entry[] {
  return Array.isArray(value) ? (value as Top3Entry[]) : [];
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{hint}</p>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, desc }: { icon: typeof Sparkles; title: string; desc: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{desc}</p>
      </div>
    </div>
  );
}

export default function PlanConquistarReportPage() {
  const params = useParams();
  const runId = params.runId as string;
  const [run, setRun] = useState<PortalRunDetail | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [engineData, setEngineData] = useState<EnginesResponse | null>(null);
  const [busyEngines, setBusyEngines] = useState<EngineKey[]>([]);
  const [engineError, setEngineError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const token = typeof window !== 'undefined' ? sessionStorage.getItem(TOKEN_KEY) : null;
        if (!token) {
          setError('No hay sesión. Volvé al portal e iniciá sesión.');
          setLoading(false);
          return;
        }

        const headers = { Authorization: `Bearer ${token}` };
        const [runRes, usageRes] = await Promise.all([
          fetch(`${API_URL}/api/reports/app/reports/${encodeURIComponent(runId)}`, { cache: 'no-store', headers }),
          fetch(`${API_URL}/api/me/usage`, { cache: 'no-store', headers }),
        ]);

        if (!runRes.ok) {
          const body = await runRes.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error || `Error ${runRes.status}`);
        }

        if (!cancelled) {
          setRun((await runRes.json()) as PortalRunDetail);
          setUsage(usageRes.ok ? ((await usageRes.json()) as UsageResponse) : null);
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

    const competitors = new Map<string, { name: string; appearances: number; reasons: string[] }>();
    for (const prompt of prompts) {
      for (const entry of top3Entries(prompt.top3Json)) {
        if (isBrandEntry(entry.name, run.brand.name, aliases)) continue;
        if (`${entry.type}`.toLowerCase() !== 'competitor') continue;
        const key = normalizeName(entry.name);
        const current = competitors.get(key) || { name: entry.name, appearances: 0, reasons: [] };
        current.appearances += 1;
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
        return {
          id: prompt.id,
          score,
          label: prompt.prompt?.category?.name || intention?.label || prompt.prompt?.name || 'Oportunidad de visibilidad',
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
      competitors: Array.from(competitors.values()).sort((a, b) => b.appearances - a.appearances).slice(0, 8),
      intentionScores: Array.from(intentionScores.values()).map((i) => ({
        label: i.label,
        score: Math.round(i.scores.reduce((a, b) => a + b, 0) / Math.max(i.scores.length, 1)),
        weight: i.weight,
      })),
      opportunities,
    };
  }, [run]);

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    (async () => {
      try {
        const token = typeof window !== 'undefined' ? sessionStorage.getItem(TOKEN_KEY) : null;
        if (!token) return;
        const res = await fetch(`${API_URL}/api/reports/app/reports/${encodeURIComponent(runId)}/engines`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
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

  async function generateEngines(targets: EngineKey[]) {
    if (targets.length === 0) return;
    setBusyEngines((prev) => Array.from(new Set([...prev, ...targets])));
    setEngineError(null);
    try {
      const token = typeof window !== 'undefined' ? sessionStorage.getItem(TOKEN_KEY) : null;
      if (!token) {
        setEngineError('No hay sesión activa.');
        return;
      }
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      const postRes = await fetch(`${API_URL}/api/reports/app/reports/${encodeURIComponent(runId)}/engines`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ engines: targets }),
      });
      const postBody = (await postRes.json().catch(() => ({}))) as { error?: string };
      if (!postRes.ok) throw new Error(postBody.error || 'No se pudo iniciar el análisis por motor.');

      const deadline = Date.now() + 4 * 60 * 1000;
      const poll = async (): Promise<void> => {
        const res = await fetch(`${API_URL}/api/reports/app/reports/${encodeURIComponent(runId)}/engines`, {
          cache: 'no-store',
          headers,
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

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
          <p className="text-sm text-slate-600">Armando tu Plan Conquistar...</p>
        </div>
      </main>
    );
  }

  if (error || !run || !analysis) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-2xl rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-rose-700">{error || 'No se pudo cargar el reporte.'}</p>
          <Link href="/portal-crecimiento" className="mt-4 inline-flex text-sm font-semibold text-violet-700 hover:underline">
            Volver al portal
          </Link>
        </div>
      </main>
    );
  }

  const premiumBase = `/portal-crecimiento/reporte/${runId}/premium`;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-700 via-violet-600 to-indigo-700 p-7 text-white shadow-xl sm:p-10">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-xs font-semibold ring-1 ring-white/20">
                <Trophy className="h-4 w-4" />
                Plan Conquistar ChatGPT en 90 días
              </div>
              <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
                Plan de acción para que {run.brand.name} gane visibilidad en motores de IA
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-violet-50 sm:text-base">
                Este reporte resume qué limita hoy tu presencia, contra quién estás compitiendo y qué acciones conviene ejecutar
                primero durante los próximos 90 días.
              </p>
            </div>
            <div className="rounded-2xl bg-white/12 p-4 text-right ring-1 ring-white/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-100">Plan activo</p>
              <p className="mt-1 text-lg font-bold">{usage?.planDisplay || 'Premium 90 días'}</p>
              <Link href={premiumBase} className="mt-3 inline-flex text-xs font-semibold text-white underline">
                Ver portal premium completo
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <MetricCard label="Cleexs Score" value={`${analysis.cleexsScore}`} hint="Indicador 0-100 de recomendación en IA." />
          <MetricCard label="Aparición Top 3" value={`${analysis.top3Rate}%`} hint="Prompts donde tu marca aparece en posiciones 1 a 3." />
          <MetricCard label="Mención de marca" value={`${analysis.mentionRate}%`} hint="Respuestas donde la IA menciona tu marca." />
          <MetricCard label="Posición #1" value={`${analysis.top1Rate}%`} hint="Prompts donde tu marca aparece primera." />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {(() => {
            const extraEngines: EngineKey[] = ['gemini', 'claude', 'perplexity'];
            const isAvailable = (engine: EngineKey) =>
              !engineData || engineData.engines.some((e) => e.engine === engine);
            const entryOf = (engine: EngineKey) => engineData?.engines.find((e) => e.engine === engine);
            const isDone = (engine: EngineKey) => {
              const entry = entryOf(engine);
              return entry?.status === 'completed' && entry.score != null;
            };
            const pendingTargets = extraEngines.filter(
              (engine) => isAvailable(engine) && !isDone(engine) && !busyEngines.includes(engine)
            );

            const cards: Array<{ key: string; score: number | null; status: string }> = [
              { key: 'chatgpt', score: engineData?.chatgpt.score ?? analysis.cleexsScore, status: 'completed' },
            ];
            for (const engine of extraEngines) {
              const entry = entryOf(engine);
              cards.push({ key: engine, score: entry?.score ?? null, status: entry?.status ?? 'not_started' });
            }

            return (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <SectionTitle
                    icon={Gauge}
                    title="Cleexs Score por motor"
                    desc="ChatGPT sale de tu corrida. Elegí con qué motores generar el score real: uno, varios o todos."
                  />
                  <button
                    type="button"
                    onClick={() => generateEngines(pendingTargets)}
                    disabled={pendingTargets.length === 0}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    Generar todos los pendientes
                  </button>
                </div>

                {engineError ? <p className="mb-3 text-sm text-amber-700">{engineError}</p> : null}

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {cards.map((card) => {
                    const inProgress = card.status === 'pending' || card.status === 'running';
                    const done = card.status === 'completed' && card.score != null;
                    const engineKey = card.key as EngineKey;
                    const isExtra = card.key !== 'chatgpt';
                    const busy = isExtra && busyEngines.includes(engineKey);
                    const available = !isExtra || isAvailable(engineKey);
                    return (
                      <div key={card.key} className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/70 p-4">
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
              </>
            );
          })()}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              icon={Users}
              title="Competidores que hoy capturan atención"
              desc="Ranking de competidores detectados en las respuestas de IA de esta corrida."
            />
            <div className="space-y-3">
              {analysis.competitors.length === 0 ? (
                <p className="text-sm text-slate-500">No se detectaron competidores con suficiente claridad en esta corrida.</p>
              ) : (
                analysis.competitors.map((competitor, idx) => (
                  <div key={competitor.name} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-900">
                        {idx + 1}. {competitor.name}
                      </p>
                      <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
                        {competitor.appearances} apariciones
                      </span>
                    </div>
                    {competitor.reasons[0] ? <p className="mt-2 text-sm text-slate-600">{competitor.reasons[0]}</p> : null}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <SectionTitle
              icon={BarChart3}
              title="Score por intención"
              desc="Dónde conviene empujar primero según las intenciones de búsqueda/recomendación."
            />
            <div className="space-y-3">
              {analysis.intentionScores.length === 0 ? (
                <p className="text-sm text-slate-500">Esta corrida no trae intenciones ponderadas parseables.</p>
              ) : (
                analysis.intentionScores.map((item) => (
                  <div key={item.label}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{item.label}</span>
                      <span className="font-semibold text-slate-900">{item.score}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-violet-500" style={{ width: `${Math.min(100, item.score)}%` }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            icon={Target}
            title="Las 20 oportunidades de mayor impacto"
            desc="Priorizadas desde los prompts con menor rendimiento: son las zonas donde mejorar puede mover más rápido tu score."
          />
          <div className="grid gap-3 md:grid-cols-2">
            {analysis.opportunities.map((opportunity, idx) => (
              <div key={opportunity.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">
                    {idx + 1}. {opportunity.label}
                  </p>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                    Score {opportunity.score}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{opportunity.action}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            icon={CalendarCheck}
            title="Plan de acción personalizado de 90 días"
            desc="La secuencia recomendada para transformar oportunidades en señales que los motores de IA puedan citar y recomendar."
          />
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: 'Días 1-30: Base de autoridad',
                items: ['Ordenar páginas clave', 'Crear FAQs por intención', 'Publicar comparativas contra competidores'],
              },
              {
                title: 'Días 31-60: Expansión de señales',
                items: ['Casos de uso y testimonios', 'Contenido para categorías débiles', 'Menciones externas y directorios relevantes'],
              },
              {
                title: 'Días 61-90: Medición y ajuste',
                items: ['Revisar prompts con peor score', 'Reforzar páginas que ya rankean', 'Preparar re-análisis del día 75'],
              },
            ].map((phase) => (
              <div key={phase.title} className="rounded-xl border border-violet-100 bg-violet-50/40 p-4">
                <h3 className="font-semibold text-slate-900">{phase.title}</h3>
                <ul className="mt-3 space-y-2">
                  {phase.items.map((item) => (
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

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionTitle
            icon={ClipboardCheck}
            title="Checklist de implementación"
            desc="Usalo como guía operativa para ejecutar el plan sin perder tiempo."
          />
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
      </div>
    </main>
  );
}
